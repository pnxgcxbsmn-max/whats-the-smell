import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import { LRUCache } from "lru-cache";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 5051;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // API ML API key for both Seedream (Comics) and GPT Image 1 (other categories)

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in api/.env");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in api/.env");
  console.error("⚠️  IMPORTANT: OPENAI_API_KEY must be a valid API ML API key (from aimlapi.com)");
  console.error("   Used for: bytedance/seedream-4-5 (Comics) and openai/gpt-image-1 (other categories)");
  process.exit(1);
}

console.log("✓ Using API ML API with model selection based on category");
console.log("  - Comics: bytedance/seedream-4-5 (no copyright restrictions)");
console.log("  - Others: openai/gpt-image-1");
console.log("✓ Using Seedream 4.5 for Comics | Using OpenAI gpt-image-1 for other categories");

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carpeta Frontend (F mayúscula)
const FRONTEND_DIR = path.join(__dirname, "..", "Frontend");

// OPTIMIZATION: Enable GZIP compression for all responses
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(cors({ origin: true }));
app.use(express.json({ limit: "5mb" }));

// OPTIMIZATION: Static files with aggressive caching headers
app.use(express.static(FRONTEND_DIR, {
  maxAge: '0',
  etag: false,
  lastModified: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.get("/health", (req, res) => res.json({ ok: true }));

async function safeJson(r) {
  try {
    return await r.json();
  } catch {
    return {};
  }
}

/* ========================= CACHES ========================= */
// Cache para imágenes solamente (mantener este)
const imageCache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 60 * 24 * 14, // 14 días
});

// Cache para respuestas (respuestas en EN y ES)
const responseCache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 60 * 24 * 30, // 30 días
});

const inFlightImages = new Map();
const inFlightResponses = new Map();
const feedbackEntries = [];
const feedbackRateLimit = new Map();
const FEEDBACK_MAX_PER_WINDOW = 10;
const FEEDBACK_WINDOW_MS = 60 * 60 * 1000;
const MAX_FEEDBACK_SCREENSHOT = 2_000_000; // ~1.5MB base64

// Carpeta para guardar y servir imágenes generadas
const GENERATED_DIR = path.join(FRONTEND_DIR, "generated");
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });

// Carpeta para respuestas cacheadas
const CACHE_DIR = path.join(FRONTEND_DIR, "cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// Archivos de persistencia
const CHAR_INDEX_FILE = path.join(CACHE_DIR, "character-index.json");
const RESPONSE_CACHE_FILE = path.join(CACHE_DIR, "responses.json");

// Índice de nombres: mapa de normalized → nombre oficial de ficha
let characterIndex = {};
// Cache de respuestas: { "ficha-name||en": "textEn", "ficha-name||es": "textEs" }
let persistedResponses = {};

// Cargar datos persistidos
function loadPersistedData() {
  try {
    if (fs.existsSync(CHAR_INDEX_FILE)) {
      characterIndex = JSON.parse(fs.readFileSync(CHAR_INDEX_FILE, "utf8"));
      console.log(`Loaded character index: ${Object.keys(characterIndex).length} entries`);
    }
    if (fs.existsSync(RESPONSE_CACHE_FILE)) {
      persistedResponses = JSON.parse(fs.readFileSync(RESPONSE_CACHE_FILE, "utf8"));
      console.log(`Loaded response cache: ${Object.keys(persistedResponses).length} entries`);
    }
  } catch (e) {
    console.error("Error loading persisted data:", e.message);
  }
}

// Guardar datos persistidos
function savePersistedData() {
  try {
    fs.writeFileSync(CHAR_INDEX_FILE, JSON.stringify(characterIndex, null, 2), "utf8");
    fs.writeFileSync(RESPONSE_CACHE_FILE, JSON.stringify(persistedResponses, null, 2), "utf8");
  } catch (e) {
    console.error("Error saving persisted data:", e.message);
  }
}

function canSubmitFeedback(ip) {
  const safeIp = String(ip || "unknown");
  const now = Date.now();
  const bucket = feedbackRateLimit.get(safeIp) || {
    count: 0,
    reset: now + FEEDBACK_WINDOW_MS,
  };

  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + FEEDBACK_WINDOW_MS;
  }

  if (bucket.count >= FEEDBACK_MAX_PER_WINDOW) {
    feedbackRateLimit.set(safeIp, bucket);
    return false;
  }

  bucket.count += 1;
  feedbackRateLimit.set(safeIp, bucket);
  return true;
}

// Registrar nombre oficial de personaje
function registerCharacter(normalizedSearchName, officialCharName) {
  characterIndex[normalizedSearchName] = officialCharName;
  savePersistedData();
}

// Obtener nombre oficial de ficha desde búsqueda
function getOfficialCharacterName(searchName) {
  const normalized = normalizeCharacterName(searchName);
  return characterIndex[normalized] || searchName;
}

// Guardar respuesta en cache persistido
function setCachedResponse(charName, lang, text) {
  const key = `${charName}||${lang}`;
  persistedResponses[key] = text;
  savePersistedData();
}

// Obtener respuesta del cache persistido
function getCachedResponse(charName, lang) {
  const key = `${charName}||${lang}`;
  return persistedResponses[key] || null;
}

// Cargar datos al iniciar
loadPersistedData();

function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

function normalizeLang(x) {
  const v = String(x || "").toLowerCase();
  return v.startsWith("es") ? "es" : "en";
}

function normKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Normalizar nombre de personaje: reconoce variaciones (Goku = Son Goku, Uchiha Sasuke = Sasuke Uchiha)
function normalizeCharacterName(name) {
  let normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^(son|dr\.?|mr\.?|miss|mrs\.?|master|saint|god|demon|angel|prince|princess|king|queen)\s+/i, "")
    .replace(/\s+(jr|sr|iii|ii|i)$/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();

  // Si hay 2 palabras, ordenarlas alfabéticamente para que "sasuke uchiha" = "uchiha sasuke"
  const words = normalized.split(/\s+/);
  if (words.length === 2) {
    words.sort();
    normalized = words.join(" ");
  }

  return normalized || "unknown";
}

function clampStr(s, max = 200) {
  s = String(s || "");
  return s.length > max ? s.slice(0, max) : s;
}

// Normalizar nombre de archivo: convertir caracteres especiales a guiones
function sanitizeFilename(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// Extraer nombre oficial de la ficha generada
function extractCharacterNameFromSheet(text) {
  const text_str = String(text || "");
  if (!text_str) return null;
  
  // Buscar "Name: ..." o "Nombre: ..." (multiline)
  const nameMatch = text_str.match(/^(?:Name|Nombre):\s*(.+?)(?:\n|$)/im);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    return name && name.length > 0 ? name : null;
  }
  
  return null;
}

// Utility: Image processing helper - optimize for WebP & size
async function optimizeImage(buffer, maxWidth = 512, quality = 75) {
  // Optimization disabled - sharp dependency removed for Railway compatibility
  // Simply return the original buffer
  if (!buffer || buffer.length === 0) {
    throw new Error("Empty buffer");
  }
  console.log(`AI-Image: Image optimization skipped (sharp not available) - returning original buffer`);
  return buffer;
}

// Utility: Image processing helper (kept for future use)
async function cropWatermark(buffer) {
  // Image cropping disabled - sharp dependency removed
  // Simply return the original buffer
  console.log(`AI-Image: Image cropping skipped (sharp not available) - returning original buffer`);
  return buffer;
}


function buildImageKey({ name, category, style, universe = "", providerHint = "" }) {
  // Incrementa v1 → v2 cuando cambies el prompt/estilo global de imágenes
  // Usa nombre normalizado para reconocer variaciones (Goku = Son Goku)
  const v = "v2";
  const normalizedName = normalizeCharacterName(name);
  const univHash = universe ? sha1(universe).slice(0, 8) : "nouniv";
  return `img::${v}::${normalizedName}::${normKey(category || "any")}::${normKey(style || "anime")}::${univHash}::${normKey(
    providerHint
  )}`;
}

function pickExt(contentType) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return "png";
}

async function fetchImageBuffer(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let needsAuth = false;
    try {
      const parsed = new URL(String(url));
      needsAuth = parsed.hostname.includes("aimlapi.com");
    } catch {
      needsAuth = false;
    }

    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "whats-the-smell/1.0",
        ...(needsAuth && OPENAI_API_KEY ? { "Authorization": `Bearer ${OPENAI_API_KEY}` } : {}),
      },
    });
    if (!r.ok) throw new Error(`Upstream HTTP ${r.status}`);
    const ct = r.headers.get("content-type") || "";
    const ab = await r.arrayBuffer();
    const buf = Buffer.from(ab);
    // Evita "placeholders" o respuestas inválidas
    if (buf.length < 20_000) throw new Error("Image too small (likely invalid)");
    return { buf, contentType: ct };
  } finally {
    clearTimeout(t);
  }
}

function buildImagePrompt(name, category, style, universe = "") {
  const base = String(name || "").trim();
  const univ = String(universe || "").trim();
  const cat = String(category || "").trim();

  // Template mejorado con datos de ficha
  const prompt = `Ultra-accurate canonical character illustration.

Character identity:
Name: ${base}
Universe: ${univ || "Unknown"}
Category/Role: ${cat || "Character"}

Identity rules (MANDATORY):
- The character must match the official canonical appearance from the specified universe
- Facial structure, hairstyle, clothing, age, and proportions must align with official source material
- No redesigns, no reinterpretations, no alternate universe versions
- Maintain original ethnicity, gender, and physical traits
- The character must be immediately recognizable to fans of the universe

Style:
- Official illustration style consistent with the source universe
- Clean, professional line art
- High-quality shading and accurate color palette
- Not realistic unless the universe is realistic
- Not westernized unless the universe is western

Composition:
- Centered portrait (bust or half-body)
- Neutral or universe-consistent background
- Clear facial visibility

Strictly prohibited:
- Fan art reinterpretations
- Style fusion with other franchises
- Costume changes
- Age changes
- Hair or eye color variation
- Accessories not present in canon

Quality:
- Masterpiece
- High fidelity
- Consistent anatomy`;

  return prompt;
}

