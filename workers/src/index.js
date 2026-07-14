/**
 * Paligo Inbox API — Cloudflare Workers
 * @see docs/exam-inbox-v1-spec.md
 */

import { corsHeaders, errorResponse, jsonResponse } from "./http.js";
import { handleV1 } from "./router.js";

const SERVICE_NAME = "paligo-inbox-api";

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
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const dbOptionalPaths = new Set(["/v1/line/issues/webhook"]);

    if (!env.DB && !dbOptionalPaths.has(path)) {
      return errorResponse(
        request,
        "db_unavailable",
        "D1 binding ไม่พร้อม — รัน migrations ตาม workers/README.md",
        503
      );
    }

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

/** @typedef {{ DB: D1Database; PALIGO_API_VERSION?: string; PALIGO_ENV?: string }} Env */
