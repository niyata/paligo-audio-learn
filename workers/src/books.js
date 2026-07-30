/**
 * Exam book library — server source of truth for a user's workbook list.
 */

import { requireUser } from "./auth.js";
import { errorResponse, jsonResponse, parseJsonBody } from "./http.js";

const MAX_BOOKS_PER_SYNC = 100;
const MAX_BOOK_BYTES = 512 * 1024;

function normalizeBookPayload(book, user) {
  if (!book || typeof book !== "object" || Array.isArray(book)) return null;
  const id = String(book.id || book.bookId || "").trim();
  if (!id) return null;

  const now = new Date().toISOString();
  const payload = {
    ...book,
    id,
    ownerUserId: book.ownerUserId || user.id,
    syncStatus: "synced",
    serverSyncedAt: now,
  };
  const clientUpdatedAt =
    String(book.updatedAt || book.draft?.savedAt || book.createdAt || "").trim() || now;
  const status = String(book.status || "draft").trim() || "draft";
  const json = JSON.stringify(payload);
  if (json.length > MAX_BOOK_BYTES) {
    const error = new Error("book_too_large");
    error.status = 413;
    throw error;
  }
  return { id, payload, json, clientUpdatedAt, status };
}

function parseBookRow(row) {
  try {
    const book = JSON.parse(row.payload_json);
    return {
      ...book,
      id: row.id,
      syncStatus: "synced",
      serverSyncedAt: row.server_updated_at,
    };
  } catch {
    return null;
  }
}

export async function handleGetBooks(request, env) {
  const user = await requireUser(request, env);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }

  const rows = await env.DB.prepare(
    `SELECT id, payload_json, server_updated_at
     FROM exam_books
     WHERE user_id = ?1 AND deleted_at IS NULL
     ORDER BY COALESCE(client_updated_at, server_updated_at) DESC, server_updated_at DESC`
  )
    .bind(user.id)
    .all();

  const books = (rows.results || []).map(parseBookRow).filter(Boolean);
  return jsonResponse(request, {
    ok: true,
    books,
    source: "server",
    serverTime: new Date().toISOString(),
  });
}
export async function handleSyncBooks(request, env) {
  const user = await requireUser(request, env);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }

  const body = await parseJsonBody(request);
  if (body == null) {
    return errorResponse(request, "invalid_json", "JSON ไม่ถูกต้อง", 400);
  }

  const inputBooks = Array.isArray(body.books) ? body.books : body.book ? [body.book] : [];
  if (inputBooks.length > MAX_BOOKS_PER_SYNC) {
    return errorResponse(request, "too_many_books", "ส่งสมุดต่อครั้งมากเกินไป", 413);
  }

  let normalized;
  try {
    normalized = inputBooks.map((book) => normalizeBookPayload(book, user)).filter(Boolean);
  } catch (error) {
    if (error.message === "book_too_large") {
      return errorResponse(request, "book_too_large", "ข้อมูลสมุดใหญ่เกินไป", error.status || 413);
    }
    throw error;
  }

  if (!normalized.length) {
    return errorResponse(request, "invalid_books", "ไม่มีสมุดที่บันทึกได้", 400);
  }

  const now = new Date().toISOString();
  await env.DB.batch(
    normalized.map((book) =>
      env.DB.prepare(
        `INSERT INTO exam_books (
          id, user_id, payload_json, payload_bytes, status, client_updated_at, server_updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(id, user_id) DO UPDATE SET
          payload_json = excluded.payload_json,
          payload_bytes = excluded.payload_bytes,
          status = excluded.status,
          client_updated_at = excluded.client_updated_at,
          server_updated_at = excluded.server_updated_at,
          deleted_at = NULL`
      ).bind(
        book.id,
        user.id,
        book.json,
        book.json.length,
        book.status,
        book.clientUpdatedAt,
        now
      )
    )
  );

  return jsonResponse(request, {
    ok: true,
    synced: normalized.map((book) => book.id),
    serverTime: now,
  });
}
