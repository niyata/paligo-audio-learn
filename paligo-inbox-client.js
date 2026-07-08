/**
 * Paligo Inbox API client — Phase 1 (auth + pairing)
 * ใช้ร่วมกับ paligo-config.js
 */
(function (global) {
  const SESSION_KEY = "paligo-inbox-session-v1";
  const API_PORT_KEY = "paligo-api-port";
  const DEV_PORTS = ["8788", "8787", "8791", "8790"];

  function isLocalDev() {
    const host = global.location?.hostname || "";
    return host === "localhost" || host === "127.0.0.1";
  }

  function getConfig() {
    return (
      global.PALIGO_CONFIG || {
        apiBase: isLocalDev() ? "http://localhost:8788/v1" : "https://api.paligo.jp/v1",
        features: { inbox: true, inboxHealthCheck: true },
        isLocal: isLocalDev(),
      }
    );
  }

  function getApiBase() {
    if (isLocalDev()) {
      const params = new URLSearchParams(global.location?.search || "");
      const fromQuery = params.get("apiPort");
      if (fromQuery && /^\d+$/.test(fromQuery)) {
        global.localStorage?.setItem(API_PORT_KEY, fromQuery);
        return `http://localhost:${fromQuery}/v1`;
      }
      const port = global.localStorage?.getItem(API_PORT_KEY) || "8788";
      return `http://localhost:${port}/v1`;
    }
    return getConfig().apiBase.replace(/\/$/, "");
  }

  function getSession() {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(SESSION_KEY) || "null");
      if (!parsed?.sessionToken) return null;
      if (parsed.expiresAt && new Date(parsed.expiresAt) <= new Date()) {
        clearSession();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function setSession(payload) {
    const record = {
      sessionToken: payload.sessionToken,
      expiresAt: payload.expiresAt,
      user: payload.user || null,
    };
    global.localStorage?.setItem(SESSION_KEY, JSON.stringify(record));
    return record;
  }

  function clearSession() {
    global.localStorage?.removeItem(SESSION_KEY);
  }

  function isLoggedIn() {
    return Boolean(getSession()?.sessionToken);
  }

  function getInboxRole() {
    return getSession()?.user?.role || null;
  }

  function isInboxFeatureEnabled() {
    const cfg = getConfig();
    if (cfg.features?.inbox === false) return false;

    try {
      const cached = JSON.parse(global.sessionStorage?.getItem("paligo-platform-flags-v1") || "null");
      const flags = cached?.flags;
      if (flags && flags.inboxEnabled === false) return false;
    } catch {
      /* ignore */
    }

    return true;
  }

  /**
   * ยืนยัน session กับ API และอัปเดต user ใน localStorage
   * @returns {Promise<object|null>}
   */
  async function ensureAuthenticatedSession() {
    const session = getSession();
    if (!session?.sessionToken) return null;

    try {
      const payload = await safeRequest("/me", { method: "GET" });
      if (payload?.user) {
        setSession({
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt,
          user: payload.user,
        });
      }
      return getSession();
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        return null;
      }
      return session;
    }
  }

  function buildUrl(path) {
    const base = getApiBase().replace(/\/$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
  }

  async function discoverApiPort() {
    if (!isLocalDev()) return null;
    for (const port of DEV_PORTS) {
      try {
        const res = await fetch(`http://localhost:${port}/v1/health`, {
          method: "GET",
          credentials: "omit",
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.ok) {
          global.localStorage?.setItem(API_PORT_KEY, port);
          return port;
        }
      } catch {
        // ลอง port ถัดไป
      }
    }
    return null;
  }

  async function ensureApiReady() {
    try {
      const res = await fetch(buildUrl("/health"), { method: "GET", credentials: "omit" });
      if (res.ok) return getApiBase();
    } catch {
      // fall through
    }
    const port = await discoverApiPort();
    if (port) return getApiBase();
    throw new Error(
      `ไม่พบ Inbox API บน localhost (${DEV_PORTS.join(", ")}) — รัน: cd workers && npm run dev`
    );
  }

  /**
   * @param {string} path
   * @param {RequestInit & { json?: unknown; auth?: boolean }} [options]
   */
  async function request(path, options = {}) {
    const { json, headers: extraHeaders, auth = true, ...rest } = options;
    const headers = {
      Accept: "application/json",
      ...(extraHeaders || {}),
    };

    if (auth) {
      const session = getSession();
      if (session?.sessionToken) {
        headers.Authorization = `Bearer ${session.sessionToken}`;
      }
    }

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

  function wrapNetworkError(error) {
    if (error instanceof TypeError || error.message === "Failed to fetch") {
      const base = getApiBase();
      const hint = isLocalDev()
        ? `ไม่ติด API ที่ ${base} — รัน \`cd workers && npm run dev\` ใน terminal แยก (API ใช้ port 8788)`
        : `ไม่ติด API ที่ ${base} — ตรวจว่า deploy Workers ที่ api.paligo.jp แล้ว`;
      const wrapped = new Error(hint);
      wrapped.cause = error;
      return wrapped;
    }
    return error;
  }

  async function safeRequest(path, options, retried = false) {
    try {
      return await request(path, options);
    } catch (error) {
      if (!retried && isLocalDev()) {
        const port = await discoverApiPort();
        if (port) return safeRequest(path, options, true);
      }
      throw wrapNetworkError(error);
    }
  }

  async function healthCheck() {
    if (!getConfig().features?.inboxHealthCheck) {
      return { ok: false, skipped: true, reason: "inboxHealthCheck disabled" };
    }
    return safeRequest("/health", { method: "GET", auth: false });
  }

  async function register({ role, displayName, email, pin }) {
    const payload = await safeRequest("/auth/register", {
      method: "POST",
      auth: false,
      json: { role, displayName, email: email || null, pin },
    });
    setSession(payload);
    return payload;
  }

  async function login({ userId, email, pin }) {
    const payload = await safeRequest("/auth/login", {
      method: "POST",
      auth: false,
      json: { userId: userId || null, email: email || null, pin },
    });
    setSession(payload);
    return payload;
  }

  async function logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors on logout
    }
    clearSession();
    return { ok: true };
  }

  async function getMe() {
    return safeRequest("/me", { method: "GET" });
  }

  async function updateMe({ displayName, email, profileJson } = {}) {
    const json = {};
    if (displayName !== undefined) json.displayName = displayName;
    if (email !== undefined) json.email = email;
    if (profileJson !== undefined) json.profileJson = profileJson;
    const payload = await safeRequest("/me", { method: "PATCH", json });
    if (payload?.user) {
      const session = getSession();
      if (session?.sessionToken) {
        setSession({
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt,
          user: payload.user,
        });
      }
    }
    return payload;
  }

  async function changePin({ currentPin, newPin }) {
    return safeRequest("/me/change-pin", {
      method: "POST",
      json: { currentPin, newPin },
    });
  }

  async function getPlatformFlags() {
    return safeRequest("/platform/flags", { method: "GET", auth: false });
  }

  async function getAdminPanel() {
    return safeRequest("/admin/panel", { method: "GET" });
  }

  async function patchAdminSettings(flags) {
    const payload = await safeRequest("/admin/settings", {
      method: "PATCH",
      json: { flags },
    });
    try {
      global.sessionStorage?.removeItem("paligo-platform-flags-v1");
    } catch {
      /* ignore */
    }
    return payload;
  }

  async function createInvite() {
    return safeRequest("/pairings/invite", { method: "POST" });
  }

  /** ค้นหาครู/ผู้ตรวจในระบบ — คืน { reviewers: [] } พร้อม handle offline (โยน error ให้ UI จัดการ fallback) */
  async function searchReviewers(query, { limit = 10 } = {}) {
    const params = new URLSearchParams();
    if (query) params.set("q", String(query).trim());
    if (limit) params.set("limit", String(limit));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return safeRequest(`/reviewers/search${suffix}`, { method: "GET" });
  }

  async function joinPairing(inviteCode) {
    return safeRequest("/pairings/join", {
      method: "POST",
      json: { inviteCode },
    });
  }

  function canUseInbox() {
    return isLoggedIn() && isInboxFeatureEnabled();
  }

  async function pushPackage(bookTransfer) {
    return safeRequest("/packages", {
      method: "POST",
      json: bookTransfer,
    });
  }

  async function listInbox() {
    return safeRequest("/inbox", { method: "GET" });
  }

  async function claimInboxItem(inboxItemId) {
    return safeRequest(`/inbox/${inboxItemId}/claim`, { method: "POST" });
  }

  global.PaligoInboxClient = {
    SESSION_KEY,
    API_PORT_KEY,
    getConfig,
    getApiBase,
    getSession,
    setSession,
    clearSession,
    isLoggedIn,
    getInboxRole,
    isInboxFeatureEnabled,
    ensureAuthenticatedSession,
    buildUrl,
    discoverApiPort,
    ensureApiReady,
    request,
    healthCheck,
    register,
    login,
    logout,
    getMe,
    updateMe,
    changePin,
    getPlatformFlags,
    getAdminPanel,
    patchAdminSettings,
    createInvite,
    joinPairing,
    searchReviewers,
    canUseInbox,
    pushPackage,
    listInbox,
    claimInboxItem,
  };
})(typeof window !== "undefined" ? window : globalThis);
