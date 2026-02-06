/**
 * Frontend Gateway Module
 * Single source of truth for:
 * - Gate versioning & config
 * - API base resolution (localhost vs production)
 * - Access state management
 * 
 * All logic is frontend-only. No dependencies on backend or root files.
 */

const GATEWAY = (() => {
  // ===== VERSION (increment to force cache busting) =====
  const VERSION = "2026-02-05-v2";
  
  // ===== GATE CONFIGURATION =====
  const GATE_CONFIG = {
    enabled: true,
    password: "reymono95",
    duration_ms: 24 * 60 * 60 * 1000, // 24 hours
    token_key: "beta_access_token",
    granted_key: "beta_access_granted",
  };

  // ===== RUNTIME ENVIRONMENT DETECTION =====
  function detectEnvironment() {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;

    if (hostname === "localhost") {
      if (port === "3000") return "DEV_LOCAL_3000";
      return "DEV_LOCAL_OTHER";
    }

    return "PRODUCTION";
  }

  // ===== API BASE RESOLUTION (deterministic, no side effects) =====
  function resolveApiBase() {
    // Priority 1: Explicit override (testing/CI)
    const forced = String(window.WTS_API_BASE || "").trim().replace(/\/+$/, "");
    if (forced) return forced;

    const env = detectEnvironment();

    switch (env) {
      case "DEV_LOCAL_3000":
        return "http://localhost:5051";
      case "DEV_LOCAL_OTHER":
        return window.location.origin.replace(/\/+$/, "");
      case "PRODUCTION":
        return "https://whats-the-smell-production.up.railway.app";
      default:
        return window.location.origin.replace(/\/+$/, "");
    }
  }

  // ===== ACCESS TOKEN VALIDATION =====
  function hasValidToken() {
    if (!GATE_CONFIG.enabled) return true;

    const token = localStorage.getItem(GATE_CONFIG.token_key);
    if (!token) {
      console.log("%c[GATEWAY] No token found", "color: red; font-size: 10px;");
      return false;
    }

    try {
      const tokenData = JSON.parse(token);
      const now = Date.now();
      const age = now - tokenData.timestamp;

      if (age > GATE_CONFIG.duration_ms) {
        console.log("%c[GATEWAY] Token expired (>" + Math.round(GATE_CONFIG.duration_ms / 1000 / 60 / 60) + "h)", "color: red; font-size: 10px;");
        localStorage.removeItem(GATE_CONFIG.token_key);
        localStorage.removeItem(GATE_CONFIG.granted_key);
        return false;
      }

      const minutes = Math.floor(age / 60000);
      console.log("%c[GATEWAY] Token valid (" + minutes + "m old)", "color: lime; font-size: 10px;");
      return true;
    } catch (e) {
      console.error("%c[GATEWAY] Token parse error", "color: red; font-size: 10px;", e);
      localStorage.removeItem(GATE_CONFIG.token_key);
      return false;
    }
  }

  // ===== SAVE ACCESS TOKEN =====
  function grantAccess() {
    const token = {
      timestamp: Date.now(),
      version: VERSION,
    };
    localStorage.setItem(GATE_CONFIG.token_key, JSON.stringify(token));
    localStorage.setItem(GATE_CONFIG.granted_key, "true");
    console.log("%c[GATEWAY] ✓ Access granted - token saved (" + Math.round(GATE_CONFIG.duration_ms / 1000 / 60 / 60) + "h)", "color: lime; font-size: 12px;");
  }

  // ===== CLEAR ACCESS (for testing) =====
  function clearAccess() {
    localStorage.removeItem(GATE_CONFIG.token_key);
    localStorage.removeItem(GATE_CONFIG.granted_key);
    console.log("%c[GATEWAY] Access cleared", "color: orange; font-size: 11px;");
  }

  // ===== PUBLIC API =====
  return {
    VERSION,
    CONFIG: GATE_CONFIG,
    
    env: detectEnvironment(),
    apiBase: resolveApiBase(),
    
    hasValidToken,
    grantAccess,
    clearAccess,
    
    // For debugging
    log() {
      console.log(
        "%c[GATEWAY] Status: " +
        "v=" + VERSION +
        " | env=" + this.env +
        " | gate=" + (GATE_CONFIG.enabled ? "ON" : "OFF") +
        " | token=" + (this.hasValidToken() ? "VALID" : "INVALID") +
        " | api=" + this.apiBase,
        "color: cyan; font-size: 11px;"
      );
    }
  };
})();

// Log gateway status immediately
console.log(
  "%c[GATEWAY] Initialized | v=" + GATEWAY.VERSION + " | API=" + GATEWAY.apiBase + " | Gate=" + (GATEWAY.CONFIG.enabled ? "ON" : "OFF"),
  "color: cyan; font-size: 12px; font-weight: bold;"
);
