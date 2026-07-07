/**
 * Paligo Inbox API client — Phase 0 (health + request wrapper)
 * ใช้ร่วมกับ paligo-config.js
 */
(function (global) {
  function getConfig() {
    return (
      global.PALIGO_CONFIG || {
        apiBase: "https://api.paligo.com/v1",
        features: { inbox: false, inboxHealthCheck: true },
      }
    );
  }

  function buildUrl(path) {
    const base = getConfig().apiBase.replace(/\/$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
  }

  /**
   * @param {string} path
   * @param {RequestInit & { json?: unknown }} [options]
   */
  async function request(path, options = {}) {
    const { json, headers: extraHeaders, ...rest } = options;
    const headers = {
      Accept: "application/json",
      ...(extraHeaders || {}),
    };

    let body = rest.body;
    if (json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(json);
    }

    const response = await fetch(buildUrl(path), {
      ...rest,
      headers,
      body,
      credentials: "omit",
    });

    let payload = null;
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && payload.message
          ? payload.message
          : `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async function healthCheck() {
    if (!getConfig().features?.inboxHealthCheck) {
      return { ok: false, skipped: true, reason: "inboxHealthCheck disabled" };
    }
    return request("/health", { method: "GET" });
  }

  global.PaligoInboxClient = {
    getConfig,
    buildUrl,
    request,
    healthCheck,
  };
})(typeof window !== "undefined" ? window : globalThis);
