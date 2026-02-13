import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { LRUCache } from "lru-cache";
import { GoogleGenAI } from "@google/genai";
import { Resend } from "resend";
import {
  buildSmellKey,
  buildImageKey,
  getSeedSmell,
  getSeedImage,
  getSeedIndex,
  getPersistentJson,
  setPersistentJson,
  hasPersistentStore,
  getSeedStats,
} from "./storage.js";

const app = express();
const PORT = process.env.PORT || 5051;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // API ML API key for both Seedream (Comics) and GPT Image 1 (other categories)
const PROMPT_VERSION = process.env.PROMPT_VERSION || "v1";
const IMAGE_PROMPT_VERSION = process.env.IMAGE_PROMPT_VERSION || "v2";
const FEEDBACK_TO_EMAIL = process.env.FEEDBACK_TO_EMAIL || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FEEDBACK_FROM_EMAIL = process.env.FEEDBACK_FROM_EMAIL || "onboarding@resend.dev";
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in api/.env");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in api/.env");
  console.error("⚠️  IMPORTANT: OPENAI_API_KEY must be a valid API ML API key (from aimlapi.com)");
  console.error("   Used for: bytedance/seedream-4-5 (Comics) and openai/gpt-image-1-5 (other categories)");
  process.exit(1);
}

console.log("✓ Using API ML API with model selection based on category");
console.log("  - Comics: bytedance/seedream-4-5 (no copyright restrictions)");
console.log("  - Others: openai/gpt-image-1-5");
console.log("✓ Using Seedream 4.5 for Comics | Using OpenAI gpt-image-1-5 for other categories");

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carpeta Frontend (F mayúscula)
const FRONTEND_DIR = path.join(__dirname, "..", "Frontend");
const GENERATED_DIR = path.join(FRONTEND_DIR, "generated");

function existingPublicImageUrl(candidates = []) {
  for (const candidate of candidates) {
    const url = String(candidate || "").trim();
    if (!url) continue;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/")) {
      const diskPath = path.join(FRONTEND_DIR, url.replace(/^\//, ""));
      if (fs.existsSync(diskPath)) return url;
    }
  }
  return "";
}

function getCanonicalImageOverride(name) {
  const normalized = normalizeCharacterName(name);
  const overrides = {
    "joel": ["/generated/joel-miller.png"],
    "joel miller": ["/generated/joel-miller.png"],
    "naruto": [
      process.env.NARUTO_CANONICAL_IMAGE_URL || "",
      "/generated/naruto-uzumaki.png",
      "/generated/naruto-uzumaki.webp",
    ],
    "naruto uzumaki": [
      process.env.NARUTO_CANONICAL_IMAGE_URL || "",
      "/generated/naruto-uzumaki.png",
      "/generated/naruto-uzumaki.webp",
    ],
  };

  return existingPublicImageUrl(overrides[normalized] || []);
}

function toClientSafeErrorDetails(err) {
  const raw = String(err?.message || err || "");
  try {
    const parsed = JSON.parse(raw);
    const reason = String(parsed?.error?.details?.[0]?.reason || "").toUpperCase();
    const msg = String(parsed?.error?.message || "");
    if (reason === "API_KEY_INVALID" || /api key expired/i.test(msg)) {
      return {
        status: 503,
        error: "AI provider unavailable",
        details: "Local Gemini API key is invalid or expired. Update GEMINI_API_KEY in api/.env and restart backend.",
      };
    }
  } catch {}
  return {
    status: 500,
    error: "Failed to generate",
    details: raw,
  };
}

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
  maxAge: "1h",
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    const file = String(filePath || "").toLowerCase();
    if (file.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return;
    }
    if (/\.(js|css|png|jpg|jpeg|webp|svg|woff|woff2|ttf|ico)$/.test(file)) {
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=3600");
  }
}));

app.get("/health", async (req, res) => {
  const checks = {
    geminiConfigured: !!GEMINI_API_KEY,
    imageProviderConfigured: !!OPENAI_API_KEY,
    feedbackConfigured: !!(RESEND_API_KEY && FEEDBACK_TO_EMAIL),
    redis: {
      configured: hasPersistentStore(),
      ok: null,
    },
  };

  if (checks.redis.configured) {
    const marker = { ts: Date.now() };
    const key = "health::redis";
    const setResult = await setPersistentJson(key, marker);
    const getResult = await getPersistentJson(key);
    checks.redis.ok = !!(setResult && getResult && getResult.ts === marker.ts);
  }

  const ok =
    checks.geminiConfigured &&
    checks.imageProviderConfigured &&
    checks.feedbackConfigured &&
    checks.redis.configured &&
    checks.redis.ok !== false;

  return res.status(ok ? 200 : 503).json({ ok, checks });
});

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
const FEEDBACK_MAX_PER_WINDOW = 5;
const FEEDBACK_WINDOW_MS = 60 * 1000;
const MAX_FEEDBACK_SCREENSHOT = 2_000_000; // ~1.5MB base64

// Índice de nombres: mapa de normalized → nombre oficial de ficha (seed + runtime)
const seedIndex = getSeedIndex();
let characterIndex = { ...seedIndex };

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
}

