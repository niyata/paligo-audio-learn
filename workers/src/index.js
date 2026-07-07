/**
 * Paligo Inbox API — Phase 0 skeleton
 * @see docs/exam-inbox-v1-spec.md
 */

const API_VERSION = "v1";
const SERVICE_NAME = "paligo-inbox-api";

/** @type {string[]} */
const ALLOWED_ORIGINS = [
  "https://app.paligo.com",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
];

/**
 * @param {string} origin
 */
function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.pages\.dev$/i.test(origin)) return true;
  return false;
}

/**
 * @param {Request} request
 * @param {Record<string, string>} extra
 */
function corsHeaders(request, extra = {}) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    ...extra,
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

/**
 * @param {Request} request
 * @param {unknown} data
 * @param {number} status
 */
function jsonResponse(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request),
    },
  });
}

/**
 * @param {Request} request
 * @param {string} code
 * @param {string} message
 * @param {number} status
 */
function errorResponse(request, code, message, status) {
  return jsonResponse(request, { error: code, message }, status);
}

/**
 * @param {Request} request
 * @param {Env} env
 */
async function handleV1(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (path === `/v1/health` && method === "GET") {
    return jsonResponse(request, {
      ok: true,
      service: SERVICE_NAME,
      version: env.PALIGO_API_VERSION || API_VERSION,
      schema: "paligo.inbox.api.v1",
      env: env.PALIGO_ENV || "development",
      phase: 0,
    });
  }

  if (path === `/v1/me` && method === "GET") {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ (Phase 1)", 401);
  }

  if (path === `/v1/inbox` && method === "GET") {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ (Phase 1)", 401);
  }

  if (path === `/v1/packages` && method === "POST") {
    return errorResponse(
      request,
      "not_implemented",
      "POST /v1/packages — จะเปิดใช้ใน Phase 2",
      501
    );
  }

  if (path.startsWith(`/v1/inbox/`) && path.endsWith(`/claim`) && method === "POST") {
    return errorResponse(request, "not_implemented", "Claim — Phase 3", 501);
  }

  if (path === `/v1/auth/register` || path === `/v1/auth/login` || path === `/v1/auth/logout`) {
    return errorResponse(request, "not_implemented", "Auth — Phase 1", 501);
  }

  if (path === `/v1/pairings/invite` || path === `/v1/pairings/join`) {
    return errorResponse(request, "not_implemented", "Pairing — Phase 1", 501);
  }

  return errorResponse(request, "not_found", `ไม่พบ ${method} ${path}`, 404);
}

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   */
  async fetch(request, env) {
    if (request.method.toUpperCase() === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return jsonResponse(request, {
        service: SERVICE_NAME,
        docs: "docs/exam-inbox-v1-spec.md",
        health: "/v1/health",
      });
    }

    if (url.pathname.startsWith("/v1")) {
      return handleV1(request, env);
    }

    return errorResponse(request, "not_found", "ใช้ path ขึ้นต้นด้วย /v1", 404);
  },
};

/** @typedef {{ PALIGO_API_VERSION?: string; PALIGO_ENV?: string }} Env */
