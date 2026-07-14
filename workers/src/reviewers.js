/**
 * Reviewer/teacher search — public-safe directory for student profile matching (#67)
 */

import { getUserBySession } from "./db.js";
import { errorResponse, jsonResponse, readBearerToken } from "./http.js";
import { publicReviewerProfileFields } from "./reviewer-profile.js";
import { publicReviewAvailabilityFields } from "./review-capacity.js";

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 10;

function safeParseProfile(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** คืนเฉพาะ field ที่เปิดเผยได้ — ห้าม leak email / secret */
function toPublicReviewer(row, pairedReviewerIds) {
  const profile = safeParseProfile(row.profile_json);
  const avatar = String(profile?.avatarUrl || "");
  const publicProfile = publicReviewerProfileFields(profile);
  const reviewAvailability = publicReviewAvailabilityFields(profile);
  return {
    id: row.id,
    displayName: row.display_name,
    institution: String(profile?.institution || "").trim() || null,
    profileStatus: publicProfile.profileStatus,
    capability: publicProfile.capability,
    roleLabel: publicProfile.roleLabel,
    reviewAvailability,
    avatarUrl: avatar.startsWith("data:image/") ? avatar : null,
    isPaired: pairedReviewerIds.has(row.id),
  };
}

export async function handleSearchReviewers(request, env) {
  const token = readBearerToken(request);
  const user = await getUserBySession(env.DB, token);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }

  const url = new URL(request.url);
  const rawQuery = String(url.searchParams.get("q") || "").trim();
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  // หาว่า student คนนี้จับคู่กับ reviewer ไหนอยู่ (เพื่อ mark isPaired)
  const pairedReviewerIds = new Set();
  if (user.role === "student") {
    const paired = await env.DB.prepare(
      `SELECT reviewer_user_id FROM pairings WHERE student_user_id = ?1 AND status = 'active'`
    )
      .bind(user.id)
      .all();
    (paired.results || []).forEach((r) => pairedReviewerIds.add(r.reviewer_user_id));
  }

  let rows;
  if (rawQuery) {
    const like = `%${rawQuery.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    rows = await env.DB.prepare(
      `SELECT id, role, display_name, profile_json
       FROM users
       WHERE role = 'reviewer'
         AND (display_name LIKE ?1 ESCAPE '\\' OR profile_json LIKE ?1 ESCAPE '\\')
       ORDER BY display_name COLLATE NOCASE ASC
       LIMIT ?2`
    )
      .bind(like, limit)
      .all();
  } else {
    rows = await env.DB.prepare(
      `SELECT id, role, display_name, profile_json
       FROM users
       WHERE role = 'reviewer'
       ORDER BY display_name COLLATE NOCASE ASC
       LIMIT ?1`
    )
      .bind(limit)
      .all();
  }

  const reviewers = (rows.results || []).map((row) => toPublicReviewer(row, pairedReviewerIds));

  return jsonResponse(request, {
    schema: "paligo.inbox.reviewers.search.v1",
    query: rawQuery,
    reviewers,
  });
}
