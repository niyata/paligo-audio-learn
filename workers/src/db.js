/**
 * Session + user lookups (D1)
 */

import { createId } from "./crypto.js";

const SESSION_DAYS = 30;

export async function createSession(db, userId) {
  const sessionId = createId();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)`
    )
    .bind(sessionId, userId, expiresAt)
    .run();
  return { sessionId, expiresAt };
}

export async function deleteSession(db, sessionId) {
  await db.prepare(`DELETE FROM sessions WHERE id = ?1`).bind(sessionId).run();
}

export async function getUserBySession(db, sessionId) {
  if (!sessionId) return null;
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `SELECT u.id, u.role, u.display_name, u.email, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?1 AND s.expires_at > ?2`
    )
    .bind(sessionId, now)
    .first();
  return row ? mapUser(row) : null;
}

export async function getUserById(db, userId) {
  const row = await db
    .prepare(
      `SELECT id, role, display_name, email, created_at FROM users WHERE id = ?1`
    )
    .bind(userId)
    .first();
  return row ? mapUser(row) : null;
}

export async function getUserByEmail(db, email) {
  const row = await db
    .prepare(
      `SELECT id, role, display_name, email, password_hash, password_salt, created_at
       FROM users WHERE email = ?1`
    )
    .bind(email)
    .first();
  return row;
}

export async function getUserByIdWithSecret(db, userId) {
  return db
    .prepare(
      `SELECT id, role, display_name, email, password_hash, password_salt, created_at
       FROM users WHERE id = ?1`
    )
    .bind(userId)
    .first();
}

function mapUser(row) {
  return {
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    email: row.email || null,
    createdAt: row.created_at,
  };
}

export { mapUser };

export async function getPairingContext(db, user) {
  if (user.role === "reviewer") {
    const invite = await db
      .prepare(
        `SELECT invite_code, created_at FROM pairing_invites WHERE reviewer_user_id = ?1`
      )
      .bind(user.id)
      .first();
    const students = await db
      .prepare(
        `SELECT p.id, p.student_user_id, u.display_name AS student_display_name, p.status, p.created_at
         FROM pairings p
         JOIN users u ON u.id = p.student_user_id
         WHERE p.reviewer_user_id = ?1 AND p.status = 'active'
         ORDER BY p.created_at DESC`
      )
      .bind(user.id)
      .all();
    return {
      invite: invite
        ? { inviteCode: invite.invite_code, createdAt: invite.created_at }
        : null,
      students: (students.results || []).map((row) => ({
        pairingId: row.id,
        studentUserId: row.student_user_id,
        studentDisplayName: row.student_display_name,
        status: row.status,
        createdAt: row.created_at,
      })),
    };
  }

  const pairing = await db
    .prepare(
      `SELECT p.id, p.reviewer_user_id, p.status, p.created_at,
              u.display_name AS reviewer_display_name
       FROM pairings p
       JOIN users u ON u.id = p.reviewer_user_id
       WHERE p.student_user_id = ?1 AND p.status = 'active'
       ORDER BY p.created_at DESC
       LIMIT 1`
    )
    .bind(user.id)
    .first();

  return {
    pairing: pairing
      ? {
          pairingId: pairing.id,
          reviewerUserId: pairing.reviewer_user_id,
          reviewerDisplayName: pairing.reviewer_display_name,
          status: pairing.status,
          createdAt: pairing.created_at,
        }
      : null,
  };
}
