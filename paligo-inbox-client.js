/**
 * Paligo Inbox API client — Phase 1 (auth + pairing)
 * ใช้ร่วมกับ paligo-config.js
 */
(function (global) {
  const SESSION_KEY = "paligo-inbox-session-v1";

  function getConfig() {
    return (
      global.PALIGO_CONFIG || {
        apiBase: "https://api.paligo.com/v1",
        features: { inbox: false, inboxHealthCheck: true },
      }
    );
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

  function buildUrl(path) {
    const base = getConfig().apiBase.replace(/\/$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
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

  async function healthCheck() {
    if (!getConfig().features?.inboxHealthCheck) {
      return { ok: false, skipped: true, reason: "inboxHealthCheck disabled" };
    }
    return request("/health", { method: "GET", auth: false });
  }

  async function register({ role, displayName, email, pin }) {
    const payload = await request("/auth/register", {
      method: "POST",
      auth: false,
      json: { role, displayName, email: email || null, pin },
    });
    setSession(payload);
    return payload;
  }

  async function login({ userId, email, pin }) {
    const payload = await request("/auth/login", {
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
    return request("/me", { method: "GET" });
  }

  async function createInvite() {
    return request("/pairings/invite", { method: "POST" });
  }

  async function joinPairing(inviteCode) {
    return request("/pairings/join", {
      method: "POST",
      json: { inviteCode },
    });
  }

  global.PaligoInboxClient = {
    SESSION_KEY,
    getConfig,
    getSession,
    setSession,
    clearSession,
    buildUrl,
    request,
    healthCheck,
    register,
    login,
    logout,
    getMe,
    createInvite,
    joinPairing,
  };
})(typeof window !== "undefined" ? window : globalThis);