// Obtener nombre oficial de ficha desde búsqueda
function getOfficialCharacterName(searchName) {
  const normalized = normalizeCharacterName(searchName);
  return characterIndex[normalized] || searchName;
}

function resolveCanonicalCharacterName(candidateName, fallbackName = "") {
  const direct = getOfficialCharacterName(candidateName);
  if (direct && direct !== candidateName) return direct;
  if (fallbackName) {
    const fromFallback = getOfficialCharacterName(fallbackName);
    if (fromFallback && fromFallback !== fallbackName) return fromFallback;
  }
  return candidateName;
}

async function getCachedSmell({ name, category, lang }) {
  const cacheKey = buildSmellKey({ name, category, lang, promptVersion: PROMPT_VERSION });

  // Prefer curated seed responses for known characters.
  // This prevents stale/generated persistent entries from overriding trusted seed content.
  const seedText = getSeedSmell(name, lang);
  if (seedText) {
    responseCache.set(cacheKey, seedText);
    return { text: seedText, cacheHit: true, source: "seed", cacheKey };
  }

  const memoryHit = responseCache.get(cacheKey);
  if (memoryHit) {
    return { text: memoryHit, cacheHit: true, source: "memory", cacheKey };
  }

  const persistent = await getPersistentJson(cacheKey);
  if (persistent && persistent.text) {
    responseCache.set(cacheKey, persistent.text);
    return { text: persistent.text, cacheHit: true, source: "persistent", cacheKey };
  }

  return { text: null, cacheHit: false, source: "miss", cacheKey };
}

async function setCachedSmell({ name, category, lang, text, provider }) {
  const cacheKey = buildSmellKey({ name, category, lang, promptVersion: PROMPT_VERSION });
  const payload = {
    text,
    name,
    category,
    lang,
    promptVersion: PROMPT_VERSION,
    provider: provider || "gemini",
    createdAt: Date.now(),
  };
  responseCache.set(cacheKey, text);
  await setPersistentJson(cacheKey, payload);
  return cacheKey;
}

// Seed stats (read-only) for observability
const seedStats = getSeedStats();
console.log(`Seed cache loaded: responses=${seedStats.responses}, index=${seedStats.index}`);

function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

function normalizeLang(x) {
  const v = String(x || "").toLowerCase();
  return v.startsWith("es") ? "es" : "en";
}

function normalizeCategoryId(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v || v === "any") return "any";
  if (v.includes("anime") || v.includes("manga")) return "anime";
  if (v.includes("game") || v.includes("videojuego") || v.includes("video game")) return "games";
  if (v.includes("movie") || v.includes("tv") || v.includes("pel") || v.includes("serie") || v.includes("show")) return "movies";
  if (v.includes("comic")) return "comics";
  if (v.includes("book") || v.includes("novel") || v.includes("libro")) return "books";
  if (v.includes("cartoon") || v.includes("caricatura")) return "cartoons";
  if (v.includes("myth") || v.includes("folklore") || v.includes("mito")) return "myth";
  return v;
}

const CHARACTER_NATURE_OVERRIDES = {
  "joel miller": "games",
};

const CHARACTER_DISPLAY_NAME_OVERRIDES = {
  "joel": "Joel Miller",
  "joel miller": "Joel Miller",
  "naruto": "Naruto Uzumaki",
  "naruto uzumaki": "Naruto Uzumaki",
};

function toCanonicalDisplayName(name) {
  const normalized = normalizeCharacterName(name);
  return CHARACTER_DISPLAY_NAME_OVERRIDES[normalized] || String(name || "").trim();
}

