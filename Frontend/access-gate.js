/**
 * Early Access Gate (Beta) - DISABLED
 * Gate access has been completely disabled
 */

const GATE_VERSION = "2026-02-03-disabled";

const ACCESS_TOKEN_KEY = "beta_access_token";
const GENERATION_LIMIT = 10;
const LIMIT_WINDOW = 24 * 60 * 60 * 1000;

let accessGranted = false;
const ACCESS_GRANTED_KEY = "beta_access_granted";

let currentAccessGateLang = localStorage.getItem("accessGateLang") || "en";

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

/**
 * Inicializa la puerta de acceso - DISABLED
 */
function initAccessGate() {
  console.log("%c[GATE] DISABLED - Gate access is completely bypassed", "color: red; font-size: 16px; font-weight: bold;");
  accessGranted = true;
  localStorage.setItem(ACCESS_GRANTED_KEY, "true");
  showMainSite();
  return;
    showMainSite();
    return;
  }

  // Mostrar puerta de acceso
  showAccessGate();
}

/**
 * Verifica si el usuario tiene acceso válido
 */
function hasValidAccess() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) return false;

  const tokenData = JSON.parse(token);
  const now = Date.now();

  // Validar que el token no haya expirado (7 días)
  if (now - tokenData.timestamp > 7 * 24 * 60 * 60 * 1000) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    return false;
  }

  return true;
}

/**
 * Muestra la puerta de acceso
 */
function showAccessGate() {
  const t = TRANSLATIONS[currentAccessGateLang];
  
  const gateHTML = `
    <div id="accessGateContainer" class="access-gate-container">
      <!-- Fondo con blur de perro -->
      <div class="access-gate-background"></div>

      <!-- Contenedor del recuadro -->
      <div class="access-gate-box">
        <div class="access-gate-content">
          <!-- Logo temático -->
          <div class="access-gate-header">
            <div class="access-gate-icon">
              <img src="assets/brand/logo.png" alt="ReyMono Studio" class="access-gate-logo-img" />
            </div>
            <h1 class="access-gate-title">${t.title}</h1>
            <p class="access-gate-subtitle">${t.subtitle}</p>
          </div>

          <!-- Input de contraseña -->
          <form class="access-gate-form" id="accessGateForm">
            <div class="access-gate-input-wrapper">
              <input
                type="password"
                id="accessGateInput"
                class="access-gate-input"
                placeholder="${t.placeholder}"
                autocomplete="off"
                required
              />
              <button type="submit" class="access-gate-submit">
                <span class="submit-text">${t.access}</span>
                <span class="submit-loading" style="display: none;">
                  <span class="loading-dot"></span>
                  <span class="loading-dot"></span>
                  <span class="loading-dot"></span>
                </span>
              </button>
            </div>

            <!-- Mensaje de error -->
            <div id="accessGateError" class="access-gate-error" style="display: none;">
              ${t.error}
            </div>
          </form>

          <!-- Descripción -->
          <div class="access-gate-description">
            <p>${t.thanks}</p>
            <p>${t.limited}</p>
          </div>

          <!-- Switch de idioma -->
          <div class="access-gate-lang-switch">
            <button class="lang-btn ${currentAccessGateLang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
            <button class="lang-btn ${currentAccessGateLang === 'es' ? 'active' : ''}" data-lang="es">ES</button>
          </div>

          <!-- Studio Footer con marca del negocio -->
          <div class="access-gate-studio-footer">
            <span class="access-gate-studio-text">ReyMono Studio │ Creative Lab</span>
            <img src="assets/brand/businesslogo.png" alt="ReyMono Studio Logo" class="access-gate-studio-logo" />
          </div>
        </div>
      </div>

      <!-- Animación de aroma flotante -->
      <div class="aroma-particles" id="aromaParticles"></div>
    </div>
  `;

  // Insertar en el body (antes del main o al inicio del body)
  const main = document.querySelector("main") || document.querySelector(".grid");
  const insertPoint = main || document.body;
  const container = document.createElement("div");
  container.innerHTML = gateHTML;
  
  if (main) {
    main.parentNode.insertBefore(container, main);
  } else {
    document.body.insertBefore(container, document.body.firstChild);
  }

  // Agregar estilos
  addAccessGateStyles();

  // Event listeners
  const form = document.getElementById("accessGateForm");
  const input = document.getElementById("accessGateInput");

  form.addEventListener("submit", handleAccessSubmit);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") form.submit();
  });

  // Language switch listeners
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      handleLanguageSwitch(btn.dataset.lang);
    });
  });

  // Focus automático
  input.focus();
}

/**
 * Maneja el cambio de idioma
 */
