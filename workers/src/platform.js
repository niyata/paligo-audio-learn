/**
 * Platform flags — public read + super-admin write
 */

import { getUserBySession } from "./db.js";
import { errorResponse, jsonResponse, parseJsonBody, readBearerToken } from "./http.js";

export const SUPER_ADMIN_EMAILS = new Set(["tha.std@paligo.jp", "1.tha.tc@paligo.jp"]);

export const DEFAULT_PLATFORM_FLAGS = {
  importExportEnabled: false,
  inboxEnabled: true,
  lineWebhookEnabled: false,
  lineMessagingEnabled: false,
  lineNotifyQueueEnabled: false,
  notificationsEnabled: true,
  crawlerIndexingAllowed: false,
  maintenanceMode: false,
  debugApiLogs: false,
};

const FLAG_KEYS = Object.keys(DEFAULT_PLATFORM_FLAGS);

function normalizeFlags(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const out = { ...DEFAULT_PLATFORM_FLAGS };
  FLAG_KEYS.forEach((key) => {
    if (typeof source[key] === "boolean") out[key] = source[key];
  });
  return out;
}

export async function getPlatformFlags(db) {
  const row = await db
    .prepare(`SELECT value_json, updated_at, updated_by FROM platform_settings WHERE key = 'platform_flags'`)
    .first();
  if (!row?.value_json) return { ...DEFAULT_PLATFORM_FLAGS, updatedAt: null, updatedBy: null };
  try {
    const parsed = JSON.parse(row.value_json);
    return {
      ...normalizeFlags(parsed),
      updatedAt: row.updated_at || null,
      updatedBy: row.updated_by || null,
    };
  } catch {
    return { ...DEFAULT_PLATFORM_FLAGS, updatedAt: row.updated_at || null, updatedBy: row.updated_by || null };
  }
}

export async function savePlatformFlags(db, flags, updatedBy) {
  const normalized = normalizeFlags(flags);
  const payload = { ...normalized };
  delete payload.updatedAt;
  delete payload.updatedBy;

  await db
    .prepare(
      `INSERT INTO platform_settings (key, value_json, updated_by, updated_at)
       VALUES ('platform_flags', ?1, ?2, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_by = excluded.updated_by,
         updated_at = datetime('now')`
    )
    .bind(JSON.stringify(payload), updatedBy || null)
    .run();

  return getPlatformFlags(db);
}

export function userIsSuperAdmin(user) {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  const email = String(user.email || "").trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.has(email);
}

export async function requireSuperAdmin(request, env) {
  const token = readBearerToken(request);
  const user = await getUserBySession(env.DB, token);
  if (!user) {
    return { error: errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401) };
  }
  if (!userIsSuperAdmin(user)) {
    return { error: errorResponse(request, "forbidden", "ต้องเป็น Super Admin", 403) };
  }
  return { user };
}

export async function handleGetPlatformFlags(request, env) {
  const flags = await getPlatformFlags(env.DB);
  const { updatedAt, updatedBy, ...publicFlags } = flags;
  return jsonResponse(request, {
    flags: publicFlags,
    meta: { updatedAt, updatedBy },
  });
}

export async function handleGetAdminPanel(request, env) {
  const auth = await requireSuperAdmin(request, env);
  if (auth.error) return auth.error;

  const flags = await getPlatformFlags(env.DB);
  let health = { ok: false };
  try {
    health = {
      ok: true,
      service: "paligo-inbox-api",
      env: env.PALIGO_ENV || "development",
    };
  } catch {
    /* ignore */
  }

  const counts = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM pairings WHERE status = 'active') AS pairings,
      (SELECT COUNT(*) FROM inbox_items WHERE status = 'pending') AS inbox_pending`
  ).first();

  return jsonResponse(request, {
    user: auth.user,
    flags,
    health,
    stats: {
      users: counts?.users || 0,
      activePairings: counts?.pairings || 0,
      inboxPending: counts?.inbox_pending || 0,
    },
    superAdminEmails: [...SUPER_ADMIN_EMAILS],
    integrations: {
      lineWebhookUrl: "/v1/line/webhook",
      lineMessaging: flags.lineMessagingEnabled ? "configured_stub" : "disabled",
      inboxApi: flags.inboxEnabled ? "enabled" : "disabled",
    },
  });
}

export async function handlePatchAdminSettings(request, env) {
  const auth = await requireSuperAdmin(request, env);
  if (auth.error) return auth.error;

  const body = await parseJsonBody(request);
  if (body == null) {
    return errorResponse(request, "invalid_json", "JSON ไม่ถูกต้อง", 400);
  }

  const current = await getPlatformFlags(env.DB);
  const next = normalizeFlags({ ...current, ...(body.flags || body) });
  const saved = await savePlatformFlags(env.DB, next, auth.user.id);
  const { updatedAt, updatedBy, ...publicFlags } = saved;

  return jsonResponse(request, {
    ok: true,
    flags: publicFlags,
    meta: { updatedAt, updatedBy },
  });
}

export async function ensureSuperAdminFlag(db, userId, email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!SUPER_ADMIN_EMAILS.has(normalized)) return;
  await db.prepare(`UPDATE users SET is_super_admin = 1 WHERE id = ?1`).bind(userId).run();
}

/**
 * Block inbox routes when maintenance or inbox API is off (super admins bypass).
 * @returns {Response|null}
 */
export async function assertInboxOperational(request, env, user) {
  if (userIsSuperAdmin(user)) return null;

  const flags = await getPlatformFlags(env.DB);
  if (flags.maintenanceMode) {
    return errorResponse(
      request,
      "maintenance",
      "ระบบปิดปรับปรุงชั่วคราว — ลองใหม่ภายหลัง",
      503
    );
  }
  if (!flags.inboxEnabled) {
    return errorResponse(
      request,
      "inbox_disabled",
      "Inbox API ปิดอยู่ — ติดต่อผู้ดูแลระบบ",
      503
    );
  }
  return null;
}
