/**
 * HTTP helpers — CORS + JSON
 */

const ALLOWED_ORIGINS = [
  "https://app.paligo.jp",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
];

/** Methods the Inbox API actually serves — keep in sync with router.js */
export const CORS_ALLOW_METHODS = ["GET", "POST", "PATCH", "OPTIONS"];

/**
 * Browser may cache preflight for Max-Age seconds.
 * Keep short enough that a CORS method/header fix recovers within minutes,
 * not a full day (86400 previously left clients blocked after PATCH deploy).
 */
const CORS_MAX_AGE_SECONDS = "600";

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.pages\.dev$/i.test(origin)) return true;
  return false;
}

export function corsHeaders(request, extra = {}) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS.join(", "),
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Accept, X-Paligo-Client",
    "Access-Control-Max-Age": CORS_MAX_AGE_SECONDS,
    ...extra,
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  return headers;
}

export function jsonResponse(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request),
    },
  });
}

export function errorResponse(request, code, message, status) {
  return jsonResponse(request, { error: code, message }, status);
}

export async function parseJsonBody(request) {
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function readBearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7).trim();
}