async function generateImageWithOpenAI({ prompt, seed = 42, width = 768, height = 768, category = "any" }) {
  // Model selection based on category recommendations
  const categoryLower = String(category || "").toLowerCase();
  
  // Determine best model for category - use exact API names
  let primaryModel, fallbackModel;
  
  if (categoryLower.includes("anime") || categoryLower.includes("manga")) {
    primaryModel = "openai/gpt-image-1";  // GPT Image 1.5 - best for anime (strong prompt adherence)
    fallbackModel = "bytedance/seedream-4-5";
  } else if (categoryLower.includes("game") || categoryLower.includes("video")) {
    primaryModel = "bytedance/seedream-4-5";
    fallbackModel = "openai/gpt-image-1";
  } else if (categoryLower.includes("comic")) {
    primaryModel = "openai/gpt-image-1";
    fallbackModel = "bytedance/seedream-4-5";
  } else if (categoryLower.includes("book")) {
    primaryModel = "openai/gpt-image-1";
    fallbackModel = "bytedance/seedream-4-5";
  } else if (categoryLower.includes("tv") || categoryLower.includes("show")) {
    primaryModel = "bytedance/seedream-4-5";
    fallbackModel = "openai/gpt-image-1";
  } else if (categoryLower.includes("movie") || categoryLower.includes("film")) {
    primaryModel = "openai/gpt-image-1";
    fallbackModel = "bytedance/seedream-4-5";
  } else if (categoryLower.includes("folklore") || categoryLower.includes("myth")) {
    primaryModel = "bytedance/seedream-4-5";
    fallbackModel = "openai/gpt-image-1";
  } else {
    // Default - anime-style by default
    primaryModel = "openai/gpt-image-1";
    fallbackModel = "bytedance/seedream-4-5";
  }

  const url = "https://api.aimlapi.com/v1/images/generations";
  let models = [primaryModel, fallbackModel];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`AI-Image: Intentando con modelo ${model} para categoría ${category}...`);

      // Sanitize prompt - ensure it's valid UTF-8 and doesn't have issues
      const sanitizedPrompt = String(prompt || "")
        .trim()
        .substring(0, 2000); // Limit to 2000 chars

      const body = {
        model: model,
        prompt: sanitizedPrompt,
      };

      console.log("AI-Image: Body enviado:", JSON.stringify({ model, promptLength: sanitizedPrompt.length }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.warn(`AI-Image: Modelo ${model} falló (${response.status}):`, errText.slice(0, 300));
        lastError = new Error(`${model} error: ${response.status} - ${errText.slice(0, 100)}`);
        continue; // Try next model
      }

      const data = await response.json().catch(() => ({}));
      console.log("AI-Image: Respuesta exitosa de", model);

      // Format: data.data[0].url or data.images[0].url
      const first = data?.data?.[0] || data?.images?.[0];

      if (!first) {
        console.warn(`AI-Image: Sin imagen en respuesta de ${model}:`, JSON.stringify(data).slice(0, 250));
        lastError = new Error(`${model}: No image in response`);
        continue; // Try next model
      }

      const urlOut = first?.url || (typeof first === "string" ? first : null);
      if (urlOut) {
        console.log("AI-Image: URL obtenida de", model, ":", String(urlOut).slice(0, 50) + "...");
        return { kind: "url", value: String(urlOut) };
      }

      const b64 = first?.b64_json || first?.b64;
      if (b64) {
        const cleaned = String(b64).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
        console.log("AI-Image: Base64 obtenido de", model);
        return { kind: "b64", value: cleaned, contentType: "image/png" };
      }

      console.warn(`AI-Image: Sin payload válido en ${model}:`, JSON.stringify(first).slice(0, 250));
      lastError = new Error(`${model}: No valid payload`);
      continue; // Try next model
    } catch (err) {
      console.warn(`AI-Image: Error con ${model}:`, err.message);
      lastError = err;
      continue; // Try next model
    }
  }

  // All models failed
  console.error("AI-Image: Todos los modelos fallaron:", lastError?.message);
  throw lastError || new Error("All image models failed");
}

