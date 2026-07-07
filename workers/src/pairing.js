/**
 * Pairing — invite (reviewer) + join (student)
 */

import { createId, createInviteCode } from "./crypto.js";
import { errorResponse, jsonResponse, parseJsonBody } from "./http.js";
import { requireUser } from "./auth.js";

export async function handlePairingInvite(request, env) {
  const user = await requireUser(request, env);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }
  if (user.role !== "reviewer") {
    return errorResponse(request, "forbidden", "เฉพาะครู/ผู้ตรวจสร้างรหัสจับคู่ได้", 403);
  }

  const existing = await env.DB.prepare(
    `SELECT invite_code, created_at FROM pairing_invites WHERE reviewer_user_id = ?1`
  )
    .bind(user.id)
    .first();

  if (existing) {
    return jsonResponse(request, {
      inviteCode: existing.invite_code,
      createdAt: existing.created_at,
      reused: true,
    });
  }

  let inviteCode = createInviteCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await env.DB.prepare(
        `INSERT INTO pairing_invites (reviewer_user_id, invite_code) VALUES (?1, ?2)`
      )
        .bind(user.id, inviteCode)
        .run();
      break;
    } catch {
      inviteCode = createInviteCode();
    }
  }

  const row = await env.DB.prepare(
    `SELECT invite_code, created_at FROM pairing_invites WHERE reviewer_user_id = ?1`
  )
    .bind(user.id)
    .first();

  return jsonResponse(
    request,
    {
      inviteCode: row.invite_code,
      createdAt: row.created_at,
      reused: false,
    },
    201
  );
}

export async function handlePairingJoin(request, env) {
  const user = await requireUser(request, env);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }
  if (user.role !== "student") {
    return errorResponse(request, "forbidden", "เฉพาะนักเรียนใช้รหัสจับคู่ได้", 403);
  }

  const body = await parseJsonBody(request);
  if (body == null) {
    return errorResponse(request, "invalid_json", "JSON ไม่ถูกต้อง", 400);
  }

  const inviteCode = String(body.inviteCode || "")
    .trim()
    .toUpperCase();
  if (inviteCode.length < 6) {
    return errorResponse(request, "invalid_invite", "รหัสจับคู่ไม่ถูกต้อง", 400);
  }

  const invite = await env.DB.prepare(
    `SELECT reviewer_user_id, invite_code, created_at
     FROM pairing_invites WHERE invite_code = ?1`
  )
    .bind(inviteCode)
    .first();

  if (!invite) {
    return errorResponse(request, "invalid_invite", "ไม่พบรหัสจับคู่นี้", 404);
  }

  const existing = await env.DB.prepare(
    `SELECT id, status FROM pairings
     WHERE student_user_id = ?1 AND reviewer_user_id = ?2`
  )
    .bind(user.id, invite.reviewer_user_id)
    .first();

  if (existing?.status === "active") {
    const reviewer = await env.DB.prepare(
      `SELECT display_name FROM users WHERE id = ?1`
    )
      .bind(invite.reviewer_user_id)
      .first();
    return jsonResponse(request, {
      pairingId: existing.id,
      reviewerUserId: invite.reviewer_user_id,
      reviewerDisplayName: reviewer?.display_name || "ครู",
      inviteCode,
      reused: true,
    });
  }

  const pairingId = createId();
  await env.DB.prepare(
    `INSERT INTO pairings (id, student_user_id, reviewer_user_id, status)
     VALUES (?1, ?2, ?3, 'active')`
  )
    .bind(pairingId, user.id, invite.reviewer_user_id)
    .run();

  const reviewer = await env.DB.prepare(
    `SELECT display_name FROM users WHERE id = ?1`
  )
    .bind(invite.reviewer_user_id)
    .first();

  return jsonResponse(
    request,
    {
      pairingId,
      reviewerUserId: invite.reviewer_user_id,
      reviewerDisplayName: reviewer?.display_name || "ครู",
      inviteCode,
      reused: false,
    },
    201
  );
}
