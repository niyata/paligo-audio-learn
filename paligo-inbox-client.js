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

  function getApiDiagnostics() {
    const cfg = getConfig();
    const base = getApiBase();
    const host = global.location?.hostname || "";
    const isPages = host === "app.paligo.jp" || /\.pages\.dev$/i.test(host);
    return {
      apiBase: base,
      isLocal: isLocalDev(),
      isPages,
      host,
      appOrigin: cfg.appOrigin || global.location?.origin || "",
      localPorts: DEV_PORTS.slice(),
      localCommand: "cd workers && npm run dev",
      localHint: `รัน Workers dev แล้วเปิดหน้านี้ใหม่ หรือใช้ ?apiPort=8788 ถ้า port เปลี่ยน`,
      cloudHint: `ตรวจ Workers CORS (ต้องมี PATCH) · route · DNS ที่ ${base}`,
    };
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
      appState: payload.appState || null,
      capabilities: payload.capabilities || null,
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

  const CANONICAL_ERROR_CODES = {
    not_authenticated: "NOT_AUTHENTICATED",
    invalid_session: "SESSION_EXPIRED",
    session_expired: "SESSION_EXPIRED",
    no_pairing: "NO_PAIRING",
    feature_disabled: "FEATURE_DISABLED",
    forbidden: "PERMISSION_DENIED",
    permission_denied: "PERMISSION_DENIED",
    invalid_json: "INVALID_INPUT",
    invalid_role: "INVALID_INPUT",
    invalid_profile: "INVALID_INPUT",
    invalid_display_name: "INVALID_INPUT",
    invalid_pin: "INVALID_INPUT",
    invalid_login: "INVALID_INPUT",
    invalid_credentials: "INVALID_INPUT",
    empty_patch: "INVALID_INPUT",
    email_taken: "INVALID_INPUT",
    not_found: "NOT_FOUND",
  };

  function normalizeErrorCode(code) {
    const raw = String(code || "").trim();
    if (!raw) return "UNKNOWN_ERROR";
    if (/^[A-Z0-9_]+$/.test(raw)) return raw;
    return CANONICAL_ERROR_CODES[raw] || raw.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  }

  function buildAppState(source = {}) {
    const session = source.session || null;
    const user = source.user || session?.user || null;
    const inboxEnabled = source.inboxEnabled ?? isInboxFeatureEnabled();
    const pairing = source.pairing ?? null;
    const students = Array.isArray(source.students) ? source.students : [];
    const hasPairing = Boolean(pairing);
    const hasVirtualStudent = students.some((student) => Boolean(student?.isVirtual));
    const hasRealStudents = students.some((student) => !student?.isVirtual);
    const isSuperAdmin = Boolean(user?.isSuperAdmin);
    const role = user?.role || null;

    let appState = "guest";
    if (source.forceOffline && user) appState = "logged_in_offline";
    else if (user) {
      if (!inboxEnabled) appState = "feature_disabled";
      else if (isSuperAdmin) appState = "super_admin";
      else if (role === "student") appState = hasPairing ? "ready_student" : "logged_in_no_pairing";
      else if (role === "reviewer") appState = hasRealStudents ? "ready_reviewer" : "ready_reviewer_trial";
      else appState = "logged_in_no_pairing";
    }

    return {
      appState,
      capabilities: {
        canUseInbox: Boolean(user && inboxEnabled),
        canOpenInbox: Boolean(user && inboxEnabled && (role === "reviewer" || hasPairing || isSuperAdmin || source.forceOffline)),
        canCreateInvite: Boolean(user && inboxEnabled && role === "reviewer"),
        canJoinPairing: Boolean(user && inboxEnabled && role === "student"),
        needsPairing: Boolean(user && inboxEnabled && role === "student" && !hasPairing),
        hasVirtualStudent,
        hasRealStudents,
        isSuperAdmin,
      },
    };
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
        const appContract = buildAppState(payload);
        setSession({
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt,
          user: payload.user,
          ...appContract,
        });
      }
      return getSession();
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        return null;
      }
      const offlineContract = buildAppState({ session, forceOffline: true });
      return { ...session, ...offlineContract };
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
    const diag = getApiDiagnostics();
    const message = diag.isLocal
      ? `ไม่พบ Inbox API บน localhost (${DEV_PORTS.join(", ")}) — รัน: ${diag.localCommand}`
      : `ไม่ติด Inbox API ที่ ${diag.apiBase} — ตรวจ Workers CORS (ต้องอนุญาต PATCH) / route / DNS`;
    const error = new Error(message);
    error.diagnostics = diag;
    throw error;
  }

  /**
   * @param {string} path
   * @param {RequestInit & { json?: unknown; auth?: boolean }} [options]
   */
  async function request(path, options = {}) {
    const { json, headers: extraHeaders, auth = true, ...rest } = options;
    const headers = {
      Accept: "application/json",
      // Bust stale CORS preflight caches that omitted PATCH (Max-Age was 86400).
      "X-Paligo-Client": "1",
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
      error.legacyCode = payload && typeof payload === "object" ? payload.error || "" : "";
      error.code = normalizeErrorCode(payload && typeof payload === "object" ? payload.code || payload.error : "");
      throw error;
    }

    return payload;
  }

  function wrapNetworkError(error) {
    if (error instanceof TypeError || error.message === "Failed to fetch") {
      const diag = getApiDiagnostics();
      const hint = diag.isLocal
        ? `ไม่ติด Inbox API ที่ ${diag.apiBase} — รัน: ${diag.localCommand}`
        : `ไม่ติด Inbox API ที่ ${diag.apiBase} — ตรวจ Workers CORS (ต้องอนุญาต PATCH) / route / DNS api.paligo.jp`;
      const wrapped = new Error(hint);
      wrapped.cause = error;
      wrapped.diagnostics = diag;
      wrapped.code = "API_OFFLINE";
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

  async function register({ role, displayName, email, pin, profileJson }) {
    const json = { role, displayName, email: email || null, pin };
    if (profileJson !== undefined) json.profileJson = profileJson;
    const payload = await safeRequest("/auth/register", {
      method: "POST",
      auth: false,
      json,
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
    const payload = await safeRequest("/me", { method: "GET" });
    if (payload?.user) {
      const session = getSession();
      if (session?.sessionToken) {
        setSession({
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt,
          user: payload.user,
          appState: payload.appState,
          capabilities: payload.capabilities,
        });
      }
    }
    return payload;
  }

  async function getAppState({ refresh = true } = {}) {
    const session = getSession();
    if (!session?.sessionToken) return buildAppState({ inboxEnabled: isInboxFeatureEnabled() });
    if (!refresh) {
      return {
        ...buildAppState({ session, inboxEnabled: isInboxFeatureEnabled() }),
        appState: session.appState || buildAppState({ session, inboxEnabled: isInboxFeatureEnabled() }).appState,
        capabilities: session.capabilities || buildAppState({ session, inboxEnabled: isInboxFeatureEnabled() }).capabilities,
      };
    }
    try {
      const payload = await getMe();
      return {
        user: payload.user,
        pairing: payload.pairing || null,
        students: payload.students || [],
        appState: payload.appState || buildAppState(payload).appState,
        capabilities: payload.capabilities || buildAppState(payload).capabilities,
      };
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        return buildAppState({ inboxEnabled: isInboxFeatureEnabled() });
      }
      return {
        ...buildAppState({ session, forceOffline: true }),
        offline: true,
        diagnostics: error.diagnostics || getApiDiagnostics(),
      };
    }
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
          appState: payload.appState,
          capabilities: payload.capabilities,
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
    getApiDiagnostics,
    getSession,
    setSession,
    clearSession,
    isLoggedIn,
    getInboxRole,
    isInboxFeatureEnabled,
    normalizeErrorCode,
    ensureAuthenticatedSession,
    buildAppState,
    getAppState,
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
