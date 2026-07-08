/**
 * POST /v1/packages — push bookTransfer (to-reviewer | to-student)
 */

import { createId } from "./crypto.js";
import { getUserById } from "./db.js";
import { requireUser } from "./auth.js";
import { errorResponse, jsonResponse, parseJsonBody } from "./http.js";

/**
 * @param {D1Database} db
 * @param {string} bookId
 * @param {string} reviewerUserId
 */
async function resolveStudentForBookReturn(db, bookId, reviewerUserId) {
  const origin = await db
    .prepare(
      `SELECT p.from_user_id AS student_id
       FROM packages p
       INNER JOIN inbox_items i ON i.package_id = p.id
       WHERE p.book_id = ?1 AND p.direction = 'to-reviewer' AND i.to_user_id = ?2
       ORDER BY p.created_at DESC
       LIMIT 1`
    )
    .bind(bookId, reviewerUserId)
    .first();

  if (!origin?.student_id) return null;

  const pairing = await db
    .prepare(
      `SELECT student_user_id FROM pairings
       WHERE student_user_id = ?1 AND reviewer_user_id = ?2 AND status = 'active'
       LIMIT 1`
    )
    .bind(origin.student_id, reviewerUserId)
    .first();

  return pairing ? origin.student_id : null;
}

/**
 * @param {Request} request
 * @param {Env} env
 */