function handleLanguageSwitch(lang) {
  currentAccessGateLang = lang;
  localStorage.setItem("accessGateLang", lang);
  
  // Actualizar botones activos
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });

  const t = TRANSLATIONS[lang];
  const container = document.getElementById("accessGateContainer");

  if (container) {
    // Actualizar textos
    document.querySelector(".access-gate-title").textContent = t.title;
    document.querySelector(".access-gate-subtitle").textContent = t.subtitle;
    document.getElementById("accessGateInput").placeholder = t.placeholder;
    document.querySelector(".submit-text").textContent = t.access;
    document.getElementById("accessGateError").textContent = t.error;
    
    const descriptions = document.querySelectorAll(".access-gate-description p");
    descriptions[0].textContent = t.thanks;
    descriptions[1].textContent = t.limited;
  }
}

/**
 * Maneja el envío de la contraseña
 */
async function handleAccessSubmit(e) {
  e.preventDefault();

  const input = document.getElementById("accessGateInput");
  const button = e.target.querySelector(".access-gate-submit");
  const errorDiv = document.getElementById("accessGateError");
  const password = input.value.trim();
  const t = TRANSLATIONS[currentAccessGateLang];

  // Limpiar error previo
  errorDiv.style.display = "none";

  // Validar
  if (password !== BETA_PASSWORD) {
    errorDiv.textContent = t.error;
    errorDiv.style.display = "block";
    input.value = "";
    input.focus();

    // Shake animation
    const box = document.querySelector(".access-gate-box");
    box.classList.add("shake");
    setTimeout(() => box.classList.remove("shake"), 500);
    return;
  }

  // Mostrar loading
  button.disabled = true;
  button.querySelector(".submit-text").style.display = "none";
  button.querySelector(".submit-loading").style.display = "inline-flex";

  // Animación de aroma
  playAromaAnimation();

  // Mostrar "Welcome" y esperar más tiempo (3.5 segundos para cargar)
  showWelcomeMessage();
  await new Promise((resolve) => setTimeout(resolve, 3500));

  // Guardar acceso
  const token = {
    timestamp: Date.now(),
    generations: 0,
  };
  localStorage.setItem(ACCESS_TOKEN_KEY, JSON.stringify(token));
  localStorage.setItem(ACCESS_GRANTED_KEY, "true");
  
  // Marcar acceso como otorgado para evitar reiniciar el gate
  accessGranted = true;

  // Transición suave
  const container = document.getElementById("accessGateContainer");
  container.classList.add("fade-out");

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mostrar sitio - prevenir eventos secundarios
  showMainSite();
}

/**
 * Muestra el mensaje "Welcome" durante la carga
 */
function showWelcomeMessage() {
  const t = TRANSLATIONS[currentAccessGateLang];
  const container = document.getElementById("accessGateContainer");
  
  // Crear overlay de bienvenida
  const welcomeOverlay = document.createElement("div");
  welcomeOverlay.className = "welcome-overlay";
  welcomeOverlay.innerHTML = `<div class="welcome-message">${t.welcome}</div>`;
  
  container.appendChild(welcomeOverlay);
}

/**
 * Reproduce la animación de aroma
 */
function playAromaAnimation() {
  const particles = document.getElementById("aromaParticles");
  const particleCount = 20;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "aroma-particle";

    const x = 50 + (Math.random() - 0.5) * 40;
    const y = 40 + (Math.random() - 0.5) * 30;
    const delay = Math.random() * 0.3;

    particle.style.setProperty("--x", `${x}%`);
    particle.style.setProperty("--y", `${y}%`);
    particle.style.setProperty("--delay", `${delay}s`);

    particles.appendChild(particle);
  }
}

/**
 * Muestra el sitio principal
 */
function showMainSite() {
  try {
    // Encontrar y remover el gate
    const container = document.getElementById("accessGateContainer");
    if (container) {
      container.remove();
    }

    // Remover estilos inyectados por el gate
    const styles = document.querySelectorAll("style");
    styles.forEach((s) => {
      if (s.textContent && s.textContent.includes("ACCESS GATE STYLES")) {
        s.remove();
      }
    });

    // Asegurar que no hay overlay
    document.body.style.overflow = "auto";

    // Mostrar elementos del sitio con pequeño delay para evitar race conditions
    setTimeout(() => {
      const topbar = document.querySelector(".topbar");
      const grid = document.querySelector(".grid");
      const footer = document.querySelector(".studioFooter");
      
      if (topbar) {
        topbar.style.display = "flex";
        topbar.style.opacity = "0";
        topbar.classList.add("fade-in");
        // Forzar reflow
        void topbar.offsetHeight;
        topbar.style.opacity = "1";
      }
      if (grid) {
        grid.style.display = "grid";
        grid.style.opacity = "0";
        grid.classList.add("fade-in");
        void grid.offsetHeight;
        grid.style.opacity = "1";
      }
      if (footer) {
        footer.style.display = "flex";
        footer.style.opacity = "0";
        footer.classList.add("fade-in");
        void footer.offsetHeight;
        footer.style.opacity = "1";
      }

      // Inicializar el sitio normalmente
      if (typeof initializeApp === "function") {
        initializeApp();
      }
    }, 120);
  } catch (err) {
    console.error("Error en showMainSite:", err);
  }
}