/* ========================= Gemini: Generación EN (canónica) ========================= */
async function geminiGenerateSmellEN({ character, category }) {
  const charName = clampStr(character, 120);
  const cat = clampStr(category || "any", 40);

  const system = [
    "You are an expert fragrance analyst and storyteller who creates vivid olfactory experiences.",
    "",
    "CRITICAL: If a character name could refer to multiple characters, ALWAYS choose the most popular/iconic version.",
    "Examples:",
    "- 'Gohan' → Son Gohan from Dragon Ball Z (not other Gohans)",
    "- 'Naruto' → Naruto Uzumaki from Naruto (not other Narutos)",
    "- 'Goku' → Son Goku from Dragon Ball Z (most popular)",
    "",
    "CORE PRINCIPLE: Do NOT list data. Build a SPECIFIC, UNIQUE sensory experience tied to this exact character.",
    "Characters DO NOT smell like commercial perfumes. They smell like REAL THINGS rooted in their story and environment.",
    "Each section must be unique, specific to THIS character, and NOT repeat information from other sections.",
    "",
    "OUTPUT STRUCTURE (EXACT FORMAT WITH LABELS):",
    "",
    "1. MAIN DESCRIPTION (2–3 sentences)",
    "   Start: \"[Character Name] emanates an aroma...\"",
    "   - VERY SPECIFIC to this character's story, personality, or abilities",
    "   - Include sensory details that connect to their unique traits",
    "   - Example: 'Son Gohan emanates the warmth of earth-soaked soil after rain, layered with the faint sweetness of unripe fruit hanging in humid air. A faint undertone of bookbinding leather suggests hidden scholarly depth.'",
    "   - NEVER generic or technical",
    "",
    "2. Aromatic Profile:",
    "   - 2–3 lines, practical but specific summary",
    "   - Connect to CHARACTER-SPECIFIC traits, environment, or story",
    "   - Do NOT repeat main description",
    "",
    "3. Aroma Essence:",
    "   - 2–3 sentences, CHARACTER-SPECIFIC sensory transmission",
    "   - What this aroma conveys about THIS character at a sensory level",
    "   - Do NOT repeat other sections",
    "",
    "4. Character Soul:",
    "   - 2–3 sentences, CHARACTER-SPECIFIC personality reflection",
    "   - How this aroma reflects THEIR UNIQUE essence/personality/powers",
    "   - Do NOT repeat other sections",
    "",
    "5. Scent Heritage:",
    "   - 2–3 sentences, CHARACTER-SPECIFIC origin/lore perspective",
    "   - Where this aroma connects to THEIR SPECIFIC universe/story/home",
    "   - Environmental or lore-based origin tied to THIS character",
    "   - Do NOT repeat other sections",
    "",
    "6. Olfactory Notes:",
    "   - Exactly 4 comma-separated real fragrance notes",
    "   - Only ingredient names, no narrative",
    "",
    "7. Fragrance Match:",
    "   - ONE real existing fragrance brand and name that BEST captures THIS character's essence",
    "   - Example: Dior Sauvage or Chanel No. 5",
    "",
    "8. Aromatic Curiosity:",
    "   - One VERY SPECIFIC insight connecting THIS character's aroma to their universe/lore/abilities",
    "   - Must be UNIQUE to this specific character, not generic",
    "   - 1–2 sentences, memorable and specific",
    "   - Examples:",
    "     - For Gohan: 'In Dragon Ball Z, Gohan's hidden potential manifests through his aura—his scent reveals an underlying ferocity beneath his scholarly calm, much like volcanic earth cooling under gentle rain.'",
    "     - For Goku: 'In Dragon Ball Z universe, warriors emit ki energy; Goku's aroma reflects his pure Saiyan nature and honest spirit—crystalline mountain air that transforms during fierce training into something electric and primal.'",
    "",
    "CHARACTER SHEET SECTION (following the exact labels below):",
    "",
    "Name:",
    "   - Character's full name or alias (THIS specific character)",
    "",
    "Universe:",
    "   - The SPECIFIC NAME of the series/anime/manga/game/film/universe the character comes from",
    "   - Examples: 'Dragon Ball Z', 'Naruto', 'One Piece', 'The Legend of Zelda', 'Marvel Universe', 'Attack on Titan'",
    "   - CRITICAL: DO NOT put the category here - put the actual series/game/universe name",
    "",
    "Category:",
    "   - Classification: Hero, Villain, Anti-hero, Mystical, etc.",
    "   - This is where you classify the character's role/type",
    "",
    "Aroma Type:",
    "   - Classification: Fresh, Oriental, Woody, Floral, Citrus, etc.",
    "",
    "Main Sensation:",
    "   - The PRIMARY sensory feeling (2–3 words)",
    "   - Example: Electric, Grounded, Ethereal",
    "",
    "Olfactory Style:",
    "   - Adjective describing the fragrance approach",
    "   - Example: Minimalist, Intense, Playful, Intricate",
    "",
    "Last Impression:",
    "   - What the aroma leaves behind (2–3 words)",
    "   - Example: Lingering warmth, Bold statement, Ephemeral magic",
    "",
    "GENDER RULE:",
    "- Male → masculine or unisex",
    "- Female → feminine",
    "- Ambiguous → unisex",
    "",
    "TONE: Confident, vivid, immersive. REALISTIC, CHARACTER-SPECIFIC sensory experience first.",
    "",
    "CRITICAL: Do NOT add headers, emojis, explanations, or extra lines beyond the structure above.",
  ].join("\n");

  const user = [
    `Character: ${charName}`,
    `Context/Category: ${cat}`,
    "",
    "Based on the character name and any context provided:",
    "1. Identify which series/anime/manga/game/film universe this character comes from (e.g., 'Dragon Ball Z', 'Naruto', 'One Piece')",
    "2. Generate a complete aromatic experience profile following the exact structure above",
    "3. In the Universe field, put the SPECIFIC NAME of the series/universe (not generic categories)",
    "4. Make EVERY section SPECIFIC to this character—not generic.",
  ].join("\n");

  const resp = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
    generationConfig: {
      temperature: 0.75,
      topP: 0.9,
      maxOutputTokens: 650,
    },
  });

  return String(resp?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

/* ========================= Gemini: Normalización de búsqueda (reconocer variaciones) ========================= */
async function geminiNormalizeCharacterSearch(userInput, category) {
  const input = clampStr(userInput, 120);
  const cat = clampStr(category || "any", 40);

  const system = [
    "You are an expert character recognition AI for anime, manga, games, comics, and pop culture.",
    "",
    "Your job: Given a user's input (which may contain typos, name variations, nicknames, or grammatical errors),",
    "determine the MOST LIKELY character they're searching for and normalize their name to the official 'Ficha' format.",
    "",
    "CRITICAL RULES:",
    "- If input could match multiple characters, choose the most popular/iconic one",
    "- Output ONLY the official character name in proper format (e.g., 'Naruto Uzumaki', 'Son Goku')",
    "- Include first name AND last name if the character has both (e.g., 'Naruto Uzumaki' not just 'Naruto')",
    "- Do NOT include titles, ranks, or honorifics (no 'Master', 'Lord', 'Dr.', etc.)",
    "- Do NOT output anything else—no explanations, no alternatives, no commentary",
    "- If you cannot identify the character, output exactly: UNKNOWN",
    "",
    "EXAMPLES:",
    "- Input: 'goku' → Output: 'Son Goku'",
    "- Input: 'uzumaki naruto' → Output: 'Naruto Uzumaki'",
    "- Input: 'naruto' → Output: 'Naruto Uzumaki'",
    "- Input: 'naruto uzumaki' → Output: 'Naruto Uzumaki'",
    "- Input: 'sasuke' → Output: 'Sasuke Uchiha'",
    "- Input: 'uchiha sasuke' → Output: 'Sasuke Uchiha'",
    "- Input: 'gohan' → Output: 'Son Gohan'",
    "- Input: 'gohan son' → Output: 'Son Gohan'",
  ].join("\n");

  const user = [
    `User input: ${input}`,
    `Category/Context: ${cat}`,
    "",
    "Respond with ONLY the normalized character name in proper 'Ficha' format (first name + last name if applicable).",
    "If you cannot identify, respond with exactly: UNKNOWN",
  ].join("\n");

  try {
    const resp = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
    });

    const normalized = String(resp?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    
    if (!normalized || normalized === "UNKNOWN") {
      console.log(`Normalization failed for: "${input}" → returning original input`);
      return input;
    }

    console.log(`Normalization: "${input}" → "${normalized}"`);
    return normalized;
  } catch (err) {
    console.error("Normalization error:", err.message);
    return input; // Si falla, devuelve el input original
  }
}

