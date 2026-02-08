import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import {
  buildSmellKey,
  buildImageKey,
  setPersistentJson,
  hasPersistentStore,
} from "../api/storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = path.join(__dirname, "..");
const SEED_RESPONSES = path.join(ROOT_DIR, "Frontend", "cache", "responses.json");
const GENERATED_DIR = path.join(ROOT_DIR, "Frontend", "generated");

const PROMPT_VERSION = process.env.PROMPT_VERSION || "v1";
const IMAGE_PROMPT_VERSION = process.env.IMAGE_PROMPT_VERSION || "v2";

function sha1(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex");
}

function normalizeKeyPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeCharacterName(name) {
  let normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^(son|dr\.?|mr\.?|miss|mrs\.?|master|saint|god|demon|angel|prince|princess|king|queen)\s+/i, "")
    .replace(/\s+(jr|sr|iii|ii|i)$/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();

  const words = normalized.split(/\s+/);
  if (words.length === 2) {
    words.sort();
    normalized = words.join(" ");
  }

  return normalized || "unknown";
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

function readSeedResponses() {
  if (!fs.existsSync(SEED_RESPONSES)) {
    throw new Error(`Seed responses not found at ${SEED_RESPONSES}`);
  }
  const raw = fs.readFileSync(SEED_RESPONSES, "utf8");
  return JSON.parse(raw);
}

async function migrate() {
  if (!hasPersistentStore()) {
    throw new Error("Persistent cache is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
  }

  const data = readSeedResponses();
  const entries = Object.entries(data);
  let smellCount = 0;
  let imageCount = 0;
  let imageBlobCount = 0;

  for (const [key, value] of entries) {
    if (!key || !value) continue;

    const parts = key.split("||");
    const name = parts[0] || "";
    const maybeImage = parts[1] || "";
    const lang = normalizeKeyPart(parts[2] || "en");

    if (maybeImage === "image") {
      const imageUrl = String(value || "").trim();
      if (!imageUrl) continue;

      let finalUrl = imageUrl;
      if (imageUrl.startsWith("/generated/")) {
        const fileName = imageUrl.replace("/generated/", "");
        const filePath = path.join(GENERATED_DIR, fileName);
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          const imageId = sha1(`${name}::${fileName}::${IMAGE_PROMPT_VERSION}`).slice(0, 16);
          const blobKey = `image-blob::${imageId}`;
          await setPersistentJson(blobKey, {
            contentType: fileName.endsWith(".png") ? "image/png" : fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") ? "image/jpeg" : "image/webp",
            base64: buffer.toString("base64"),
            createdAt: Date.now(),
          });
          finalUrl = `/api/image/${imageId}`;
          imageBlobCount += 1;
        }
      }

      const cacheKey = buildImageCacheKey({
        name,
        category: "any",
        style: "anime",
        lang,
        universe: "",
      });

      await setPersistentJson(cacheKey, {
        imageUrl: finalUrl,
        provider: "seed-migration",
        promptVersion: IMAGE_PROMPT_VERSION,
        createdAt: Date.now(),
      });
      imageCount += 1;
      continue;
    }

    const smellText = String(value || "").trim();
    if (!smellText) continue;

    const smellKey = buildSmellKey({
      name,
      category: "any",
      lang,
      promptVersion: PROMPT_VERSION,
    });

    await setPersistentJson(smellKey, {
      text: smellText,
      name,
      category: "any",
      lang,
      promptVersion: PROMPT_VERSION,
      provider: "seed-migration",
      createdAt: Date.now(),
    });
    smellCount += 1;
  }

  console.log(`Seed migration complete: smells=${smellCount}, images=${imageCount}, blobs=${imageBlobCount}`);
}

migrate().catch((err) => {
  console.error("Seed migration failed:", err?.message || err);
  process.exit(1);
});