async function inferCharacterNatureCategory(name, requestedCategory) {
  const normalizedName = normalizeCharacterName(name);
  const req = normalizeCategoryId(requestedCategory);
  if (!normalizedName) return req;
  if (CHARACTER_NATURE_OVERRIDES[normalizedName]) {
    return CHARACTER_NATURE_OVERRIDES[normalizedName];
  }

  // Heuristic from known universe in curated seed text
  const seedEn = getSeedSmell(name, "en") || "";
  const universe = String((seedEn.match(/Universe:\s*([^\n]+)/i)?.[1] || "")).toLowerCase();
  if (universe) {
    if (
      universe.includes("last of us") ||
      universe.includes("resident evil") ||
      universe.includes("final fantasy") ||
      universe.includes("metal gear") ||
      universe.includes("zelda") ||
      universe.includes("halo")
    ) {
      return "games";
    }
    if (universe.includes("naruto") || universe.includes("dragon ball") || universe.includes("one piece") || universe.includes("bleach")) {
      return "anime";
    }
  }

  return req;
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

function buildImageCacheKey({ name, category, style, lang, universe }) {
  const normalizedName = normalizeCharacterName(name);
  const universeKey = universe ? sha1(universe).slice(0, 8) : "nouniv";
  return buildImageKey({
    name: `${normalizedName}::${universeKey}`,
    category,
    style,
    lang,
    promptVersion: IMAGE_PROMPT_VERSION,
  });
}

async function getCachedImage({ name, category, style, lang, universe }) {
  const cacheKey = buildImageCacheKey({ name, category, style, lang, universe });

  // Canonical single-profile image overrides
  const forced = getCanonicalImageOverride(name);
  if (forced) {
    imageCache.set(cacheKey, forced);
    return { imageUrl: forced, cacheHit: true, source: "seed", cacheKey, provider: "seed" };
  }

  // Prefer curated seed image first to avoid stale/wrong persistent image overrides.
  const seedName = toCanonicalDisplayName(name);
  const seedUrl = getSeedImage(seedName, lang) || getSeedImage(name, lang);
  if (seedUrl) {
    imageCache.set(cacheKey, seedUrl);
    return { imageUrl: seedUrl, cacheHit: true, source: "seed", cacheKey, provider: "seed" };
  }

  const memoryHit = imageCache.get(cacheKey);
  if (memoryHit) {
    return { imageUrl: memoryHit, cacheHit: true, source: "memory", cacheKey };
  }

  const persistent = await getPersistentJson(cacheKey);
  if (persistent && persistent.imageUrl) {
    imageCache.set(cacheKey, persistent.imageUrl);
    return { imageUrl: persistent.imageUrl, cacheHit: true, source: "persistent", cacheKey, provider: persistent.provider };
  }

  return { imageUrl: null, cacheHit: false, source: "miss", cacheKey };
}

async function setCachedImage({ cacheKey, imageUrl, provider }) {
  if (!cacheKey || !imageUrl) return null;
  const payload = {
    imageUrl,
    provider: provider || "unknown",
    promptVersion: IMAGE_PROMPT_VERSION,
    createdAt: Date.now(),
  };
  imageCache.set(cacheKey, imageUrl);
  await setPersistentJson(cacheKey, payload);
  return imageUrl;
}

async function storeImageBlob({ cacheKey, contentType, base64 }) {
  if (!cacheKey || !base64) return null;
  const imageId = sha1(cacheKey).slice(0, 16);
  const blobKey = `image-blob::${imageId}`;
  const payload = {
    contentType: contentType || "image/png",
    base64,
    createdAt: Date.now(),
  };
  await setPersistentJson(blobKey, payload);
  return { imageId, imageUrl: `/api/image/${imageId}` };
}

function buildImagePrompt(name, category, style, universe = "") {
  const base = String(name || "").trim();
  const univ = String(universe || "").trim();
  const cat = String(category || "").trim();
  const styleHint = String(style || "").trim().toLowerCase();
  const normalized = normalizeCharacterName(base);

  const VISUAL_BIBLE = {
    "captain america": {
      canon: "Steve Rogers",
      traits: [
        "adult athletic male, square jaw, clean-shaven",
        "blue tactical suit with white star centered on chest",
        "red-white-blue palette, combat straps and gloves",
        "short neat light-brown/blond hair",
      ],
      forbid: ["anime hairstyle", "wrong superhero logo", "casual civilian outfit"],
    },
    "choso": {
      canon: "Choso (Jujutsu Kaisen)",
      traits: [
        "pale skin, long dark hair tied back",
        "distinct dark blood-mark face paint across nose and under eyes",
        "black high-collar outfit with layered sleeves",
      ],
      forbid: ["muscular armor", "bright colorful shonen costume", "different face markings"],
    },
    "chozo": {
      canon: "Chozo race (Metroid)",
      traits: [
        "avian humanoid alien with beak-like facial structure",
        "ancient advanced armor motifs, metallic and ceremonial",
        "regal stoic posture",
      ],
      forbid: ["human face", "anime school uniform", "modern civilian clothes"],
    },
    "goku black": {
      canon: "Goku Black (Dragon Ball Super)",
      traits: [
        "spiky black Goku-style hair",
        "dark grey/black gi with high collar, red sash belt",
        "green Potara earring on one ear",
      ],
      forbid: ["orange gi", "Super Saiyan blond hair", "missing Potara earring"],
    },
    "link": {
      canon: "Link (The Legend of Zelda)",
      traits: [
        "young heroic elf-like male with pointed ears",
        "blond hair, blue/green iconic fantasy tunic style",
        "Hylian adventurer aesthetic",
      ],
      forbid: ["modern urban clothes", "firearms", "non-elf ears"],
    },
    "madara": {
      canon: "Madara Uchiha (Naruto)",
      traits: [
        "long wild black hair",
        "pale skin, stern mature face",
        "dark red segmented armor over shinobi clothing",
      ],
      forbid: ["short hair", "bright modern outfit", "child proportions"],
    },
    "steve hyuga": {
      canon: "Steve Hyuga (custom profile in this app)",
      traits: [
        "adult male with Byakugan-inspired pale eyes",
        "Hyuga-inspired ninja styling, calm and disciplined expression",
        "neutral dark shinobi attire with subtle modern touch",
      ],
      forbid: ["cartoon mascot style", "superhero armor", "random franchise symbols"],
    },
    "suguru geto": {
      canon: "Suguru Geto (Jujutsu Kaisen)",
      traits: [
        "long black hair tied in a half-up style",
        "elongated earlobes, calm intimidating expression",
        "dark monk-like robe outfit",
      ],
      forbid: ["short hair", "bright colorful battle suit", "modern casual hoodie"],
    },
    "tanjiro kamado": {
      canon: "Tanjiro Kamado (Demon Slayer)",
      traits: [
        "short dark burgundy hair, scar on forehead",
        "hanafuda earrings clearly visible",
        "green-black checkered haori over demon slayer uniform",
      ],
      forbid: ["different earring style", "missing forehead scar", "modern clothing"],
    },
    "toji fushiguro": {
      canon: "Toji Fushiguro (Jujutsu Kaisen)",
      traits: [
        "adult muscular male with short dark hair",
        "sharp eyes, faint facial scar detail",
        "tight black shirt / dark combat clothing",
      ],
      forbid: ["teen body proportions", "flashy fantasy armor", "bright hero costume"],
    },
    "naruto uzumaki": {
      canon: "Naruto Uzumaki",
      traits: [
        "spiky blond hair, blue eyes, whisker-like cheek marks",
        "orange-black shinobi outfit",
        "metal Leaf Village forehead protector with engraved leaf symbol",
      ],
      forbid: ["different hair color", "no whisker marks", "non-ninja modern outfit", "text or lettering on forehead protector"],
    },
    "naruto": {
      canon: "Naruto Uzumaki",
      traits: [
        "spiky blond hair, blue eyes, whisker-like cheek marks",
        "orange-black shinobi outfit",
        "metal Leaf Village forehead protector with engraved leaf symbol",
      ],
      forbid: ["different hair color", "no whisker marks", "non-ninja modern outfit", "text or lettering on forehead protector"],
    },
  };

  const anchor = VISUAL_BIBLE[normalized] || null;
  const styleGuideByCategory = {
    anime: "Official anime key visual style. Clean line art, cel shading, and anime-accurate facial proportions.",
    games: "Official game key art style. Production-quality rendering matching the game's canonical look.",
    movies: "Official source-medium style. Use live-action likeness for live-action franchises and animation style for animated franchises.",
    comics: "Official comic-book illustration style. Strong inks, graphic shading, and canonical costume rendering.",
    books: "Official book-cover illustration style consistent with the franchise adaptation language.",
    cartoons: "Official cartoon style from the original series. Preserve simplified shapes and palette logic.",
    myth: "Classical mythic illustration style with grounded historical motifs (not modern cosplay).",
  };
  const categoryKey = normalizeCategoryId(cat) || "any";
  const fallbackStyleGuide = styleGuideByCategory[categoryKey] || "Official franchise visual language matching the original source material.";
  const styleLine = styleHint && styleHint !== "auto" && styleHint !== "any"
    ? `Requested style mode: ${styleHint}. Keep identity 1:1 canonical while applying only this source-consistent rendering mode.`
    : `Style mode: auto by category (${categoryKey}). ${fallbackStyleGuide}`;

  const identityLines = anchor
    ? [
        `Canonical target: ${anchor.canon}`,
        "Mandatory visual anchors:",
        ...anchor.traits.map((t) => `- ${t}`),
        "Strict negatives:",
        ...anchor.forbid.map((f) => `- ${f}`),
      ].join("\n")
    : [
        "Canonical target: Use the single most iconic official design for this character.",
        "- Resolve to one franchise/universe only (no fusion or mixed continuities).",
        "- Prefer default/base form outfit and appearance (not event skins, alternates, or fan variants).",
        "- If universe is missing, infer the most globally recognized canonical universe from the name.",
      ].join("\n");

  // Template mejorado con datos de ficha
  const prompt = `Ultra-accurate canonical character illustration.

Character identity:
Name: ${base}
Universe: ${univ || "Unknown"}
Category/Role: ${cat || "Character"}
${identityLines}
${styleLine}

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
- Text, logos, watermarks, signatures, UI overlays in the image

Quality:
- Masterpiece
- High fidelity
- Consistent anatomy
- High facial likeness
- Instant recognizability for franchise fans`;

  return prompt;
}

async function generateImageWithOpenAI({ prompt, seed = 42, width = 768, height = 768, category = "any" }) {
  // Model selection based on category; use AIMLAPI model IDs
  const categoryLower = String(category || "").toLowerCase();

  function normalizeAIMLImageModelId(rawModel) {
    const model = String(rawModel || "").trim();
    const lower = model.toLowerCase();
    if (!lower) return "openai/gpt-image-1-5";
    if (lower === "gpt-image-1") return "openai/gpt-image-1";
    if (lower === "gpt-image-1-mini") return "openai/gpt-image-1-mini";
    if (lower === "gpt-image-1.5" || lower === "gpt-image-1-5") return "openai/gpt-image-1-5";
    return model;
  }

  // AIMLAPI currently exposes these IDs; adjust here if your account uses different ones
  const MODEL_OPENAI = normalizeAIMLImageModelId(
    process.env.IMG_MODEL_PRIMARY || "openai/gpt-image-1-5"
  );
  const MODEL_SEEDREAM = normalizeAIMLImageModelId(
    process.env.IMG_MODEL_FALLBACK || "bytedance/seedream-4-5"
  );

  let primaryModel, fallbackModel;

  if (categoryLower.includes("anime") || categoryLower.includes("manga")) {
    primaryModel = MODEL_OPENAI;
    fallbackModel = null;
  } else if (categoryLower.includes("game") || categoryLower.includes("video")) {
    primaryModel = MODEL_SEEDREAM;
    fallbackModel = MODEL_OPENAI;
  } else if (categoryLower.includes("comic")) {
    primaryModel = MODEL_OPENAI;
    fallbackModel = MODEL_SEEDREAM;
  } else if (categoryLower.includes("book")) {
    primaryModel = MODEL_OPENAI;
    fallbackModel = MODEL_SEEDREAM;
  } else if (categoryLower.includes("tv") || categoryLower.includes("show")) {
    primaryModel = MODEL_SEEDREAM;
    fallbackModel = MODEL_OPENAI;
  } else if (categoryLower.includes("movie") || categoryLower.includes("film")) {
    primaryModel = MODEL_OPENAI;
    fallbackModel = MODEL_SEEDREAM;
  } else if (categoryLower.includes("folklore") || categoryLower.includes("myth")) {
    primaryModel = MODEL_SEEDREAM;
    fallbackModel = MODEL_OPENAI;
  } else {
    primaryModel = MODEL_OPENAI;
    fallbackModel = MODEL_SEEDREAM;
  }

  const url = "https://api.aimlapi.com/v1/images/generations";
  let models = [primaryModel, fallbackModel].filter(Boolean);
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[IMG] intentando modelo=${model} categoria=${category}`);

      // Sanitize prompt - ensure it's valid UTF-8 and doesn't have issues
      const sanitizedPrompt = String(prompt || "")
        .trim()
        .substring(0, 2000); // Limit to 2000 chars

      const body = {
        model: model,
        prompt: sanitizedPrompt,
        response_format: "b64_json", // prefer base64 to avoid protected CDN URLs
      };

      console.log("[IMG] request", JSON.stringify({ model, promptLength: sanitizedPrompt.length }));

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
        console.warn(`[IMG] modelo=${model} status=${response.status} body=${errText.slice(0, 200)}`);
        lastError = new Error(`${model} error: ${response.status} - ${errText.slice(0, 100)}`);
        continue; // Try next model
      }

      const data = await response.json().catch(() => ({}));
      console.log(`[IMG] ok model=${model}`);

      // Format: data.data[0].url or data.images[0].url
      const first = data?.data?.[0] || data?.images?.[0];

      if (!first) {
        console.warn(`[IMG] model=${model} sin imagen response=${JSON.stringify(data).slice(0, 200)}`);
        lastError = new Error(`${model}: No image in response`);
        continue; // Try next model
      }

      const b64 = first?.b64_json || first?.b64 || first?.base64;
      if (b64) {
        const cleaned = String(b64).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
        console.log(`[IMG] base64 model=${model}`);
        return { kind: "b64", value: cleaned, contentType: "image/png", model };
      }

      const urlOut = first?.url || (typeof first === "string" ? first : null);
      if (urlOut) {
        console.log(`[IMG] url model=${model} value=${String(urlOut).slice(0, 50)}...`);
        return { kind: "url", value: String(urlOut), model };
      }

      console.warn(`[IMG] model=${model} sin payload=${JSON.stringify(first).slice(0, 200)}`);
      lastError = new Error(`${model}: No valid payload`);
      continue; // Try next model
    } catch (err) {
      console.warn(`[IMG] model=${model} error=${err.message}`);
      lastError = err;
      continue; // Try next model
    }
  }

  // All models failed
  console.error("[IMG] todos los modelos fallaron:", lastError?.message);
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

async function getImageForCharacter({ name, category, style, lang, universe }) {
  const start = Date.now();
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    return { ok: false, error: "Missing name" };
  }

  const cacheHit = await getCachedImage({ name: cleanName, category, style, lang, universe });
  if (cacheHit.imageUrl) {
    console.log(`[IMG] cacheHit (${cacheHit.source}) name="${cleanName}"`);
    if (cacheHit.source === "seed" && hasPersistentStore()) {
      await setCachedImage({
        cacheKey: cacheHit.cacheKey,
        imageUrl: cacheHit.imageUrl,
        provider: cacheHit.provider || "seed",
      });
    }
    return {
      ok: true,
      imageUrl: cacheHit.imageUrl,
      provider: cacheHit.provider || cacheHit.source,
      cacheHit: true,
      durationMs: Date.now() - start,
    };
  }

  const cacheKey = cacheHit.cacheKey;
  console.log(`[IMG] cacheMiss name="${cleanName}" category="${category}" style="${style}"`);
  if (inFlightImages.has(cacheKey)) {
    const url = await inFlightImages.get(cacheKey);
    return { ok: true, imageUrl: url, provider: "inflight", cacheHit: true, durationMs: Date.now() - start };
  }

  if (!OPENAI_API_KEY) {
    return { ok: false, error: "Image provider not configured" };
  }

  const job = (async () => {
    const prompt = buildImagePrompt(cleanName, category, style, universe);
    const seed = Math.abs(parseInt(sha1(cacheKey).slice(0, 8), 16)) % 100000;

    console.log(`[IMG] generate name="${cleanName}" category="${category}" style="${style}"`);

    const gen = await generateImageWithOpenAI({
      prompt,
      seed,
      width: 768,
      height: 768,
      category,
    });

    let imageUrl = "";
    let provider = `aiml:${gen?.model || "unknown"}`;

    if (gen && gen.kind === "b64") {
      const stored = await storeImageBlob({
        cacheKey,
        contentType: gen.contentType || "image/png",
        base64: String(gen.value || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""),
      });
      imageUrl = stored?.imageUrl || "";
    } else if (gen && gen.kind === "url") {
      imageUrl = String(gen.value || "");
    }

    if (!imageUrl) {
      throw new Error("No image output returned");
    }

    await setCachedImage({ cacheKey, imageUrl, provider });
    return { imageUrl, provider };
  })();

  const inflight = job
    .then((x) => {
      inFlightImages.delete(cacheKey);
      return x.imageUrl;
    })
    .catch((err) => {
      inFlightImages.delete(cacheKey);
      console.error("[IMG] job error:", err.message);
      throw err;
    });

  inFlightImages.set(cacheKey, inflight);

  try {
    const out = await job;
    const duration = Date.now() - start;
    console.log(`[IMG] generated provider=${out.provider} duration=${duration}ms`);
    return { ok: true, imageUrl: out.imageUrl, provider: out.provider, cacheHit: false, durationMs: duration };
  } catch (err) {
    return { ok: false, error: err?.message || "Image generation failed" };
  }
}

/* ========================= API routes ========================= */
app.post("/api/smell", async (req, res) => {
  const startTime = Date.now();
  const timings = {};
  
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const requestedCategory = String(req.body?.category || "any").trim();
    let category = normalizeCategoryId(requestedCategory);
    const requestedLang = normalizeLang(req.body?.lang || "en");
    const includeEs = Boolean(req.body?.includeEs);

    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    
    // Validate: Category must be specified (not "any")
    if (!category || category === "any") {
      return res.status(400).json({ error: "Category required" });
    }

    const normalizedSearch = normalizeCharacterName(prompt);

    // 1) Normalizar búsqueda con Gemini - reconoce variaciones y errores gramaticales
    // Convierte "naruto", "uzumaki naruto", "naruto uzumaki" → "Naruto Uzumaki" (nombre oficial de Ficha)
    let formalCharacterName = await geminiNormalizeCharacterSearch(prompt, category);
    console.log(`Normalized: "${prompt}" → "${formalCharacterName}"`);

    // 2) Resolver al nombre canónico del índice local para evitar misses tipo "Joel" vs "Joel Miller"
    const resolvedFromIndex = resolveCanonicalCharacterName(formalCharacterName, prompt);
    if (resolvedFromIndex !== formalCharacterName) {
      console.log(`Canonicalized from index: "${formalCharacterName}" → "${resolvedFromIndex}"`);
      formalCharacterName = resolvedFromIndex;
    }
    formalCharacterName = toCanonicalDisplayName(formalCharacterName);

    // 2b) Resolve character nature/category and override mismatches.
    const canonicalNature = await inferCharacterNatureCategory(formalCharacterName, category);
    const categoryOverridden = canonicalNature && canonicalNature !== category;
    if (categoryOverridden) {
      console.log(`Category override for "${formalCharacterName}": requested="${category}" → canonical="${canonicalNature}"`);
      category = canonicalNature;
    }
    
    // 3) Registrar esta variación para búsquedas futuras
    registerCharacter(normalizedSearch, formalCharacterName);
    
    // 4) Buscar en cache usando el nombre oficial de Ficha + contexto
    const cacheLookup = await getCachedSmell({
      name: formalCharacterName,
      category,
      lang: "en",
    });
    let textEn = cacheLookup.text;
    let cached = cacheLookup.cacheHit;
    const cacheSource = cacheLookup.source;

    if (textEn) {
      cached = true;
      timings.cache_hit = Date.now() - startTime;
      console.log(`Smell: Cache hit (${cacheSource}) for:`, formalCharacterName);
      if (cacheSource === "seed" && hasPersistentStore()) {
        await setCachedSmell({
          name: formalCharacterName,
          category,
          lang: "en",
          text: textEn,
          provider: "seed",
        });
      }
    } else {
      // 5) Si no está en cache, generar con in-flight deduplication
      const cacheKeyEn = buildSmellKey({
        name: formalCharacterName,
        category,
        lang: "en",
        promptVersion: PROMPT_VERSION,
      });
      
      if (inFlightResponses.has(cacheKeyEn)) {
        console.log("Smell: Esperando generación in-flight para:", prompt);
        textEn = await inFlightResponses.get(cacheKeyEn);
      } else {
        console.log("Smell: Generando respuesta para:", prompt);
        const inflight = (async () => {
          try {
            const out = await geminiGenerateSmellEN({ character: formalCharacterName, category });
            console.log("Gemini response length:", out ? out.length : 0);
            console.log("Gemini response preview:", out ? out.slice(0, 200) : "EMPTY");
            
            if (!out || out.length < 50) {
              throw new Error("Respuesta demasiado corta o vacía");
            }
            
            // Extraer nombre oficial de la ficha generada
            const sheetName = extractCharacterNameFromSheet(out);
            let finalName = formalCharacterName;
            
            if (sheetName && sheetName.length > 0) {
              // Usar nombre extraído, pero re-canonizar con índice local
              finalName = resolveCanonicalCharacterName(sheetName, prompt);
              // Si es diferente al que teníamos, registrarlo
              if (finalName !== formalCharacterName) {
                registerCharacter(normalizeCharacterName(prompt), finalName);
                console.log(`Registered: "${prompt}" → "${finalName}"`);
              }
            }
            
            // Guardar en cache persistente con nombre de ficha
            await setCachedSmell({ name: finalName, category, lang: "en", text: out, provider: "gemini" });
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
    const extractedSheetName = extractCharacterNameFromSheet(textEn) || formalCharacterName;
    const finalSheetName = resolveCanonicalCharacterName(extractedSheetName, prompt);
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

        const imageResp = await getImageForCharacter({
          name: formalCharacterName,
          category: category || "any",
          style: "auto",
          lang: "en",
          universe,
        });

        if (imageResp?.ok && imageResp.imageUrl) {
          const imageTime = Date.now() - imageStart;
          console.log("[IMG] Smell: Imagen lista:", imageResp.imageUrl, `(${imageTime}ms)`, "provider=", imageResp.provider || "unknown");
          timings.image_generation = imageTime;
        } else {
          console.warn("[IMG] Smell: respuesta de imagen sin url", imageResp);
        }

        return imageResp?.imageUrl || null;
      } catch (e) {
        console.warn("[IMG] Image parallel generation error:", e.message);
        return null;
      }
    })();

    // Start translation WITHOUT waiting (fires in background)
    const translationPromise = (async () => {
      const translationStart = Date.now();
      try {
        const cachedEs = await getCachedSmell({
          name: formalCharacterName,
          category,
          lang: "es",
        });
        let textEs = cachedEs.text || "";
        const shouldHaveEs = requestedLang === "es" || includeEs;
        
        if (!textEs && shouldHaveEs) {
          console.log("Smell: Traduciendo a ES en paralelo:", formalCharacterName);
          textEs = await geminiTranslate(textEn, "es");
          const translationTime = Date.now() - translationStart;
          console.log("Smell: Traducción completada:", `(${translationTime}ms)`);
          timings.translation = translationTime;
          await setCachedSmell({ name: formalCharacterName, category, lang: "es", text: textEs, provider: "gemini" });
        } else if (textEs) {
          timings.translation_cached = Date.now() - translationStart;
        }
        
        return textEs || "";
      } catch (e) {
        console.error("Parallel translation error:", e.message);
        return "";
      }
    })();

    let textEsForResponse = "";
    if (requestedLang === "es") {
      textEsForResponse = await translationPromise;
    }

    // Return main response (includes ES when requestedLang=es)
    const response = {
      text: textEn,
      textEn,
      textEs: textEsForResponse || "",
      cached,
      sourceLang: "en",
      requestedLang,
      officialName: formalCharacterName,
      normalizedSearch,
      requestedCategory: normalizeCategoryId(requestedCategory),
      resolvedCategory: category,
      categoryOverridden,
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
    const safe = toClientSafeErrorDetails(e);
    return res.status(safe.status).json({
      error: safe.error,
      details: safe.details,
    });
  }
});

/* ========================= Translation endpoint ========================= */
app.post("/api/translate", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const targetLang = normalizeLang(req.body?.lang || "es");
    const characterName = String(req.body?.character || "").trim();
    const requestedCategory = String(req.body?.category || "any").trim();
    let category = normalizeCategoryId(requestedCategory);

    if (!text) return res.status(400).json({ error: "Missing text" });

    const canonicalName = characterName
      ? toCanonicalDisplayName(resolveCanonicalCharacterName(characterName, characterName))
      : "";

    if (canonicalName) {
      const inferred = await inferCharacterNatureCategory(canonicalName, category);
      if (inferred) category = inferred;
      const smellCacheHit = await getCachedSmell({
        name: canonicalName,
        category,
        lang: targetLang,
      });
      if (smellCacheHit?.text) {
        return res.json({ text: smellCacheHit.text, fromCache: true, source: "smell-cache" });
      }
    }

    // Normalizar nombre para caché
    const normalizedName = canonicalName ? normalizeCharacterName(canonicalName) : "";
    const cacheKey = `resp::${targetLang}::${normalizedName}::${normKey(category)}`;

    // Buscar en caché
    let cached = responseCache.get(cacheKey);
    if (cached) {
      return res.json({ text: cached, fromCache: true });
    }

    // Si no está en caché, traducir
    const translated = await geminiTranslate(text, targetLang);
    responseCache.set(cacheKey, translated);
    if (canonicalName && translated) {
      await setCachedSmell({
        name: canonicalName,
        category,
        lang: targetLang,
        text: translated,
        provider: "gemini-translate",
      });
    }

    return res.json({ text: translated, fromCache: false, source: "gemini" });
  } catch (e) {
    return res.status(500).json({
      error: "Translation failed",
      details: String(e?.message || e),
    });
  }
});

app.post("/api/feedback", async (req, res) => {
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
  const allowedCategories = new Set(["feedback", "bug", "idea", "suggestion", "other", "image", "aroma"]);
  const safeCategory = allowedCategories.has(requestedCategory) ? requestedCategory : "feedback";

  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `fb-${Date.now()}`,
    ts: Date.now(),
    ipHash: sha1(String(ip || "")),
    category: safeCategory,
    contact: String(req.body?.contact || "").trim().slice(0, 180),
    url: String(req.body?.url || "").trim().slice(0, 500),
    userAgent: String(req.body?.userAgent || "").trim().slice(0, 500),
    locale: String(req.body?.locale || "").trim().slice(0, 20),
    sessionId: String(req.body?.sessionId || "").trim().slice(0, 120),
    message: message.slice(0, 2000),
    screenshot: screenshotBase64 || null,
  };

  feedbackEntries.push(entry);
  if (feedbackEntries.length > 200) {
    feedbackEntries.shift();
  }

  if (!resend || !FEEDBACK_TO_EMAIL) {
    console.warn("[feedback] Email delivery not configured");
    return res.status(503).json({ ok: false, error: "Feedback delivery not configured" });
  }

  const subject = `[WTS] ${entry.category} feedback`;
  const text = [
    `Category: ${entry.category}`,
    `When: ${new Date(entry.ts).toISOString()}`,
    entry.contact ? `Contact: ${entry.contact}` : "Contact: (none)",
    entry.url ? `URL: ${entry.url}` : "URL: (none)",
    entry.userAgent ? `User-Agent: ${entry.userAgent}` : "User-Agent: (none)",
    entry.locale ? `Locale: ${entry.locale}` : "Locale: (none)",
    entry.sessionId ? `Session: ${entry.sessionId}` : "Session: (none)",
    "",
    "Message:",
    entry.message,
  ].join("\n");

  const attachments = [];
  if (entry.screenshot) {
    const raw = entry.screenshot.split(",")[1] || entry.screenshot;
    attachments.push({ filename: "screenshot.jpg", content: raw });
  }

  try {
    const result = await resend.emails.send({
      from: FEEDBACK_FROM_EMAIL,
      to: [FEEDBACK_TO_EMAIL],
      subject,
      text,
      attachments,
    });
    console.log(`[feedback] delivered id=${result?.id || "unknown"} category=${entry.category}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[feedback] Email send failed:", err?.message || err);
    return res.status(502).json({ ok: false, error: "Feedback delivery failed" });
  }
});