export async function handlePostPackage(request, env) {
  const user = await requireUser(request, env);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }

  const body = await parseJsonBody(request);
  if (!body || body.schema !== "paligo.exam.bookTransfer.v1") {
    return errorResponse(request, "invalid_package", "ต้องเป็น paligo.exam.bookTransfer.v1", 400);
  }

  const direction = body.direction;
  if (direction !== "to-reviewer" && direction !== "to-student") {
    return errorResponse(request, "invalid_package", "direction ไม่รองรับ", 400);
  }

  const bookId = body.book?.id || body.submission?.bookId || body.review?.bookId;
  if (!bookId) {
    return errorResponse(request, "invalid_package", "ไม่มี bookId", 400);
  }

  const bookRevision = Number(body.submission?.bookRevision || body.book?.revision || body.review?.bookRevision || 1);
  const submissionId = body.submission?.id || null;
  const answerHash = body.submission?.answerHash || null;
  const bookTitle =
    body.book?.studentName || body.submission?.bookTitle || body.book?.title || body.review?.bookTitle || "สมุดข้อสอบ";
  const subject = body.book?.subject || body.submission?.subject || body.review?.subject || "";
  const grade = body.book?.grade || body.submission?.grade || body.review?.grade || "";

  if (direction === "to-reviewer") {
    if (user.role !== "student") {
      return errorResponse(request, "forbidden", "เฉพาะนักเรียนส่งเข้า inbox ครูได้", 403);
    }

    if (!body.submission) {
      return errorResponse(request, "invalid_package", "ต้องส่งตรวจก่อน (ไม่มี submission)", 400);
    }

    const pairing = await env.DB.prepare(
      `SELECT reviewer_user_id FROM pairings
       WHERE student_user_id = ?1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`
    )
      .bind(user.id)
      .first();

    if (!pairing) {
      return errorResponse(request, "no_pairing", "ยังไม่ได้จับคู่ครู — ไปที่ บัญชี Inbox แท็บจับคู่", 400);
    }

    const duplicate = await env.DB.prepare(
      `SELECT i.id FROM inbox_items i
       INNER JOIN packages p ON p.id = i.package_id
       WHERE i.status = 'pending' AND p.book_id = ?1 AND p.direction = 'to-reviewer'
         AND p.from_user_id = ?2 AND i.to_user_id = ?3`
    )
      .bind(bookId, user.id, pairing.reviewer_user_id)
      .first();

    if (duplicate) {
      return errorResponse(
        request,
        "duplicate_pending",
        "มีแพ็กรอครูรับอยู่แล้วสำหรับสมุดนี้",
        409
      );
    }

    const reviewer = await getUserById(env.DB, pairing.reviewer_user_id);
    const payloadJson = JSON.stringify(body);
    const packageId = createId();
    const inboxId = createId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const recipientLabel = reviewer?.displayName
      ? `ครู ${reviewer.displayName}`
      : "ครู/ผู้ตรวจ";

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO packages (
          id, schema, direction, book_id, book_revision, submission_id, answer_hash,
          payload_json, payload_bytes, from_user_id
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
      ).bind(
        packageId,
        body.schema,
        direction,
        bookId,
        bookRevision,
        submissionId,
        answerHash,
        payloadJson,
        payloadJson.length,
        user.id
      ),
      env.DB.prepare(
        `INSERT INTO inbox_items (
          id, package_id, to_user_id, from_user_id, status,
          intended_recipient_label, book_title, subject, grade, expires_at
        ) VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7, ?8, ?9)`
      ).bind(
        inboxId,
        packageId,
        pairing.reviewer_user_id,
        user.id,
        recipientLabel,
        bookTitle,
        subject,
        grade,
        expiresAt
      ),
    ]);

    return jsonResponse(
      request,
      {
        packageId,
        inboxItemId: inboxId,
        status: "pending",
        intendedRecipientLabel: recipientLabel,
      },
      201
    );
  }

  // direction === "to-student"
  if (user.role !== "reviewer") {
    return errorResponse(request, "forbidden", "เฉพาะครู/ผู้ตรวจส่งผลกลับนักเรียนได้", 403);
  }

  if (!body.review || body.review.schema !== "paligo.exam.review.v1") {
    return errorResponse(request, "invalid_package", "ต้องมีผลตรวจ (paligo.exam.review.v1)", 400);
  }

  const studentUserId = await resolveStudentForBookReturn(env.DB, bookId, user.id);
  if (!studentUserId) {
    return errorResponse(
      request,
      "no_student",
      "ไม่พบนักเรียนที่ส่งสมุดนี้เข้ามา — ตรวจว่าจับคู่และเคยรับสมุดจาก inbox แล้ว",
      400
    );
  }

  const duplicate = await env.DB.prepare(
    `SELECT i.id FROM inbox_items i
     INNER JOIN packages p ON p.id = i.package_id
     WHERE i.status = 'pending' AND p.book_id = ?1 AND p.direction = 'to-student'
       AND p.from_user_id = ?2 AND i.to_user_id = ?3`
  )
    .bind(bookId, user.id, studentUserId)
    .first();

  if (duplicate) {
    return errorResponse(
      request,
      "duplicate_pending",
      "มีผลตรวจรอนักเรียนรับอยู่แล้วสำหรับสมุดนี้",
      409
    );
  }

  const student = await getUserById(env.DB, studentUserId);
  const payloadJson = JSON.stringify(body);
  const packageId = createId();
  const inboxId = createId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const recipientLabel = student?.displayName
    ? `นักเรียน ${student.displayName}`
    : "นักเรียน";

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO packages (
        id, schema, direction, book_id, book_revision, submission_id, answer_hash,
        payload_json, payload_bytes, from_user_id
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    ).bind(
      packageId,
      body.schema,
      direction,
      bookId,
      bookRevision,
      submissionId,
      answerHash,
      payloadJson,
      payloadJson.length,
      user.id
    ),
    env.DB.prepare(
      `INSERT INTO inbox_items (
        id, package_id, to_user_id, from_user_id, status,
        intended_recipient_label, book_title, subject, grade, expires_at
      ) VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7, ?8, ?9)`
    ).bind(
      inboxId,
      packageId,
      studentUserId,
      user.id,
      recipientLabel,
      bookTitle,
      subject,
      grade,
      expiresAt
    ),
  ]);

  return jsonResponse(
    request,
    {
      packageId,
      inboxItemId: inboxId,
      status: "pending",
      intendedRecipientLabel: recipientLabel,
    },
    201
  );
}
