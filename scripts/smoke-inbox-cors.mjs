#!/usr/bin/env node
/**
 * Smoke: Inbox API CORS must allow PATCH (profile sync / pairing save).
 * Usage: node scripts/smoke-inbox-cors.mjs [apiBase]
 * Default apiBase: https://api.paligo.jp/v1
 */
const apiBase = (process.argv[2] || "https://api.paligo.jp/v1").replace(/\/$/, "");
const origin = process.env.SMOKE_ORIGIN || "https://app.paligo.jp";
const url = `${apiBase}/me`;

const res = await fetch(url, {
  method: "OPTIONS",
  headers: {
    Origin: origin,
    "Access-Control-Request-Method": "PATCH",
    "Access-Control-Request-Headers": "authorization,content-type,x-paligo-client",
  },
});

const allowMethods = res.headers.get("access-control-allow-methods") || "";
const allowOrigin = res.headers.get("access-control-allow-origin") || "";
const allowHeaders = (res.headers.get("access-control-allow-headers") || "").toLowerCase();
const methods = allowMethods
  .split(",")
  .map((m) => m.trim().toUpperCase())
  .filter(Boolean);

const okStatus = res.status === 204 || res.status === 200;
const hasPatch = methods.includes("PATCH");
const originOk = allowOrigin === origin || allowOrigin === "*";
const hasClientHeader = allowHeaders.includes("x-paligo-client");

console.log(
  JSON.stringify(
    {
      url,
      status: res.status,
      allowMethods,
      allowOrigin,
      allowHeaders: res.headers.get("access-control-allow-headers"),
      okStatus,
      hasPatch,
      originOk,
      hasClientHeader,
    },
    null,
    2
  )
);

if (!okStatus || !hasPatch || !originOk) {
  console.error(
    "FAIL: CORS preflight must return 204/200, Allow-Origin for app, and PATCH in Allow-Methods"
  );
  process.exit(1);
}

if (!hasClientHeader) {
  console.warn("WARN: Allow-Headers missing X-Paligo-Client (client sends it to bust stale preflight)");
}

console.log("OK: Inbox CORS allows PATCH");