/* ========================= IA Image endpoint (persistent cache) ========================= */
app.post("/api/ai-image", async (req, res) => {
  const body = req.body || {};
  const name = String(body?.name || "").trim();
  const category = String(body?.category || "any").trim();
  const style = String(body?.style || "auto").trim();
  const universe = String(body?.universe || "").trim();
  const lang = String(body?.lang || "en").trim();

  const resp = await getImageForCharacter({ name, category, style, lang, universe });
  const payload = {
    ok: !!resp.ok,
    imageUrl: resp.imageUrl || undefined,
    provider: resp.provider || undefined,
    cacheHit: !!resp.cacheHit,
    error: resp.ok ? undefined : resp.error || "Image generation failed",
  };

  return res.status(resp.ok ? 200 : 500).json(payload);
});

app.get("/api/ai-image", async (req, res) => {
  const name = String(req.query?.name || "").trim();
  const category = String(req.query?.category || "any").trim();
  const style = String(req.query?.style || "auto").trim();
  const universe = String(req.query?.universe || "").trim();
  const lang = String(req.query?.lang || "en").trim();

  const resp = await getImageForCharacter({ name, category, style, lang, universe });
  const payload = {
    ok: !!resp.ok,
    imageUrl: resp.imageUrl || undefined,
    provider: resp.provider || undefined,
    cacheHit: !!resp.cacheHit,
    error: resp.ok ? undefined : resp.error || "Image generation failed",
  };

  return res.status(resp.ok ? 200 : 500).json(payload);
});

app.get("/api/image/:id", async (req, res) => {
  const id = String(req.params?.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "Missing image id" });
  const blob = await getPersistentJson(`image-blob::${id}`);
  if (!blob || !blob.base64) {
    return res.status(404).json({ ok: false, error: "Image not found" });
  }
  const contentType = blob.contentType || "image/png";
  const buffer = Buffer.from(String(blob.base64), "base64");
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  return res.send(buffer);
});

// ===== Admin: Clear cache =====
app.post("/admin/clear-cache", (req, res) => {
  try {
    // Clear in-memory caches
    responseCache.clear();
    imageCache.clear();
    inFlightResponses.clear();
    inFlightImages.clear();

    console.log("Cache cleared: in-memory caches only (persistent cache untouched)");
    return res.json({ ok: true, message: "In-memory cache cleared" });
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
