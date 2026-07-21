#!/usr/bin/env node
/**
 * Live API readiness audit for app.paligo.jp <-> api.paligo.jp.
 *
 * Always checks:
 *   - /health shape
 *   - CORS preflight for PATCH /me from app origin
 *   - unauthenticated /me returns canonical NOT_AUTHENTICATED
 *
 * Optional credential checks:
 *   PALIGO_LIVE_STUDENT_EMAIL=tha.std@paligo.jp
 *   PALIGO_LIVE_STUDENT_PIN=147258
 *   PALIGO_LIVE_REVIEWER_EMAIL=1.tha.tc@paligo.jp
 *   PALIGO_LIVE_REVIEWER_PIN=147258
 *
 * Usage:
 *   node scripts/audit-live-api-readiness.mjs [apiBase]
 */

import assert from "node:assert/strict";

const apiBase = (process.argv[2] || process.env.PALIGO_API_BASE || "https://api.paligo.jp/v1").replace(/\/$/, "");
const origin = process.env.PALIGO_APP_ORIGIN || "https://app.paligo.jp";

const optionalAccounts = [
  {
    label: "student",
    email: process.env.PALIGO_LIVE_STUDENT_EMAIL,
    pin: process.env.PALIGO_LIVE_STUDENT_PIN,
    expectedRole: "student",
  },
  {
    label: "reviewer",
    email: process.env.PALIGO_LIVE_REVIEWER_EMAIL,
    pin: process.env.PALIGO_LIVE_REVIEWER_PIN,
    expectedRole: "reviewer",
  },
];

const report = {
  schema: "paligo.audit.liveApiReadiness.v1",
  apiBase,
  origin,
  startedAt: new Date().toISOString(),
  checks: [],
};

function record(name, ok, detail = {}) {
  report.checks.push({
    name,
    ok: Boolean(ok),
    at: new Date().toISOString(),
    ...detail,
  });
}

async function fetchJson(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let json = null;
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  return { response, json };
}

async function checkHealth() {
  const { response, json } = await fetchJson("/health", {
    headers: { Origin: origin },
  });
  assert.equal(response.status, 200, "GET /health must return 200");
  assert.equal(json?.ok, true, "GET /health must return ok:true");
  assert.equal(json?.schema, "paligo.inbox.api.v1", "GET /health must expose API schema");
  record("health", true, { status: response.status, env: json?.env, phase: json?.phase });
}

async function checkCors() {
  const response = await fetch(`${apiBase}/me`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PATCH",
      "Access-Control-Request-Headers": "authorization,content-type,x-paligo-client",
    },
  });
  const allowMethods = response.headers.get("access-control-allow-methods") || "";
  const allowOrigin = response.headers.get("access-control-allow-origin") || "";
  const allowHeaders = (response.headers.get("access-control-allow-headers") || "").toLowerCase();
  const methods = allowMethods.split(",").map((method) => method.trim().toUpperCase());

  assert([200, 204].includes(response.status), "CORS preflight must return 200/204");
  assert.equal(allowOrigin, origin, "CORS preflight must echo app origin");
  assert(methods.includes("PATCH"), "CORS preflight must allow PATCH");
  assert(allowHeaders.includes("authorization"), "CORS preflight must allow Authorization");
  assert(allowHeaders.includes("x-paligo-client"), "CORS preflight must allow X-Paligo-Client");

  record("cors.patch.me", true, {
    status: response.status,
    allowMethods,
    allowOrigin,
    allowHeaders: response.headers.get("access-control-allow-headers"),
  });
}

async function checkUnauthenticatedContract() {
  const { response, json } = await fetchJson("/me", {
    headers: { Origin: origin },
  });
  assert.equal(response.status, 401, "GET /me without auth must return 401");
  assert.equal(json?.code, "NOT_AUTHENTICATED", "GET /me without auth must return canonical code");
  assert.equal(json?.error, "not_authenticated", "GET /me without auth must keep legacy error");
  record("me.unauthenticated", true, { status: response.status, code: json?.code });
}

async function checkLoginAccount(account) {
  if (!account.email || !account.pin) {
    record(`login.${account.label}`, true, { skipped: true, reason: "missing optional credentials" });
    return;
  }

  const login = await fetchJson("/auth/login", {
    method: "POST",
    headers: { Origin: origin },
    body: { email: account.email, pin: account.pin },
  });
  assert.equal(login.response.status, 200, `${account.label} login must return 200`);
  assert.equal(login.json?.user?.role, account.expectedRole, `${account.label} must have expected role`);
  assert(login.json?.sessionToken, `${account.label} login must return sessionToken`);
  assert(login.json?.appState, `${account.label} login must return appState`);
  assert.equal(typeof login.json?.capabilities, "object", `${account.label} login must return capabilities`);

  const token = login.json.sessionToken;
  const me = await fetchJson("/me", {
    headers: {
      Origin: origin,
      Authorization: `Bearer ${token}`,
    },
  });
  assert.equal(me.response.status, 200, `${account.label} /me must return 200`);
  assert.equal(me.json?.user?.id, login.json.user.id, `${account.label} /me must match logged-in user`);
  assert.equal(me.json?.appState, login.json.appState, `${account.label} /me appState must match login`);

  await fetchJson("/auth/logout", {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: `Bearer ${token}`,
    },
  });

  record(`login.${account.label}`, true, {
    email: account.email,
    role: login.json.user.role,
    appState: login.json.appState,
    capabilities: login.json.capabilities,
  });
}

async function main() {
  try {
    await checkHealth();
    await checkCors();
    await checkUnauthenticatedContract();
    for (const account of optionalAccounts) {
      await checkLoginAccount(account);
    }
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error.message;
    record("failure", false, { message: error.message });
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  } finally {
    report.finishedAt = new Date().toISOString();
  }

  console.log(JSON.stringify(report, null, 2));
}

await main();