/**
 * Agrega los estilos de la puerta de acceso
 */
function addAccessGateStyles() {
  const style = document.createElement("style");
  style.textContent = `
    /* ==== ACCESS GATE STYLES ==== */
    .access-gate-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      background: rgba(12, 12, 24, 0.75);
      animation: access-gate-fade-in 0.6s ease-out;
      backdrop-filter: blur(8px);
    }

    .access-gate-container.fade-out {
      animation: access-gate-fade-out 0.8s ease-in forwards;
    }

    @keyframes access-gate-fade-in {
      from {
        opacity: 0;
        backdrop-filter: blur(0px);
      }
      to {
        opacity: 1;
        backdrop-filter: blur(10px);
      }
    }

    @keyframes access-gate-fade-out {
      from {
        opacity: 1;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(1.05);
      }
    }

    /* Fondo con imagen de perro */
    .access-gate-background {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url("assets/bg/Background.png");
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      filter: blur(15px);
      opacity: 0.3;
      z-index: 0;
    }

    /* Recuadro principal con más transparencia */
    .access-gate-box {
      position: relative;
      z-index: 10;
      background: rgba(18, 18, 32, 0.42);
      backdrop-filter: blur(22px);
      border: 1px solid rgba(240, 240, 240, 0.14);
      border-radius: 24px;
      padding: 64px 36px 96px 36px;
      max-width: 420px;
      width: 90%;
      box-shadow:
        0 10px 36px rgba(0, 0, 0, 0.35),
        inset 0 1px 1px rgba(255, 255, 255, 0.12);
      animation: access-gate-slide-up 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes access-gate-slide-up {
      from {
        opacity: 0;
        transform: translateY(40px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .access-gate-box.shake {
      animation: access-gate-shake 0.5s;
    }

    @keyframes access-gate-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-10px); }
      50% { transform: translateX(10px); }
      75% { transform: translateX(-10px); }
    }

    .access-gate-content {
      text-align: center;
      position: relative;
    }

    /* Header con logo */
    .access-gate-header {
      margin-bottom: 36px;
      margin-top: 8px;
    }

    .access-gate-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      color: #f0f0f0;
      opacity: 0.9;
      animation: access-gate-icon-float 3s ease-in-out infinite;
    }

    @keyframes access-gate-icon-float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }

    .access-gate-logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4));
    }

    .access-gate-title {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 2px;
      margin: 0;
      color: #f0f0f0;
      text-transform: uppercase;
    }

    .access-gate-subtitle {
      font-size: 13px;
      color: #aaa;
      margin: 8px 0 0 0;
      letter-spacing: 1px;
      text-transform: uppercase;
      opacity: 0.7;
    }

    /* Form */
    .access-gate-form {
      margin-bottom: 24px;
    }

    .access-gate-input-wrapper {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }

    .access-gate-input {
      flex: 1;
      height: 44px;
      padding: 0 16px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      color: #f0f0f0;
      font-size: 14px;
      transition: all 0.3s ease;
      font-family: inherit;
    }

    .access-gate-input:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .access-gate-input:focus {
      outline: none;
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.5);
      box-shadow: 0 0 0 3px rgba(240, 240, 240, 0.1);
    }

    .access-gate-input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }

    .access-gate-submit {
      height: 44px;
      padding: 0 28px;
      background: linear-gradient(135deg, rgba(240, 240, 240, 0.2), rgba(240, 240, 240, 0.1));
      border: 1px solid rgba(240, 240, 240, 0.3);
      border-radius: 12px;
      color: #f0f0f0;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: inherit;
      white-space: nowrap;
    }

    .access-gate-submit:hover:not(:disabled) {
      background: linear-gradient(135deg, rgba(240, 240, 240, 0.3), rgba(240, 240, 240, 0.2));
      border-color: rgba(240, 240, 240, 0.5);
      box-shadow: 0 4px 12px rgba(240, 240, 240, 0.15);
    }

    .access-gate-submit:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .submit-loading {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      justify-content: center;
    }

    .loading-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #f0f0f0;
      animation: access-gate-dot-bounce 1.4s infinite;
    }

    .loading-dot:nth-child(1) {
      animation-delay: 0s;
    }

    .loading-dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .loading-dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes access-gate-dot-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-10px); }
    }

    /* Error message */
    .access-gate-error {
      font-size: 12px;
      color: #ff6b6b;
      animation: access-gate-slide-down 0.3s ease-out;
      padding: 12px;
      background: rgba(255, 107, 107, 0.1);
      border: 1px solid rgba(255, 107, 107, 0.3);
      border-radius: 8px;
      margin-bottom: 12px;
    }

    @keyframes access-gate-slide-down {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Description */
    .access-gate-description {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.6;
      margin-bottom: 20px;
    }

    .access-gate-description p {
      margin: 8px 0;
    }

    /* Language Switch */
    .access-gate-lang-switch {
      position: absolute;
      top: 14px;
      right: 14px;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-bottom: 0;
      z-index: 20;
    }

    .lang-btn {
      padding: 6px 14px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.5);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .lang-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.7);
    }

    .lang-btn.active {
      background: rgba(240, 240, 240, 0.2);
      border-color: rgba(240, 240, 240, 0.4);
      color: #f0f0f0;
    }

    /* Studio Footer - Bottom Center */
    .access-gate-studio-footer {
      position: absolute;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 0;
      pointer-events: none;
    }

    .access-gate-studio-text {
      font-family: 'Courier New', 'Courier', monospace;
      font-size: 9px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
      letter-spacing: 0.4px;
      white-space: nowrap;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
    }

    .access-gate-studio-logo {
      width: 20px;
      height: 20px;
      object-fit: contain;
      opacity: 0.5;
      filter: drop-shadow(0 0 4px rgba(120, 210, 255, 0.3));
      transition: filter 180ms ease;
    }

    .access-gate-studio-footer:hover .access-gate-studio-logo {
      filter: drop-shadow(0 0 8px rgba(120, 210, 255, 0.6));
    }

    /* Welcome Message */
    .welcome-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(20, 20, 40, 0.95);
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: welcome-fade-in 0.8s ease-out;
      z-index: 100;
      backdrop-filter: blur(3px);
    }

    @keyframes welcome-fade-in {
      0% {
        opacity: 0;
        backdrop-filter: blur(0px);
      }
      100% {
        opacity: 1;
        backdrop-filter: blur(3px);
      }
    }

    .welcome-message {
      font-size: 56px;
      font-weight: 700;
      color: #f0f0f0;
      text-transform: uppercase;
      letter-spacing: 3px;
      text-align: center;
      animation: welcome-scale 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      text-shadow: 0 0 30px rgba(120, 210, 255, 0.5);
    }

    @keyframes welcome-scale {
      0% {
        opacity: 0;
        transform: scale(0.5);
      }
      60% {
        opacity: 1;
        transform: scale(1.1);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }

    /* Partículas de aroma */
    .aroma-particles {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 5;
      pointer-events: none;
    }

    .aroma-particle {
      position: absolute;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(240, 240, 240, 0.8), rgba(240, 240, 240, 0));
      animation: access-gate-particle-float 2s ease-out forwards;
      opacity: 0;
    }

    @keyframes access-gate-particle-float {
      0% {
        opacity: 1;
        transform: translate(0, 0) scale(1);
      }
      100% {
        opacity: 0;
        transform: translate(var(--x), var(--y)) scale(0);
      }
    }

    /* Transición fade-in del sitio */
    main.fade-in {
      animation: access-gate-main-fade-in 0.8s ease-out;
    }

    @keyframes access-gate-main-fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* Mobile responsive */
    @media (max-width: 480px) {
      .access-gate-box {
        padding: 32px 24px 70px 24px;
        border-radius: 16px;
      }

      .access-gate-title {
        font-size: 24px;
      }

      .access-gate-input-wrapper {
        flex-direction: column;
      }

      .access-gate-submit {
        width: 100%;
      }

      .access-gate-icon {
        width: 60px;
        height: 60px;
      }

      .welcome-message {
        font-size: 36px;
      }
    }
  `;

  document.head.appendChild(style);
}

/**
 * Obtiene el número de generaciones usadas hoy
 */
function getGenerationsUsedToday() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) return 0;

  const tokenData = JSON.parse(token);
  const now = Date.now();
  const tokenTime = tokenData.timestamp;

  // Si pasó más de 24 horas, reiniciar contador
  if (now - tokenTime > LIMIT_WINDOW) {
    tokenData.generations = 0;
    tokenData.timestamp = now;
    localStorage.setItem(ACCESS_TOKEN_KEY, JSON.stringify(tokenData));
  }

  return tokenData.generations || 0;
}

/**
 * Incrementa el contador de generaciones
 */
function incrementGenerationCounter() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) return;

  const tokenData = JSON.parse(token);
  tokenData.generations = (tokenData.generations || 0) + 1;
  localStorage.setItem(ACCESS_TOKEN_KEY, JSON.stringify(tokenData));
}

/**
 * Verifica si se alcanzó el límite de generaciones
 */
function hasReachedGenerationLimit() {
  return getGenerationsUsedToday() >= GENERATION_LIMIT;
}

/**
 * Obtiene información del límite de generaciones
 */
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
