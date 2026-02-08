import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { Redis } from "@upstash/redis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SEED_CACHE_DIR = path.join(__dirname, "..", "Frontend", "cache");
const SEED_RESPONSES_FILE = path.join(SEED_CACHE_DIR, "responses.json");
const SEED_INDEX_FILE = path.join(SEED_CACHE_DIR, "character-index.json");

const seedResponses = (() => {
  try {
    if (!fs.existsSync(SEED_RESPONSES_FILE)) return {};
    const raw = fs.readFileSync(SEED_RESPONSES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.warn("[seed] Failed to load responses.json:", err?.message || err);
    return {};
  }
})();

const seedIndex = (() => {
  try {
    if (!fs.existsSync(SEED_INDEX_FILE)) return {};
    const raw = fs.readFileSync(SEED_INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.warn("[seed] Failed to load character-index.json:", err?.message || err);
    return {};
  }
})();

const memoryStore = new Map();

const redis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
})();

function normalizeKeyPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function buildSmellKey({ name, category, lang, promptVersion }) {
  return [
    "smell",
    normalizeKeyPart(promptVersion || "v1"),
    normalizeKeyPart(name),
    normalizeKeyPart(category || "any"),
    normalizeKeyPart(lang || "en"),
  ].join("::");
}

export function buildImageKey({ name, category, style, lang, promptVersion }) {
  return [
    "img",
    normalizeKeyPart(promptVersion || "v1"),
    normalizeKeyPart(name),
    normalizeKeyPart(category || "any"),
    normalizeKeyPart(style || "anime"),
    normalizeKeyPart(lang || "en"),
  ].join("::");
}

export function getSeedIndex() {
  return seedIndex;
}

export function getSeedSmell(name, lang) {
  if (!name) return null;
  const key = `${name}||${normalizeKeyPart(lang || "en")}`;
  return seedResponses[key] || null;
}

export function getSeedImage(name, lang) {
  if (!name) return null;
  const key = `${name}||image||${normalizeKeyPart(lang || "en")}`;
  return seedResponses[key] || null;
}

export async function getPersistentJson(key) {
  if (!key) return null;
  if (redis) {
    try {
      return await redis.get(key);
    } catch (err) {
      console.warn("[cache] Redis get failed:", err?.message || err);
      return null;
    }
  }
  return memoryStore.get(key) || null;
}

export async function setPersistentJson(key, value) {
  if (!key) return null;
  if (redis) {
    try {
      await redis.set(key, value);
      return value;
    } catch (err) {
      console.warn("[cache] Redis set failed:", err?.message || err);
      return null;
    }
  }
  memoryStore.set(key, value);
  return value;
}

export function hasPersistentStore() {
  return !!redis;
}

export function getSeedStats() {
  return {
    responses: Object.keys(seedResponses).length,
    index: Object.keys(seedIndex).length,
  };
}
