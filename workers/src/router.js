/**
 * Route dispatch — Phase 1
 */

import { handleLogin, handleLogout, handleMe, handleRegister, requireUser } from "./auth.js";
import { handlePairingInvite, handlePairingJoin } from "./pairing.js";
import { errorResponse, jsonResponse } from "./http.js";

const SERVICE_NAME = "paligo-inbox-api";

export async function handleV1(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (path === "/v1/health" && method === "GET") {
    return jsonResponse(request, {
      ok: true,
      service: SERVICE_NAME,
      version: env.PALIGO_API_VERSION || "v1",
      schema: "paligo.inbox.api.v1",
      env: env.PALIGO_ENV || "development",
      phase: 1,
    });
  }

  if (path === "/v1/auth/register" && method === "POST") {
    return handleRegister(request, env);
  }
  if (path === "/v1/auth/login" && method === "POST") {
    return handleLogin(request, env);
  }
  if (path === "/v1/auth/logout" && method === "POST") {
    return handleLogout(request, env);
  }
  if (path === "/v1/me" && method === "GET") {
    return handleMe(request, env);
  }

  if (path === "/v1/pairings/invite" && method === "POST") {
    return handlePairingInvite(request, env);
  }
  if (path === "/v1/pairings/join" && method === "POST") {
    return handlePairingJoin(request, env);
  }

  if (path === "/v1/inbox" && method === "GET") {
    const user = await requireUser(request, env);
    if (!user) {
      return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
    }
    return jsonResponse(request, { items: [], phase: 2 });
  }

  if (path === "/v1/packages" && method === "POST") {
    return errorResponse(request, "not_implemented", "POST /v1/packages — Phase 2", 501);
  }

  if (path.startsWith("/v1/inbox/") && path.endsWith("/claim") && method === "POST") {
    return errorResponse(request, "not_implemented", "Claim — Phase 3", 501);
  }

  return errorResponse(request, "not_found", `ไม่พบ ${method} ${path}`, 404);
}
