import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const RESPONSES_FILE = path.join(ROOT, "Frontend", "cache", "responses.json");
const INDEX_FILE = path.join(ROOT, "Frontend", "cache", "character-index.json");
const GENERATED_DIR = path.join(ROOT, "Frontend", "generated");
const ENV_FILE = path.join(ROOT, "api", ".env");

const TARGET_NAMES = [
  "Captain America",
  "Capitan America",
  "Capitán América (Steve Rogers)",
  "Chozo",
  "Choso",
  "Goku Black",
  "Link",
  "Madara",
  "Steve Hyuga",
  "Suguru Geto",
  "Tanjiro Kamado",
  "Toji Fushiguro",
  "Naruto",
  "Naruto Uzumaki",
];

const TARGET_SLUG_HINTS = [
  "capit",
  "chozo",
  "choso",
  "goku-black",
  "link",
  "madara",
  "steve-hyuga",
  "suguru-geto",
  "tanjiro-kamado",
  "toji-fushiguro",
  "naruto",
];

function fold(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const TARGET_FOLDED = TARGET_NAMES.map(fold);

function isTargetName(name) {
  const n = fold(name);
  if (!n) return false;
  if (TARGET_FOLDED.includes(n)) return true;
  return TARGET_FOLDED.some((t) => n.includes(t) || t.includes(n));
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || /^\s*#/.test(line)) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    out[k] = v;
  }
  return out;
}

async function redisCommand(url, token, args) {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) {
    throw new Error(data.error || `Redis command failed: ${args[0]}`);
  }
  return data.result;
}

async function scanAllKeys(url, token) {
  let cursor = "0";
  const keys = [];
  do {
    const result = await redisCommand(url, token, ["SCAN", cursor, "COUNT", "500"]);
    const nextCursor = String(result?.[0] ?? "0");
    const chunk = Array.isArray(result?.[1]) ? result[1] : [];
    keys.push(...chunk);
    cursor = nextCursor;
  } while (cursor !== "0");
  return keys;
}

function shouldDeleteRedisKey(key) {
  const k = String(key || "");
  const parts = k.split("::");
  if (parts[0] === "smell" && parts.length >= 5) return isTargetName(parts[2]);
  if (parts[0] === "img" && parts.length >= 6) return isTargetName(parts[2]);
  if (parts[0] === "resp" && parts.length >= 4) return isTargetName(parts[2]);
  return isTargetName(k);
}

function blobKeyForImageCacheKey(cacheKey) {
  const id = crypto.createHash("sha1").update(String(cacheKey)).digest("hex").slice(0, 16);
  return `image-blob::${id}`;
}

async function clearAdminCaches() {
  const endpoints = [
    "http://localhost:5051/admin/clear-cache",
    "https://whats-the-smell-production.up.railway.app/admin/clear-cache",
  ];
  const out = [];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, { method: "POST" });
      out.push({ url, ok: r.ok, status: r.status });
    } catch (e) {
      out.push({ url, ok: false, error: e?.message || String(e) });
    }
  }
  return out;
}

async function main() {
  const summary = {
    responsesRemoved: 0,
    indexRemoved: 0,
    filesRemoved: 0,
    redisKeysRemoved: 0,
    redisBlobKeysRemoved: 0,
    adminClear: [],
  };

  // 1) Remove seed responses entries
  const responses = readJson(RESPONSES_FILE, {});
  for (const key of Object.keys(responses)) {
    const namePart = String(key).split("||")[0];
    if (isTargetName(namePart)) {
      delete responses[key];
      summary.responsesRemoved += 1;
    }
  }
  writeJson(RESPONSES_FILE, responses);

  // 2) Remove character-index mappings
  const index = readJson(INDEX_FILE, {});
  for (const alias of Object.keys(index)) {
    const official = index[alias];
    if (isTargetName(alias) || isTargetName(official)) {
      delete index[alias];
      summary.indexRemoved += 1;
    }
  }
  writeJson(INDEX_FILE, index);

  // 3) Remove generated image files
  if (fs.existsSync(GENERATED_DIR)) {
    for (const file of fs.readdirSync(GENERATED_DIR)) {
      const lower = file.toLowerCase();
      const hit = TARGET_SLUG_HINTS.some((h) => lower.includes(h));
      if (hit) {
        fs.unlinkSync(path.join(GENERATED_DIR, file));
        summary.filesRemoved += 1;
      }
    }
  }

  // 4) Remove persistent Redis keys (Upstash)
  const env = parseEnv(ENV_FILE);
  const redisUrl = env.UPSTASH_REDIS_REST_URL || "";
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN || "";
  if (redisUrl && redisToken) {
    const keys = await scanAllKeys(redisUrl, redisToken);
    const toDelete = keys.filter(shouldDeleteRedisKey);
    const blobKeys = new Set();
    for (const k of toDelete) {
      if (String(k).startsWith("img::")) {
        blobKeys.add(blobKeyForImageCacheKey(k));
      }
    }

    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      if (!chunk.length) continue;
      await redisCommand(redisUrl, redisToken, ["DEL", ...chunk]);
      summary.redisKeysRemoved += chunk.length;
    }

    const blobList = Array.from(blobKeys);
    for (let i = 0; i < blobList.length; i += 100) {
      const chunk = blobList.slice(i, i + 100);
      if (!chunk.length) continue;
      await redisCommand(redisUrl, redisToken, ["DEL", ...chunk]);
      summary.redisBlobKeysRemoved += chunk.length;
    }
  }

  // 5) Clear in-memory caches on local + Railway backends
  summary.adminClear = await clearAdminCaches();

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
