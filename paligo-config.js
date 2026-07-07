/**
 * Paligo runtime config — apiBase แยก local / production
 * Override ก่อนโหลดไฟล์นี้: window.PALIGO_API_BASE = "https://…"
 *
 * Domain plan:
 *   paligo.com      — landing
 *   app.paligo.com  — Cloudflare Pages
 *   api.paligo.com  — Workers (→ DO ภายหลัง)
 */
(function (global) {
  const locationRef = global.location || { hostname: "", origin: "" };
  const host = locationRef.hostname || "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const isPagesPreview = /\.pages\.dev$/i.test(host);

  function resolveApiBase() {
    if (global.PALIGO_API_BASE) {
      return String(global.PALIGO_API_BASE).replace(/\/$/, "");
    }
    if (isLocal) {
      return "http://localhost:8787/v1";
    }
    return "https://api.paligo.com/v1";
  }

  function resolveAppOrigin() {
    if (isLocal || isPagesPreview) {
      return locationRef.origin || "http://localhost:8765";
    }
    return "https://app.paligo.com";
  }

  const config = {
    apiBase: resolveApiBase(),
    appOrigin: resolveAppOrigin(),
    marketingOrigin: "https://paligo.com",
    isLocal,
    isPagesPreview,
    features: {
      /** เปิดเมื่อ Phase 2 push inbox พร้อม */
      inbox: false,
      /** Phase 0 — เรียก health ได้ */
      inboxHealthCheck: true,
    },
  };

  global.PALIGO_CONFIG = Object.freeze({
    ...config,
    features: Object.freeze({ ...config.features }),
  });
})(typeof window !== "undefined" ? window : globalThis);
