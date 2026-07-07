(() => {
  const OPTIONS = [
    {
      id: "th-sarabun-bali",
      label: "TH Sarabun Bali",
      stack: '"TH Sarabun Bali", "TH Sarabun Pali", Sarabun, sans-serif',
    },
    {
      id: "angsana-upc",
      label: "Angsana UPC",
      stack: '"Angsana UPC", Angsana, serif',
    },
    {
      id: "cordia-upc",
      label: "Cordia UPC",
      stack: '"Cordia UPC", Cordia, sans-serif',
    },
  ];

  const STORAGE_KEY = "paligo-book-font-id";
  const SIZE_STORAGE_KEY = "paligo-text-scale";
  const DEFAULT_ID = "th-sarabun-bali";
  const DEFAULT_SCALE = 100;
  const MIN_SCALE = 70;
  const MAX_SCALE = 150;
  const SCALE_LAYERS = ".book-page-bg, .book-page-text";

  const getOption = (fontId) => OPTIONS.find((option) => option.id === fontId) || OPTIONS[0];

  const getStoredFontId = () => localStorage.getItem(STORAGE_KEY) || DEFAULT_ID;

  const setStoredFontId = (fontId) => {
    localStorage.setItem(STORAGE_KEY, fontId);
  };

  const clampScale = (value) => {
    const scale = Number(value);
    if (!Number.isFinite(scale)) return DEFAULT_SCALE;
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(scale)));
  };

  const getStoredScale = () => clampScale(localStorage.getItem(SIZE_STORAGE_KEY) || DEFAULT_SCALE);

  const setStoredScale = (scale) => {
    localStorage.setItem(SIZE_STORAGE_KEY, String(clampScale(scale)));
  };

  const applyLayerScale = (layer, factor) => {
    if (factor === 1) {
      layer.style.removeProperty("zoom");
      return;
    }
    layer.style.zoom = String(factor);
  };

  const applyToRoots = (roots, fontId) => {
    const option = getOption(fontId);
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll(".book-page").forEach((page) => {
        page.style.setProperty("--book-font-family", option.stack);
        page.dataset.bookFont = option.id;
      });
    });
    return option;
  };

  const applyBookTokenScale = (roots, scalePercent) => {
    const factor = clampScale(scalePercent) / 100;

    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll(".book-page").forEach((page) => {
        page.style.setProperty("--book-font-scale", String(factor));
        page.style.removeProperty("zoom");
        page.querySelectorAll(SCALE_LAYERS).forEach((layer) => {
          applyLayerScale(layer, factor);
        });
      });
    });
  };

  const applyTextScaleVars = (root, scalePercent, config = {}) => {
    const factor = clampScale(scalePercent) / 100;
    const targets = Array.isArray(config.targets) ? config.targets : [];

    if (root) {
      root.style.setProperty("--paligo-text-scale", String(factor));
    }

    targets.forEach(({ element, basePx }) => {
      if (!element || !Number.isFinite(basePx)) return;
      element.style.fontSize = `${basePx * factor}px`;
    });
  };

  const bindSelect = (select, rootsProvider) => {
    if (!select) return;

    select.innerHTML = OPTIONS.map(
      (option) => `<option value="${option.id}">${option.label}</option>`
    ).join("");

    const storedId = getStoredFontId();
    select.value = getOption(storedId).id;

    const applyCurrent = () => {
      const roots = typeof rootsProvider === "function" ? rootsProvider() : rootsProvider;
      applyToRoots(roots, select.value);
      setStoredFontId(select.value);
    };

    select.addEventListener("change", applyCurrent);
    applyCurrent();
  };

  const bindScaleRange = (input, valueEl, onChange) => {
    if (!input) return getStoredScale();

    input.min = String(MIN_SCALE);
    input.max = String(MAX_SCALE);
    input.step = "5";
    input.value = String(getStoredScale());

    const apply = (scale) => {
      const nextScale = clampScale(scale);
      if (valueEl) valueEl.textContent = `${nextScale}%`;
      setStoredScale(nextScale);
      if (typeof onChange === "function") onChange(nextScale);
      return nextScale;
    };

    apply(Number(input.value));
    input.addEventListener("input", () => apply(Number(input.value)));
    return apply(Number(input.value));
  };

  window.PaligoBookFonts = {
    OPTIONS,
    DEFAULT_ID,
    DEFAULT_SCALE,
    MIN_SCALE,
    MAX_SCALE,
    SIZE_STORAGE_KEY,
    getOption,
    getStoredFontId,
    setStoredFontId,
    getStoredScale,
    setStoredScale,
    clampScale,
    applyToRoots,
    applyBookTokenScale,
    applyTextScaleVars,
    bindSelect,
    bindScaleRange,
  };
})();