/* ========================= Gemini: Traducción interpretada (preserva formato) ========================= */
async function geminiTranslate(text, target) {
  const tgt = normalizeLang(target);
  const targetLang = tgt === "es" ? "Spanish" : "English";

  const system = [
    "You are a professional translator and localization specialist.",
    "Produce natural, idiomatic translation with identical meaning (not literal word-for-word).",
    "Do NOT add any commentary, metadata, or extra lines.",
    "Preserve the exact line structure and line breaks.",
    "CRITICAL: Fragrance notes should be translated into meaningful ingredient names in the target language.",
    "",
    "CRITICAL TRANSLATION RULES:",
    "- If translating to Spanish:",
    "  'Olfactory Notes:' → 'Notas Olfativas:'",
    "  'Fragrance Match:' → 'Perfume Sugerido:'",
    "  'Aromatic Curiosity:' → 'Curiosidad Aromática:'",
    "  'Aroma Essence:' → 'Esencia Aromática:'",
    "  'Character Soul:' → 'Alma del Personaje:'",
    "  'Scent Heritage:' → 'Herencia Aromática:'",
    "  'Aromatic Profile:' → 'Perfil Aromático:'",
    "  'MAIN DESCRIPTION:' → 'DESCRIPCIÓN PRINCIPAL:'",
    "",
    "  CHARACTER SHEET labels:",
    "  'Name:' → 'Nombre:'",
    "  'Universe:' → 'Universo:'",
    "  'Category:' → 'Categoría:'",
    "  'Aroma Type:' → 'Tipo de Aroma:'",
    "  'Main Sensation:' → 'Sensación Principal:'",
    "  'Olfactory Style:' → 'Estilo Olfativo:'",
    "  'Last Impression:' → 'Impresión Final:'",
    "",
    "- If translating to English: (reverse the above translations)",
    "",
    "- NEVER translate brand/product names (e.g., 'Dior Sauvage' stays 'Dior Sauvage')",
    "- Translate fragrance ingredient notes contextually (e.g., 'bergamota' → 'bergamot', 'cedro' → 'cedar')",
    "- Keep the exact structure and line breaks of the original text",
    "- For fragrance notes line: translate each note while preserving comma-separated format",
  ].join("\n");

  const user = `Target language: ${targetLang}\n\nTEXT:\n${text}`;

  const resp = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 650,
    },
  });

  return String(resp?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

/* ========================= API routes ========================= */
app.post("/api/smell", async (req, res) => {
  const startTime = Date.now();
  const timings = {};
  
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const category = String(req.body?.category || "any").trim();
    const requestedLang = normalizeLang(req.body?.lang || "en");
    const includeEs = Boolean(req.body?.includeEs);

    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    
    // Validate: Category must be specified (not "any")
    if (!category || category === "any") {
      return res.status(400).json({ error: "Category required" });
    }

    // 1) Normalizar búsqueda con Gemini - reconoce variaciones y errores gramaticales
    // Convierte "naruto", "uzumaki naruto", "naruto uzumaki" → "Naruto Uzumaki" (nombre oficial de Ficha)
    let formalCharacterName = await geminiNormalizeCharacterSearch(prompt, category);
    console.log(`Normalized: "${prompt}" → "${formalCharacterName}"`);
    
    // 2) Si Gemini devolvió UNKNOWN, usar la búsqueda original normalizada
    if (formalCharacterName === prompt) {
      const normalizedSearch = normalizeCharacterName(prompt);
      formalCharacterName = getOfficialCharacterName(normalizedSearch) || prompt;
      console.log(`Fallback to local: "${prompt}" → "${formalCharacterName}"`);
    }
    
    // 3) Registrar esta variación para búsquedas futuras
    registerCharacter(normalizeCharacterName(prompt), formalCharacterName);
    
    // 4) Buscar en cache usando el nombre oficial de Ficha
    let textEn = getCachedResponse(formalCharacterName, "en");
    let cached = false;

    if (textEn) {
      cached = true;
      timings.cache_hit = Date.now() - startTime;
      console.log("Smell: Resultado EN encontrado en cache persistido:", formalCharacterName);
    } else {
      // 5) Si no está en cache, generar con in-flight deduplication
      const cacheKeyEn = `${formalCharacterName}||en||${normKey(category)}`;
      
      if (inFlightResponses.has(cacheKeyEn)) {
        console.log("Smell: Esperando generación in-flight para:", prompt);
        textEn = await inFlightResponses.get(cacheKeyEn);
      } else {
        console.log("Smell: Generando respuesta para:", prompt);
        const inflight = (async () => {
          try {
            const out = await geminiGenerateSmellEN({ character: prompt, category });
            console.log("Gemini response length:", out ? out.length : 0);
            console.log("Gemini response preview:", out ? out.slice(0, 200) : "EMPTY");
            
            if (!out || out.length < 50) {
              throw new Error("Respuesta demasiado corta o vacía");
            }
            
            // Extraer nombre oficial de la ficha generada
            const sheetName = extractCharacterNameFromSheet(out);
            let finalName = formalCharacterName;
            
            if (sheetName && sheetName.length > 0) {
              // Usar el nombre extraído de la ficha
              finalName = sheetName;
              // Si es diferente al que teníamos, registrarlo
              if (finalName !== formalCharacterName) {
                registerCharacter(normalizeCharacterName(prompt), finalName);
                console.log(`Registered: "${prompt}" → "${finalName}"`);
              }
            }
            
            // Guardar en cache persistido con nombre de ficha
            setCachedResponse(finalName, "en", out);
            console.log("Smell: Respuesta generada y cacheada:", finalName);
            return out;
          } catch (genErr) {
            console.error("Smell: Error generando respuesta:", genErr.message);
            throw genErr;
          }
        })();

        inFlightResponses.set(cacheKeyEn, inflight);
        try {
          textEn = await inflight;
          timings.text_generation = Date.now() - startTime;
        } finally {
          inFlightResponses.delete(cacheKeyEn);
        }
      }
    }

    // Verificar que textEn no esté vacío
    if (!textEn || textEn.length < 50) {
      console.error("Smell: Respuesta inválida", {
        textEn: textEn ? textEn.slice(0, 100) : "EMPTY",
        length: textEn ? textEn.length : 0,
        cached,
      });
      return res.status(500).json({
        error: "Invalid response",
        details: `Generated text is empty or too short (${textEn ? textEn.length : 0} chars)`,
        cached,
        normalizedSearch,
      });
    }

    console.log("Smell: textEn generado correctamente", {
      length: textEn.length,
      preview: textEn.slice(0, 150),
    });

    // Extraer el nombre oficial de la ficha DEL TEXTO, sin importar si fue caché o generado
    const finalSheetName = extractCharacterNameFromSheet(textEn) || formalCharacterName;
    if (finalSheetName && finalSheetName !== formalCharacterName) {
      registerCharacter(normalizeCharacterName(prompt), finalSheetName);
      formalCharacterName = finalSheetName;
    }

    // OPTIMIZATION 2: Parallel generation of image and translation
    // Start image generation WITHOUT waiting (fires in background)
    const imagePromise = (async () => {
      const imageStart = Date.now();
      try {
        // Extract universe from the text if available
        const universeMatch = textEn.match(/Universe:\s*([^\n]+)/);
        const universe = universeMatch ? universeMatch[1].trim() : "";
        
        const imageParams = new URLSearchParams({
          name: formalCharacterName,
          category: category || "any",
          style: "anime",
          universe: universe
        });
        
        const imageUrl = await fetch(`http://localhost:${PORT}/api/ai-image?${imageParams.toString()}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }).then(r => r.json()).then(d => {
          // Cache the image URL with the response for future use
          if (d.url) {
            const imageTime = Date.now() - imageStart;
            console.log("Smell: Imagen generada exitosamente:", d.url, `(${imageTime}ms)`);
            timings.image_generation = imageTime;
            // Store image URL in response cache for quick reuse
            setCachedResponse(`${formalCharacterName}||image`, "en", d.url);
          }
          return d.url;
        }).catch(e => {
          console.warn("Parallel image generation failed:", e.message);
          return null;
        });
        
        return imageUrl;
      } catch (e) {
        console.warn("Image parallel generation error:", e.message);
        return null;
      }
    })();

    // Start translation WITHOUT waiting (fires in background)
    const translationPromise = (async () => {
      const translationStart = Date.now();
      try {
        let textEs = getCachedResponse(formalCharacterName, "es");
        const shouldHaveEs = requestedLang === "es" || includeEs;
        
        if (!textEs && shouldHaveEs) {
          console.log("Smell: Traduciendo a ES en paralelo:", formalCharacterName);
          textEs = await geminiTranslate(textEn, "es");
          const translationTime = Date.now() - translationStart;
          console.log("Smell: Traducción completada:", `(${translationTime}ms)`);
          timings.translation = translationTime;
          setCachedResponse(formalCharacterName, "es", textEs);
        } else if (textEs) {
          timings.translation_cached = Date.now() - translationStart;
        }
        
        return textEs || "";
      } catch (e) {
        console.error("Parallel translation error:", e.message);
        return "";
      }
    })();

    // Return the main response immediately with text
    // Image and translation will be available soon (can be fetched separately or bundled)
    const response = {
      text: textEn,
      textEn,
      textEs: "", // Will be filled via separate request or polling
      cached,
      sourceLang: "en",
      requestedLang,
      officialName: formalCharacterName,
      normalizedSearch: normalizeCharacterName(prompt),
      timings, // Include timing info in response
    };

    res.json(response);

    // Log parallel tasks completion (non-blocking)
    Promise.all([imagePromise, translationPromise]).then(([imgUrl, textEs]) => {
      const totalTime = Date.now() - startTime;
      console.log(`\n⏱️ TOTAL TIME for "${formalCharacterName}": ${totalTime}ms`);
      console.log("Timing breakdown:", timings);
      console.log(`Parallel generation complete | Image: ${imgUrl ? "Ready" : "Failed"} | Translation: ${textEs ? "Ready" : "N/A"}\n`);
    });
  } catch (e) {
    console.error("Smell endpoint error:", e.message);
    return res.status(500).json({
      error: "Failed to generate",
      details: String(e?.message || e),
    });
  }
});

/* ========================= Translation endpoint ========================= */
app.post("/api/translate", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const targetLang = normalizeLang(req.body?.lang || "es");
    const characterName = String(req.body?.character || "").trim();
    const category = String(req.body?.category || "any").trim();

    if (!text) return res.status(400).json({ error: "Missing text" });

    // Normalizar nombre para caché
    const normalizedName = characterName ? normalizeCharacterName(characterName) : "";
    const cacheKey = `resp::${targetLang}::${normalizedName}::${normKey(category)}`;

    // Buscar en caché
    let cached = responseCache.get(cacheKey);
    if (cached) {
      return res.json({ text: cached, fromCache: true });
    }

    // Si no está en caché, traducir
    const translated = await geminiTranslate(text, targetLang);
    responseCache.set(cacheKey, translated);

    return res.json({ text: translated, fromCache: false });
  } catch (e) {
    return res.status(500).json({
      error: "Translation failed",
      details: String(e?.message || e),
    });
  }
});

app.post("/api/feedback", (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (message.length < 5) {
    return res.status(400).json({ ok: false, error: "Message is required" });
  }

  const ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip;
  if (!canSubmitFeedback(ip)) {
    return res.status(429).json({ ok: false, error: "Feedback rate limit reached" });
  }

  const screenshotBase64 = typeof req.body?.screenshotBase64 === "string" ? req.body.screenshotBase64.trim() : null;
  if (screenshotBase64 && screenshotBase64.length > MAX_FEEDBACK_SCREENSHOT) {
    return res.status(413).json({ ok: false, error: "Screenshot too large" });
  }

  const requestedCategory = String(req.body?.category || "feedback").toLowerCase();
  const allowedCategories = new Set(["feedback", "bug", "idea", "other"]);
  const safeCategory = allowedCategories.has(requestedCategory) ? requestedCategory : "feedback";

  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `fb-${Date.now()}`,
    ts: Date.now(),
    ipHash: sha1(String(ip || "")),
    category: safeCategory,
    contact: String(req.body?.contact || "").trim().slice(0, 180),
    url: String(req.body?.url || "").trim().slice(0, 500),
    userAgent: String(req.body?.userAgent || "").trim().slice(0, 500),
    message: message.slice(0, 2000),
    screenshot: screenshotBase64 || null,
  };

  feedbackEntries.push(entry);
  if (feedbackEntries.length > 200) {
    feedbackEntries.shift();
  }

  console.log(`[feedback] ${entry.category} :: ${entry.message.slice(0, 120)}${entry.message.length > 120 ? "…" : ""}`);
  return res.json({ ok: true });
});

/* ========================= IA Image endpoint with Seedream 4.5 ========================= */
app.get("/api/ai-image", async (req, res) => {
  try {
    const name = String(req.query?.name || "").trim();
    const category = String(req.query?.category || "any").trim();
    const style = String(req.query?.style || "anime").trim();
    const universe = String(req.query?.universe || "").trim();

    if (!name) return res.status(400).json({ error: "Missing name" });

    const cacheKey = buildImageKey({ name, category, style, universe });

    // 1) Cache hit - verificar que el archivo físico existe
    const cached = imageCache.get(cacheKey);
    if (cached) {
      const cachedFile = path.join(GENERATED_DIR, path.basename(cached));
      if (fs.existsSync(cachedFile)) {
        console.log("AI-Image: Usando imagen en cache:", cached);
        return res.json({ url: cached, cached: true, provider: "cache" });
      } else {
        // El archivo fue borrado, eliminar del caché en memoria
        imageCache.delete(cacheKey);
        console.log("AI-Image: Archivo cacheado no existe, regenerando:", cached);
      }
    }

    // 1b) Verificar si el archivo ya existe físicamente (por si la memoria se limpió)
    // Si existe con el nombre normalizado, NO regenerar, solo devolver
    const ext = pickExt("image/png"); // por defecto PNG
    const sanitizedName = sanitizeFilename(name);
    const expectedFile = `${sanitizedName}.*`; // puede ser .png, .jpg, .webp
    const existingFiles = fs.readdirSync(GENERATED_DIR).filter(f => {
      const baseName = f.split('.').slice(0, -1).join('.');
      return baseName === sanitizedName;
    });
    
    if (existingFiles.length > 0) {
      const existingFile = existingFiles[0];
      const localUrl = `/generated/${existingFile}`;
      console.log("AI-Image: Archivo ya existe en disco, no regenerando:", localUrl);
      imageCache.set(cacheKey, localUrl); // Restaurar a memoria también
      return res.json({ url: localUrl, cached: true, provider: "disk" });
    }

    // 2) In-flight de-dupe
    if (inFlightImages.has(cacheKey)) {
      const url = await inFlightImages.get(cacheKey);
      return res.json({ url, cached: true, provider: "inflight" });
    }

    const job = (async () => {
      const prompt = buildImagePrompt(name, category, style, universe);
      const seed = Math.abs(parseInt(sha1(cacheKey).slice(0, 8), 16)) % 100000;
      
      console.log("AI-Image: Generando imagen para:", name, "con prompt:", prompt.slice(0, 100));
      
      const gen = await generateImageWithOpenAI({
        prompt,
        seed,
        width: 768,
        height: 768,
        category  // Pass category for validation
      });

      let buf, contentType;
      if (gen && gen.kind === "b64") {
        buf = Buffer.from(String(gen.value || ""), "base64");
        contentType = gen.contentType || "image/png";
        // Evita "placeholders" o respuestas inválidas
        if (!buf || buf.length < 20_000) throw new Error("Image too small (likely invalid)");
      } else {
        const urlToFetch = gen?.value || gen;
        let outFetch = await fetchImageBuffer(urlToFetch, 15000);
        buf = outFetch.buf;
        contentType = outFetch.contentType;
      }
      
      // Verify buffer is valid before optimization
      if (!buf || buf.length === 0) {
        throw new Error("Invalid image buffer received");
      }
      
      // OPTIMIZATION 1: Compress to WebP and resize
      console.log("AI-Image: Optimizando imagen a WebP (antes:", buf.length, "bytes)");
      try {
        buf = await optimizeImage(buf, 512, 75);
        console.log("AI-Image: Imagen lista para guardar");
      } catch (optErr) {
        console.warn("AI-Image: Optimization failed, using original:", optErr.message);
        // Continue with original buffer if optimization fails
      }
      
      const sanitizedName = sanitizeFilename(name);
      const file = `${sanitizedName}.webp`; // Always use WebP
      const abs = path.join(GENERATED_DIR, file);
      
      // CRÍTICO: Si el archivo ya existe, NO reemplazar - usar el que está en disco
      if (fs.existsSync(abs)) {
        console.log("AI-Image: Archivo ya existe en disco, NO se reemplaza:", file);
        const localUrl = `/generated/${file}`;
        return { localUrl, provider: "disk-existing" };
      }
      
      fs.writeFileSync(abs, buf);
      const localUrl = `/generated/${file}`;
      console.log("AI-Image: Imagen guardada en:", localUrl);
      return { localUrl, provider: "openai-dalle3" };
    })();

    // Guardar la promesa con catch para evitar unhandled rejections que pueden tumbar el proceso
    const inflight = job
      .then((x) => {
        inFlightImages.delete(cacheKey);
        return x.localUrl;
      })
      .catch((err) => {
        // Limpieza defensiva
        inFlightImages.delete(cacheKey);
        console.error("AI-Image job error:", err.message);
        throw err;
      });

    inFlightImages.set(cacheKey, inflight);

    try {
      const out = await job;
      imageCache.set(cacheKey, out.localUrl);
      return res.json({ url: out.localUrl, cached: false, provider: out.provider });
    } catch (jobErr) {
      inFlightImages.delete(cacheKey);
      const errorMsg = String(jobErr?.message || jobErr);
      console.error("AI-Image job execution failed:", errorMsg);
      
      // FALLBACK: Try to find any existing generated image to use as placeholder
      console.log("AI-Image: Intentando encontrar imagen cached como fallback...");
      const allGenerated = fs.readdirSync(GENERATED_DIR).filter(f => f.endsWith('.webp'));
      if (allGenerated.length > 0) {
        const fallbackFile = allGenerated[Math.floor(Math.random() * allGenerated.length)];
        const fallbackUrl = `/generated/${fallbackFile}`;
        console.log("AI-Image: Usando imagen cached como fallback:", fallbackUrl);
        return res.json({ 
          url: fallbackUrl, 
          cached: true, 
          provider: "fallback",
          warning: "Used cached image as fallback due to generation error"
        });
      }
      
      return res.status(500).json({
        error: "ai-image failed",
        details: errorMsg,
      });
    }
  } catch (e) {
    const errorMsg = String(e?.message || e);
    console.error("AI-Image endpoint error:", errorMsg);
    return res.status(500).json({
      error: "ai-image failed",
      details: errorMsg,
    });
  }
});

// ===== Admin: Clear cache =====
app.post("/admin/clear-cache", (req, res) => {
  try {
    // Clear in-memory caches
    responseCache.clear();
    imageCache.clear();
    inFlightResponses.clear();
    inFlightImages.clear();

    // Clear cache directory files
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        const filePath = path.join(CACHE_DIR, file);
        if (fs.lstatSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }
    }

    // Clear generated images directory
    if (fs.existsSync(GENERATED_DIR)) {
      const files = fs.readdirSync(GENERATED_DIR);
      for (const file of files) {
        const filePath = path.join(GENERATED_DIR, file);
        if (fs.lstatSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }
    }

    console.log("Cache cleared: in-memory caches, cache directory, and generated images");
    return res.json({ ok: true, message: "Cache cleared successfully" });
  } catch (e) {
    console.error("Clear cache error:", e.message);
    return res.status(500).json({
      error: "clear-cache failed",
      details: String(e?.message || e),
    });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`WTS running on http://localhost:${PORT}`);
  console.log(`Model: ${GEMINI_MODEL}`);
});


// PATCH: Visual prompt built from character sheet
