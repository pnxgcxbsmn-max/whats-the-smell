// ===== Rebuilt Access Gate (Cloudflare-compatible) =====
(() => {
  const GATE_VERSION = "2026-02-06-access-gate-v2";
  const ACCESS_TOKEN_KEY = "beta_access_token";
  const ACCESS_GRANTED_KEY = "beta_access_granted";
  const ACCESS_GATE_VERSION_KEY = "beta_access_gate_version";
  const LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24h
  const GENERATION_LIMIT = 10;

  const DEFAULT_BETA_PASSWORD = "reymono95";
  const OVERRIDE_BETA_PASSWORD = typeof window.WTS_BETA_PASSWORD === "string"
    ? window.WTS_BETA_PASSWORD.trim()
    : "";
  const ALLOWED_PASSWORDS = new Set([DEFAULT_BETA_PASSWORD, OVERRIDE_BETA_PASSWORD].filter(Boolean));

  if (ALLOWED_PASSWORDS.size === 0) {
    console.warn("%c[ACCESS-GATE] No valid beta passwords configured; gate will reject all logins", "color: red; font-size: 12px;");
  }

  const TRANSLATIONS = {
    en: {
      title: "BETA ACCESS",
      subtitle: "Early Access Program",
      placeholder: "Enter password...",
      access: "ACCESS",
      error: "Invalid password. Try again.",
      thanks: "Thank you for your interest in our beta program.",
      limited: "Limited early access available.",
      welcome: "Welcome!"
    },
    es: {
      title: "ACCESO BETA",
      subtitle: "Programa de Acceso Anticipado",
      placeholder: "Ingresa la contraseña...",
      access: "ACCEDER",
      error: "Contraseña inválida. Intenta de nuevo.",
      thanks: "Gracias por tu interés en nuestro programa beta.",
      limited: "Acceso anticipado limitado disponible.",
      welcome: "¡Bienvenido!"
    }
  };

  let currentAccessGateLang = localStorage.getItem("accessGateLang") || "en";

  // Reset token when gate version changes
  const lastVersion = localStorage.getItem(ACCESS_GATE_VERSION_KEY);
  if (lastVersion !== GATE_VERSION) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ACCESS_GRANTED_KEY);
    localStorage.setItem(ACCESS_GATE_VERSION_KEY, GATE_VERSION);
    console.log("%c[ACCESS-GATE] Reset applied for version:", "color: orange; font-size: 12px;", GATE_VERSION);
  }

  function readToken() {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return null;
    try {
      return JSON.parse(token);
    } catch {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(ACCESS_GRANTED_KEY);
      return null;
    }
  }

  function hasValidAccess() {
    const tokenData = readToken();
    if (!tokenData || !tokenData.timestamp) return false;
    const now = Date.now();
    if (now - tokenData.timestamp > LIMIT_WINDOW) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(ACCESS_GRANTED_KEY);
      return false;
    }
    return true;
  }

  function writeToken(generations = 0) {
    const token = { timestamp: Date.now(), generations };
    localStorage.setItem(ACCESS_TOKEN_KEY, JSON.stringify(token));
    localStorage.setItem(ACCESS_GRANTED_KEY, "true");
  }

  function getGenerationsUsedToday() {
    const tokenData = readToken();
    if (!tokenData) return 0;
    const now = Date.now();
    if (now - tokenData.timestamp > LIMIT_WINDOW) {
      writeToken(0);
      return 0;
    }
    return tokenData.generations || 0;
  }

  function incrementGenerationCounter() {
    const tokenData = readToken();
    if (!tokenData) {
      writeToken(1);
      return;
    }
    tokenData.generations = (tokenData.generations || 0) + 1;
    localStorage.setItem(ACCESS_TOKEN_KEY, JSON.stringify(tokenData));
  }

  function hasReachedGenerationLimit() {
    return getGenerationsUsedToday() >= GENERATION_LIMIT;
  }

  function getGenerationLimitInfo() {
    const used = getGenerationsUsedToday();
    const remaining = Math.max(0, GENERATION_LIMIT - used);
    return {
      used,
      remaining,
      limit: GENERATION_LIMIT,
      percentage: Math.round((used / GENERATION_LIMIT) * 100),
    };
  }

  // Expose rate-limit helpers for app.js
  window.hasReachedGenerationLimit = hasReachedGenerationLimit;
  window.incrementGenerationCounter = incrementGenerationCounter;
  window.getGenerationLimitInfo = getGenerationLimitInfo;

  function addAccessGateStyles() {
    const style = document.createElement("style");
    style.id = "access-gate-styles";
    style.textContent = `
      .access-gate-container{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999;background:rgba(12,12,24,.75);backdrop-filter:blur(8px);}
      .access-gate-container.fade-out{animation:access-gate-fade-out .8s ease-in forwards;}
      @keyframes access-gate-fade-out{from{opacity:1;transform:scale(1);}to{opacity:0;transform:scale(1.05);}}
      .access-gate-background{position:absolute;inset:0;background-image:url("assets/bg/Background.png");background-size:cover;background-position:center;filter:blur(15px);opacity:.3;}
      .access-gate-box{position:relative;z-index:2;background:rgba(18,18,32,.42);backdrop-filter:blur(22px);border:1px solid rgba(240,240,240,.14);border-radius:24px;padding:64px 36px 96px;max-width:420px;width:90%;box-shadow:0 10px 36px rgba(0,0,0,.35),inset 0 1px 1px rgba(255,255,255,.12);}
      .access-gate-header{margin:8px 0 36px;text-align:center;}
      .access-gate-icon{width:80px;height:80px;margin:0 auto 20px;opacity:.9;}
      .access-gate-logo-img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 12px rgba(0,0,0,.4));}
      .access-gate-title{font-size:28px;font-weight:700;letter-spacing:2px;margin:0;color:#f0f0f0;text-transform:uppercase;}
      .access-gate-subtitle{font-size:13px;color:#aaa;margin:8px 0 0;letter-spacing:1px;text-transform:uppercase;}
      .access-gate-form{margin-bottom:24px;}
      .access-gate-input-wrapper{display:flex;gap:12px;margin-bottom:12px;}
      .access-gate-input{flex:1;height:44px;padding:0 16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:12px;color:#f0f0f0;font-size:14px;}
      .access-gate-input:focus{outline:none;background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.5);box-shadow:0 0 0 3px rgba(240,240,240,.1);}
      .access-gate-submit{height:44px;padding:0 28px;background:linear-gradient(135deg,rgba(240,240,240,.2),rgba(240,240,240,.1));border:1px solid rgba(240,240,240,.3);border-radius:12px;color:#f0f0f0;font-size:13px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;justify-content:center;}
      .access-gate-submit:disabled{opacity:.7;cursor:not-allowed;}
      .access-gate-error{font-size:12px;color:#ff6b6b;padding:12px;background:rgba(255,107,107,.1);border:1px solid rgba(255,107,107,.3);border-radius:8px;margin-bottom:12px;display:none;}
      .access-gate-description{font-size:12px;color:rgba(255,255,255,.6);line-height:1.6;margin-bottom:20px;}
      .access-gate-lang-switch{position:absolute;top:14px;right:14px;display:flex;gap:8px;}
      .lang-btn{padding:6px 14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:6px;color:rgba(255,255,255,.5);font-size:11px;font-weight:600;cursor:pointer;letter-spacing:.5px;}
      .lang-btn.active{background:rgba(240,240,240,.2);border-color:rgba(240,240,240,.4);color:#f0f0f0;}
      .access-gate-studio-footer{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;pointer-events:none;}
      .access-gate-studio-text{font-family:'Courier New','Courier',monospace;font-size:9px;font-weight:600;color:rgba(255,255,255,.6);letter-spacing:.4px;white-space:nowrap;}
      .access-gate-studio-logo{width:20px;height:20px;object-fit:contain;opacity:.5;filter:drop-shadow(0 0 4px rgba(120,210,255,.3));}
      .welcome-overlay{position:absolute;inset:0;background:rgba(20,20,40,.95);border-radius:24px;display:flex;align-items:center;justify-content:center;z-index:100;}
      .welcome-message{font-size:56px;font-weight:700;color:#f0f0f0;text-transform:uppercase;letter-spacing:3px;text-align:center;text-shadow:0 0 30px rgba(120,210,255,.5);}
      @media (max-width:480px){.access-gate-box{padding:32px 24px 70px;border-radius:16px}.access-gate-title{font-size:24px}.access-gate-input-wrapper{flex-direction:column}.access-gate-submit{width:100%}.access-gate-icon{width:60px;height:60px}.welcome-message{font-size:36px}}
    `;
    document.head.appendChild(style);
  }

  function showMainSite() {
    try {
      const container = document.getElementById("accessGateContainer");
      if (container) {
        container.style.display = "none";
        setTimeout(() => container.remove(), 100);
      }
      const styles = document.getElementById("access-gate-styles");
      if (styles) styles.remove();
      document.body.style.overflow = "auto";
      // Trigger app boot (single path to avoid double bindings)
      if (typeof window.initializeApp === "function") {
        window.initializeApp();
      }
    } catch (err) {
      console.error("[ACCESS-GATE] showMainSite error:", err);
    }
  }

  function showAccessGate() {
    const t = TRANSLATIONS[currentAccessGateLang];
    const gateHTML = `
      <div id="accessGateContainer" class="access-gate-container">
        <div class="access-gate-background"></div>
        <div class="access-gate-box">
          <div class="access-gate-content">
            <div class="access-gate-header">
              <div class="access-gate-icon">
                <img src="assets/brand/logo.png" alt="ReyMono Studio" class="access-gate-logo-img" />
              </div>
              <h1 class="access-gate-title">${t.title}</h1>
              <p class="access-gate-subtitle">${t.subtitle}</p>
            </div>
            <form class="access-gate-form" id="accessGateForm">
              <div class="access-gate-input-wrapper">
                <input type="password" id="accessGateInput" class="access-gate-input" placeholder="${t.placeholder}" autocomplete="new-password" required />
                <button type="submit" class="access-gate-submit"><span class="submit-text">${t.access}</span></button>
              </div>
              <div id="accessGateError" class="access-gate-error">${t.error}</div>
            </form>
            <div class="access-gate-description">
              <p>${t.thanks}</p>
              <p>${t.limited}</p>
            </div>
            <div class="access-gate-lang-switch">
              <button class="lang-btn ${currentAccessGateLang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
              <button class="lang-btn ${currentAccessGateLang === 'es' ? 'active' : ''}" data-lang="es">ES</button>
            </div>
            <div class="access-gate-studio-footer">
              <span class="access-gate-studio-text">ReyMono Studio │ Creative Lab</span>
              <img src="assets/brand/businesslogo.png" alt="ReyMono Studio Logo" class="access-gate-studio-logo" />
            </div>
          </div>
        </div>
      </div>
    `;

    const main = document.querySelector("main") || document.querySelector(".grid");
    const container = document.createElement("div");
    container.innerHTML = gateHTML;
    const gateEl = container.firstElementChild;
    if (main) {
      main.parentNode.insertBefore(gateEl, main);
    } else {
      document.body.insertBefore(gateEl, document.body.firstChild);
    }

    addAccessGateStyles();

    const form = document.getElementById("accessGateForm");
    const input = document.getElementById("accessGateInput");
    const errorDiv = document.getElementById("accessGateError");

    if (!form || !input || !errorDiv) {
      console.error("[ACCESS-GATE] Missing form elements");
      return;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = String(input.value || "").trim();
      errorDiv.style.display = "none";

      if (!ALLOWED_PASSWORDS.has(password)) {
        errorDiv.textContent = t.error;
        errorDiv.style.display = "block";
        input.value = "";
        input.focus();
        return;
      }

      writeToken(0);

      const gateContainer = document.getElementById("accessGateContainer");
      if (gateContainer) gateContainer.classList.add("fade-out");
      await new Promise((resolve) => setTimeout(resolve, 600));
      showMainSite();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && typeof form.requestSubmit === "function") {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    input.focus();

    document.querySelectorAll(".lang-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const lang = btn.dataset.lang || "en";
        currentAccessGateLang = lang;
        localStorage.setItem("accessGateLang", lang);
        document.querySelectorAll(".lang-btn").forEach(b => b.classList.toggle("active", b.dataset.lang === lang));
        const t2 = TRANSLATIONS[lang];
        const title = document.querySelector(".access-gate-title");
        const subtitle = document.querySelector(".access-gate-subtitle");
        if (title) title.textContent = t2.title;
        if (subtitle) subtitle.textContent = t2.subtitle;
        input.placeholder = t2.placeholder;
        const submitText = document.querySelector(".submit-text");
        if (submitText) submitText.textContent = t2.access;
        errorDiv.textContent = t2.error;
        const desc = document.querySelectorAll(".access-gate-description p");
        if (desc.length >= 2) {
          desc[0].textContent = t2.thanks;
          desc[1].textContent = t2.limited;
        }
      });
    });
  }

  function initAccessGate() {
    if (hasValidAccess()) {
      showMainSite();
    } else {
      showAccessGate();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccessGate);
  } else {
    initAccessGate();
  }
})();
