(() => {
  // =========================
  // What's The Smell? (Frontend)
  // Robust bindings: language + category + generate
  // =========================

  console.log("%c[APP] Version 2.0 + addition and patches", "color: lime; font-size: 14px; font-weight: bold;");

  // ===== Use GATEWAY module for API resolution =====
  // GATEWAY is defined in gateway.js (loaded before app.js)
  if (typeof GATEWAY === "undefined") {
    console.error("[APP] GATEWAY module not loaded. Ensure gateway.js is loaded before app.js");
    return;
  }

  const API = String(GATEWAY.apiBase || "").trim().replace(/\/+$/, "");
  const API_VALID = /^https?:\/\//i.test(API);
  console.log("%c[APP] API endpoint: " + API + " | Environment: " + GATEWAY.env, "color: cyan; font-size: 11px;");
  if (!API_VALID) {
    console.error("[APP] Invalid API base. Expected absolute http(s) URL. Got:", API);
  }

  const SAFE_FETCH = (typeof window !== "undefined" && typeof window.fetch === "function")
    ? window.fetch.bind(window)
    : null;

  function safeFetch(url, options) {
    if (!SAFE_FETCH) {
      console.error("[APP] window.fetch is not available in this environment.");
      return Promise.reject(new Error("fetch not available"));
    }
    return SAFE_FETCH(url, options);
  }

  const APP_BUILD_VERSION = GATEWAY?.VERSION || "frontend-20260207";
  const generateId = () => (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `wts-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const DESKTOP_QUERY = window.matchMedia("(min-width: 768px)");
  const isDesktop = () => DESKTOP_QUERY.matches;
  const isMobile = () => !DESKTOP_QUERY.matches;

  // ===== DOM =====
  const el = {
    langSelect: document.getElementById("langSelect"),
    langSwitch: document.getElementById("langSwitch"),

    appLogoImg: document.getElementById("appLogoImg"),

    characterLabel: document.getElementById("characterLabel"),
    characterInput: document.getElementById("characterInput"),

    categoryLabel: document.getElementById("categoryLabel"),
    categoryDD: document.getElementById("categoryDD"),
    categoryBtn: document.getElementById("categoryBtn"),
    categoryDrawer: document.getElementById("categoryDrawer"),
    categoryValue: document.getElementById("categoryValue"),
    categoryArrowLeft: document.getElementById("categoryArrowLeft"),
    categoryArrowRight: document.getElementById("categoryArrowRight"),
    categoryRail: document.getElementById("categoryRail"),
    categoryPrev: document.getElementById("categoryPrev"),
    categoryActive: document.getElementById("categoryActive"),
    categoryNext: document.getElementById("categoryNext"),

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
    appTabs: document.getElementById("appTabs"),
    appViews: document.querySelectorAll(".app-view"),
    tabButtons: document.querySelectorAll(".app-tab-btn"),
    appGrid: document.getElementById("appGrid"),
    navDrawerToggle: document.getElementById("navDrawerToggle"),
    desktopDrawer: document.getElementById("desktopDrawer"),
    drawerBackdrop: document.getElementById("drawerBackdrop"),
    drawerButtons: document.querySelectorAll(".drawer-link"),
    drawerHeading: document.getElementById("drawerHeading"),
    drawerCloseBtn: document.getElementById("drawerCloseBtn"),
    drawerLibraryBadge: document.getElementById("drawerLibraryBadge"),
    tabLibraryBadge: document.getElementById("tabLibraryBadge"),
    imagePlaceholder: document.getElementById("imagePlaceholder"),
    imagePlaceholderText: document.getElementById("imagePlaceholderText"),
    imageRetryBtn: document.getElementById("imageRetryBtn"),
    libraryList: document.getElementById("libraryList"),
    libraryEmptyState: document.getElementById("libraryEmptyState"),
    librarySearchInput: document.getElementById("librarySearchInput"),
    libraryCategoryFilter: document.getElementById("libraryCategoryFilter"),
    librarySortSelect: document.getElementById("librarySortSelect"),
    favoritesList: document.getElementById("favoritesList"),
    favoritesEmptyState: document.getElementById("favoritesEmptyState"),
    feedbackForm: document.getElementById("feedbackForm"),
    feedbackType: document.getElementById("feedbackType"),
    feedbackDescription: document.getElementById("feedbackDescription"),
    feedbackClearScreenshot: document.getElementById("feedbackClearScreenshot"),
    feedbackScreenshotLabel: document.getElementById("feedbackScreenshotLabel"),
    feedbackFileInput: document.getElementById("feedbackFileInput"),
    feedbackPreview: document.getElementById("feedbackPreview"),
    feedbackPreviewImg: document.getElementById("feedbackPreviewImg"),
    feedbackUploadLabel: document.getElementById("feedbackUploadLabel"),
    feedbackStatus: document.getElementById("feedbackStatus"),
    feedbackSubmitBtn: document.getElementById("feedbackSubmitBtn"),
    detailCard: document.getElementById("detailCard"),
    detailCloseBtn: document.getElementById("detailCloseBtn"),
    favoriteToggle: document.getElementById("favoriteToggle"),
    favoriteToggleLabel: document.getElementById("favoriteToggleLabel"),
    detailBackBtn: document.getElementById("detailBackBtn"),
    detailDownloadBtn: document.getElementById("detailDownloadBtn"),
    detailCaptureBtn: document.getElementById("detailCaptureBtn"),
    langOverlay: document.getElementById("langOverlay"),
  };

  // ===== Guard: if DOM missing, stop gracefully =====
  const required = ["characterInput", "categoryBtn", "smellBtn", "clearBtn", "outputBox"];
  for (const k of required) {
    if (!el[k]) {
      console.error("[WTS] Missing DOM element:", k);
    }
  }

  if (!el.langSelect) {
    const select = document.createElement("select");
    select.id = "langSelect";
    select.innerHTML = "<option value=\"en\">English</option><option value=\"es\">Español</option>";
    select.style.display = "none";
    document.body.appendChild(select);
    el.langSelect = select;
  }

  if (!el.langSwitch) {
    const toggle = document.createElement("div");
    toggle.id = "langSwitch";
    toggle.style.display = "none";
    document.body.appendChild(toggle);
    el.langSwitch = toggle;
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
        const response = await safeFetch(
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
      aromaFound: "Aroma identified",
      tabSearch: "Search",
      tabLibrary: "Library",
      tabFavorites: "Favorites",
      tabFeedback: "Feedback",
      libraryTitle: "My Library",
      libraryEmpty: "No saved trails yet.",
      librarySearchPlaceholder: "Search by character",
      libraryFilterAll: "All categories",
      librarySortRecent: "Newest first",
      librarySortOldest: "Oldest first",
      librarySortAZ: "A-Z",
      favoritesTitle: "Favorites",
      favoritesEmpty: "No favorites yet.",
      favoritesHint: "Mark any aroma as favorite to find it here.",
      favoriteAdd: "Save favorite",
      favoriteRemove: "Remove favorite",
      feedbackTitle: "Feedback & Bug report",
      feedbackTypeLabel: "Type",
      feedbackTypeBug: "Bug / Something broken",
      feedbackTypeSuggestion: "Suggestion",
      feedbackTypeImage: "Image quality",
      feedbackTypeAroma: "Aroma quality",
      feedbackTypeOther: "Other",
      feedbackDescriptionLabel: "Description",
      feedbackDescriptionPlaceholder: "Tell us what to improve or what went wrong",
      feedbackUploadLabel: "Upload screenshot",
      feedbackSubmit: "Send",
      feedbackThanks: "Thanks! We'll review your note shortly.",
      feedbackError: "Couldn't send feedback. Try again in a moment.",
      feedbackMissingDescription: "Please describe your feedback.",
      feedbackCapture: "Upload screenshot",
      feedbackCaptureRemove: "Remove upload",
      feedbackScreenshotReady: "Screenshot ready",
      feedbackScreenshotEmpty: "No file selected",
      feedbackScreenshotInvalid: "Please choose an image file.",
      feedbackScreenshotTooLarge: "File too large (max 5MB).",
      libraryActionView: "Open",
      libraryActionDownload: "Download",
      libraryActionFavorite: "Favorite",
      libraryActionUnfavorite: "Unfavorite",
      libraryActionDelete: "Delete",
      libraryTimePrefix: "Saved",
      drawerHeading: "Navigate",
      imageRetry: "Retry image",
      imageFailed: "Premium placeholder active.",
      backToGenerator: "Back to generator",
      detailDownload: "Download",
      detailCapture: "Capture",
    },
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
      tabSearch: "Buscar",
      tabLibrary: "Biblioteca",
      tabFavorites: "Favoritos",
      tabFeedback: "Feedback",
      libraryTitle: "Mi Biblioteca",
      libraryEmpty: "Aún no guardas rastros aromáticos.",
      librarySearchPlaceholder: "Buscar por personaje",
      libraryFilterAll: "Todas las categorías",
      librarySortRecent: "Más recientes",
      librarySortOldest: "Más antiguas",
      librarySortAZ: "A-Z",
      favoritesTitle: "Favoritos",
      favoritesEmpty: "Todavía no tienes favoritos.",
      favoritesHint: "Marca cualquier aroma como favorito para verlo aquí.",
      favoriteAdd: "Guardar favorito",
      favoriteRemove: "Quitar favorito",
      feedbackTitle: "Feedback y reporte de bugs",
      feedbackTypeLabel: "Tipo",
      feedbackTypeBug: "Bug / Algo no funciona",
      feedbackTypeSuggestion: "Sugerencia",
      feedbackTypeImage: "Calidad de imagen",
      feedbackTypeAroma: "Calidad del aroma",
      feedbackTypeOther: "Otro",
      feedbackDescriptionLabel: "Descripción",
      feedbackDescriptionPlaceholder: "Cuéntanos qué mejorar o qué salió mal",
      feedbackUploadLabel: "Subir captura",
      feedbackSubmit: "Enviar",
      feedbackThanks: "¡Gracias! Revisaremos tu nota pronto.",
      feedbackError: "No pudimos enviar el feedback. Intenta de nuevo.",
      feedbackMissingDescription: "Por favor describe tu feedback.",
      feedbackCapture: "Subir captura",
      feedbackCaptureRemove: "Quitar captura",
      feedbackScreenshotReady: "Captura lista",
      feedbackScreenshotEmpty: "Sin archivo",
      feedbackScreenshotInvalid: "Elige una imagen valida.",
      feedbackScreenshotTooLarge: "Archivo muy pesado (max 5MB).",
      libraryActionView: "Abrir",
      libraryActionDownload: "Descargar",
      libraryActionFavorite: "Favorito",
      libraryActionUnfavorite: "Quitar favorito",
      libraryActionDelete: "Eliminar",
      libraryTimePrefix: "Guardado",
      drawerHeading: "Navegación",
      imageRetry: "Reintentar imagen",
      imageFailed: "Placeholder premium activo.",
      backToGenerator: "Volver al generador",
      detailDownload: "Descargar",
      detailCapture: "Capturar",
    },
  };

  const MAX_FEEDBACK_FILE_SIZE = 5 * 1024 * 1024;
  const LIBRARY_BADGE_KEY = "wts:library:badge";

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
    detail: null,
    detailSource: "none",
    currentView: "search",
    sessionId: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `wts-${Date.now()}`,
    libraryItems: [],
    libraryFilters: { search: "", category: "all", sort: "recent" },
    currentImageUrl: "",
    currentImageError: "",
    libraryReady: false,
    libraryHasNew: false,
    drawerOpen: false,
    feedbackFile: null,
    feedbackPreviewUrl: "",
    categoryAnimating: false,
    carouselSlots: null,
    lastCategoryPressAt: 0,
    ignoreDrawerClicksUntil: 0,
    lastCategoryCloseAt: 0,
    lastCategoryConfirmAt: 0,
    categoryDropdownBound: false,
    libraryHydrating: false,
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

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildLibraryKey(name, category) {
  return `lib::v1::${normalizeKey(name)}::${normalizeKey(category || "any")}`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Try loading a cached generated image directly from /generated as a fallback
async function tryLoadCachedGeneratedImage(charName) {
  const base = sanitizeFilename(charName);
  if (!base) return null;
  const exts = ["png", "jpg", "webp"];

  for (const ext of exts) {
    const candidate = `${API}/generated/${base}.${ext}`;
    const urlWithBust = `${candidate}?v=${Date.now()}`;
    const ok = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = urlWithBust;
    });
    if (ok) {
      el.characterImg.src = urlWithBust;
      el.characterImg.style.display = "block";
      return urlWithBust;
    }
  }
  return null;
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
      closeCategoryPanel();
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

  const VIEW_KEYS = ["search", "library", "favorites", "feedback"];

  function updateLibraryBadge() {
    const show = !!state.libraryHasNew;
    if (el.drawerLibraryBadge) {
      el.drawerLibraryBadge.classList.toggle("is-active", show);
    }
    if (el.tabLibraryBadge) {
      el.tabLibraryBadge.classList.toggle("is-active", show);
    }
  }

  function markLibraryBadge() {
    state.libraryHasNew = true;
    try {
      localStorage.setItem(LIBRARY_BADGE_KEY, "1");
    } catch {}
    updateLibraryBadge();
  }

  function clearLibraryBadge() {
    state.libraryHasNew = false;
    try {
      localStorage.removeItem(LIBRARY_BADGE_KEY);
    } catch {}
    updateLibraryBadge();
  }

  function setView(viewName) {
    const next = VIEW_KEYS.includes(viewName) ? viewName : "search";
    state.currentView = next;

    if (el.appViews) {
      el.appViews.forEach((section) => {
        const match = section.id === `view-${next}`;
        section.classList.toggle("is-active", match);
      });
    }

    if (el.tabButtons) {
      el.tabButtons.forEach((btn) => {
        const match = (btn.dataset.view || "") === next;
        btn.classList.toggle("is-active", match);
      });
    }

    if (el.drawerButtons) {
      el.drawerButtons.forEach((btn) => {
        const match = (btn.dataset.view || "") === next;
        btn.classList.toggle("is-active", match);
      });
    }

    if (next === "library" && !state.libraryReady) {
      initLibrary();
    }

    if (next === "library") {
      clearLibraryBadge();
    }

    if (next !== "search") {
      closeDetailPanel();
    } else if (state.detail) {
      openDetailPanel();
      hydrateDetailTranslationIfNeeded();
    }

    if (state.drawerOpen) {
      closeDrawer();
    }

    if (state.ddOpen) {
      closeCategoryPanel();
    }

    updateViewLayout();
  }

  function setActiveView(viewName) {
    setView(viewName);
  }

  function bindTabs() {
    if (!el.tabButtons) return;
    el.tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view || "search";
        setView(view);
      });
    });
  }

  function handleDrawerKeydown(event) {
    if (event.key === "Escape" && state.drawerOpen) {
      event.preventDefault();
      closeDrawer();
      el.navDrawerToggle?.focus();
    }
  }

  function openDrawer() {
    if (!el.desktopDrawer || state.drawerOpen) return;
    state.drawerOpen = true;
    el.desktopDrawer.classList.add("is-open");
    el.desktopDrawer.setAttribute("aria-hidden", "false");
    el.navDrawerToggle?.setAttribute("aria-expanded", "true");
    document.body.classList.add("drawer-open");
    document.addEventListener("keydown", handleDrawerKeydown);
    const activeBtn = Array.from(el.drawerButtons || []).find((btn) => (btn.dataset.view || "") === state.currentView);
    (activeBtn || (el.drawerButtons && el.drawerButtons[0]))?.focus?.();
  }

  function closeDrawer() {
    if (!el.desktopDrawer) return;
    state.drawerOpen = false;
    el.desktopDrawer.classList.remove("is-open");
    el.desktopDrawer.setAttribute("aria-hidden", "true");
    el.navDrawerToggle?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("drawer-open");
    document.removeEventListener("keydown", handleDrawerKeydown);
  }

  function toggleDrawer(forceState) {
    const nextState = typeof forceState === "boolean" ? forceState : !state.drawerOpen;
    if (nextState) openDrawer();
    else closeDrawer();
  }

  function bindDrawerNav() {
    if (el.navDrawerToggle) {
      el.navDrawerToggle.addEventListener("click", () => toggleDrawer());
    }
    if (el.drawerBackdrop) {
      el.drawerBackdrop.addEventListener("click", closeDrawer);
    }
    if (el.drawerCloseBtn) {
      el.drawerCloseBtn.addEventListener("click", closeDrawer);
    }
    if (el.drawerButtons) {
      el.drawerButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const view = btn.dataset.view || "search";
          setView(view);
        });
      });
    }
  }

  function animateDetailLift(originEl) {
    if (!originEl || !document.body || isDesktop()) return;
    const rect = originEl.getBoundingClientRect();
    const clone = document.createElement("div");
    clone.className = "detail-lift-clone";
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    const img = originEl.querySelector("img");
    if (img && img.src) {
      clone.style.backgroundImage = `url("${img.src}")`;
    }
    document.body.appendChild(clone);

    requestAnimationFrame(() => {
      const targetWidth = Math.min(window.innerWidth - 32, 980);
      const targetHeight = Math.min(window.innerHeight - 40, 720);
      const targetLeft = (window.innerWidth - targetWidth) / 2;
      const targetTop = (window.innerHeight - targetHeight) / 2;
      clone.style.transform = `translate(${targetLeft - rect.left}px, ${targetTop - rect.top}px) scale(${targetWidth / rect.width}, ${targetHeight / rect.height})`;
      clone.style.opacity = "0";
    });

    clone.addEventListener("transitionend", () => clone.remove(), { once: true });
  }

  function openDetailPanel(originEl = null) {
    updateDetailActionsVisibility();
    if (isDesktop()) {
      if (el.detailCard) {
        el.detailCard.classList.remove("panel-lift");
        void el.detailCard.offsetWidth;
        el.detailCard.classList.add("panel-lift");
        setTimeout(() => el.detailCard?.classList.remove("panel-lift"), 420);
      }
      return;
    }
    // Mobile: keep detail inline to avoid jump/overlay behavior.
    // This preserves the favorite action while preventing disruptive card lift.
    document.body.classList.remove("show-detail");
    document.body.classList.remove("detail-animating");
  }

  function closeDetailPanel() {
    document.body.classList.remove("show-detail");
    updateDetailActionsVisibility();
  }

  function updateViewLayout() {
    if (!el.detailCard) return;
    const showVisual = state.currentView === "search";
    el.detailCard.style.display = showVisual ? "" : "none";
    if (el.appGrid) {
      el.appGrid.classList.toggle("single-column", !showVisual);
    }
  }

  function updateDetailActionsVisibility() {
    const hasResult = !!state.hasResult && !!state.detail;
    const showFavorite = hasResult;
    const showDownload = false;
    const showCapture = false;
    const showBack = false;
    const showClose = false;

    if (el.favoriteToggle) {
      el.favoriteToggle.classList.toggle("is-visible", showFavorite);
    }
    if (el.detailDownloadBtn) {
      el.detailDownloadBtn.style.display = showDownload ? "inline-flex" : "none";
    }
    if (el.detailCaptureBtn) {
      el.detailCaptureBtn.style.display = showCapture ? "inline-flex" : "none";
    }
    if (el.detailBackBtn) {
      el.detailBackBtn.style.display = showBack ? "inline-flex" : "none";
    }
    if (el.detailCloseBtn) {
      el.detailCloseBtn.style.display = showClose ? "block" : "none";
    }
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
    if (!el.langSwitch || !el.langSelect) return;
    const isEn = curLang() === "en";
    el.langSwitch.classList.toggle("is-en", isEn);
    el.langSwitch.classList.toggle("is-es", !isEn);
    el.langSwitch.setAttribute("aria-checked", isEn ? "true" : "false");
  }

  function triggerLangOverlay() {
    if (!el.langOverlay) return;
    el.langOverlay.classList.remove("is-active");
    void el.langOverlay.offsetWidth;
    el.langOverlay.classList.add("is-active");
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

    const setText = (id, key) => {
      const node = document.getElementById(id);
      if (node) node.textContent = t(key);
    };

    setText("libraryTitle", "libraryTitle");
    setText("favoritesTitle", "favoritesTitle");
    setText("favoritesHint", "favoritesHint");
    setText("feedbackTitle", "feedbackTitle");
    setText("tabSearchLabel", "tabSearch");
    setText("tabLibraryLabel", "tabLibrary");
    setText("tabFavoritesLabel", "tabFavorites");
    setText("tabFeedbackLabel", "tabFeedback");
    setText("drawerHeading", "drawerHeading");
    setText("drawerSearchLabel", "tabSearch");
    setText("drawerLibraryLabel", "tabLibrary");
    setText("drawerFavoritesLabel", "tabFavorites");
    setText("drawerFeedbackLabel", "tabFeedback");
    setText("detailBackBtn", "backToGenerator");
    setText("imageRetryBtn", "imageRetry");
    setText("detailDownloadBtn", "detailDownload");
    setText("detailCaptureBtn", "detailCapture");

    setText("feedbackTypeLabel", "feedbackTypeLabel");
    setText("feedbackTypeBug", "feedbackTypeBug");
    setText("feedbackTypeSuggestion", "feedbackTypeSuggestion");
    setText("feedbackTypeImage", "feedbackTypeImage");
    setText("feedbackTypeAroma", "feedbackTypeAroma");
    setText("feedbackTypeOther", "feedbackTypeOther");
    setText("feedbackDescriptionLabel", "feedbackDescriptionLabel");
    setText("feedbackUploadLabel", "feedbackUploadLabel");

    if (el.feedbackSubmitBtn) {
      el.feedbackSubmitBtn.textContent = t("feedbackSubmit");
    }
    if (el.feedbackClearScreenshot) {
      el.feedbackClearScreenshot.textContent = t("feedbackCaptureRemove");
    }
    if (el.feedbackDescription) {
      el.feedbackDescription.placeholder = t("feedbackDescriptionPlaceholder");
    }

    if (el.librarySearchInput) {
      el.librarySearchInput.placeholder = t("librarySearchPlaceholder");
    }
    updateLibrarySortOptionLabels();
    populateLibraryCategoryFilter();
    renderLibraryList();
    renderFavoritesList();
    updateScreenshotLabel();
    updateFavoriteToggle();

    // Category display
    const label = categoryLabelFor(state.selectedCategory);
    el.categoryValue.textContent = label;
  }

  function updateLibrarySortOptionLabels() {
    if (!el.librarySortSelect) return;
    const sortOptions = {
      recent: t("librarySortRecent"),
      oldest: t("librarySortOldest"),
      az: t("librarySortAZ"),
    };
    Array.from(el.librarySortSelect.options).forEach((opt) => {
      if (sortOptions[opt.value]) opt.textContent = sortOptions[opt.value];
    });
  }

  // ===== Locks =====
  function applyLocks() {
    // Bloquea idioma solo mientras genera (no cuando ya hay resultado)
    if (el.langSelect) el.langSelect.disabled = state.busy;
    if (el.langSwitch) el.langSwitch.classList.toggle("is-disabled", state.busy);

    // Inputs should be locked when busy OR when a result is present (until New trail)
    const shouldLockInputs = state.busy || state.hasResult;
    
    if (el.smellBtn && el.characterInput) {
      el.smellBtn.disabled = shouldLockInputs || !el.characterInput.value.trim();
    }
    if (el.characterInput) el.characterInput.disabled = shouldLockInputs;
    if (el.categoryBtn) el.categoryBtn.disabled = shouldLockInputs;
    if (el.clearBtn) el.clearBtn.disabled = state.busy;

    if (state.busy) closeCategoryPanel();
  }
  function setBusy(v) {
    state.busy = !!v;
    applyLocks();
    updateFavoriteToggle();
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
  function setCategoryValue(id) {
    const next = CATEGORIES.some((x) => x.id === id) ? id : "any";
    const idx = Math.max(0, CATEGORIES.findIndex((x) => x.id === next));
    setActiveCategoryIndex(idx);
  }

  function ensureCarouselSlots() {
    if (!el.categoryPrev || !el.categoryActive || !el.categoryNext) return null;
    if (!state.carouselSlots) {
      state.carouselSlots = {
        left: el.categoryPrev,
        center: el.categoryActive,
        right: el.categoryNext,
      };
    }
    return state.carouselSlots;
  }

  function setCarouselItem(elm, id) {
    if (!elm) return;
    elm.textContent = categoryLabelFor(id);
    elm.dataset.value = id;
  }

  function setCarouselPosition(elm, pos) {
    if (!elm) return;
    elm.classList.remove("left", "center", "right");
    elm.classList.add(pos);
    const isCenter = pos === "center";
    elm.setAttribute("aria-hidden", isCenter ? "false" : "true");
    elm.setAttribute("aria-selected", isCenter ? "true" : "false");
    elm.setAttribute("tabindex", isCenter ? "0" : "-1");
  }

  function updateCategoryCarousel() {
    const slots = ensureCarouselSlots();
    if (!slots) return;
    const len = CATEGORIES.length;
    const activeIndex = ((state.focusIndex % len) + len) % len;
    const prevIndex = (activeIndex - 1 + len) % len;
    const nextIndex = (activeIndex + 1) % len;

    setCarouselPosition(slots.left, "left");
    setCarouselPosition(slots.center, "center");
    setCarouselPosition(slots.right, "right");

    setCarouselItem(slots.left, CATEGORIES[prevIndex].id);
    setCarouselItem(slots.center, CATEGORIES[activeIndex].id);
    setCarouselItem(slots.right, CATEGORIES[nextIndex].id);
  }

  function setActiveCategoryIndex(nextIndex) {
    const len = CATEGORIES.length;
    state.focusIndex = ((nextIndex % len) + len) % len;
    const nextId = CATEGORIES[state.focusIndex].id;
    state.selectedCategory = nextId;
    if (el.categoryValue) el.categoryValue.textContent = categoryLabelFor(nextId);
    updateCategoryCarousel();
  }

  function moveCategory(delta) {
    if (state.categoryAnimating) return;
    const len = CATEGORIES.length;
    if (!len) return;
    const slots = ensureCarouselSlots();
    if (!slots) return;

    const nextIndex = (state.focusIndex + delta + len) % len;
    const prevIndex = (nextIndex - 1 + len) % len;
    const nextNextIndex = (nextIndex + 1) % len;

    state.categoryAnimating = true;

    const newSlots = delta > 0
      ? { left: slots.center, center: slots.right, right: slots.left }
      : { left: slots.right, center: slots.left, right: slots.center };

    state.carouselSlots = newSlots;

    setCarouselPosition(newSlots.left, "left");
    setCarouselPosition(newSlots.center, "center");
    setCarouselPosition(newSlots.right, "right");

    state.focusIndex = nextIndex;
    state.selectedCategory = CATEGORIES[nextIndex].id;
    if (el.categoryValue) el.categoryValue.textContent = categoryLabelFor(state.selectedCategory);

    setCarouselItem(newSlots.center, state.selectedCategory);

    window.setTimeout(() => {
      setCarouselItem(newSlots.left, CATEGORIES[prevIndex].id);
      setCarouselItem(newSlots.right, CATEGORIES[nextNextIndex].id);
      state.categoryAnimating = false;
    }, 140);
  }

  function openCategoryPanel() {
    if (!el.categoryDD || !el.categoryBtn) return;
    state.ddOpen = true;
    state.ignoreDrawerClicksUntil = Date.now() + 250;
    el.categoryDD.classList.add("open");
    el.categoryBtn.classList.add("active");
    el.categoryBtn.setAttribute("aria-expanded", "true");
    updateCategoryCarousel();
  }

  function closeCategoryPanel() {
    if (!el.categoryDD || !el.categoryBtn) return;
    state.ddOpen = false;
    state.lastCategoryCloseAt = Date.now();
    el.categoryDD.classList.remove("open");
    el.categoryBtn.classList.remove("active");
    el.categoryBtn.setAttribute("aria-expanded", "false");
  }

  function isCategoryPanelOpen() {
    if (!el.categoryDD || !el.categoryBtn) return !!state.ddOpen;
    return el.categoryDD.classList.contains("open")
      || el.categoryBtn.classList.contains("active")
      || state.ddOpen;
  }

  function syncCategoryPanelState() {
    const visualOpen = isCategoryPanelOpen();
    state.ddOpen = visualOpen;
    if (el.categoryBtn) {
      el.categoryBtn.setAttribute("aria-expanded", visualOpen ? "true" : "false");
    }
  }

  function getEventClientPoint(e) {
    const touch = e?.touches?.[0] || e?.changedTouches?.[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
    return {
      x: Number.isFinite(e?.clientX) ? e.clientX : 0,
      y: Number.isFinite(e?.clientY) ? e.clientY : 0,
    };
  }

  function bindCategoryDropdown() {
    if (state.categoryDropdownBound) return;
    state.categoryDropdownBound = true;
    updateCategoryCarousel();

    if (el.categoryBtn) {
      const handleCategoryPress = (e) => {
        e.preventDefault();
        e.stopPropagation();
        syncCategoryPanelState();

        if (!isCategoryPanelOpen()) {
          openCategoryPanel();
          return;
        }
        closeCategoryPanel();
      };

      el.categoryBtn.addEventListener("pointerdown", (e) => {
        state.lastCategoryPressAt = Date.now();
        handleCategoryPress(e);
      }, { passive: false });

      el.categoryBtn.addEventListener("click", (e) => {
        const sincePointer = Date.now() - state.lastCategoryPressAt;
        if (sincePointer < 350) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        handleCategoryPress(e);
      });

      el.categoryBtn.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        if (!state.ddOpen) {
          openCategoryPanel();
          return;
        }
        closeCategoryPanel();
      });
    }

    if (el.categoryDD) {
      const handleCategoryDDCapture = (e) => {
        syncCategoryPanelState();
        if (!isCategoryPanelOpen()) {
          e.preventDefault();
          e.stopPropagation();
          openCategoryPanel();
          return;
        }
        if (!el.categoryDrawer || !el.categoryBtn) return;
        if (Date.now() < state.ignoreDrawerClicksUntil) return;
        if (e.target.closest(".ddArrowLeft") || e.target.closest(".ddArrowRight")) return;

        const rect = el.categoryDD.getBoundingClientRect();
        const point = getEventClientPoint(e);
        const x = point.x - rect.left;
        const edgeZone = Math.max(42, rect.width * 0.18);

        e.preventDefault();
        e.stopPropagation();

        if (x <= edgeZone) {
          moveCategory(-1);
          return;
        }
        if (x >= rect.width - edgeZone) {
          moveCategory(1);
          return;
        }
        closeCategoryPanel();
      };

      // Capture phase ensures center taps are handled even if inner layers conflict.
      el.categoryDD.addEventListener("pointerdown", handleCategoryDDCapture, { passive: false, capture: true });

      el.categoryDD.addEventListener("click", (e) => {
        syncCategoryPanelState();
        if (isCategoryPanelOpen()) return;
        if (e.target.closest("#categoryBtn")) return;
        if (Date.now() - state.lastCategoryCloseAt < 180) return;
        if (e.target.closest(".ddArrowLeft") || e.target.closest(".ddArrowRight")) return;
        openCategoryPanel();
      });
    }

    if (el.categoryArrowLeft) {
      el.categoryArrowLeft.addEventListener("click", (e) => {
        e.preventDefault();
        moveCategory(-1);
      });
    }

    if (el.categoryArrowRight) {
      el.categoryArrowRight.addEventListener("click", (e) => {
        e.preventDefault();
        moveCategory(1);
      });
    }

    if (el.categoryDrawer) {
      const handleDrawerZonePress = (e) => {
        const rect = el.categoryDrawer.getBoundingClientRect();
        const point = getEventClientPoint(e);
        const x = point.x - rect.left;
        const edgeZone = Math.max(52, rect.width * 0.22);
        if (x <= edgeZone) {
          moveCategory(-1);
          return true;
        }
        if (x >= rect.width - edgeZone) {
          moveCategory(1);
          return true;
        }
        closeCategoryPanel();
        return true;
      };

      const handleDrawerItemPress = (e) => {
        syncCategoryPanelState();
        if (!isCategoryPanelOpen()) return;
        if (Date.now() < state.ignoreDrawerClicksUntil) return;
        if (e.target.closest(".ddArrowLeft") || e.target.closest(".ddArrowRight")) return;

        const item = e.target.closest(".carousel-item");
        if (!item) return;

        e.preventDefault();
        e.stopPropagation();

        if (item.classList.contains("left")) {
          moveCategory(-1);
          return;
        }
        if (item.classList.contains("right")) {
          moveCategory(1);
          return;
        }
        if (item.classList.contains("center")) {
          closeCategoryPanel();
          return;
        }

        handleDrawerZonePress(e);
      };

      el.categoryDrawer.addEventListener("pointerdown", handleDrawerItemPress, { passive: false });

      el.categoryDrawer.addEventListener("click", (e) => {
        e.stopPropagation();
        syncCategoryPanelState();
        if (!isCategoryPanelOpen()) return;
        if (Date.now() < state.ignoreDrawerClicksUntil) return;
        if (e.target.closest(".ddArrowLeft") || e.target.closest(".ddArrowRight")) return;

        const item = e.target.closest(".carousel-item");
        if (!item) {
          handleDrawerZonePress(e);
          return;
        }
        if (item.classList.contains("left")) {
          moveCategory(-1);
          return;
        }
        if (item.classList.contains("right")) {
          moveCategory(1);
          return;
        }
        if (item.classList.contains("center")) {
          closeCategoryPanel();
          return;
        }
        handleDrawerZonePress(e);
      });

      el.categoryDrawer.addEventListener("keydown", (e) => {
        syncCategoryPanelState();
        if (!isCategoryPanelOpen()) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          state.lastCategoryConfirmAt = Date.now();
          closeCategoryPanel();
        }
      });
    }

    if (el.categoryRail) {
      el.categoryRail.addEventListener("wheel", (e) => {
        syncCategoryPanelState();
        if (!isCategoryPanelOpen()) return;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(delta) < 2) return;
        e.preventDefault();
        moveCategory(delta > 0 ? 1 : -1);
      }, { passive: false });

      let touchStartX = 0;
      let touchActive = false;
      el.categoryRail.addEventListener("touchstart", (e) => {
        syncCategoryPanelState();
        if (!isCategoryPanelOpen()) return;
        const touch = e.touches[0];
        if (!touch) return;
        touchActive = true;
        touchStartX = touch.clientX;
      }, { passive: true });

      el.categoryRail.addEventListener("touchend", (e) => {
        syncCategoryPanelState();
        if (!isCategoryPanelOpen() || !touchActive) return;
        const touch = e.changedTouches[0];
        if (!touch) return;
        const deltaX = touch.clientX - touchStartX;
        if (Math.abs(deltaX) > 24) {
          moveCategory(deltaX < 0 ? 1 : -1);
        }
        touchActive = false;
      }, { passive: true });
    }

    document.addEventListener("click", (e) => {
      syncCategoryPanelState();
      if (!isCategoryPanelOpen()) return;
      if (el.categoryDD && !el.categoryDD.contains(e.target)) {
        closeCategoryPanel();
      }
    });

    document.addEventListener("keydown", (e) => {
      syncCategoryPanelState();
      if (!isCategoryPanelOpen()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeCategoryPanel();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        state.lastCategoryConfirmAt = Date.now();
        closeCategoryPanel();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveCategory(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        moveCategory(1);
      }
    });
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
    const detail = state.detail;
    
    if (detail && (detail.textEn || detail.textEs)) {
      const lang = curLang();
      const txt = lang === "es" ? (detail.textEs || detail.textEn) : (detail.textEn || detail.textEs);
      const curiosity = parseSectionAny(txt || "", ["Aromatic Curiosity","Curiosidad Aromática","Curiosidad aromática"]) || "";
      el.curiosityBox.textContent = curiosity || "—";
      return;
    }
    
    // Si no hay resultado, usar el mapa local (fallback)
    const fallbackName = nameRaw || detail?.characterName || detail?.officialName || "";
    const key = String(fallbackName || "").trim().toLowerCase();
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

  const LibraryStore = (() => {
    const DB_NAME = "wtsLibrary";
    const DB_VERSION = 2;
    const STORE = "entries";
    const supported = typeof indexedDB !== "undefined";
    const LS_KEY = "wts:library:v1";
    const LEGACY_LS_KEY = "wts:favorites:v1";
    let dbPromise = null;

    function lsReadAll() {
      try {
        let raw = localStorage.getItem(LS_KEY);
        if (!raw) {
          const legacyRaw = localStorage.getItem(LEGACY_LS_KEY);
          if (legacyRaw) {
            localStorage.setItem(LS_KEY, legacyRaw);
            localStorage.removeItem(LEGACY_LS_KEY);
            raw = legacyRaw;
          }
        }
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function lsWriteAll(list) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(list));
      } catch (err) {
        console.warn("LS persist failed", err?.message);
      }
    }

    function openDB() {
      if (!supported) {
        return Promise.reject(new Error("IndexedDB not supported"));
      }
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: "id" });
            store.createIndex("byFavorite", "isFavorite", { unique: false });
            store.createIndex("byTimestamp", "createdAt", { unique: false });
          } else {
            const store = event.target.transaction.objectStore(STORE);
            if (!store.indexNames.contains("byFavorite")) {
              store.createIndex("byFavorite", "isFavorite", { unique: false });
            }
            if (!store.indexNames.contains("byTimestamp")) {
              store.createIndex("byTimestamp", "createdAt", { unique: false });
            }
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return dbPromise;
    }

    function withStore(mode, handler) {
      return openDB().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let request;
        try {
          request = handler(store);
        } catch (err) {
          reject(err);
          return;
        }

        if (request && typeof request.onsuccess === "function") {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        } else {
          tx.oncomplete = () => resolve(request);
          tx.onerror = () => reject(tx.error);
        }
      }));
    }

    return {
      supported,
      async getAll() {
        if (!supported) return lsReadAll().map(normalizeLibraryEntry);
        try {
          const result = await withStore("readonly", (store) => store.getAll());
          const list = Array.isArray(result) ? result.map(normalizeLibraryEntry) : [];
          if (list.length) {
            // Keep a localStorage mirror as extra resilience on mobile browsers.
            lsWriteAll(list);
            return list;
          }

          // IndexedDB empty: restore from localStorage mirror if available.
          const backup = lsReadAll().map(normalizeLibraryEntry);
          if (backup.length) {
            await Promise.all(
              backup.map((item) => withStore("readwrite", (store) => store.put(item)).catch(() => null))
            );
            return backup;
          }
          return [];
        } catch (err) {
          console.warn("Library getAll fallback to localStorage:", err?.message || err);
          return lsReadAll().map(normalizeLibraryEntry);
        }
      },
      async put(entry) {
        const normalized = normalizeLibraryEntry(entry);
        const all = lsReadAll().map(normalizeLibraryEntry);
        const idx = all.findIndex((e) => e.id === normalized.id);
        if (idx >= 0) all[idx] = normalized;
        else all.push(normalized);
        lsWriteAll(all);

        if (!supported) return normalized;
        try {
          await withStore("readwrite", (store) => store.put(normalized));
        } catch (err) {
          console.warn("Library put failed in IndexedDB (LS mirror kept):", err?.message || err);
        }
        return normalized;
      },
      async delete(id) {
        const all = lsReadAll().filter((e) => e.id !== id);
        lsWriteAll(all);
        if (!supported) return;
        try {
          await withStore("readwrite", (store) => store.delete(id));
        } catch (err) {
          console.warn("Library delete failed in IndexedDB (LS mirror kept):", err?.message || err);
        }
      },
      async get(id) {
        if (!supported) return lsReadAll().find((e) => e.id === id) || null;
        try {
          const fromDb = await withStore("readonly", (store) => store.get(id));
          if (fromDb) return normalizeLibraryEntry(fromDb);
        } catch (err) {
          console.warn("Library get fallback to localStorage:", err?.message || err);
        }
        return lsReadAll().find((e) => e.id === id) || null;
      }
    };
  })();

  function normalizeLibraryEntry(entry) {
    const safeEntry = entry && typeof entry === "object" ? { ...entry } : {};
    const name = safeEntry.name || safeEntry.characterName || safeEntry.officialName || safeEntry.searchName || "";
    const category = safeEntry.category || "any";
    const createdAt = safeEntry.createdAt || safeEntry.timestamp || Date.now();
    const isFavorite = safeEntry.isFavorite ?? safeEntry.favorite ?? false;
    const notes = Array.isArray(safeEntry.notes) && safeEntry.notes.length
      ? safeEntry.notes
      : parseNotesFromResult(safeEntry.textEn || safeEntry.text || "");
    const icons = Array.isArray(safeEntry.icons) && safeEntry.icons.length
      ? safeEntry.icons
      : notes.map(noteToIcon).filter(Boolean);

    return {
      ...safeEntry,
      id: safeEntry.id || sanitizeFilename(`${name}-${category}`) || generateId(),
      key: safeEntry.key || buildLibraryKey(name, category),
      name,
      category,
      notes,
      icons,
      imageUrl: safeEntry.imageUrl || "",
      createdAt,
      isFavorite,
      favorite: isFavorite,
    };
  }

  const CANONICAL_LIBRARY_OVERRIDES = {
    "joel miller": {
      category: "games",
      imageUrl: "/generated/joel-miller.png",
    },
  };

  const CANONICAL_NAME_ALIASES = {
    "joel": "joel miller",
  };

  const SINGLE_PROFILE_CANONICAL = new Set([
    "joel miller",
  ]);

  function canonicalizeLibraryName(rawName) {
    const normalized = normalizeKey(rawName || "");
    if (!normalized) return "";
    if (normalized === "joel" || normalized.startsWith("joel ") || normalized.includes("joel miller")) {
      return "joel miller";
    }
    return CANONICAL_NAME_ALIASES[normalized] || normalized;
  }

  function dedupeCanonicalEntriesForView(entries) {
    const input = Array.isArray(entries) ? entries.map(normalizeLibraryEntry) : [];
    const byKey = new Map();
    for (const raw of input) {
      const { entry } = applyCanonicalOverrideToEntry(raw);
      const logicalName = canonicalizeLibraryName(entry.characterName || entry.name || entry.officialName || entry.searchName || entry.id);
      const logicalCategory = normalizeKey(entry.category || "any");
      const logicalKey = SINGLE_PROFILE_CANONICAL.has(logicalName)
        ? logicalName
        : `${logicalName}::${logicalCategory}`;

      const current = byKey.get(logicalKey);
      if (!current) {
        byKey.set(logicalKey, entry);
        continue;
      }
      const currentTs = current.createdAt || current.timestamp || 0;
      const nextTs = entry.createdAt || entry.timestamp || 0;
      if (nextTs >= currentTs) {
        byKey.set(logicalKey, entry);
      }
    }
    return Array.from(byKey.values());
  }

  function applyCanonicalOverrideToEntry(entry) {
    const rawName = entry?.characterName || entry?.name || entry?.officialName || entry?.searchName || "";
    const normalizedName = canonicalizeLibraryName(rawName);
    const rule = CANONICAL_LIBRARY_OVERRIDES[normalizedName];
    if (!rule) return { entry, changed: false };

    const next = { ...entry };
    let changed = false;
    const canonicalDisplayName = "Joel Miller";
    if (canonicalDisplayName && next.name !== canonicalDisplayName) {
      next.name = canonicalDisplayName;
      changed = true;
    }
    if (canonicalDisplayName && next.characterName !== canonicalDisplayName) {
      next.characterName = canonicalDisplayName;
      changed = true;
    }
    if (canonicalDisplayName && next.officialName !== canonicalDisplayName) {
      next.officialName = canonicalDisplayName;
      changed = true;
    }
    if (rule.category && next.category !== rule.category) {
      next.category = rule.category;
      changed = true;
    }
    if (rule.imageUrl && next.imageUrl !== rule.imageUrl) {
      next.imageUrl = rule.imageUrl;
      changed = true;
    }
    if (changed) {
      next.key = buildLibraryKey(next.name || next.characterName || next.officialName || next.searchName || next.id, next.category || "any");
    }
    return { entry: next, changed };
  }

  async function reconcileCanonicalLibraryEntries(entries) {
    const list = Array.isArray(entries) ? entries.map(normalizeLibraryEntry) : [];
    const dedup = new Map();
    const toDeleteIds = [];
    let changed = false;

    for (const raw of list) {
      const { entry, changed: entryChanged } = applyCanonicalOverrideToEntry(raw);
      if (entryChanged) changed = true;

      const logicalName = canonicalizeLibraryName(entry.characterName || entry.name || entry.officialName || entry.searchName || entry.id);
      const logicalCategory = normalizeKey(entry.category || "any");
      const logicalKey = SINGLE_PROFILE_CANONICAL.has(logicalName)
        ? logicalName
        : `${logicalName}::${logicalCategory}`;

      const current = dedup.get(logicalKey);
      if (!current) {
        dedup.set(logicalKey, entry);
        continue;
      }

      const currentTs = current.createdAt || current.timestamp || 0;
      const nextTs = entry.createdAt || entry.timestamp || 0;
      if (nextTs >= currentTs) {
        toDeleteIds.push(current.id);
        dedup.set(logicalKey, entry);
      } else {
        toDeleteIds.push(entry.id);
      }
      changed = true;
    }

    const reconciled = Array.from(dedup.values());
    if (changed) {
      for (const id of toDeleteIds) {
        if (!id) continue;
        try { await LibraryStore.delete(id); } catch {}
      }
      for (const item of reconciled) {
        try { await LibraryStore.put(item); } catch {}
      }
    }
    return reconciled;
  }

  function populateLibraryCategoryFilter() {
    if (!el.libraryCategoryFilter) return;
    const current = state.libraryFilters.category || "all";
    const options = [
      `<option value="all">${t("libraryFilterAll")}</option>`,
      ...CATEGORIES.filter((c) => c.id !== "any").map((c) => {
        const label = curLang() === "es" ? c.es : c.en;
        return `<option value="${c.id}">${label}</option>`;
      }),
    ];
    el.libraryCategoryFilter.innerHTML = options.join("");
    el.libraryCategoryFilter.value = current;
  }

  function formatTimestamp(ts) {
    if (!ts) return "";
    try {
      return new Intl.DateTimeFormat(curLang(), {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(ts));
    } catch {
      return new Date(ts).toLocaleString();
    }
  }

  function applyLibraryFilters(items) {
    const filters = state.libraryFilters;
    let output = Array.isArray(items) ? [...items] : [];
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      output = output.filter((item) => {
        const localText = getEntryLocalizedText(item, curLang());
        const localSummary = buildCondensedMainOutput(localText || item.summary || "");
        const hay = `${item.name || ""} ${item.characterName || ""} ${item.officialName || ""} ${item.summary || ""} ${localSummary} ${item.textEn || ""} ${item.textEs || ""}`.toLowerCase();
        return hay.includes(needle);
      });
    }
    if (filters.category && filters.category !== "all") {
      output = output.filter((item) => (item.category || "") === filters.category);
    }
    if (filters.sort === "oldest") {
      output.sort((a, b) => (a.createdAt || a.timestamp || 0) - (b.createdAt || b.timestamp || 0));
    } else if (filters.sort === "az") {
      output.sort((a, b) => (a.name || a.characterName || "").localeCompare(b.name || b.characterName || ""));
    } else {
      output.sort((a, b) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0));
    }
    return output;
  }

  function buildLibraryItemMarkup(entry) {
    const catLabel = categoryLabelFor(entry.category || "any");
    const dateLabel = formatTimestamp(entry.createdAt || entry.timestamp);
    const localizedText = getEntryLocalizedText(entry, curLang());
    const summary = escapeHtml(buildCondensedMainOutput(localizedText || entry.summary || ""));
    const name = escapeHtml(entry.characterName || entry.officialName || entry.searchName || entry.id);
    const fav = !!(entry.isFavorite ?? entry.favorite);
    const favLabel = fav ? t("libraryActionUnfavorite") : t("libraryActionFavorite");
    const openLabel = t("libraryActionView");
    const downloadLabel = t("libraryActionDownload");
    const deleteLabel = t("libraryActionDelete");
    const favAction = fav ? "unfavorite" : "favorite";
    const thumbUrl = entry.imageUrl ? escapeHtml(entry.imageUrl) : "";
    const thumbImg = thumbUrl ? `<img src="${thumbUrl}" alt="${name}" loading="lazy" />` : "";
    const notes = Array.isArray(entry.notes) && entry.notes.length ? entry.notes : [];
    const noteIcons = notes
      .slice(0, 4)
      .map((note) => {
        const icon = noteToIcon(note);
        return icon ? `<span class="library-note" style="--note-icon:url('${icon}')" aria-hidden="true"></span>` : "";
      })
      .filter(Boolean)
      .join("");
    return `
      <li class="library-item glass-card" data-id="${entry.id}">
        <div class="library-thumb">
          ${thumbImg || ""}
          <span class="thumb-badge">${escapeHtml(catLabel)}</span>
          <button class="fav-heart ${fav ? "is-favorite" : ""}" data-action="${favAction}" aria-label="${favLabel}">♥</button>
        </div>
        <div class="library-item-header">
          <div>
            <strong>${name}</strong>
            <div class="charFact">${t("libraryTimePrefix")} · ${escapeHtml(catLabel)} · ${escapeHtml(dateLabel)}</div>
          </div>
          <div class="library-item-actions">
            <button class="library-icon-btn" data-action="view" aria-label="${escapeHtml(openLabel)}" title="${escapeHtml(openLabel)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.8-6 9-6 9 6 9 6-3.8 6-9 6-9-6-9-6zm9 3.3a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z" fill="currentColor"/></svg>
            </button>
            <button class="library-icon-btn" data-action="download" aria-label="${escapeHtml(downloadLabel)}" title="${escapeHtml(downloadLabel)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42L11 12.6V4a1 1 0 0 1 1-1zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z" fill="currentColor"/></svg>
            </button>
            <button class="library-icon-btn danger" data-action="delete" aria-label="${escapeHtml(deleteLabel)}" title="${escapeHtml(deleteLabel)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6a1 1 0 0 1 1 1v1h4v2h-1v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7H4V5h4V4a1 1 0 0 1 1-1zm1 2v0h4V5h-4zm-3 2v13h10V7H7zm3 3h2v7h-2v-7zm4 0h2v7h-2v-7z" fill="currentColor"/></svg>
            </button>
          </div>
        </div>
        ${noteIcons ? `<div class="library-notes">${noteIcons}</div>` : ""}
        <p class="charFact">${summary}</p>
      </li>`;
  }

  function renderLibraryList() {
    if (!el.libraryList) return;
    const canonical = dedupeCanonicalEntriesForView(state.libraryItems);
    const filtered = applyLibraryFilters(canonical);
    el.libraryList.innerHTML = filtered.map(buildLibraryItemMarkup).join("");
    if (el.libraryEmptyState) {
      el.libraryEmptyState.style.display = filtered.length ? "none" : "block";
      if (!filtered.length) {
        el.libraryEmptyState.textContent = t("libraryEmpty");
      }
    }
  }

  function renderFavoritesList() {
    if (!el.favoritesList) return;
    const canonical = dedupeCanonicalEntriesForView(state.libraryItems);
    const favorites = canonical.filter((item) => item.isFavorite ?? item.favorite);
    el.favoritesList.innerHTML = favorites.map(buildLibraryItemMarkup).join("");
    if (el.favoritesEmptyState) {
      el.favoritesEmptyState.style.display = favorites.length ? "none" : "block";
      if (!favorites.length) {
        el.favoritesEmptyState.textContent = t("favoritesEmpty");
      }
    }
  }

  function getLibraryEntryById(id) {
    if (!id) return null;
    return state.libraryItems.find((item) => item.id === id) || null;
  }

  function updateFavoriteToggle() {
    if (!el.favoriteToggle) return;
    const entry = state.detail;
    if (!entry) {
      el.favoriteToggle.classList.remove("is-visible", "is-favorite");
      el.favoriteToggle.setAttribute("aria-pressed", "false");
      el.favoriteToggle.disabled = true;
      el.favoriteToggle.setAttribute("aria-label", t("favoriteAdd"));
      el.favoriteToggle.setAttribute("title", t("favoriteAdd"));
      if (el.favoriteToggleLabel) el.favoriteToggleLabel.textContent = t("favoriteAdd");
      return;
    }

    const storedEntry = entry.id ? getLibraryEntryById(entry.id) : null;
    const isFavorite = storedEntry ? (storedEntry.isFavorite ?? storedEntry.favorite) : !!entry.favorite;
    el.favoriteToggle.disabled = !!state.busy;
    el.favoriteToggle.classList.add("is-visible");
    el.favoriteToggle.classList.toggle("is-favorite", !!isFavorite);
    el.favoriteToggle.setAttribute("aria-pressed", isFavorite ? "true" : "false");
    const actionLabel = isFavorite ? t("favoriteRemove") : t("favoriteAdd");
    el.favoriteToggle.setAttribute("aria-label", actionLabel);
    el.favoriteToggle.setAttribute("title", actionLabel);
    if (el.favoriteToggleLabel) el.favoriteToggleLabel.textContent = actionLabel;
  }

  async function toggleFavoriteFromDetail() {
    if (!state.detail) return;
    let entry = state.detail.id ? getLibraryEntryById(state.detail.id) : null;
    if (!entry) {
      entry = buildEntryFromState({ id: state.detail.id });
    }
    if (!entry) return;
    const nextFav = !(entry.isFavorite ?? entry.favorite);
    entry.isFavorite = nextFav;
    entry.favorite = nextFav;
    state.detail.favorite = nextFav;
    await persistEntry(entry);
    updateFavoriteToggle();
  }

  function bindFavoriteToggle() {
    if (!el.favoriteToggle) return;
    el.favoriteToggle.addEventListener("click", toggleFavoriteFromDetail);
  }

  function upsertLibraryItem(entry) {
    const idx = state.libraryItems.findIndex((item) => item.id === entry.id);
    if (idx >= 0) {
      state.libraryItems[idx] = entry;
    } else {
      state.libraryItems.push(entry);
    }
  }

  function handleLibraryListClick(event) {
    const actionBtn = event.target.closest("button[data-action]");
    if (!actionBtn) return;
    const itemEl = actionBtn.closest(".library-item");
    if (!itemEl) return;
    const id = itemEl.dataset.id;
    const action = actionBtn.dataset.action;
    const entry = state.libraryItems.find((item) => item.id === id);
    if (!entry) return;

    if (action === "view") {
      setDetailFromEntry(entry, "library");
      setView("search");
      const thumb = itemEl.querySelector(".library-thumb");
      openDetailPanel(thumb);
      return;
    }

    if (action === "favorite" || action === "unfavorite") {
      const nextFav = action === "favorite";
      entry.isFavorite = nextFav;
      entry.favorite = nextFav;
      LibraryStore.put(entry).catch((err) => console.warn("Favorite toggle failed", err?.message));
      upsertLibraryItem(entry);
      renderLibraryList();
      renderFavoritesList();
      if (state.detail?.id === entry.id) {
        state.detail.favorite = entry.favorite;
        updateFavoriteToggle();
      }
      return;
    }

    if (action === "download") {
      downloadLibraryCard(itemEl, entry).catch((err) => {
        console.warn("Library download failed", err?.message || err);
      });
      return;
    }

    if (action === "delete") {
      state.libraryItems = state.libraryItems.filter((item) => item.id !== id);
      LibraryStore.delete(id).catch((err) => console.warn("Delete failed", err?.message));
      renderLibraryList();
      renderFavoritesList();
      if (state.detail?.id === id) {
        state.detail = null;
        state.hasResult = false;
        updateFavoriteToggle();
        updateDetailActionsVisibility();
        closeDetailPanel();
        setOutput("");
        applyLocks();
      }
      return;
    }
  }

  function bindLibraryUI() {
    populateLibraryCategoryFilter();
    if (el.librarySearchInput) {
      el.librarySearchInput.placeholder = t("librarySearchPlaceholder");
      el.librarySearchInput.addEventListener("input", (e) => {
        state.libraryFilters.search = e.target.value.trim().toLowerCase();
        renderLibraryList();
      });
      el.librarySearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          // Prevent accidental Enter bubbling from triggering unrelated actions.
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }
    if (el.libraryCategoryFilter) {
      el.libraryCategoryFilter.addEventListener("change", (e) => {
        state.libraryFilters.category = e.target.value;
        renderLibraryList();
      });
    }
    if (el.librarySortSelect) {
      el.librarySortSelect.addEventListener("change", (e) => {
        state.libraryFilters.sort = e.target.value;
        renderLibraryList();
      });
      el.librarySortSelect.value = state.libraryFilters.sort;
      updateLibrarySortOptionLabels();
    }
    if (el.libraryList) {
      el.libraryList.addEventListener("click", handleLibraryListClick);
    }
    if (el.favoritesList) {
      el.favoritesList.addEventListener("click", handleLibraryListClick);
    }
  }

  async function initLibrary() {
    try {
      const entries = await LibraryStore.getAll();
      state.libraryItems = await reconcileCanonicalLibraryEntries(entries);
      state.libraryReady = true;
      renderLibraryList();
      renderFavoritesList();
      hydrateLibraryTranslationsIfNeeded().catch(() => {});
    } catch (err) {
      console.warn("Library init failed", err?.message);
    }
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function wrapTextLines(ctx, text, maxWidth, maxLines = 6) {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return [];
    const words = raw.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
      if (lines.length >= maxLines) break;
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length > maxLines) lines.length = maxLines;
    if (lines.length === maxLines) {
      const last = lines[maxLines - 1];
      if (ctx.measureText(last).width > maxWidth - 20) {
        lines[maxLines - 1] = `${last.slice(0, Math.max(0, last.length - 3))}...`;
      }
    }
    return lines;
  }

  function loadImageElement(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function buildShareCardCanvas(entry) {
    const width = 1200;
    const height = 1550;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("captureFailed");

    const textSource = curLang() === "es"
      ? (entry?.textEs || entry?.textEn || entry?.text || "")
      : (entry?.textEn || entry?.textEs || entry?.text || "");
    const summary = buildCondensedMainOutput(textSource || entry?.summary || "");
    const notesFromText = parseNotesFromResult(textSource || "").slice(0, 4);
    const notes = notesFromText.length
      ? notesFromText
      : ((Array.isArray(entry?.notes) && entry.notes.length) ? entry.notes.slice(0, 4) : []);
    const name = String(entry?.characterName || entry?.name || entry?.officialName || "Unknown").trim() || "Unknown";
    const category = categoryLabelFor(entry?.category || state?.selectedCategory || "any");
    const universe = String(entry?.universe || "").trim();
    const imageUrl = entry?.imageUrl || state.currentImageUrl || "";

    // Background
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#140c2b");
    bg.addColorStop(0.45, "#3a295a");
    bg.addColorStop(1, "#6a496f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Ambient glow
    ctx.globalAlpha = 0.55;
    const g1 = ctx.createRadialGradient(width * 0.75, height * 0.2, 40, width * 0.75, height * 0.2, 360);
    g1.addColorStop(0, "rgba(255,170,220,.85)");
    g1.addColorStop(1, "rgba(255,170,220,0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, width, height);
    const g2 = ctx.createRadialGradient(width * 0.2, height * 0.85, 40, width * 0.2, height * 0.85, 340);
    g2.addColorStop(0, "rgba(120,220,255,.65)");
    g2.addColorStop(1, "rgba(120,220,255,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;

    // Main glass panel
    drawRoundedRect(ctx, 80, 80, width - 160, height - 160, 36);
    ctx.fillStyle = "rgba(18,22,40,.55)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,.22)";
    ctx.stroke();

    // Branding
    const logo = await loadImageElement("assets/brand/logo-en.png");
    if (logo) {
      ctx.drawImage(logo, 120, 150, 280, 120);
    }
    ctx.font = "700 42px Sora, Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.96)";
    ctx.fillText(name, 120, 330);
    ctx.font = "600 24px Sora, Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(225,232,255,.85)";
    ctx.fillText(universe || "What's the Smell?", 120, 368);

    // Category pill
    drawRoundedRect(ctx, width - 430, 255, 300, 58, 29);
    ctx.fillStyle = "rgba(8,12,28,.72)";
    ctx.fill();
    ctx.strokeStyle = "rgba(180,200,255,.35)";
    ctx.stroke();
    ctx.font = "700 24px Sora, Segoe UI, sans-serif";
    ctx.fillStyle = "#eaf1ff";
    ctx.textAlign = "center";
    ctx.fillText(category, width - 280, 293);
    ctx.textAlign = "start";

    // Image frame
    drawRoundedRect(ctx, 120, 420, 430, 560, 28);
    ctx.fillStyle = "rgba(250,252,255,.88)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.4)";
    ctx.stroke();

    const charImg = await loadImageElement(imageUrl);
    if (charImg) {
      const imgX = 136;
      const imgY = 436;
      const imgW = 398;
      const imgH = 528;
      const scale = Math.max(imgW / charImg.width, imgH / charImg.height);
      const dw = charImg.width * scale;
      const dh = charImg.height * scale;
      const dx = imgX + (imgW - dw) / 2;
      const dy = imgY + (imgH - dh) / 2;
      ctx.save();
      drawRoundedRect(ctx, imgX, imgY, imgW, imgH, 20);
      ctx.clip();
      ctx.drawImage(charImg, dx, dy, dw, dh);
      ctx.restore();
    } else {
      ctx.font = "600 22px Sora, Segoe UI, sans-serif";
      ctx.fillStyle = "rgba(80,90,120,.9)";
      ctx.fillText("No image available", 220, 700);
    }

    // Summary block
    drawRoundedRect(ctx, 580, 420, 500, 560, 28);
    ctx.fillStyle = "rgba(20,24,42,.58)";
    ctx.fill();
    ctx.strokeStyle = "rgba(190,205,255,.22)";
    ctx.stroke();
    ctx.font = "700 24px Sora, Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(240,246,255,.95)";
    ctx.fillText(curLang() === "es" ? "Perfil Aromatico" : "Aroma Profile", 614, 468);
    ctx.font = "500 30px Sora, Segoe UI, sans-serif";
    const lines = wrapTextLines(ctx, summary, 430, 14);
    let y = 514;
    for (const line of lines) {
      ctx.fillStyle = "rgba(232,238,255,.92)";
      ctx.fillText(line, 614, y);
      y += 42;
    }

    // Notes row
    drawRoundedRect(ctx, 120, 1030, width - 240, 190, 24);
    ctx.fillStyle = "rgba(16,20,34,.6)";
    ctx.fill();
    ctx.strokeStyle = "rgba(180,205,255,.25)";
    ctx.stroke();
    ctx.font = "700 22px Sora, Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(240,246,255,.95)";
    ctx.fillText(curLang() === "es" ? "Notas" : "Notes", 150, 1078);
    ctx.font = "600 22px Sora, Segoe UI, sans-serif";
    notes.forEach((note, idx) => {
      const px = 150 + (idx % 2) * 450;
      const py = 1128 + Math.floor(idx / 2) * 54;
      drawRoundedRect(ctx, px, py - 30, 380, 40, 20);
      ctx.fillStyle = "rgba(255,255,255,.11)";
      ctx.fill();
      ctx.fillStyle = "rgba(233,240,255,.94)";
      ctx.fillText(String(note), px + 18, py - 3);
    });

    // Footer
    ctx.font = "500 20px Sora, Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(222,232,255,.82)";
    ctx.textAlign = "center";
    ctx.fillText(`Generated with What's the Smell? App`, width / 2, height - 80);
    ctx.textAlign = "start";

    return canvas;
  }

  async function ensureEntryLocalizedForCurrentLang(entry) {
    const safeEntry = (entry && typeof entry === "object") ? entry : {};
    if (curLang() !== "es") return safeEntry;

    const existingEs = String(safeEntry.textEs || "").trim();
    if (looksSpanishText(existingEs)) return safeEntry;

    const enText = String(safeEntry.textEn || safeEntry.text || "").trim();
    if (!enText) return safeEntry;

    const character = String(
      safeEntry.characterName ||
      safeEntry.name ||
      safeEntry.officialName ||
      state.lastCharacter ||
      ""
    ).trim();
    const category = String(safeEntry.category || state.selectedCategory || "any").trim() || "any";

    let translated = "";
    try {
      const resp = await apiPost("/api/translate", {
        text: enText,
        lang: "es",
        character,
        category,
      });
      translated = String(resp?.text || "").trim();
    } catch (err) {
      try {
        translated = String(await TRANSLATOR.enToEs(enText) || "").trim();
      } catch {
        translated = "";
      }
    }

    if (!looksSpanishText(translated)) return safeEntry;

    safeEntry.textEs = translated;
    const normalized = normalizeLibraryEntry(safeEntry);
    upsertAndRenderEntry(normalized);
    if (LibraryStore.supported) {
      try {
        await LibraryStore.put(normalized);
      } catch (err) {
        console.warn("Localized library save failed", err?.message || err);
      }
    }

    if (state.detail && normalized.id && state.detail.id === normalized.id) {
      state.detail.textEs = translated;
      state.resultEs = translated;
    }
    return normalized;
  }

  async function downloadLibraryCard(itemEl, entry) {
    const localizedEntry = await ensureEntryLocalizedForCurrentLang(entry || {});
    const canvas = await buildShareCardCanvas(localizedEntry || {});
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
    if (!blob) throw new Error("captureFailed");
    const name = sanitizeFilename(entry?.name || "card") || "card";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `wts-${name}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function setFeedbackStatus(message, mode = "info") {
    if (!el.feedbackStatus) return;
    el.feedbackStatus.textContent = message || "";
    el.feedbackStatus.dataset.mode = mode;
  }

  function updateScreenshotLabel() {
    if (!el.feedbackScreenshotLabel) return;
    if (state.feedbackFile) {
      el.feedbackScreenshotLabel.textContent = t("feedbackScreenshotReady");
      el.feedbackClearScreenshot?.removeAttribute("hidden");
    } else {
      el.feedbackScreenshotLabel.textContent = t("feedbackScreenshotEmpty");
      el.feedbackClearScreenshot?.setAttribute("hidden", "true");
    }
  }

  function clearFeedbackScreenshot() {
    if (state.feedbackPreviewUrl) {
      URL.revokeObjectURL(state.feedbackPreviewUrl);
      state.feedbackPreviewUrl = "";
    }
    state.feedbackFile = null;
    if (el.feedbackFileInput) {
      el.feedbackFileInput.value = "";
    }
    if (el.feedbackPreview) {
      el.feedbackPreview.setAttribute("hidden", "true");
    }
    if (el.feedbackPreviewImg) {
      el.feedbackPreviewImg.removeAttribute("src");
    }
    updateScreenshotLabel();
  }

  function setFeedbackFile(file) {
    if (!file) {
      clearFeedbackScreenshot();
      return;
    }
    if (!file.type || !file.type.startsWith("image/")) {
      setFeedbackStatus(t("feedbackScreenshotInvalid"), "error");
      clearFeedbackScreenshot();
      return;
    }
    if (file.size > MAX_FEEDBACK_FILE_SIZE) {
      setFeedbackStatus(t("feedbackScreenshotTooLarge"), "error");
      clearFeedbackScreenshot();
      return;
    }

    if (state.feedbackPreviewUrl) {
      URL.revokeObjectURL(state.feedbackPreviewUrl);
    }
    state.feedbackFile = file;
    state.feedbackPreviewUrl = URL.createObjectURL(file);
    if (el.feedbackPreviewImg) {
      el.feedbackPreviewImg.src = state.feedbackPreviewUrl;
    }
    if (el.feedbackPreview) {
      el.feedbackPreview.removeAttribute("hidden");
    }
    updateScreenshotLabel();
  }

  function setFeedbackBusy(isBusy) {
    if (!el.feedbackSubmitBtn) return;
    el.feedbackSubmitBtn.disabled = !!isBusy;
    el.feedbackSubmitBtn.textContent = isBusy ? `${t("feedbackSubmit")}…` : t("feedbackSubmit");
    if (el.feedbackFileInput) {
      el.feedbackFileInput.disabled = !!isBusy;
    }
  }

  async function handleFeedbackSubmit(event) {
    event.preventDefault();
    if (!el.feedbackDescription) return;
    const message = String(el.feedbackDescription.value || "").trim();
    if (!message) {
      setFeedbackStatus(t("feedbackMissingDescription"), "error");
      el.feedbackDescription.focus();
      return;
    }
    setFeedbackStatus("", "info");
    setFeedbackBusy(true);

    try {
      const selectedType = document.querySelector('input[name="feedbackType"]:checked');
      const feedbackCategory = selectedType ? selectedType.value : "feedback";
      const contactValue = "";

      if (state.feedbackFile) {
        const formData = new FormData();
        formData.append("message", message);
        formData.append("category", feedbackCategory);
        if (contactValue) formData.append("contact", contactValue);
        formData.append("url", window.location.href);
        formData.append("userAgent", navigator.userAgent);
        formData.append("ts", String(Date.now()));
        formData.append("locale", curLang());
        formData.append("sessionId", state.sessionId);
        formData.append("screenshot", state.feedbackFile, state.feedbackFile.name || "screenshot.png");
        await apiPostFormData("/api/feedback", formData);
      } else {
        const payload = {
          message,
          category: feedbackCategory,
          contact: contactValue,
          url: window.location.href,
          userAgent: navigator.userAgent,
          ts: Date.now(),
          locale: curLang(),
          sessionId: state.sessionId,
        };
        await apiPost("/api/feedback", payload);
      }
      setFeedbackStatus(t("feedbackThanks"), "success");
      el.feedbackForm.reset();
      clearFeedbackScreenshot();
    } catch (err) {
      console.error("Feedback submit failed", err?.message || err);
      setFeedbackStatus(t("feedbackError"), "error");
    } finally {
      setFeedbackBusy(false);
    }
  }

  function bindFeedbackForm() {
    if (!el.feedbackForm) return;
    const syncChips = () => {
      document.querySelectorAll(".chip").forEach((label) => {
        const input = label.querySelector("input");
        label.classList.toggle("is-checked", !!input?.checked);
      });
    };

    el.feedbackForm.addEventListener("submit", handleFeedbackSubmit);
    document.querySelectorAll('input[name="feedbackType"]').forEach((input) => {
      input.addEventListener("change", syncChips);
    });
    syncChips();
    if (el.feedbackFileInput) {
      el.feedbackFileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
        setFeedbackFile(file);
      });
    }
    if (el.feedbackClearScreenshot) {
      el.feedbackClearScreenshot.addEventListener("click", () => {
        clearFeedbackScreenshot();
        setFeedbackStatus(t("feedbackScreenshotEmpty"), "info");
      });
    }
    updateScreenshotLabel();
  }

  async function captureDetailCanvas() {
    if (typeof html2canvas !== "function") {
      throw new Error("missingLib");
    }
    const target = el.detailCard || document.body;
    return html2canvas(target, {
      backgroundColor: "#0b0f1a",
      useCORS: true,
      logging: false,
      scale: Math.min(window.devicePixelRatio || 1.5, 2),
    });
  }

  async function handleDetailDownload() {
    try {
      const entry = state.detail || buildEntryFromState() || {};
      const localizedEntry = await ensureEntryLocalizedForCurrentLang(entry);
      const canvas = await buildShareCardCanvas(localizedEntry || {});
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
      if (!blob) throw new Error("captureFailed");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wts-card-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Detail download failed", err?.message || err);
      showImagePlaceholder(t("imageFailed"), true);
    }
  }

  async function handleDetailCapture() {
    try {
      const entry = state.detail || buildEntryFromState() || {};
      const localizedEntry = await ensureEntryLocalizedForCurrentLang(entry);
      const canvas = await buildShareCardCanvas(localizedEntry || {});
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
      if (!blob) throw new Error("captureFailed");
      const file = new File([blob], `wts-card-${Date.now()}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "What's the Smell?" });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Detail capture failed", err?.message || err);
      showImagePlaceholder(t("imageFailed"), true);
    }
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
    const hasAny = (...parts) => parts.some((p) => n.includes(p));

    // High-priority explicit aliases to reduce generic fallback in real outputs.
    if (hasAny("white musk", "almizcle blanco")) return "assets/notes/085_skin-musk.svg";
    if (hasAny("musk", "almizcle")) return "assets/notes/085_skin-musk.svg";
    if (hasAny("steel", "acero", "metal")) return "assets/notes/017_hot-metal.svg";
    if (hasAny("bamboo", "bambu")) return "assets/notes/051_fresh-cut-grass.svg";
    if (hasAny("green tea", "te verde", "matcha")) return "assets/notes/059_tea-leaf.svg";
    if (hasAny("dry sand", "sun-baked earth", "arena seca", "arena")) return "assets/notes/027_dust.svg";
    if (hasAny("wet earth", "damp soil", "tierra humeda", "suelo humedo")) return "assets/notes/021_earth.svg";
    if (hasAny("gun oil", "machine oil", "aceite")) return "assets/notes/016_tar.svg";
    if (hasAny("forest", "bosque")) return "assets/notes/024_moss.svg";
    if (hasAny("sage", "salvia")) return "assets/notes/056_sage.svg";
    if (hasAny("kumquat", "quinoto")) return "assets/notes/045_lime.svg";
    if (hasAny("zest", "cascara")) return "assets/notes/041_lemon.svg";
    if (hasAny("broth", "caldo", "miso")) return "assets/notes/073_coffee.svg";
    if (hasAny("ash", "ceniza")) return "assets/notes/012_charcoal.svg";
    if (hasAny("burnt", "quemado", "scorched", "chamuscado")) return "assets/notes/013_ember.svg";
    if (hasAny("blood", "sangre")) return "assets/notes/028_iron.svg";
    if (hasAny("leaves", "leaf", "hojas", "hoja")) return "assets/notes/051_fresh-cut-grass.svg";
    if (hasAny("cloth", "fabric", "tela", "ropa")) return "assets/notes/083_fresh-linen.svg";
    if (hasAny("detergent", "detergente")) return "assets/notes/089_laundry.svg";
    if (hasAny("ambergris")) return "assets/notes/005_amber-resin.svg";
    if (hasAny("smog")) return "assets/notes/011_smoke.svg";
    if (hasAny("electricity", "electricidad")) return "assets/notes/091_ozone.svg";

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

  function applyDetailImageFromState() {
    if (!el.characterImg) return;
    if (state.currentImageUrl) {
      el.characterImg.src = state.currentImageUrl;
      el.characterImg.style.display = "block";
      el.characterImg.classList.add("is-visible");
      el.characterImg.style.opacity = "1";
      setImageFrameHasImage(true);
      hideImagePlaceholder();
    } else {
      el.characterImg.removeAttribute("src");
      el.characterImg.style.display = "none";
      setImageFrameHasImage(false);
      showImagePlaceholder(t("noImageYet"), true);
    }
  }

  function setDetailFromEntry(entry, source = "library") {
    if (!entry) return;
    const detail = {
      ...entry,
      textEn: entry.textEn || entry.text || state.resultEn || "",
      textEs: entry.textEs || state.resultEs || "",
    };
    detail.favorite = !!(detail.isFavorite ?? detail.favorite);
    state.detail = detail;
    state.detailSource = source;
    state.resultEn = detail.textEn || "";
    state.resultEs = looksSpanishText(detail.textEs) ? detail.textEs : "";
    state.characterName = detail.characterName || detail.name || detail.officialName || state.characterName;
    state.officialName = detail.officialName || state.officialName;
    state.characterUniverse = detail.universe || detail.metadata?.universe || state.characterUniverse;
    state.lastCharacter = detail.searchName || state.lastCharacter;
    if (detail.searchName) {
      el.characterInput.value = detail.searchName;
    }
    state.currentImageUrl = detail.imageUrl || state.currentImageUrl;
    if (detail.category) {
      setCategoryValue(detail.category);
    }
    state.hasResult = true;
    applyDetailImageFromState();
    renderResultForCurrentLang();
    applyLocks();
    updateFavoriteToggle();
    updateDetailActionsVisibility();
    hydrateDetailTranslationIfNeeded();
  }

  async function hydrateDetailTranslationIfNeeded() {
    if (curLang() !== "es" || !state.detail || !state.hasResult) return;
    if (looksSpanishText(state.resultEs) || looksSpanishText(state.detail.textEs)) return;
    if (!state.resultEn && !state.detail.textEn) return;
    try {
      await ensureTranslation("es", true);
      if (!state.resultEs) return;
      state.detail.textEs = state.resultEs;
      const enriched = buildEntryFromState({
        id: state.detail.id,
        timestamp: state.detail.createdAt || state.detail.timestamp || Date.now(),
        isFavorite: state.detail.favorite,
        favorite: state.detail.favorite,
      });
      if (enriched) {
        enriched.textEs = state.resultEs;
        persistEntry(enriched);
      }
      renderResultForCurrentLang();
    } catch (err) {
      console.warn("Detail ES hydration failed", err?.message || err);
    }
  }

  function buildEntryFromState(overrides = {}) {
    if (!state.resultEn) return null;
    const slugSource = state.officialName || state.characterName || state.lastCharacter || "entry";
    const baseId = sanitizeFilename(`${slugSource}-${state.selectedCategory || "any"}`) || generateId();
    const notes = parseNotesFromResult(state.resultEn || "");
    const icons = notes.map(noteToIcon).filter(Boolean);
    const name = state.characterName || state.officialName || slugSource;
    const category = state.selectedCategory || "any";
    return {
      id: overrides.id || baseId,
      key: buildLibraryKey(name, category),
      name,
      notes,
      icons,
      officialName: state.officialName,
      characterName: state.characterName || state.officialName,
      searchName: state.lastCharacter,
      category,
      lang: curLang(),
      timestamp: overrides.timestamp || Date.now(),
      createdAt: overrides.timestamp || Date.now(),
      summary: buildCondensedMainOutput(state.resultEn),
      textEn: state.resultEn,
      textEs: state.resultEs,
      universe: state.characterUniverse,
      imageUrl: state.currentImageUrl,
      isFavorite: overrides.isFavorite ?? overrides.favorite ?? state.detail?.favorite ?? false,
      favorite: overrides.isFavorite ?? overrides.favorite ?? state.detail?.favorite ?? false,
      metadata: {
        sessionId: state.sessionId,
        categoryLabel: categoryLabelFor(state.selectedCategory),
        lastPrompt: state.lastCharacter,
      },
    };
  }

  function setImageFrameHasImage(hasImage) {
    const frame = el.characterImg?.closest(".imgFrame");
    if (!frame) return;
    frame.classList.toggle("has-image", !!hasImage);
  }

  function upsertAndRenderEntry(entry) {
    if (!entry) return;
    const normalized = normalizeLibraryEntry(entry);
    upsertLibraryItem(normalized);
    renderLibraryList();
    renderFavoritesList();
  }

  async function persistEntry(entry) {
    if (!entry) return null;
    const normalized = normalizeLibraryEntry(entry);
    upsertAndRenderEntry(normalized);
    if (!LibraryStore.supported) {
      return normalized;
    }
    try {
      await LibraryStore.put(normalized);
    } catch (err) {
      console.warn("Library save failed", err?.message);
    }
    return normalized;
  }

  function showImagePlaceholder(message, allowRetry = true) {
    state.currentImageError = message || "";
    if (el.imagePlaceholder) {
      el.imagePlaceholder.classList.add("is-visible");
      if (el.imagePlaceholderText) {
        el.imagePlaceholderText.textContent = message || t("imageFailed");
      }
      if (el.imageRetryBtn) {
        el.imageRetryBtn.disabled = !allowRetry;
        el.imageRetryBtn.style.display = allowRetry ? "inline-flex" : "none";
      }
    }
    if (el.characterImg) {
      el.characterImg.classList.remove("is-visible");
      el.characterImg.style.opacity = "0";
    }
    setImageFrameHasImage(false);
  }

  function hideImagePlaceholder() {
    state.currentImageError = "";
    if (el.imagePlaceholder) {
      el.imagePlaceholder.classList.remove("is-visible");
    }
  }

  // ===== Character image =====
  // OPTIMIZATION 3: Lazy load images with IntersectionObserver
  function initLazyLoadImage() {
    return new Promise((resolve) => {
      if (!el.characterImg) return resolve(false);

      const img = el.characterImg;
      const finalize = (ok) => {
        if (finalize.done) return;
        finalize.done = true;
        resolve(!!ok);
      };

      const attachHandlers = () => {
        img.onload = () => {
          hideLoadingSpinner();
          const frame = img.closest('.imgFrame');
          if (frame) frame.classList.remove("spinning");
          img.classList.add("is-visible");
          img.style.opacity = "1";
          setImageFrameHasImage(true);
          hideImagePlaceholder();
          img.onload = null;
          img.onerror = null;
          finalize(true);
        };
        img.onerror = () => {
          hideLoadingSpinner();
          const frame = img.closest('.imgFrame');
          if (frame) frame.classList.remove("spinning");
          img.style.opacity = "0";
          setImageFrameHasImage(false);
          img.onload = null;
          img.onerror = null;
          showImagePlaceholder(t("imageFailed"), true);
          finalize(false);
        };
      };

      const loadNow = () => {
        const url = img.dataset.lazyImageUrl;
        if (!url) return finalize(false);
        attachHandlers();
        img.src = url;
        delete img.dataset.lazyImageUrl;
        console.log("Lazy loaded image:", url.slice(0, 50));
      };

      if (!("IntersectionObserver" in window)) {
        loadNow();
        return;
      }

      // Setup IntersectionObserver for lazy loading
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.target.dataset.lazyImageUrl) {
            observer.unobserve(entry.target);
            loadNow();
          }
        });
      }, {
        rootMargin: '50px' // Start loading 50px before element is visible
      });
      
      imageObserver.observe(img);
    });
  }

  async function setCharacterImage(charName, categoryId, universe = "") {
    const name = String(charName || "").trim();
    if (!name) {
      console.warn("setCharacterImage: No name provided");
      return null;
    }

    try {
      if (el.characterImg) {
        el.characterImg.classList.remove("is-visible");
        el.characterImg.style.opacity = "0";
      }
      setImageFrameHasImage(false);
      showLoadingSpinner();
      const univ = String(universe || "").trim();
      if (!API_VALID) {
        throw new Error("Invalid API base; cannot fetch image.");
      }

      const payload = {
        name,
        category: categoryId || "any",
        // Match /api/smell background generation params to avoid duplicate paid renders.
        style: "auto",
        universe: univ,
        lang: "en",
      };

      console.log("Fetching image from:", `${API}/api/ai-image`);
      const r = await safeFetch(`${API}/api/ai-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      const imgUrl = String(data?.imageUrl || data?.url || "");

      console.log("Image response:", { ok: r.ok && data?.ok !== false, url: imgUrl, provider: data?.provider });

      if (!r.ok || data?.ok === false || !imgUrl) {
        const errMsg = data?.details || data?.error || t("imageFailed");
        console.error("Image generation failed:", errMsg);
        hideLoadingSpinner();
        showImagePlaceholder(errMsg, true);
        throw new Error(errMsg);
      }

      const resolvedBase = imgUrl.startsWith("http") ? imgUrl : `${API}${imgUrl}`;
      const cacheBust = `cb=${Date.now()}`;
      const joiner = resolvedBase.includes("?") ? "&" : "?";
      const resolvedUrl = `${resolvedBase}${joiner}${cacheBust}`;
      el.characterImg.dataset.lazyImageUrl = resolvedUrl;
      el.characterImg.style.display = "block";
      hideImagePlaceholder();

      await initLazyLoadImage();
      state.currentImageUrl = resolvedUrl;
      if (state.detail) state.detail.imageUrl = resolvedUrl;
      console.log("Image queued for lazy loading");
      return resolvedUrl;
    } catch (err) {
      console.error("setCharacterImage error:", err.message);
      hideLoadingSpinner();

      try {
        const fallbackUrl = await tryLoadCachedGeneratedImage(name);
        if (fallbackUrl) {
          console.log("Fallback cached image loaded from /generated");
          hideLoadingSpinner();
          const frame = el.characterImg.closest('.imgFrame');
          if (frame) frame.classList.remove("spinning");
          el.characterImg.classList.add("is-visible");
          el.characterImg.style.opacity = "1";
          setImageFrameHasImage(true);
          state.currentImageUrl = fallbackUrl;
          if (state.detail) state.detail.imageUrl = fallbackUrl;
          return fallbackUrl;
        }
      } catch (e) {
        console.warn("Fallback cached image check failed:", e?.message || e);
      }

      el.characterImg.removeAttribute("src");
      el.characterImg.removeAttribute("data-lazy-image-url");
      el.characterImg.style.display = "none";
      setImageFrameHasImage(false);
      state.currentImageUrl = "";
      showImagePlaceholder(err?.message || t("imageFailed"), true);
      throw err;
    }
  }

  async function retryCharacterImage() {
    try {
      const targetName = state.officialName || state.characterName || state.lastCharacter;
      if (!targetName) {
        showImagePlaceholder(t("enterCharacter"), false);
        return;
      }
      showImagePlaceholder(t("working"), false);
      await setCharacterImage(targetName, state.selectedCategory, state.characterUniverse);
    } catch (err) {
      console.warn("Retry image failed", err?.message || err);
    }
  }

  // ===== Backend calls =====
  async function apiPost(path, body) {
    if (!API_VALID) {
      console.error("[APP] Invalid API base; cannot call backend:", API, "path:", path);
      throw new Error("API base invalid. Check configuration.");
    }

    const r = await safeFetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.details || data?.error || `HTTP ${r.status}`);
    return data;
  }

  async function apiPostFormData(path, formData) {
    if (!API_VALID) {
      console.error("[APP] Invalid API base; cannot call backend:", API, "path:", path);
      throw new Error("API base invalid. Check configuration.");
    }

    const r = await safeFetch(`${API}${path}`, {
      method: "POST",
      body: formData,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.details || data?.error || `HTTP ${r.status}`);
    return data;
  }

  function looksSpanishText(text) {
    const src = String(text || "").trim();
    if (!src) return false;
    const lower = src.toLowerCase();
    if (/[áéíóúñ¿¡]/.test(src)) return true;
    const spanishHints = [
      "nombre:", "universo:", "categoría:", "categoria:", "tipo de aroma:",
      "sensación", "sensacion", "estilo olfativo", "impresión final",
      "impresion final", "perfil aromático", "perfil aromatico",
      "perfume sugerido", "notas"
    ];
    return spanishHints.some((h) => lower.includes(h));
  }

  function getEntryLocalizedText(entry, lang = curLang()) {
    const safeEntry = entry && typeof entry === "object" ? entry : {};
    const enText = String(safeEntry.textEn || safeEntry.text || "").trim();
    const esRaw = String(safeEntry.textEs || "").trim();
    const esText = looksSpanishText(esRaw) ? esRaw : "";
    if (lang === "es") return esText || enText;
    return enText || esText;
  }

  async function hydrateLibraryTranslationsIfNeeded() {
    if (curLang() !== "es" || state.libraryHydrating) return;
    const candidates = (state.libraryItems || []).filter((item) => {
      const enText = String(item?.textEn || item?.text || "").trim();
      const esText = String(item?.textEs || "").trim();
      return !!enText && !looksSpanishText(esText);
    });
    if (!candidates.length) return;

    state.libraryHydrating = true;
    let changed = false;
    try {
      for (const item of candidates.slice(0, 8)) {
        const enText = String(item.textEn || item.text || "").trim();
        if (!enText) continue;
        let translated = "";
        try {
          const resp = await apiPost("/api/translate", {
            text: enText,
            lang: "es",
            character: item.characterName || item.name || item.officialName || "",
            category: item.category || "any",
          });
          translated = String(resp?.text || "").trim();
        } catch {
          try {
            translated = String(await TRANSLATOR.enToEs(enText) || "").trim();
          } catch {
            translated = "";
          }
        }
        if (!looksSpanishText(translated)) continue;
        const next = normalizeLibraryEntry({ ...item, textEs: translated });
        upsertLibraryItem(next);
        if (LibraryStore.supported) {
          try { await LibraryStore.put(next); } catch {}
        }
        if (state.detail?.id && state.detail.id === next.id) {
          state.detail.textEs = translated;
          state.resultEs = translated;
          renderResultForCurrentLang();
        }
        changed = true;
      }
    } finally {
      state.libraryHydrating = false;
      if (changed) {
        renderLibraryList();
        renderFavoritesList();
      }
    }
  }

  async function ensureTranslation(targetLang, isCached = false) {
    // Translate from canonical EN using server endpoint
    if (!state.resultEn) return;

    if (targetLang === "en") return;
    
    // Si ya tenemos la traducción y NO viene del cache, retornar rápido
    if (targetLang === "es" && state.resultEs && looksSpanishText(state.resultEs) && !isCached) return;

    // Solo mostrar "translating" si NO está en cache
    if (!isCached) {
      setStatus("translating");
    }
    
    // Si viene del cache y ya tenemos resultEs, no hay nada que hacer
    if (isCached && state.resultEs && looksSpanishText(state.resultEs)) {
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
      const translated = String(resp?.text || "").trim();
      state.resultEs = looksSpanishText(translated) ? translated : "";
    } catch (e) {
      // Fallback to local translator if server fails
      const fallback = String(await TRANSLATOR.enToEs(state.resultEn) || "").trim();
      state.resultEs = looksSpanishText(fallback) ? fallback : "";
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
    const detail = state.detail;

    if (!detail || (!detail.textEn && !detail.textEs)) {
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
    const txt = getEntryLocalizedText(detail, lang);
    
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
    setCuriosityForCharacter(detail.characterName || state.lastCharacter);
    updateFavoriteToggle();
    updateDetailActionsVisibility();
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
        lang: curLang(),
        includeEs: curLang() === "es",
      });

      console.log("API Response:", data);

      state.resultEn = String(data?.textEn || data?.text || "").trim();
      state.resultEs = String(data?.textEs || "").trim();
      const resolvedCategory = String(data?.resolvedCategory || state.selectedCategory || "any").trim();
      const categoryWasOverridden = !!data?.categoryOverridden;
      
      // Usar el nombre oficial que viene del servidor (normalizado)
      state.officialName = String(data?.officialName || character).trim();
      if (resolvedCategory && resolvedCategory !== "any" && resolvedCategory !== state.selectedCategory) {
        setCategoryValue(resolvedCategory);
      }
      
      console.log("State after response:", {
        resultEn: state.resultEn.slice(0, 150),
        resultEs: state.resultEs.slice(0, 150),
        officialName: state.officialName,
        requestedCategory: data?.requestedCategory,
        resolvedCategory,
        categoryWasOverridden,
      });
      
      // Validar que tenemos al menos una respuesta en inglés
      if (!state.resultEn || state.resultEn.length < 50) {
        throw new Error(`La respuesta recibida está vacía o incompleta (${state.resultEn.length} caracteres). Intenta nuevamente.`);
      }
      
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

      // Prepare tasks and wait before rendering
      const imagePromise = setCharacterImage(state.officialName, resolvedCategory, state.characterUniverse)
        .catch(imgErr => {
          console.error("Image generation failed:", imgErr.message);
          return null;
        });

      const needsEs = curLang() === "es";
      const translationPromise = needsEs
        ? ensureTranslation("es", isCached)
        : Promise.resolve();

      await Promise.all([imagePromise, translationPromise]);

      const liveEntry = buildEntryFromState();
      if (liveEntry) {
        setDetailFromEntry(liveEntry, "live");
        await persistEntry(liveEntry);
        markLibraryBadge();
      }

      // Render together once everything is ready
      state.hasResult = true;
      console.log("Rendering results after all tasks ready...");
      setView("search");

      // Clear search text after results are ready
      el.characterInput.value = "";

      // Marcar como completado
      setStatus("done");
      openDetailPanel();
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
    closeDetailPanel();

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
    state.detail = null;
    state.detailSource = "none";
    state.currentImageUrl = "";
    updateFavoriteToggle();
    updateDetailActionsVisibility();
    
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
    setImageFrameHasImage(false);
    hideImagePlaceholder();
    state.currentImageError = "";
    
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

    triggerLangOverlay();
    setLogoForLang();
    applyLangSwitchUI();
    setCategoryValue(state.selectedCategory);
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
    if (state.hasResult && curLang() === "es" && !looksSpanishText(state.resultEs)) {
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
    hydrateLibraryTranslationsIfNeeded().catch(() => {});
  }

  function bindLangSwitch() {
    if (!el.langSwitch || !el.langSelect) return;
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
    if (window.__WTS_BOOTED) return;
    window.__WTS_BOOTED = true;
    console.log("[Boot] Application starting...");
    // Set default language to English on first load
    if (!el.langSelect.value) {
      el.langSelect.value = "en";
    }
    
    // Initial state
    applyLangSwitchUI();
    setLogoForLang(true); // Skip animation on initial load
    state.isInitialLoad = false;
    try {
      state.libraryHasNew = localStorage.getItem(LIBRARY_BADGE_KEY) === "1";
    } catch {
      state.libraryHasNew = false;
    }
    updateLibraryBadge();
    updateDetailActionsVisibility();
    updateViewLayout();

    // Category init
    setCategoryValue("any");
    computeCategoryButtonWidth();

    // Text
    applyStaticText();
    setCuriosityForCharacter(el.characterInput.value);
    hideImagePlaceholder();

    // Bindings
    bindLangSwitch();
    bindCategoryDropdown();
    bindTabs();
    bindDrawerNav();
    bindLibraryUI();
    bindFavoriteToggle();
    bindFeedbackForm();
    initLibrary();

    DESKTOP_QUERY.addEventListener("change", () => {
      updateDetailActionsVisibility();
      closeDetailPanel();
      updateViewLayout();
    });

    el.smellBtn.addEventListener("click", onGenerate);
    el.clearBtn.addEventListener("click", onClear);

    if (el.imageRetryBtn) {
      el.imageRetryBtn.addEventListener("click", retryCharacterImage);
    }

    if (el.detailBackBtn) {
      el.detailBackBtn.addEventListener("click", () => {
        closeDetailPanel();
        setView("search");
      });
    }

    if (el.detailDownloadBtn) {
      el.detailDownloadBtn.addEventListener("click", handleDetailDownload);
    }

    if (el.detailCaptureBtn) {
      el.detailCaptureBtn.addEventListener("click", handleDetailCapture);
    }

    if (el.detailCloseBtn) {
      el.detailCloseBtn.addEventListener("click", closeDetailPanel);
    }

    document.addEventListener("click", (evt) => {
      if (!document.body.classList.contains("show-detail") || isDesktop()) return;
      const card = el.detailCard;
      if (!card) return;
      if (!card.contains(evt.target)) {
        closeDetailPanel();
      }
    });

    setView(state.currentView);

    // Update button text and state when character input changes
    el.characterInput.addEventListener("input", () => {
      const hasChar = el.characterInput.value.trim().length > 0;
      el.smellBtn.textContent = hasChar ? t("identify") : t("enterCharacter");
      applyLocks();
    });

    // Enter in search input triggers the same flow as Identify scent.
    el.characterInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (state.busy || state.hasResult) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      onGenerate();
    });

    applyLocks();
    updateDetailActionsVisibility();

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

  // Allow access-gate to trigger boot explicitly
  window.addEventListener("wts:boot", () => {
    if (document.querySelector(".access-gate-container")) return;
    boot();
  });
})();


// PATCH: bilingual sheet handling (en/es cached)
