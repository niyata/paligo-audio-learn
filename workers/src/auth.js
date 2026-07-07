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
import { createSession, deleteSession, getPairingContext, getUserByEmail, getUserByIdWithSecret, getUserBySession, mapUser } from "./db.js";
import { errorResponse, jsonResponse, parseJsonBody, readBearerToken } from "./http.js";

export async function handleRegister(request, env) {
  const body = await parseJsonBody(request);
  if (body == null) {
    return errorResponse(request, "invalid_json", "JSON ไม่ถูกต้อง", 400);
  }

  const role = body.role;
  const displayName = normalizeDisplayName(body.displayName);
  const email = normalizeEmail(body.email);
  const pin = String(body.pin || "");

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

  await env.DB.prepare(
    `INSERT INTO users (id, role, display_name, email, password_hash, password_salt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  )
    .bind(userId, role, displayName, email, passwordHash, salt)
    .run();

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

export async function requireUser(request, env) {
  const token = readBearerToken(request);
  return getUserBySession(env.DB, token);
}
