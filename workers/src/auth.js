/**
 * Auth — register, login, logout, me
 */

import {
  createId,
  createSaltHex,
  hashPin,
  isValidPin,
  isValidRole,
  normalizeDisplayName,
  normalizeEmail,
  verifyPin,
} from "./crypto.js";
import { createSession, deleteSession, getPairingContext, getUserByEmail, getUserByIdWithSecret, getUserBySession, mapUser, updateUserPin, updateUserProfile } from "./db.js";
import { ensureSuperAdminFlag, SUPER_ADMIN_EMAILS } from "./platform.js";
import { errorResponse, jsonResponse, parseJsonBody, readBearerToken } from "./http.js";
import { mergeReviewAvailabilityIntoProfile } from "./review-capacity.js";

function sanitizeProfileJson(role, profileJson) {
  if (!profileJson || typeof profileJson !== "object") return profileJson;
  if (role !== "reviewer") return profileJson;
  return mergeReviewAvailabilityIntoProfile(profileJson);
}

export async function handleRegister(request, env) {
  const body = await parseJsonBody(request);
  if (body == null) {
    return errorResponse(request, "invalid_json", "JSON ไม่ถูกต้อง", 400);
  }

  const role = body.role;
  const displayName = normalizeDisplayName(body.displayName);
  const email = normalizeEmail(body.email);
  const pin = String(body.pin || "");

  let profileJson = null;
  if (body.profileJson !== undefined && body.profileJson !== null) {
    if (typeof body.profileJson !== "object") {
      return errorResponse(request, "invalid_profile", "profileJson ต้องเป็น object", 400);
    }
    profileJson = body.profileJson;
  }

  if (!isValidRole(role)) {
    return errorResponse(request, "invalid_role", "role ต้องเป็น student หรือ reviewer", 400);
  }
  if (displayName.length < 2) {
    return errorResponse(request, "invalid_display_name", "ชื่อแสดงต้องมีอย่างน้อย 2 ตัวอักษร", 400);
  }
  if (!isValidPin(pin)) {
    return errorResponse(request, "invalid_pin", "PIN ต้องเป็นตัวเลขอย่างน้อย 6 หลัก", 400);
  }

  if (email) {
    const existing = await getUserByEmail(env.DB, email);
    if (existing) {
      return errorResponse(request, "email_taken", "อีเมลนี้ถูกใช้แล้ว", 409);
    }
  }

  const userId = createId();
  const salt = createSaltHex();
  const passwordHash = await hashPin(pin, salt);
  const isSuperAdmin = email && SUPER_ADMIN_EMAILS.has(email) ? 1 : 0;
  const storedProfile = profileJson ? sanitizeProfileJson(role, profileJson) : null;

  await env.DB.prepare(
    `INSERT INTO users (id, role, display_name, email, password_hash, password_salt, is_super_admin, profile_json)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  )
    .bind(userId, role, displayName, email, passwordHash, salt, isSuperAdmin, storedProfile ? JSON.stringify(storedProfile) : null)
    .run();

  await ensureSuperAdminFlag(env.DB, userId, email);

  const session = await createSession(env.DB, userId);
  const user = await getUserBySession(env.DB, session.sessionId);

  return jsonResponse(
    request,
    {
      user,
      sessionToken: session.sessionId,
      expiresAt: session.expiresAt,
    },
    201
  );
}

export async function handleLogin(request, env) {
  const body = await parseJsonBody(request);
  if (body == null) {
    return errorResponse(request, "invalid_json", "JSON ไม่ถูกต้อง", 400);
  }

  const pin = String(body.pin || "");
  const userId = String(body.userId || "").trim();
  const email = normalizeEmail(body.email);

  if (!isValidPin(pin)) {
    return errorResponse(request, "invalid_pin", "PIN ไม่ถูกต้อง", 400);
  }
  if (!userId && !email) {
    return errorResponse(request, "invalid_login", "ต้องระบุ userId หรือ email", 400);
  }

  const row = email
    ? await getUserByEmail(env.DB, email)
    : await getUserByIdWithSecret(env.DB, userId);

  if (!row) {
    return errorResponse(request, "invalid_credentials", "ไม่พบบัญชีหรือ PIN ไม่ถูกต้อง", 401);
  }

  const ok = await verifyPin(pin, row.password_salt, row.password_hash);
  if (!ok) {
    return errorResponse(request, "invalid_credentials", "ไม่พบบัญชีหรือ PIN ไม่ถูกต้อง", 401);
  }

  await ensureSuperAdminFlag(env.DB, row.id, row.email);

  const session = await createSession(env.DB, row.id);
  const user = mapUser(row);

  return jsonResponse(request, {
    user,
    sessionToken: session.sessionId,
    expiresAt: session.expiresAt,
  });
}

export async function handleLogout(request, env) {
  const token = readBearerToken(request);
  if (token) {
    await deleteSession(env.DB, token);
  }
  return jsonResponse(request, { ok: true });
}

export async function handleMe(request, env) {
  const token = readBearerToken(request);
  const user = await getUserBySession(env.DB, token);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }

  const pairingContext = await getPairingContext(env.DB, user);
  return jsonResponse(request, {
    user,
    ...pairingContext,
  });
}

export async function handlePatchMe(request, env) {
  const token = readBearerToken(request);
  const user = await getUserBySession(env.DB, token);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }

  const body = await parseJsonBody(request);
  if (body == null) {
    return errorResponse(request, "invalid_json", "JSON ไม่ถูกต้อง", 400);
  }

  const patch = {};

  if (body.displayName !== undefined) {
    const displayName = normalizeDisplayName(body.displayName);
    if (displayName.length < 2) {
      return errorResponse(request, "invalid_display_name", "ชื่อแสดงต้องมีอย่างน้อย 2 ตัวอักษร", 400);
    }
    patch.displayName = displayName;
  }

  if (body.email !== undefined) {
    const email = normalizeEmail(body.email);
    if (email) {
      const existing = await getUserByEmail(env.DB, email);
      if (existing && existing.id !== user.id) {
        return errorResponse(request, "email_taken", "อีเมลนี้ถูกใช้แล้ว", 409);
      }
    }
    patch.email = email || null;
  }

  if (body.profileJson !== undefined) {
    if (body.profileJson !== null && typeof body.profileJson !== "object") {
      return errorResponse(request, "invalid_profile", "profileJson ต้องเป็น object", 400);
    }
    patch.profileJson = sanitizeProfileJson(user.role, body.profileJson);
  }

  if (!Object.keys(patch).length) {
    return errorResponse(request, "empty_patch", "ไม่มีฟิลด์ที่จะอัปเดต", 400);
  }

  const updated = await updateUserProfile(env.DB, user.id, patch);
  const pairingContext = await getPairingContext(env.DB, updated);
  return jsonResponse(request, {
    user: updated,
    ...pairingContext,
  });
}

export async function handleChangePin(request, env) {
  const token = readBearerToken(request);
  const user = await getUserBySession(env.DB, token);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }

  const body = await parseJsonBody(request);
  if (body == null) {
    return errorResponse(request, "invalid_json", "JSON ไม่ถูกต้อง", 400);
  }

  const currentPin = String(body.currentPin || "");
  const newPin = String(body.newPin || "");

  if (!isValidPin(currentPin) || !isValidPin(newPin)) {
    return errorResponse(request, "invalid_pin", "PIN ต้องเป็นตัวเลขอย่างน้อย 6 หลัก", 400);
  }

  const row = await getUserByIdWithSecret(env.DB, user.id);
  if (!row) {
    return errorResponse(request, "not_found", "ไม่พบบัญชี", 404);
  }

  const ok = await verifyPin(currentPin, row.password_salt, row.password_hash);
  if (!ok) {
    return errorResponse(request, "invalid_credentials", "PIN ปัจจุบันไม่ถูกต้อง", 401);
  }

  const salt = createSaltHex();
  const passwordHash = await hashPin(newPin, salt);
  await updateUserPin(env.DB, user.id, passwordHash, salt);

  return jsonResponse(request, { ok: true });
}

export async function requireUser(request, env) {
  const token = readBearerToken(request);
  return getUserBySession(env.DB, token);
}
