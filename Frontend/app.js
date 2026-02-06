(() => {
  // =========================
  // What's The Smell? (Frontend)
  // Robust bindings: language + category + generate
  // =========================

  console.log("%c[APP] update 9:15 PM 2.5.26 | Gate: 24h active", "color: lime; font-size: 14px; font-weight: bold;");

  // ===== API base (works for localhost:3000 + prod) =====
  const API = (() => {
    const forced = String(window.WTS_API_BASE || "").trim().replace(/\/+$/, "");
    if (forced) return forced;

    const isLocal3000 =
      window.location.hostname === "localhost" &&
      window.location.port === "3000";

    if (isLocal3000) return "http://localhost:5051";
    
    // Production: use Railway API
    const isProduction = window.location.hostname !== "localhost";
    if (isProduction) return "https://whats-the-smell-production.up.railway.app";
    
    return window.location.origin.replace(/\/+$/, "");
  })();

  // ===== DOM =====
  const el = {
    langSelect: document.getElementById("langSelect"),
    langSwitch: document.getElementById("langSwitch"),

    appLogoImg: document.getElementById("appLogoImg"),

    characterLabel: document.getElementById("characterLabel"),
    characterInput: document.getElementById("characterInput"),

    categoryLabel: document.getElementById("categoryLabel"),
    categorySelect: document.getElementById("categorySelect"),
    categoryDD: document.getElementById("categoryDD"),
    categoryBtn: document.getElementById("categoryBtn"),
    categoryArrowLeft: document.getElementById("categoryArrowLeft"),
    categoryArrowRight: document.getElementById("categoryArrowRight"),
    categoryValue: document.getElementById("categoryValue"),
    categoryValueActive: document.getElementById("categoryValueActive"),

    smellBtn: document.getElementById("smellBtn"),
    clearBtn: document.getElementById("clearBtn"),
    statusText: document.getElementById("statusText"),
    errorBox: document.getElementById("errorBox"),

    outputLabel: document.getElementById("outputLabel"),
    outputBox: document.getElementById("outputBox"),

    visualTitle1: document.getElementById("visualTitle1"),
    visualTitle2: document.getElementById("visualTitle2"),
    curiosityTitle: document.getElementById("curiosityTitle"),
    curiosityBox: document.getElementById("curiosityBox"),

    characterImg: document.getElementById("characterImg"),
    visualCharText: document.getElementById("visualCharText"),
    loadingSpinner: document.getElementById("loadingSpinner"),

    compImg: [
      document.getElementById("compImg1"),
      document.getElementById("compImg2"),
      document.getElementById("compImg3"),
      document.getElementById("compImg4"),
    ],
    compName: [
      document.getElementById("compName1"),
      document.getElementById("compName2"),
      document.getElementById("compName3"),
      document.getElementById("compName4"),
    ],
  };

  // ===== Guard: if DOM missing, stop gracefully =====
  const required = ["langSelect", "langSwitch", "characterInput", "categoryBtn", "smellBtn", "clearBtn", "outputBox"];
  for (const k of required) {
    if (!el[k]) {
      console.error("[WTS] Missing DOM element:", k);
      return;
    }
  }

  // ===== TRANSLATION ENGINE (Using free API) =====
  const TRANSLATOR = (() => {
    const apiUrl = "https://api.mymemory.translated.net/get";
    
    // Cache local para traducciones ya realizadas
    const translationCache = {};

    async function translateText(text, targetLang) {
      if (!text || typeof text !== 'string' || text.length === 0) return text;
      
      // Revisar cache primero
      const cacheKey = `${targetLang}::${text}`;
      if (translationCache[cacheKey]) {
        return translationCache[cacheKey];
      }

      try {
        const response = await fetch(
          `${apiUrl}?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
        );
        const data = await response.json();
        
        if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
          const translated = data.responseData.translatedText;
          translationCache[cacheKey] = translated;
          return translated;
        }
      } catch (e) {
        console.warn("Translation API failed:", e.message);
      }
      
      // Si falla, devuelve el original
      return text;
    }

    return {
      // Translate from EN to ES using API
      enToEs: async (text) => {
        return await translateText(text, "es");
      },
      
      // Cache helper
      addPhrases: (newMap) => {
        Object.assign(translationCache, newMap);
      }
    };
  })();

  // ===== I18N =====
  const I18N = {
    en: {
      appTitle: "What's the Smell?",
      character: "Character",
      category: "Category",
      identify: "Identify scent",
      reset: "New trail",
      working: "Revealing the essence…",
      translating: "Adding final aromatic touches…",
      done: "Scent identified",
      scentProfile: "Scent profile…",
      characterVisual: "Character visual",
      scentNotesVisual: "Aroma profile",
      noImageYet: "No image yet",
      unknown: "unknown",
      enterCharacter: "Enter a character.",
      placeholder: "e.g., Naruto",
      errorGeneric: "Something went wrong.",
      selectCategory: "Please select a category.",
    
    sheetName: "Name:",
    sheetUniverse: "Universe:",
    sheetCategory: "Category:",
    sheetAromaType: "Aroma Type:",
    sheetMainSensation: "Main Sensation:",
    sheetOlfactoryStyle: "Olfactory Style:",
    sheetLastImpression: "Last Impression:",
    aromaFound: "Aroma identified",},
    es: {
      appTitle: "¿A qué huele?",
      character: "Personaje",
      category: "Categoría",
      identify: "Identificar aroma",
      reset: "Seguir otro rastro",
      working: "Revelando la esencia…",
      translating: "Añadiendo últimos toques aromáticos…",
      done: "Aroma identificado",
      scentProfile: "Perfil aromático…",
      characterVisual: "Visual del personaje",
      scentNotesVisual: "Perfil aromático",
      noImageYet: "Sin imagen aún",
      unknown: "desconocido",
      enterCharacter: "Escribe un personaje.",
      placeholder: "ej., Naruto",
      errorGeneric: "Ocurrió un error.",
      selectCategory: "Por favor selecciona una categoría.",
      sheetName: "Nombre:",
      sheetUniverse: "Universo:",
      sheetCategory: "Categoría:",
      sheetAromaType: "Tipo de aroma:",
      sheetMainSensation: "Sensación Principal:",
      sheetOlfactoryStyle: "Estilo Olfativo:",
      sheetLastImpression: "Impresión Final:",
      aromaFound: "Aroma identificado",
    },
  };

  // ===== Aroma Curiosities (Loading Screen) =====
  const AROMA_CURIOSITIES = {
    en: [
      "In many fantasy stories, wizards are often described with incense or resin aromas, associated with ancient rituals.",
      "In sci-fi cinema, futuristic laboratories tend to smell of ozone to suggest advanced technology.",
      "In post-apocalyptic universes, the persistent aroma of dust and burnt metal reinforces the sense of a destroyed world.",
      "Immortal characters in fiction are often associated with cold or mineral scents to convey antiquity.",
      "In anime, calm heroes are often described with subtle aromas like tea or wood.",
      "Many classic villains are linked to smoke or sulfur scents to emphasize their threat.",
      "In space stories, the void is symbolically represented with metallic and sterile aromas.",
      "Enchanted forests in fantasy often smell of moss, damp earth, and ancient leaves.",
      "In cyberpunk novels, futuristic cities combine aromas of rain, neon, and hot cables.",
      "Dragons in fiction are often associated with aromas of fire, ash, and ancient leather.",
      "Androids are often described with clean or synthetic scents to differentiate them from humans.",
      "In fictional underwater worlds, saline aromas reinforce sensory immersion.",
      "Royal palaces in fantasy often smell of candles, dried flowers, and cold stone.",
      "Veteran warriors are associated with scents of metal, leather, and battle dust.",
      "In horror stories, cursed places are often described with aromas of humidity and mold.",
      "Time travel in fiction often includes electric or ozonic scents.",
      "Elves are often linked with natural aromas like flowers, sap, and fresh air.",
      "Ancient spaceships are described with scents of oil and aged metal.",
      "In dystopias, contaminated air is represented with chemical and acrid aromas.",
      "Wise elders in fiction often smell of parchment and old wood.",
    ],
    es: [
      "En muchas historias de fantasía, los magos suelen describirse con aromas a incienso o resina, asociados a rituales antiguos.",
      "En el cine de ciencia ficción, los laboratorios futuristas suelen oler a ozono para sugerir tecnología avanzada.",
      "En universos postapocalípticos, el aroma persistente a polvo y metal quemado refuerza la sensación de mundo destruido.",
      "Los personajes inmortales en la ficción a menudo se asocian con olores fríos o minerales para transmitir antigüedad.",
      "En el anime, los héroes tranquilos suelen describirse con aromas suaves como té o madera.",
      "Muchos villanos clásicos están vinculados a olores a humo o azufre para enfatizar su amenaza.",
      "En historias espaciales, el vacío se representa simbólicamente con aromas metálicos y estériles.",
      "Los bosques encantados en la fantasía suelen oler a musgo, tierra húmeda y hojas antiguas.",
      "En novelas cyberpunk, las ciudades futuristas combinan olores a lluvia, neón y cables calientes.",
      "Los dragones en la ficción suelen asociarse con aromas a fuego, ceniza y cuero antiguo.",
      "Los androides se describen a menudo con olores limpios o sintéticos para diferenciarlos de humanos.",
      "En mundos submarinos ficticios, los aromas salinos refuerzan la inmersión sensorial.",
      "Los palacios reales en la fantasía suelen oler a velas, flores secas y piedra fría.",
      "Los guerreros veteranos se asocian con olores a metal, cuero y polvo de batalla.",
      "En historias de terror, los lugares malditos suelen describirse con aromas a humedad y moho.",
      "Los viajes en el tiempo en la ficción a menudo incluyen olores eléctricos u ozónicos.",
      "Los elfos suelen vincularse con aromas naturales como flores, savia y aire fresco.",
      "Las naves espaciales antiguas se describen con olores a aceite y metal envejecido.",
      "En distopías, el aire contaminado se representa con aromas químicos y ásperos.",
      "Los sabios ancianos en la ficción suelen oler a pergamino y madera vieja.",
    ],
  };

  // ===== Categories =====
    const CATEGORIES = [
    { id: "any",      en: "Choose one",        es: "Elige una" },
    { id: "anime",    en: "Anime/Manga",       es: "Anime/Manga" },
    { id: "games",    en: "Video Games",       es: "Videojuegos" },
    { id: "movies",   en: "Movies/TV",         es: "Películas/TV" },
    { id: "comics",   en: "Comics",            es: "Cómics" },
    { id: "books",    en: "Books/Novels",      es: "Libros/Novelas" },
    { id: "cartoons", en: "Cartoons",          es: "Caricaturas" },
    { id: "myth",     en: "Myth/Folklore",     es: "Mito/Folclore" },
  ];

  // ===== State =====
  const state = {
    busy: false,
    hasResult: false,

    ddOpen: false,
    focusIndex: 0,
    selectedCategory: "any",

    resultEn: "",
    resultEs: "",
    lastCharacter: "",
    officialName: "",
    characterName: "",
    characterUniverse: "",
    currentErrorKey: null, // Guardar la clave del error actual para retraducir
    isInitialLoad: true, // Flag to skip animation on first load
  };

  // ===== Helpers =====

// Sanitize filename-like strings (matches backend behavior)
function sanitizeFilename(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// Try loading a cached generated image directly from /generated as a fallback
async function tryLoadCachedGeneratedImage(charName) {
  const base = sanitizeFilename(charName);
  if (!base) return false;
  const exts = ["png", "jpg", "webp"];

  // Try each extension until one loads
  for (const ext of exts) {
    const candidate = `${API}/generated/${base}.${ext}`;
    const ok = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      // cache-bust lightly in case browser cached a 404
      img.src = `${candidate}?v=${Date.now()}`;
    });
    if (ok) {
      el.characterImg.src = `${candidate}?v=${Date.now()}`;
      el.characterImg.style.display = "block";
      return true;
    }
  }
  return false;
}

  function curLang() {
    return (el.langSelect.value || "en").toLowerCase().startsWith("es") ? "es" : "en";
  }
  function t(key) {
    const lang = curLang();
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  }
  function categoryLabelFor(id) {
    const lang = curLang();
    const hit = CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
    return lang === "es" ? hit.es : hit.en;
  }
  function showError(msg, errorKey = null) {
    // Si msg es una cadena directa, usarla; si es una clave, traducir
    const finalMsg = typeof msg === 'string' ? msg : t(msg);
    el.errorBox.textContent = finalMsg || t("errorGeneric");
    el.errorBox.classList.add("visible");
    
    // Guardar la clave para poder retraducir cuando cambie de idioma
    if (errorKey) {
      state.currentErrorKey = errorKey;
    }
    
    // IMPORTANT: Cerrar dropdown cuando hay error para evitar estado inconsistente
    if (state.ddOpen) {
      ddClose();
    }
  }
  function clearError() {
    el.errorBox.textContent = "";
    el.errorBox.classList.remove("visible");
    state.currentErrorKey = null;
  }
  
  // ===== Loading Screen with Curiosities (Parallel Language Streams) =====
  let loadingDotsInterval = null;
  let curiosityIntervals = {}; // { en: interval, es: interval }
  let loadingActive = false;
  let curiosityStates = {
    en: { index: 0, curiosities: [], shuffled: [] },
    es: { index: 0, curiosities: [], shuffled: [] }
  };
  
  // Función para barajar array (Fisher-Yates shuffle)
  function shuffleArray(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  
  function startLoadingScreen() {
    if (loadingActive) return;
    loadingActive = true;
    
    // Inicializar curiosidades para ambos idiomas con barajado aleatorio
    curiosityStates.en.curiosities = AROMA_CURIOSITIES.en || [];
    curiosityStates.es.curiosities = AROMA_CURIOSITIES.es || [];
    curiosityStates.en.shuffled = shuffleArray(curiosityStates.en.curiosities);
    curiosityStates.es.shuffled = shuffleArray(curiosityStates.es.curiosities);
    curiosityStates.en.index = 0;
    curiosityStates.es.index = 0;
    
    // Mostrar puntos cargando (actualizar según idioma actual)
    let dotCount = 0;
    const loadingMessages = {
      en: "Identifying aroma",
      es: "Identificando aroma"
    };
    
    loadingDotsInterval = setInterval(() => {
      dotCount = (dotCount + 1) % 4;
      const dots = ".".repeat(dotCount);
      const lang = curLang();
      const text = loadingMessages[lang] + dots;
      if (el.statusText) el.statusText.textContent = text;
    }, 500);
    
    // Función para mostrar curiosidad de un idioma específico
    const showCuriosity = (lang) => {
      // CRÍTICO: Verificar que loadingActive siga siendo true
      if (!loadingActive) return;
      
      const state = curiosityStates[lang];
      if (!state || state.shuffled.length === 0) return;
      
      // Obtener la siguiente curiosidad de la lista barajada
      const curiosity = state.shuffled[state.index % state.shuffled.length];
      state.index++;
      
      // Solo actualizar el outputBox si estamos en el idioma correcto Y la carga sigue activa
      if (loadingActive && curLang() === lang && el.outputBox) {
        el.outputBox.style.transition = "opacity 0.5s ease-in-out";
        el.outputBox.style.opacity = "0";
        
        setTimeout(() => {
          // Verificar nuevamente que sigue en carga ANTES de actualizar
          if (loadingActive && curLang() === lang && el.outputBox) {
            el.outputBox.textContent = curiosity;
            el.outputBox.style.opacity = "1";
          }
        }, 250);
      }
    };
    
    // Mostrar primera curiosidad inmediatamente en idioma actual
    showCuriosity(curLang());
    
    // Iniciar los intervalos de curiosidades para ambos idiomas (8 segundos cada una)
    // 6s visible + 2s fade in/out
    curiosityIntervals.en = setInterval(() => showCuriosity('en'), 8000);
    curiosityIntervals.es = setInterval(() => showCuriosity('es'), 8000);
  }
  
  function stopLoadingScreen() {
    loadingActive = false;
    
    // Detener TODOS los intervalos inmediatamente
    if (loadingDotsInterval) {
      clearInterval(loadingDotsInterval);
      loadingDotsInterval = null;
    }
    
    if (curiosityIntervals.en) {
      clearInterval(curiosityIntervals.en);
      curiosityIntervals.en = null;
    }
    
    if (curiosityIntervals.es) {
      clearInterval(curiosityIntervals.es);
      curiosityIntervals.es = null;
    }
    
    // Limpiar outputBox SOLO si no hay resultado
    if (el.outputBox && !state.hasResult) {
      el.outputBox.style.opacity = "1";
      el.outputBox.style.transition = "opacity 0.2s ease-in";
      el.outputBox.textContent = "";
    }
    
    // Resetear estado de curiosidades para ambos idiomas
    curiosityStates.en.index = 0;
    curiosityStates.es.index = 0;
    curiosityStates.en.shuffled = [];
    curiosityStates.es.shuffled = [];
  }
  
  function setStatus(mode) {
    if (!el.statusText) return;
    if (mode === "idle") el.statusText.textContent = "";
    else if (mode === "working") {
      el.statusText.textContent = t("working");
      startLoadingScreen();
    }
    else if (mode === "translating") el.statusText.textContent = t("translating");
    else if (mode === "done") {
      stopLoadingScreen();
      el.statusText.textContent = t("aromaFound");
    }
    else el.statusText.textContent = "";
  }
  function setOutput(text) {
    el.outputBox.textContent = text || "";
  }

  function computeCategoryButtonWidth() {
    // Unifica el ancho de ambas cajas (Personaje/Categoría) basado en la etiqueta más larga.
    const cs = window.getComputedStyle(el.categoryBtn);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = font;

    let maxLabelW = 0;
    for (const c of CATEGORIES) {
      const label = curLang() === "es" ? c.es : c.en;
      maxLabelW = Math.max(maxLabelW, ctx.measureText(label).width);
    }

    const pad = 56;    // padding interno total aproximado
    const arrows = 56; // flechas + espacios
    const safety = 24;

    const raw = Math.ceil(maxLabelW + pad + arrows + safety);
    const total = Math.max(240, Math.min(raw, 340)); // clamp para evitar “línea” de glow

    document.documentElement.style.setProperty("--fieldW", `${total}px`);
  }

  // ===== UI copy =====
  function setLogoForLang(skipAnimation = false) {
    if (!el.appLogoImg) return;
    const appLogo = el.appLogoImg.closest('.appLogo');
    
    // Skip animation on initial load
    if (skipAnimation) {
      el.appLogoImg.src = curLang() === "es" ? "assets/brand/logo-es.png" : "assets/brand/logo-en.png";
      el.appLogoImg.alt = curLang() === "es" ? "¿A qué huele?" : "What's the Smell?";
      document.title = curLang() === "es" ? "¿A qué huele?" : "What's the Smell?";
      return;
    }
    
    // Trigger evaporation animation
    if (appLogo) {
      appLogo.classList.remove('is-appearing');
      appLogo.classList.add('is-swapping');
    }
    
    // After evaporation completes, change the logo and trigger condensation
    setTimeout(() => {
      el.appLogoImg.src = curLang() === "es" ? "assets/brand/logo-es.png" : "assets/brand/logo-en.png";
      el.appLogoImg.alt = curLang() === "es" ? "¿A qué huele?" : "What's the Smell?";
      document.title = curLang() === "es" ? "¿A qué huele?" : "What's the Smell?";
      
      if (appLogo) {
        appLogo.classList.remove('is-swapping');
        appLogo.classList.add('is-appearing');
      }
    }, 390); // Timing aligned with evaporation animation
    
    // Clean up classes after condensation completes
    setTimeout(() => {
      if (appLogo) {
        appLogo.classList.remove('is-appearing');
      }
    }, 800); // Total animation time
  }

  function applyLangSwitchUI() {
    const isEn = curLang() === "en";
    el.langSwitch.classList.toggle("is-en", isEn);
    el.langSwitch.classList.toggle("is-es", !isEn);
    el.langSwitch.setAttribute("aria-checked", isEn ? "true" : "false");
  }

  function applyStaticText() {
    // Sheet labels + curiosity title
    const ln = curLang();
    const get = (k)=> (I18N[ln] && I18N[ln][k]) ? I18N[ln][k] : (I18N.en[k]||"");
    const sl = (id, key)=>{ const n=document.getElementById(id); if(n) n.textContent = get(key); };
    sl("sheetLabelName","sheetName");
    sl("sheetLabelUniverse","sheetUniverse");
    sl("sheetLabelCategory","sheetCategory");
    sl("sheetLabelAromaType","sheetAromaType");
    sl("sheetLabelSensation","sheetMainSensation");
    sl("sheetLabelStyle","sheetOlfactoryStyle");
    sl("sheetLabelImpression","sheetLastImpression");
    if (el.curiosityTitle) el.curiosityTitle.textContent = get("curiosityTitle");

    el.characterLabel.textContent = t("character");
    el.categoryLabel.textContent = t("category");
    el.smellBtn.textContent = t("identify");
    el.clearBtn.textContent = t("reset");
    el.outputLabel.textContent = t("scentProfile");
    el.visualTitle1.textContent = t("characterVisual");
    el.visualTitle2.textContent = t("scentNotesVisual");
    el.characterInput.placeholder = state.hasResult ? "" : t("placeholder");

    // Category display
    const label = categoryLabelFor(state.selectedCategory);
    el.categoryValue.textContent = label;
    if (el.categoryValueActive) el.categoryValueActive.textContent = label;
  }

  // ===== Locks =====
  function applyLocks() {
    // Bloquea idioma solo mientras genera (no cuando ya hay resultado)
    el.langSelect.disabled = state.busy;
    el.langSwitch.classList.toggle("is-disabled", state.busy);

    // Inputs should be locked when busy OR when a result is present (until New trail)
    const shouldLockInputs = state.busy || state.hasResult;
    
    el.smellBtn.disabled = shouldLockInputs || !el.characterInput.value.trim();
    el.characterInput.disabled = shouldLockInputs;
    el.categoryBtn.disabled = shouldLockInputs;
    el.clearBtn.disabled = state.busy;

    if (state.busy) ddClose();
  }
  function setBusy(v) {
    state.busy = !!v;
    applyLocks();
  }

  function showLoadingSpinner() {
    if (el.loadingSpinner) {
      el.loadingSpinner.classList.add("active");
      // Nota: la clase "spinning" ya se agrega en onGenerate() para empezar la animación inmediatamente
    }
  }

  function hideLoadingSpinner() {
    if (el.loadingSpinner) {
      el.loadingSpinner.classList.remove("active");
      const imgFrame = document.querySelector('.imgFrame');
      if (imgFrame) {
        imgFrame.classList.remove("spinning");
      }
    }
  }

  // ===== Dropdown =====
  function fillCategorySelectHidden() {
    const prev = state.selectedCategory || "any";
    el.categorySelect.innerHTML = "";
    for (const c of CATEGORIES) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = categoryLabelFor(c.id);
      el.categorySelect.appendChild(opt);
    }
    el.categorySelect.value = CATEGORIES.some((x) => x.id === prev) ? prev : "any";
  }

  function setCategoryValue(id) {
    const next = CATEGORIES.some((x) => x.id === id) ? id : "any";
    state.selectedCategory = next;
    el.categorySelect.value = next;

    const label = categoryLabelFor(next);
    el.categoryValue.textContent = label;
    if (el.categoryValueActive) el.categoryValueActive.textContent = label;

    state.focusIndex = Math.max(0, CATEGORIES.findIndex((x) => x.id === next));
  }

  function ddOpen() {
    // No-op: carousel is always open
  }

  function ddClose() {
    // No-op: carousel is always open
  }

  function ddToggle() {
    // No-op: carousel is always open
  }

  function ddMove(delta) {
    const len = CATEGORIES.length;
    console.log(`[Carousel] Moving ${delta > 0 ? 'right' : 'left'}, category count: ${len}, current index: ${state.focusIndex}`);
    console.log(`[Carousel] Categories available:`, CATEGORIES.map(c => c.id));
    state.focusIndex = (state.focusIndex + delta + len) % len;
    const nextId = CATEGORIES[state.focusIndex].id;
    console.log(`[Carousel] New index: ${state.focusIndex}, ID: ${nextId}`);
    setCategoryValue(nextId);
    renderCategoryCarousel();
  }

  
function renderCategoryCarousel() {
  // v7: "Arrow + confirm" UX (no rail items overlay).
  // The previous ddRail/ddItem carousel could block pointer hitboxes on the viewport in some browsers.
  // We keep the drawer minimal: arrows + active label only.
  const label = categoryLabelFor(state.selectedCategory);
  if (el.categoryValueActive) {
    el.categoryValueActive.textContent = label;
    console.log(`[Carousel] Rendered category: ${state.selectedCategory} (${label}), focusIndex: ${state.focusIndex}`);
  }
}

function updateCarouselFocus() {
  // no-op (kept for backward compatibility)
}

  function bindCategoryDropdown() {
    // Generate carousel items
    renderCategoryCarousel();
    console.log(`[Carousel] Initialized with ${CATEGORIES.length} categories`);

    // Toggle "active" mode to show/hide carousel controls
    function setCategoryActive(on) {
      const isOn = !!on;
      state.ddOpen = isOn;
      if (el.categoryBtn) {
        el.categoryBtn.classList.toggle("active", isOn);
        console.log(`[Carousel] Active mode: ${isOn}`);
      }
    }

    function confirmCategory() {
      if (!el.categoryBtn) return;
      el.categoryBtn.classList.add("confirm");
      setTimeout(() => el.categoryBtn.classList.remove("confirm"), 180);
      setCategoryActive(false);
    }

    // Arrow clicks - LEFT (only when active)
    if (el.categoryArrowLeft) {
      el.categoryArrowLeft.addEventListener("click", (e) => {
        console.log("[Carousel] Left arrow clicked");
        e.preventDefault();
        e.stopPropagation();
        ddMove(-1);
      });
      console.log("[Carousel] Left arrow listener attached");
    }

    // Arrow clicks - RIGHT (only when active)
    if (el.categoryArrowRight) {
      el.categoryArrowRight.addEventListener("click", (e) => {
        console.log("[Carousel] Right arrow clicked");
        e.preventDefault();
        e.stopPropagation();
        ddMove(1);
      });
      console.log("[Carousel] Right arrow listener attached");
    }

    // Center button - confirms selection
    if (el.categoryValueActive) {
      el.categoryValueActive.addEventListener("click", (e) => {
        console.log("[Carousel] Center clicked, confirming:", state.selectedCategory);
        e.preventDefault();
        e.stopPropagation();
        confirmCategory();
      });
      console.log("[Carousel] Center value listener attached");
    }

    // Button click - toggle active mode
    if (el.categoryBtn) {
      el.categoryBtn.addEventListener("click", (e) => {
        const t = e.target;
        // Don't activate if clicking arrows or center
        if (
          t === el.categoryArrowLeft ||
          t === el.categoryArrowRight ||
          t === el.categoryValueActive
        ) {
          return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        const isActive = el.categoryBtn.classList.contains("active");
        setCategoryActive(!isActive);
        if (!isActive) {
          el.categoryBtn.focus?.();
        }
      });
      console.log("[Carousel] Button click listener attached");
    }

    // Keyboard navigation (only when active)
    document.addEventListener("keydown", (e) => {
      const isActive = el.categoryBtn?.classList.contains("active");
      if (!isActive) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        ddMove(-1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        ddMove(1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        confirmCategory();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setCategoryActive(false);
        return;
      }
    });

    // Click outside to close
    document.addEventListener("click", (e) => {
      const isActive = el.categoryBtn?.classList.contains("active");
      if (!isActive) return;

      const categoryWrap = document.getElementById("categoryDD");
      if (categoryWrap && !categoryWrap.contains(e.target)) {
        setCategoryActive(false);
        console.log("[Carousel] Closed by outside click");
      }
    });

    console.log("[Carousel] Keyboard listeners attached");
  }

  
  // ===== Canon aroma curiosities (curated; no inventions) =====
  const CANON_CURIOSITY_MAP = {
    // Naruto: canon food smell theme (Ichiraku Ramen obsession)
    "naruto uzumaki": {
      en: "Canon note: Naruto is famously obsessed with Ichiraku Ramen—if he had a signature trail, it would lean toward warm broth, noodles, and a hint of ginger.",
      es: "Dato canon: Naruto es famoso por su obsesión con el ramen de Ichiraku—si dejara un rastro, tendería a caldo caliente, fideos y un toque de jengibre."
    },
    "naruto": {
      en: "Canon note: Naruto is famously obsessed with Ichiraku Ramen—if he had a signature trail, it would lean toward warm broth, noodles, and a hint of ginger.",
      es: "Dato canon: Naruto es famoso por su obsesión con el ramen de Ichiraku—si dejara un rastro, tendería a caldo caliente, fideos y un toque de jengibre."
    },
    // Goku: canon food/training motif; keep it safe and not too specific
    "goku": {
      en: "Canon note: Goku’s defining duo is training + eating; if anything follows him, it’s open-air sparring and fresh, hearty food rather than fancy cologne.",
      es: "Dato canon: La dupla de Goku es entrenar + comer; si algo lo sigue, es aire de entrenamiento y comida recién hecha, no perfume elegante."
    }
  };

  function setCuriosityForCharacter(nameRaw) {
    if (!el.curiosityBox) return;
    
    // Si hay resultado, extraer curiosidad del resultado de la IA (traducido)
    if (state.hasResult) {
      const lang = curLang();
      const txt = lang === "es" ? (state.resultEs || state.resultEn) : state.resultEn;
      const curiosity = parseSectionAny(txt || "", ["Aromatic Curiosity","Curiosidad Aromática","Curiosidad aromática"]) || "";
      el.curiosityBox.textContent = curiosity || "—";
      return;
    }
    
    // Si no hay resultado, usar el mapa local (fallback)
    const key = String(nameRaw || "").trim().toLowerCase();
    const hit = CANON_CURIOSITY_MAP[key] || CANON_CURIOSITY_MAP[key.replace(/\s+/g," ")] || null;
    if (!hit) {
      el.curiosityBox.textContent = "—";
      return;
    }
    el.curiosityBox.textContent = curLang() === "es" ? hit.es : hit.en;
  }

  // ===== Notes parsing + icons =====
  function parseNotesFromResult(text) {
    // Try both English and Spanish formats
    let m =
      String(text || "").match(/^\s*Olfactory Notes\s*:\s*(.+)$/im) ||
      String(text || "").match(/^\s*Notas Olfativas\s*:\s*(.+)$/im) ||
      String(text || "").match(/^\s*NOTES\s*:\s*(.+)$/im) ||
      String(text || "").match(/^\s*NOTAS\s*:\s*(.+)$/im);
    if (!m) return [];
    return m[1].split(",").map((x) => x.trim()).filter(Boolean).slice(0, 4);
  }

  function parseSectionContent(text, sectionLabel) {
    // Extract section content by label
    // Match: "Section Label:" followed by content until next section or end
    const escapedLabel = sectionLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^\\s*${escapedLabel}\\s*:\\s*(.+?)(?=^\\s*(?:Aroma Essence|Character Soul|Scent Heritage|Olfactory Notes|Fragrance Match|Aromatic Curiosity|Name|Universe|Category|Aroma Type|Main Sensation|Olfactory Style|Last Impression)\\s*:|$)`, "ims");
    const m = String(text || "").match(regex);
    return m ? m[1].trim() : "—";
  }

  
  // ===== Robust bilingual section parsing =====
  const SECTION_STOPS = [
    "Aroma Essence","Character Soul","Scent Heritage","Olfactory Notes","Fragrance Match","Aromatic Curiosity",
    "Name","Universe","Category","Aroma Type","Main Sensation","Olfactory Style","Last Impression",
    "Esencia Aromática","Alma del Personaje","Herencia Aromática","Notas Olfativas","Perfume Sugerido","Curiosidad Aromática",
    "Nombre","Universo","Categoría","Tipo de aroma","Sensación Principal","Estilo Olfativo","Impresión Final",
    "Aromatic Profile","Perfil Aromático","Perfil aromático","MAIN DESCRIPTION","Descripción principal","DESCRIPCIÓN PRINCIPAL"
  ];

  function parseSectionAny(text, labels) {
    const src = String(text || "");
    const labs = Array.isArray(labels) ? labels : [labels];
    for (const lab of labs) {
      const escaped = lab.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const stopsEsc = SECTION_STOPS.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
      const rx = new RegExp(`^\\s*(?:${escaped})\\s*:\\s*(.+?)(?=^\\s*(?:${stopsEsc})\\s*:|$)`, "ims");
      const m = src.match(rx);
      if (m && m[1]) return m[1].trim();
    }
    return "";
  }

  function parseCharacterSheetBilingual(text) {
    return {
      name: parseSectionAny(text, ["Name","Nombre"]),
      universe: parseSectionAny(text, ["Universe","Universo"]),
      category: parseSectionAny(text, ["Category","Categoría","Categoria"]),
      aromaType: parseSectionAny(text, ["Aroma Type","Tipo de aroma","Tipo de Aroma"]),
      mainSensation: parseSectionAny(text, ["Main Sensation","Sensación Principal","Sensacion Principal"]),
      olfactoryStyle: parseSectionAny(text, ["Olfactory Style","Estilo Olfativo"]),
      lastImpression: parseSectionAny(text, ["Last Impression","Impresión Final","Impresion Final"]),
    };
  }

  function firstSentences(t, maxSent=2) {
    const s = String(t||"").replace(/\s+/g," ").trim();
    if (!s) return "";
    // Split by sentence-ish punctuation
    const parts = s.split(/(?<=[\.\!\?])\s+/);
    return parts.slice(0, maxSent).join(" ").trim();
  }

  function buildCondensedMainOutput(rawText) {
    const desc = parseSectionAny(rawText, ["MAIN DESCRIPTION","Descripción principal","DESCRIPCIÓN PRINCIPAL"]) || "";
    const prof = parseSectionAny(rawText, ["Aromatic Profile","Perfil Aromático","Perfil aromático"]) || "";
    const frag = parseSectionAny(rawText, ["Fragrance Match","Cologne Match","Perfume Sugerido","Perfume sugerido"]) || "";

    // 2–3 lines total: 2 sentences from desc + 1 from profile (if needed)
    let body = firstSentences(desc, 2);
    if (!body) body = firstSentences(prof, 2);
    else {
      const p1 = firstSentences(prof, 1);
      if (p1) body = (body + " " + p1).trim();
    }

    const lang = curLang();
    const fragPrefix  = lang === "es" ? "PERFUME SUGERIDO:" : "COLOGNE MATCH:";

    const out = [
      body,
      "",
      frag ? `${fragPrefix} ${frag}` : ""
    ].filter(x=>x!=="" || x==="" ).join("\n").trim();

    return out;
  }


  function parseCharacterSheet(text) {
    const sheet = {
      name: parseSectionAny(text, ["Name","Nombre"]),
      universe: parseSectionAny(text, ["Universe","Universo"]),
      category: parseSectionAny(text, ["Category","Categoría","Categoria"]),
      aromaType: parseSectionAny(text, ["Aroma Type","Tipo de aroma","Tipo de Aroma"]),
      mainSensation: parseSectionAny(text, ["Main Sensation","Sensación Principal","Sensacion Principal"]),
      olfactoryStyle: parseSectionAny(text, ["Olfactory Style","Estilo Olfativo"]),
      lastImpression: parseSectionAny(text, ["Last Impression","Impresión Final","Impresion Final"])
    };
    return sheet;
  }

  function stripAccents(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function normNote(s) {
    return stripAccents(String(s || "").trim().toLowerCase()).replace(/\s+/g, " ");
  }

  function noteToIcon(note) {
    const n = normNote(note);

    // Woods & Resins (001-010)
    if (n.includes("cedar") || n.includes("cedro")) return "assets/notes/001_cedar.svg";
    if (n.includes("sandalwood") || n.includes("sandalo")) return "assets/notes/002_sandalwood.svg";
    if (n.includes("pine") || n.includes("pino")) return "assets/notes/003_pine-resin.svg";
    if (n.includes("oak") || n.includes("roble")) return "assets/notes/004_oak-barrel.svg";
    if (n.includes("amber") || n.includes("ambar")) return "assets/notes/005_amber-resin.svg";
    if (n.includes("frankincense") || n.includes("olibano")) return "assets/notes/006_frankincense.svg";
    if (n.includes("myrrh") || n.includes("mirra")) return "assets/notes/007_myrrh.svg";
    if (n.includes("patchouli") || n.includes("pachuli")) return "assets/notes/008_patchouli.svg";
    if (n.includes("guaiac") || n.includes("guayaco")) return "assets/notes/009_guaiac-wood.svg";
    if (n.includes("cypress") || n.includes("cipres")) return "assets/notes/010_cypress.svg";

    // Smoke & Heat (011-020)
    if (n.includes("smoke") || n.includes("humo")) return "assets/notes/011_smoke.svg";
    if (n.includes("charcoal") || n.includes("carbon")) return "assets/notes/012_charcoal.svg";
    if (n.includes("ember") || n.includes("brasa")) return "assets/notes/013_ember.svg";
    if (n.includes("campfire") || n.includes("fogata")) return "assets/notes/014_campfire.svg";
    if (n.includes("soot") || n.includes("hollin")) return "assets/notes/015_soot.svg";
    if (n.includes("tar") || n.includes("alquitran")) return "assets/notes/016_tar.svg";
    if (n.includes("hot metal") || n.includes("metal caliente")) return "assets/notes/017_hot-metal.svg";
    if (n.includes("toasted sugar") || n.includes("azucar tostada")) return "assets/notes/018_toasted-sugar.svg";
    if (n.includes("leather smoke") || n.includes("cuero ahumado") || n.includes("raw leather") || n.includes("cuero crudo")) return "assets/notes/019_leather-smoke.svg";
    if (n.includes("pepper") || n.includes("pimienta")) return "assets/notes/020_pepper-heat.svg";

    // Earth & Mineral (021-030)
    if (n.includes("earth") || n.includes("tierra") || n.includes("soil") || n.includes("suelo")) return "assets/notes/021_earth.svg";
    if (n.includes("petrichor") || n.includes("petricor")) return "assets/notes/022_petrichor.svg";
    if (n.includes("clay") || n.includes("arcilla")) return "assets/notes/023_clay.svg";
    if (n.includes("moss") || n.includes("musgo")) return "assets/notes/024_moss.svg";
    if (n.includes("stone") || n.includes("piedra")) return "assets/notes/025_stone.svg";
    if (n.includes("concrete") || n.includes("concreto")) return "assets/notes/026_concrete.svg";
    if (n.includes("dust") || n.includes("polvo")) return "assets/notes/027_dust.svg";
    if (n.includes("iron") || n.includes("hierro")) return "assets/notes/028_iron.svg";
    if (n.includes("salted earth") || n.includes("tierra salina")) return "assets/notes/029_salted-earth.svg";
    if (n.includes("roots") || n.includes("raices")) return "assets/notes/030_roots.svg";

    // Water & Marine (031-040)
    if (n.includes("water") || n.includes("agua")) return "assets/notes/031_water.svg";
    if (n.includes("rain") || n.includes("lluvia")) return "assets/notes/032_rain.svg";
    if (n.includes("ocean") || n.includes("oceano")) return "assets/notes/033_ocean.svg";
    if (n.includes("sea salt") || n.includes("sal marina")) return "assets/notes/034_sea-salt.svg";
    if (n.includes("algae") || n.includes("algas")) return "assets/notes/035_algae.svg";
    if (n.includes("driftwood") || n.includes("madera a la deriva")) return "assets/notes/036_driftwood.svg";
    if (n.includes("river") || n.includes("rio")) return "assets/notes/037_river-stone.svg";
    if (n.includes("fog") || n.includes("niebla")) return "assets/notes/038_fog.svg";
    if (n.includes("aquatic") || n.includes("acuatico")) return "assets/notes/039_aquatic-musk.svg";
    if (n.includes("icy") || n.includes("helado")) return "assets/notes/040_icy-water.svg";

    // Citrus & Fruits (041-050)
    if (n.includes("lemon") || n.includes("limon")) return "assets/notes/041_lemon.svg";
    if (n.includes("orange") || n.includes("naranja")) return "assets/notes/042_orange.svg";
    if (n.includes("bergamot") || n.includes("bergamota")) return "assets/notes/043_bergamot.svg";
    if (n.includes("grapefruit") || n.includes("toronja")) return "assets/notes/044_grapefruit.svg";
    if (n.includes("lime") || n.includes("lima")) return "assets/notes/045_lime.svg";
    if (n.includes("mandarin") || n.includes("mandarina")) return "assets/notes/046_mandarin.svg";
    if (n.includes("apple") || n.includes("manzana")) return "assets/notes/047_apple.svg";
    if (n.includes("pear") || n.includes("pera")) return "assets/notes/048_pear.svg";
    if (n.includes("berry") || n.includes("frutos rojos")) return "assets/notes/049_berry.svg";
    if (n.includes("peach") || n.includes("durazno")) return "assets/notes/050_peach.svg";

    // Greens & Herbs (051-060)
    if (n.includes("grass") || n.includes("pasto")) return "assets/notes/051_fresh-cut-grass.svg";
    if (n.includes("basil") || n.includes("albahaca")) return "assets/notes/052_basil.svg";
    if (n.includes("mint") || n.includes("menta")) return "assets/notes/053_mint.svg";
    if (n.includes("rosemary") || n.includes("romero")) return "assets/notes/054_rosemary.svg";
    if (n.includes("thyme") || n.includes("tomillo")) return "assets/notes/055_thyme.svg";
    if (n.includes("sage") || n.includes("salvia")) return "assets/notes/056_sage.svg";
    if (n.includes("lavender") || n.includes("lavanda")) return "assets/notes/057_lavender.svg";
    if (n.includes("eucalyptus") || n.includes("eucalipto")) return "assets/notes/058_eucalyptus.svg";
    if (n.includes("tea") || n.includes("te")) return "assets/notes/059_tea-leaf.svg";
    if (n.includes("vetiver")) return "assets/notes/060_vetiver.svg";

    // Florals (061-070)
    if (n.includes("rose") || n.includes("rosa")) return "assets/notes/061_rose.svg";
    if (n.includes("jasmine") || n.includes("jazmin")) return "assets/notes/062_jasmine.svg";
    if (n.includes("violet") || n.includes("violeta")) return "assets/notes/063_violet.svg";
    if (n.includes("lily") || n.includes("lirio")) return "assets/notes/064_lily.svg";
    if (n.includes("gardenia")) return "assets/notes/065_gardenia.svg";
    if (n.includes("orange blossom") || n.includes("azahar")) return "assets/notes/066_orange-blossom.svg";
    if (n.includes("magnolia")) return "assets/notes/067_magnolia.svg";
    if (n.includes("ylang")) return "assets/notes/068_ylang-ylang.svg";
    if (n.includes("iris") || n.includes("orris")) return "assets/notes/069_iris.svg";
    if (n.includes("chamomile") || n.includes("manzanilla")) return "assets/notes/070_chamomile.svg";

    // Spices & Gourmand (071-080)
    if (n.includes("vanilla") || n.includes("vainilla")) return "assets/notes/071_vanilla.svg";
    if (n.includes("cocoa") || n.includes("cacao")) return "assets/notes/072_cocoa.svg";
    if (n.includes("coffee") || n.includes("cafe")) return "assets/notes/073_coffee.svg";
    if (n.includes("cinnamon") || n.includes("canela")) return "assets/notes/074_cinnamon.svg";
    if (n.includes("clove") || n.includes("clavo")) return "assets/notes/075_clove.svg";
    if (n.includes("cardamom") || n.includes("cardamomo")) return "assets/notes/076_cardamom.svg";
    if (n.includes("honey") || n.includes("miel")) return "assets/notes/077_honey.svg";
    if (n.includes("caramel") || n.includes("caramelo")) return "assets/notes/078_caramel.svg";
    if (n.includes("nutmeg") || n.includes("nuez moscada")) return "assets/notes/079_nutmeg.svg";
    if (n.includes("ginger") || n.includes("jengibre")) return "assets/notes/080_ginger.svg";

    // Clean & Skin (081-090)
    if (n.includes("cotton") || n.includes("algodon") || n.includes("linen") || n.includes("lino")) return "assets/notes/081_cotton.svg";
    if (n.includes("soap") || n.includes("jabon")) return "assets/notes/082_soap.svg";
    if (n.includes("fresh linen") || n.includes("lino fresco")) return "assets/notes/083_fresh-linen.svg";
    if (n.includes("powder") || n.includes("talco")) return "assets/notes/084_powder.svg";
    if (n.includes("skin musk") || n.includes("almizcle de piel")) return "assets/notes/085_skin-musk.svg";
    if (n.includes("milk") || n.includes("leche")) return "assets/notes/086_milk.svg";
    if (n.includes("shampoo") || n.includes("champu")) return "assets/notes/087_shampoo.svg";
    if (n.includes("deodorant") || n.includes("desodorante")) return "assets/notes/088_deodorant.svg";
    if (n.includes("laundry") || n.includes("ropa limpia")) return "assets/notes/089_laundry.svg";
    if (n.includes("baby powder") || n.includes("talco de bebe")) return "assets/notes/090_baby-powder.svg";

    // Synthetic & Futuristic (091-100)
    if (n.includes("ozone") || n.includes("ozono") || n.includes("electric") || n.includes("electr")) return "assets/notes/091_ozone.svg";
    if (n.includes("plastic") || n.includes("plastico")) return "assets/notes/092_neon-plastic.svg";
    if (n.includes("rubber") || n.includes("goma")) return "assets/notes/093_rubber.svg";
    if (n.includes("circuit") || n.includes("circuitos")) return "assets/notes/094_circuitry.svg";
    if (n.includes("coolant") || n.includes("refrigerante")) return "assets/notes/095_coolant.svg";
    if (n.includes("sterile") || n.includes("esteril")) return "assets/notes/096_sterile.svg";
    if (n.includes("ink") || n.includes("tinta")) return "assets/notes/097_ink.svg";
    if (n.includes("battery") || n.includes("bateria")) return "assets/notes/098_battery.svg";
    if (n.includes("gunpowder") || n.includes("polvora")) return "assets/notes/099_gunpowder.svg";
    if (n.includes("carbon fiber") || n.includes("fibra de carbono")) return "assets/notes/100_carbon-fiber.svg";
    if (n.includes("galbano")) return "assets/notes/005_amber-resin.svg"; // Galbano es similar a resinas

    return "assets/notes/generic.svg";
  }

  function iconToTone(iconPath) {
    const p = String(iconPath || "");

    // Map the 001-100 SVG ranges to the tone classes that already exist in index.html
    // (Keeps UI identical; just fixes auto-population colors.)
    // Woods & Resins (001-010)
    if (/00[1-9]_|010_/.test(p)) return "tone-wood";

    // Smoke & Heat (011-020)
    if (/01[1-9]_|020_/.test(p)) return "tone-smoke";

    // Earth & Mineral (021-030)
    if (/02[1-9]_|030_/.test(p)) return "tone-earth";

    // Water & Marine (031-040)
    if (/03[1-9]_|040_/.test(p)) return "tone-water";

    // Citrus & Fruits (041-050)
    if (/04[1-9]_|050_/.test(p)) return "tone-citrus";

    // Greens & Herbs (051-060)
    if (/05[1-9]_|060_/.test(p)) return "tone-leaf";

    // Florals (061-070) – closest existing palette is leaf/soft; keep consistent
    if (/06[1-9]_|070_/.test(p)) return "tone-leaf";

    // Spices & Gourmand (071-080)
    if (/07[1-9]_|080_/.test(p)) return "tone-incense";

    // Clean & Skin (081-090)
    if (/08[1-9]_|090_/.test(p)) return "tone-fabric";

    // Synthetic & Futuristic (091-100)
    if (/09[1-9]_|100_/.test(p)) return "tone-spark";

    return "tone-generic";
  }

  function setNoteIconsInline(notes) {
    const arr = (notes || []).slice(0, 4);
    for (let i = 0; i < 4; i++) {
      const note = arr[i] || "";
      el.compName[i].textContent = note || "—";
      const node = el.compImg[i];

      if (!note) {
        node.style.display = "none";
        node.style.webkitMaskImage = "";
        node.style.maskImage = "";
        node.className = "noteIcon tone-generic";
        continue;
      }

      const iconPath = noteToIcon(note);
      const tone = iconToTone(iconPath);
      node.className = `noteIcon ${tone}`;
      node.style.webkitMaskImage = `url("${iconPath}")`;
      node.style.maskImage = `url("${iconPath}")`;
      node.style.display = "inline-block";
    }
  }

  // ===== Character image =====
  // OPTIMIZATION 3: Lazy load images with IntersectionObserver
  function initLazyLoadImage() {
    if (!el.characterImg) return;
    
    // Setup IntersectionObserver for lazy loading
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.target.dataset.lazyImageUrl) {
          const url = entry.target.dataset.lazyImageUrl;
          entry.target.src = url;
          delete entry.target.dataset.lazyImageUrl;
          imageObserver.unobserve(entry.target);
          console.log("Lazy loaded image:", url.slice(0, 50));
          
          // Hide loading spinner when image successfully loads
            entry.target.onload = () => {
              hideLoadingSpinner();
              const frame = entry.target.closest('.imgFrame');
              if (frame) frame.classList.remove("spinning");
              entry.target.classList.add("is-visible");
              entry.target.style.opacity = "1";
              entry.target.onload = null; // Clean up listener
            };
            entry.target.onerror = () => {
              hideLoadingSpinner();
              const frame = entry.target.closest('.imgFrame');
              if (frame) frame.classList.remove("spinning");
              entry.target.style.opacity = "0";
              entry.target.onerror = null; // Clean up listener
            };
        }
      });
    }, {
      rootMargin: '50px' // Start loading 50px before element is visible
    });
    
    imageObserver.observe(el.characterImg);
  }

  async function setCharacterImage(charName, categoryId, universe = "") {
    const name = String(charName || "").trim();
    if (!name) {
      console.warn("setCharacterImage: No name provided");
      return;
    }

    try {
        if (el.characterImg) {
          el.characterImg.classList.remove("is-visible");
          el.characterImg.style.opacity = "0";
        }
      showLoadingSpinner();
      const univ = String(universe || "").trim();
      let url = `${API}/api/ai-image?name=${encodeURIComponent(name)}&category=${encodeURIComponent(categoryId || "any")}&style=anime`;
      if (univ) {
        url += `&universe=${encodeURIComponent(univ)}`;
      }
      
      console.log("Fetching image from:", url);
      const r = await fetch(url);
      const data = await r.json().catch(() => ({}));
      const imgUrl = String(data?.url || "");
      
      console.log("Image response:", { ok: r.ok, url: imgUrl, data });
      
      if (!r.ok || !imgUrl) {
        console.error("Image generation failed:", data?.details || data?.error || "unknown error");
        hideLoadingSpinner();
        throw new Error(data?.details || data?.error || "image generation failed");
      }

      // OPTIMIZATION: Use lazy loading for image
      el.characterImg.dataset.lazyImageUrl = `${API}${imgUrl}`;
      el.characterImg.style.display = "block";
      
      // Trigger lazy loading
      initLazyLoadImage();
      
      console.log("Image queued for lazy loading");
    } catch (err) {
      console.error("setCharacterImage error:", err.message);
      hideLoadingSpinner();

      // Fallback: if backend failed, try serving a previously generated cached image from disk
      try {
        const loaded = await tryLoadCachedGeneratedImage(name);
        if (loaded) {
          console.log("Fallback cached image loaded from /generated");
          hideLoadingSpinner();
          const frame = el.characterImg.closest('.imgFrame');
          if (frame) frame.classList.remove("spinning");
          el.characterImg.classList.add("is-visible");
          el.characterImg.style.opacity = "1";
          return;
        }
      } catch (e) {
        console.warn("Fallback cached image check failed:", e?.message || e);
      }

      el.characterImg.removeAttribute("src");
      el.characterImg.removeAttribute("data-lazy-image-url");
      el.characterImg.style.display = "none";
      throw err; // Propagar error para que se maneje en flujo principal
    }
  }

  // ===== Backend calls =====
  async function apiPost(path, body) {
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.details || data?.error || `HTTP ${r.status}`);
    return data;
  }

  async function ensureTranslation(targetLang, isCached = false) {
    // Translate from canonical EN using server endpoint
    if (!state.resultEn) return;

    if (targetLang === "en") return;
    
    // Si ya tenemos la traducción y NO viene del cache, retornar rápido
    if (targetLang === "es" && state.resultEs && !isCached) return;

    // Solo mostrar "translating" si NO está en cache
    if (!isCached) {
      setStatus("translating");
    }
    
    // Si viene del cache y ya tenemos resultEs, no hay nada que hacer
    if (isCached && state.resultEs) {
      return;
    }
    
    // Use server translation endpoint (cacheado por el servidor)
    try {
      const resp = await apiPost("/api/translate", {
        text: state.resultEn,
        lang: targetLang,
        character: state.lastCharacter,
        category: state.selectedCategory || "any"
      });
      state.resultEs = resp?.text || state.resultEn;
    } catch (e) {
      // Fallback to local translator if server fails
      state.resultEs = await TRANSLATOR.enToEs(state.resultEn);
    }
  }

  function renderResultForCurrentLang() {
    const lang = curLang();
    
    // Always update titles dynamically based on current language
    document.getElementById("visualTitle1").textContent = lang === "es" 
      ? "Visual del Personaje y Ficha" 
      : "Character Visual and Sheet";
    document.getElementById("visualTitle2").textContent = lang === "es" 
      ? "Perfil aromático" 
      : "Aroma profile";
    
    // Update sheet labels for current language
    applyStaticText();
    
    if (!state.hasResult) {
      setOutput("");
      setNoteIconsInline([]);
      document.getElementById("charSheetName").textContent = "—";
      document.getElementById("charSheetUniverse").textContent = "—";
      document.getElementById("charSheetCategory").textContent = "—";
      document.getElementById("charSheetAromaType").textContent = "—";
      document.getElementById("charSheetSensation").textContent = "—";
      document.getElementById("charSheetStyle").textContent = "—";
      document.getElementById("charSheetImpression").textContent = "—";
      el.curiosityBox.textContent = "—";
      return;
    }

    // Use appropriate language for rendering
    const txt = lang === "es" ? (state.resultEs || state.resultEn) : state.resultEn;
    
    // For output box, show only the condensed aroma profile (not the whole result)
    const condensedOutput = buildCondensedMainOutput(txt || "");
    setOutput(condensedOutput || "");
    setNoteIconsInline(parseNotesFromResult(txt || ""));
    
    // Parse and display character sheet (only from the full text)
    const sheet = parseCharacterSheet(txt || "");
    document.getElementById("charSheetName").textContent = sheet.name || "—";
    document.getElementById("charSheetUniverse").textContent = sheet.universe || "—";
    document.getElementById("charSheetCategory").textContent = sheet.category || "—";
    document.getElementById("charSheetAromaType").textContent = sheet.aromaType || "—";
    document.getElementById("charSheetSensation").textContent = sheet.mainSensation || "—";
    document.getElementById("charSheetStyle").textContent = sheet.olfactoryStyle || "—";
    document.getElementById("charSheetImpression").textContent = sheet.lastImpression || "—";
    
    // Set curiosity from result
    setCuriosityForCharacter(state.lastCharacter);
  }

  // ===== Actions =====
  async function onGenerate() {
    if (state.hasResult) return;
    clearError();

    // ===== RATE LIMITING CHECK (Beta Early Access) =====
    if (typeof hasReachedGenerationLimit === "function" && hasReachedGenerationLimit()) {
      const limitInfo = getGenerationLimitInfo();
      const message = `Daily limit reached (${limitInfo.used}/${limitInfo.limit}). Try again in 24 hours.`;
      showError(message, "rateLimit");
      return;
    }

    const character = String(el.characterInput.value || "").trim();
    if (!character) {
      showError(t("enterCharacter"), "enterCharacter");
      return;
    }

    // VALIDATE: Category must be selected (not "any")
    if (state.selectedCategory === "any" || !state.selectedCategory) {
      showError(t("selectCategory"), "selectCategory");
      return;
    }

    // INICIAR ANIMACIÓN SOLO CUANDO LOS DATOS SON VÁLIDOS
    const imgFrame = document.querySelector('.imgFrame');
    if (imgFrame) {
      imgFrame.classList.add("spinning");
    }
    showLoadingSpinner();

    setBusy(true);
    setStatus("working");

    try {
      state.lastCharacter = character;

      // 1) Generate canonical EN (backend already caches)
      const data = await apiPost("/api/smell", {
        prompt: character,
        category: state.selectedCategory || "any",
        lang: "en",
        includeEs: true,
      });

      console.log("API Response:", data);

      state.resultEn = String(data?.textEn || data?.text || "").trim();
      state.resultEs = String(data?.textEs || "").trim();
      
      // Usar el nombre oficial que viene del servidor (normalizado)
      state.officialName = String(data?.officialName || character).trim();
      
      console.log("State after response:", {
        resultEn: state.resultEn.slice(0, 150),
        resultEs: state.resultEs.slice(0, 150),
        officialName: state.officialName,
      });
      
      // Validar que tenemos al menos una respuesta en inglés
      if (!state.resultEn || state.resultEn.length < 50) {
        throw new Error(`La respuesta recibida está vacía o incompleta (${state.resultEn.length} caracteres). Intenta nuevamente.`);
      }
      
      state.hasResult = true;
      const isCached = data?.cached || false;

      // ===== INCREMENT GENERATION COUNTER (Beta Early Access) =====
      if (typeof incrementGenerationCounter === "function") {
        incrementGenerationCounter();
      }

      // Parse character info from result EARLY
      const charSheet = parseCharacterSheetBilingual(state.resultEn);
      state.characterName = charSheet.name || state.officialName;
      state.characterUniverse = charSheet.universe || "";
      
      console.log("Character sheet extracted:", {
        name: state.characterName,
        universe: state.characterUniverse,
      });

      // OPTIMIZATION 2: Start image generation in parallel (don't wait)
      // This fires in background while we render text
      const imagePromise = setCharacterImage(state.officialName, state.selectedCategory, state.characterUniverse)
        .then(() => console.log("Image generation completed in background"))
        .catch(imgErr => console.error("Image generation failed in background:", imgErr.message));

      // OPTIMIZATION: Start translation in parallel (don't wait)
      const translationPromise = (async () => {
        if (!state.resultEs || state.resultEs.length < 50) {
          console.log("Fetching translation in parallel...");
          try {
            const transResp = await apiPost("/api/translate", {
              text: state.resultEn,
              lang: "es",
              character: state.officialName,
              category: state.selectedCategory || "any"
            });
            state.resultEs = String(transResp?.text || "").trim();
            console.log("Translation completed in background");
          } catch (transErr) {
            console.error("Translation failed in background:", transErr.message);
          }
        }
      })();

      // RENDER IMMEDIATELY with EN text (translation will come later if needed)
      console.log("Rendering results immediately (text ready)...");
      renderResultForCurrentLang();

      // Clear search text after results are ready
      el.characterInput.value = "";
      
      // Marcar como completado
      setStatus("done");

      // Wait for parallel tasks in background (non-blocking)
      Promise.all([imagePromise, translationPromise]).then(() => {
        console.log("All background tasks completed");
        // Re-render if translation came in and user switched languages
        if (state.hasResult) {
          renderResultForCurrentLang();
        }
      });
    } catch (e) {
      showError(String(e?.message || e));
      stopLoadingScreen();
      setStatus("idle");
      hideLoadingSpinner();
      const frame = document.querySelector('.imgFrame');
      if (frame) frame.classList.remove("spinning");
    } finally {
      setBusy(false);
      // Lock inputs after a successful result
      if (state.hasResult) {
        applyLocks();
      } else {
        hideLoadingSpinner();
        const frame = document.querySelector('.imgFrame');
        if (frame) frame.classList.remove("spinning");
        stopLoadingScreen();
      }
    }
  }

  function onClear() {
    // Hard reset sin recargar la página (evita que el gate pida contraseña de nuevo)
    stopLoadingScreen();
    hideLoadingSpinner();
    const frame = document.querySelector('.imgFrame');
    if (frame) frame.classList.remove("spinning");
    el.characterImg.classList.remove("is-visible");

    state.busy = false;
    state.hasResult = false;
    state.resultEn = null;
    state.resultEs = null;
    state.lastCharacter = "";
    state.officialName = "";
    state.characterName = "";
    state.characterUniverse = "";
    state.currentErrorKey = null;
    state.selectedCategory = "any";
    
    // Limpiar inputs
    el.characterInput.value = "";
    el.characterInput.focus();
    
    // Reset visual
    el.outputBox.textContent = "";
    el.outputBox.classList.remove("visible");
    el.errorBox.textContent = "";
    el.errorBox.classList.remove("visible");
    
    // Reset category a "any"
    setCategoryValue("any");
    
    // Limpiar campos de resultado
    el.visualTitle1.textContent = t("characterVisual");
    el.visualTitle2.textContent = t("scentNotesVisual");
    el.curiosityTitle.textContent = "";
    el.curiosityBox.textContent = "";
    
    // Reset imágenes
    if (el.visualImg1) el.visualImg1.src = "";
    if (el.visualImg2) el.visualImg2.src = "";
    
    el.characterImg.style.display = "none";
    el.characterImg.removeAttribute("src");
    el.characterImg.removeAttribute("data-lazy-image-url");
    el.characterImg.style.opacity = "0";
    
    // Reset listas de aroma
    const noteElements = document.querySelectorAll("[id^='compImg']");
    noteElements.forEach(el => el.classList.remove("tone-generic", "tone-top", "tone-heart", "tone-base"));
    document.querySelectorAll("[id^='compName']").forEach(el => el.textContent = "—");
    
    setStatus("idle");
    renderResultForCurrentLang();

    // Aplicar bloqueos
    applyLocks();
    applyStaticText();
    setLogoForLang();
  }

  async function onLanguageChange() {
    if (state.busy && !loadingActive) return; // Permitir cambio si está en carga

    setLogoForLang();
    applyLangSwitchUI();
    fillCategorySelectHidden();
    computeCategoryButtonWidth();
    applyStaticText();
    setCuriosityForCharacter(el.characterInput.value);

    // Si está en modo carga, mostrar la curiosidad del idioma actual
    if (loadingActive) {
      const lang = curLang();
      const state = curiosityStates[lang];
      if (state && state.curiosities.length > 0) {
        // Mostrar una curiosidad aleatoria del idioma actual inmediatamente
        const randomIndex = Math.floor(Math.random() * state.curiosities.length);
        if (el.outputBox) {
          el.outputBox.style.opacity = "0";
          el.outputBox.style.transition = "opacity 0.3s ease-in-out";
          setTimeout(() => {
            el.outputBox.textContent = state.curiosities[randomIndex];
            el.outputBox.style.opacity = "1";
          }, 150);
        }
      }
    }

    // Retraducir error si está visible
    if (state.currentErrorKey && el.errorBox.classList.contains("visible")) {
      el.errorBox.textContent = t(state.currentErrorKey);
    }

    // If there is a result and user switched to ES, translate once
    if (state.hasResult && curLang() === "es" && !state.resultEs) {
      try {
        setBusy(true);
        await ensureTranslation("es");
      } catch (e) {
        showError(String(e?.message || e));
      } finally {
        setBusy(false);
      }
    }

    // Actualizar status text cuando cambia idioma
    if (state.hasResult) {
      setStatus("done");
    }

    renderResultForCurrentLang();
  }

  function bindLangSwitch() {
    el.langSwitch.addEventListener("click", (e) => {
      if (state.busy) return;

      const btn = e.target.closest(".langOption");
      if (btn && btn.dataset.lang) {
        el.langSelect.value = btn.dataset.lang === "es" ? "es" : "en";
      } else {
        el.langSelect.value = curLang() === "es" ? "en" : "es";
      }
      onLanguageChange();
    });

    el.langSwitch.addEventListener("keydown", (e) => {
      if (state.busy) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        el.langSelect.value = curLang() === "es" ? "en" : "es";
        onLanguageChange();
      }
    });

    el.langSelect.addEventListener("change", () => onLanguageChange());
  }

  // ===== Boot =====
  function boot() {
    console.log("[Boot] Application starting...");
    // Set default language to English on first load
    if (!el.langSelect.value) {
      el.langSelect.value = "en";
    }
    
    // Initial state
    applyLangSwitchUI();
    setLogoForLang(true); // Skip animation on initial load
    state.isInitialLoad = false;

    // Category init
    fillCategorySelectHidden();
    setCategoryValue("any");
    computeCategoryButtonWidth();

    // Text
    applyStaticText();
    setCuriosityForCharacter(el.characterInput.value);

    // Bindings
    bindLangSwitch();
    bindCategoryDropdown();

    el.smellBtn.addEventListener("click", onGenerate);
    el.clearBtn.addEventListener("click", onClear);

    // Update button text and state when character input changes
    el.characterInput.addEventListener("input", () => {
      const hasChar = el.characterInput.value.trim().length > 0;
      el.smellBtn.textContent = hasChar ? t("identify") : t("enterCharacter");
      applyLocks();
    });

    // Enter in character input triggers generate (when allowed)
    el.characterInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !state.busy && !state.hasResult) {
        e.preventDefault();
        onGenerate();
      }
    });

    applyLocks();

    // ===== Zoom-based Visibility System =====
    // Hide footer when zoom >= 150%, show when zoom < 150%
    const studioFooter = document.querySelector('.studioFooter');
    if (studioFooter) {
      function checkZoomLevel() {
        // Get zoom level (devicePixelRatio represents zoom level)
        // 100% zoom = 1.0, 150% zoom = 1.5, 200% zoom = 2.0, etc.
        const zoomLevel = window.devicePixelRatio * 100;

        if (zoomLevel >= 150) {
          // Hide footer at 150% zoom or greater
          studioFooter.classList.add('hidden');
        } else {
          // Show footer when below 150% zoom
          studioFooter.classList.remove('hidden');
        }
      }

      // Check zoom on window resize (zoom triggers resize event)
      window.addEventListener('resize', checkZoomLevel, { passive: true });

      // Monitor zoom level continuously
      let lastZoom = window.devicePixelRatio * 100;
      setInterval(() => {
        const currentZoom = window.devicePixelRatio * 100;
        // Check if zoom changed (with small tolerance for floating point)
        if (Math.abs(currentZoom - lastZoom) > 0.5) {
          lastZoom = currentZoom;
          checkZoomLevel();
        }
      }, 100);

      // Initial check
      setTimeout(checkZoomLevel, 100);
      checkZoomLevel();
    }
  }

  // Export boot as initializeApp for external access
  window.initializeApp = boot;

  // Ensure DOM ready (BUT ONLY IF no access gate is present)
  // Access gate will call window.initializeApp() after authentication
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      // Check if access gate was initialized
      if (document.querySelector(".access-gate-container")) {
        // Access gate is present, wait for it to call initializeApp
        return;
      }
      boot();
    });
  } else {
    if (!document.querySelector(".access-gate-container")) {
      boot();
    }
  }
})();


// PATCH: bilingual sheet handling (en/es cached)
