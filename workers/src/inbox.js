/**
 * Inbox list + claim
 */

import { requireUser } from "./auth.js";
import { errorResponse, jsonResponse } from "./http.js";
import { assertInboxOperational } from "./platform.js";

/**
 * @param {unknown} profileJson
 */
function avatarFromProfileJson(profileJson) {
  if (!profileJson) return null;
  try {
    const parsed = typeof profileJson === "string" ? JSON.parse(profileJson) : profileJson;
    const url = String(parsed?.avatarUrl || "").trim();
    return url.startsWith("data:image/") ? url : null;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} payloadJson
 */
function avatarFromPackagePayload(payloadJson) {
  if (!payloadJson) return null;
  try {
    const parsed = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
    const candidates = [
      parsed?.submission?.profile?.avatarUrl,
      parsed?.submission?.studentProfile?.avatarUrl,
      parsed?.book?.profile?.avatarUrl,
      parsed?.book?.studentProfile?.avatarUrl,
      parsed?.profile?.avatarUrl,
    ];
    const url = candidates.map((value) => String(value || "").trim()).find((value) => value.startsWith("data:image/"));
    return url || null;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} row
 */
function mapInboxItem(row) {
  const profileAvatar = avatarFromProfileJson(row.from_profile_json);
  return {
    id: row.id,
    status: row.status,
    intendedRecipientLabel: row.intended_recipient_label,
    bookTitle: row.book_title,
    subject: row.subject,
    grade: row.grade,
    direction: row.direction,
    bookId: row.book_id,
    bookRevision: row.book_revision,
    fromUserId: row.from_user_id,
    fromDisplayName: row.from_display_name,
    fromAvatarUrl: profileAvatar || avatarFromPackagePayload(row.payload_json),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/**
 * @param {Request} request
 * @param {Env} env
 */
export async function handleGetInbox(request, env) {
  const user = await requireUser(request, env);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }

  const blocked = await assertInboxOperational(request, env, user);
  if (blocked) return blocked;

  const result = await env.DB.prepare(
    `SELECT i.id, i.status, i.intended_recipient_label, i.book_title, i.subject, i.grade,
            i.created_at, i.expires_at, p.direction, p.book_id, p.book_revision,
            p.payload_json,
            i.from_user_id,
            u.display_name AS from_display_name, u.profile_json AS from_profile_json
     FROM inbox_items i
     INNER JOIN packages p ON p.id = i.package_id
     INNER JOIN users u ON u.id = i.from_user_id
     WHERE i.to_user_id = ?1 AND i.status = 'pending'
     ORDER BY i.created_at DESC`
  )
    .bind(user.id)
    .all();

  return jsonResponse(request, {
    items: (result.results || []).map(mapInboxItem),
  });
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {string} inboxId
 */
export async function handleClaimInbox(request, env, inboxId) {
  const user = await requireUser(request, env);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }

  const blocked = await assertInboxOperational(request, env, user);
  if (blocked) return blocked;

  const row = await env.DB.prepare(
    `SELECT i.id, i.to_user_id, i.from_user_id, i.status, i.intended_recipient_label,
            p.payload_json, p.direction,
            u.display_name AS from_display_name, u.profile_json AS from_profile_json
     FROM inbox_items i
     INNER JOIN packages p ON p.id = i.package_id
     INNER JOIN users u ON u.id = i.from_user_id
     WHERE i.id = ?1`
  )
    .bind(inboxId)
    .first();

  if (!row) {
    return errorResponse(request, "not_found", "ไม่พบรายการ inbox", 404);
  }

  if (row.to_user_id !== user.id) {
    return errorResponse(
      request,
      "forbidden",
      `แพ็กนี้สำหรับ ${row.intended_recipient_label || "ผู้รับที่ถูกต้อง"} — ไม่ใช่บัญชีนี้`,
      403
    );
  }

  if (row.status !== "pending") {
    return errorResponse(request, "already_claimed", "รายการนี้ถูกรับไปแล้ว", 409);
  }

  if (row.direction === "to-reviewer" && user.role !== "reviewer") {
    return errorResponse(request, "forbidden", "เฉพาะครู/ผู้ตรวจรับแพ็กนี้ได้", 403);
  }

  if (row.direction === "to-student" && user.role !== "student") {
    return errorResponse(request, "forbidden", "เฉพาะนักเรียนรับแพ็กนี้ได้", 403);
  }

  await env.DB.prepare(
    `UPDATE inbox_items SET status = 'claimed', claimed_at = datetime('now') WHERE id = ?1`
  )
    .bind(inboxId)
    .run();

  let bookTransfer;
  try {
    bookTransfer = JSON.parse(row.payload_json);
  } catch {
    return errorResponse(request, "corrupt_payload", "ข้อมูลแพ็กเสียหาย", 500);
  }

  return jsonResponse(request, {
    inboxItemId: inboxId,
    fromUserId: row.from_user_id,
    fromDisplayName: row.from_display_name,
    fromAvatarUrl: avatarFromProfileJson(row.from_profile_json) || avatarFromPackagePayload(row.payload_json),
    bookTransfer,
  });
}
