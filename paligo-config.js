/**
 * Paligo runtime config — apiBase แยก local / production
 * Override ก่อนโหลดไฟล์นี้: window.PALIGO_API_BASE = "https://…"
 *
 * Domain plan:
 *   paligo.jp      — landing
 *   app.paligo.jp  — Cloudflare Pages
 *   api.paligo.jp  — Workers (→ DO ภายหลัง)
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
      const params = new URLSearchParams(locationRef.search || "");
      const apiPort = params.get("apiPort") || global.localStorage?.getItem("paligo-api-port");
      const port = apiPort && /^\d+$/.test(apiPort) ? apiPort : "8788";
      return `http://localhost:${port}/v1`;
    }
    return "https://api.paligo.jp/v1";
  }

  function resolveAppOrigin() {
    if (isLocal || isPagesPreview) {
      return locationRef.origin || "http://localhost:8765";
    }
    return "https://app.paligo.jp";
  }

  const config = {
    apiBase: resolveApiBase(),
    appOrigin: resolveAppOrigin(),
    marketingOrigin: "https://paligo.jp",
    isLocal,
    isPagesPreview,
    features: {
      /** เปิดเมื่อ Phase 2 push inbox พร้อม */
      inbox: true,
      /** Phase 0 — เรียก health ได้ */
      inboxHealthCheck: true,
      /** Phase 8 — badge บน exam-line-liff.html (script push) */
      lineLiffNotify: true,
    },
    /** ตั้งใน LINE Developers Console → LIFF → Endpoint URL ชี้ exam-line-liff.html */
    lineLiffId: global.PALIGO_LINE_LIFF_ID || "",
    superAdminEmails: ["tha.std@paligo.jp", "1.tha.tc@paligo.jp"],
    /** sync max with workers/src/review-capacity.js DEFAULT_REVIEWER_DAILY_LIMIT_MAX */
    reviewCapacity: {
      dailyLimitMax: 60,
    },
  };

  global.PALIGO_CONFIG = Object.freeze({
    ...config,
    features: Object.freeze({ ...config.features }),
    lineLiffId: config.lineLiffId,
    reviewCapacity: Object.freeze({ ...config.reviewCapacity }),
  });
})(typeof window !== "undefined" ? window : globalThis);
