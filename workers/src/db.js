/**
 * Session + user lookups (D1)
 */

import { createId } from "./crypto.js";
import { publicReviewerProfileFields } from "./reviewer-profile.js";

const SESSION_DAYS = 30;
const VIRTUAL_STUDENT_ID = "virtual-student:onboarding";

function buildVirtualStudentContext(user) {
  return {
    pairingId: "virtual-pairing:onboarding-student",
    studentUserId: VIRTUAL_STUDENT_ID,
    studentDisplayName: "สามเณรทดลอง",
    studentRoleLabel: "นักเรียนเสมือน",
    studentAvatarUrl: "",
    status: "virtual",
    isVirtual: true,
    createdAt: user.createdAt,
  };
}

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
      `SELECT u.id, u.role, u.display_name, u.email, u.created_at, u.profile_json, u.is_super_admin
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
      `SELECT id, role, display_name, email, created_at, profile_json, is_super_admin FROM users WHERE id = ?1`
    )
    .bind(userId)
    .first();
  return row ? mapUser(row) : null;
}

export async function getUserByEmail(db, email) {
  const row = await db
    .prepare(
      `SELECT id, role, display_name, email, password_hash, password_salt, created_at, profile_json, is_super_admin
       FROM users WHERE email = ?1`
    )
    .bind(email)
    .first();
  return row;
}

export async function getUserByIdWithSecret(db, userId) {
  return db
    .prepare(
      `SELECT id, role, display_name, email, password_hash, password_salt, created_at, profile_json, is_super_admin
       FROM users WHERE id = ?1`
    )
    .bind(userId)
    .first();
}

function mapUser(row) {
  let profileJson = null;
  if (row.profile_json) {
    try {
      profileJson = JSON.parse(row.profile_json);
    } catch {
      profileJson = null;
    }
  }
  return {
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    email: row.email || null,
    createdAt: row.created_at,
    profileJson,
    isSuperAdmin: Boolean(row.is_super_admin),
  };
}

export async function updateUserProfile(db, userId, { displayName, email, profileJson }) {
  const sets = [];
  const values = [];
  let index = 1;

  if (displayName !== undefined) {
    sets.push(`display_name = ?${index}`);
    values.push(displayName);
    index += 1;
  }
  if (email !== undefined) {
    sets.push(`email = ?${index}`);
    values.push(email || null);
    index += 1;
  }
  if (profileJson !== undefined) {
    sets.push(`profile_json = ?${index}`);
    values.push(profileJson ? JSON.stringify(profileJson) : null);
    index += 1;
  }

  if (!sets.length) return getUserById(db, userId);

  values.push(userId);
  await db
    .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?${index}`)
    .bind(...values)
    .run();

  return getUserById(db, userId);
}

export async function updateUserPin(db, userId, passwordHash, salt) {
  await db
    .prepare(`UPDATE users SET password_hash = ?1, password_salt = ?2 WHERE id = ?3`)
    .bind(passwordHash, salt, userId)
    .run();
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
    const realStudents = (students.results || []).map((row) => ({
      pairingId: row.id,
      studentUserId: row.student_user_id,
      studentDisplayName: row.student_display_name,
      status: row.status,
      isVirtual: false,
      createdAt: row.created_at,
    }));

    return {
      invite: invite
        ? { inviteCode: invite.invite_code, createdAt: invite.created_at }
        : null,
      students: realStudents.length ? realStudents : [buildVirtualStudentContext(user)],
    };
  }

  const pairing = await db
    .prepare(
      `SELECT p.id, p.reviewer_user_id, p.status, p.created_at,
              u.display_name AS reviewer_display_name,
              u.profile_json AS reviewer_profile_json
       FROM pairings p
       JOIN users u ON u.id = p.reviewer_user_id
       WHERE p.student_user_id = ?1 AND p.status = 'active'
       ORDER BY p.created_at DESC
       LIMIT 1`
    )
    .bind(user.id)
    .first();

  let reviewerProfile = null;
  if (pairing?.reviewer_profile_json) {
    try {
      reviewerProfile = JSON.parse(pairing.reviewer_profile_json);
    } catch {
      reviewerProfile = null;
    }
  }
  const publicProfile = publicReviewerProfileFields(reviewerProfile);

  return {
    pairing: pairing
      ? {
          pairingId: pairing.id,
          reviewerUserId: pairing.reviewer_user_id,
          reviewerDisplayName: pairing.reviewer_display_name,
          reviewerProfileStatus: publicProfile.profileStatus,
          reviewerCapability: publicProfile.capability,
          reviewerRoleLabel: publicProfile.roleLabel,
          reviewerAvatarUrl: publicProfile.avatarUrl,
          status: pairing.status,
          createdAt: pairing.created_at,
        }
      : null,
  };
}
