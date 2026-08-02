/**
 * Inbox room roster — account-backed contacts/groups beyond pairing.
 */

import { requireUser } from "./auth.js";
import { errorResponse, jsonResponse, parseJsonBody } from "./http.js";
import { assertInboxOperational } from "./platform.js";

const MAX_ROOMS = 80;
const MAX_PAYLOAD_BYTES = 16000;

function stableString(value) {
  return String(value || "").trim();
}

function normalizeRoom(source) {
  if (!source || typeof source !== "object") return null;
  const payload = source.payload && typeof source.payload === "object" ? source.payload : source;
  const type = stableString(source.type || source.roomType || payload.type);
  if (type !== "personal" && type !== "group") return null;

  const id = stableString(source.id || source.roomId || payload.id);
  const threadId = stableString(source.threadId || source.thread_id || payload.threadId);
  const name = stableString(source.name || source.displayName || payload.name);
  if (!id || !threadId || !name) return null;

  const now = new Date().toISOString();
  const cleaned = {
    ...payload,
    id,
    type,
    threadId,
    name,
    updatedAt: stableString(payload.updatedAt || source.updatedAt) || now,
    createdAt: stableString(payload.createdAt || source.createdAt) || now,
  };
  const payloadJson = JSON.stringify(cleaned);
  if (new TextEncoder().encode(payloadJson).length > MAX_PAYLOAD_BYTES) return null;

  return {
    id,
    type,
    threadId,
    name,
    payload: cleaned,
    payloadJson,
    updatedAt: cleaned.updatedAt,
  };
}

function mapRoom(row) {
  let payload = null;
  try {
    payload = JSON.parse(row.payload_json);
  } catch {
    payload = null;
  }

  return {
    id: row.room_id,
    type: row.room_type,
    threadId: row.thread_id,
    name: row.display_name,
    payload: payload || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function handleGetInboxRooms(request, env) {
  const user = await requireUser(request, env);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }

  const blocked = await assertInboxOperational(request, env, user);
  if (blocked) return blocked;

  const result = await env.DB.prepare(
    `SELECT room_id, room_type, thread_id, display_name, payload_json, created_at, updated_at
     FROM inbox_rooms
     WHERE owner_user_id = ?1
     ORDER BY updated_at DESC`
  )
    .bind(user.id)
    .all();

  return jsonResponse(request, {
    rooms: (result.results || []).map(mapRoom),
  });
}

export async function handleSyncInboxRooms(request, env) {
  const user = await requireUser(request, env);
  if (!user) {
    return errorResponse(request, "not_authenticated", "ยังไม่ได้เข้าสู่ระบบ", 401);
  }

  const blocked = await assertInboxOperational(request, env, user);
  if (blocked) return blocked;

  const body = await parseJsonBody(request);
  if (body == null) {
    return errorResponse(request, "invalid_json", "JSON ไม่ถูกต้อง", 400);
  }

  const incoming = Array.isArray(body.rooms) ? body.rooms : [];
  if (incoming.length > MAX_ROOMS) {
    return errorResponse(request, "too_many_rooms", `sync ได้ไม่เกิน ${MAX_ROOMS} ห้อง`, 400);
  }

  const rooms = incoming.map(normalizeRoom);
  if (rooms.some((room) => !room)) {
    return errorResponse(request, "invalid_rooms", "ข้อมูลห้องสนทนา sync ไม่ถูกต้อง", 400);
  }
  const seen = new Set();
  const uniqueRooms = rooms.filter((room) => {
    const key = `${room.type}:${room.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const existing = await env.DB.prepare(`SELECT room_id FROM inbox_rooms WHERE owner_user_id = ?1`)
    .bind(user.id)
    .all();
  const nextIds = new Set(uniqueRooms.map((room) => room.id));
  const staleIds = (existing.results || []).map((row) => row.room_id).filter((id) => !nextIds.has(id));

  const statements = uniqueRooms.map((room) =>
    env.DB.prepare(
      `INSERT INTO inbox_rooms (
         owner_user_id, room_id, room_type, thread_id, display_name, payload_json, updated_at
       )
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(owner_user_id, room_id) DO UPDATE SET
         room_type = excluded.room_type,
         thread_id = excluded.thread_id,
         display_name = excluded.display_name,
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`
    ).bind(user.id, room.id, room.type, room.threadId, room.name, room.payloadJson, room.updatedAt)
  );

  staleIds.forEach((roomId) => {
    statements.push(
      env.DB.prepare(`DELETE FROM inbox_rooms WHERE owner_user_id = ?1 AND room_id = ?2`).bind(user.id, roomId)
    );
  });

  if (statements.length) await env.DB.batch(statements);

  return jsonResponse(request, {
    rooms: uniqueRooms.map((room) => ({
      id: room.id,
      type: room.type,
      threadId: room.threadId,
      name: room.name,
      payload: room.payload,
      updatedAt: room.updatedAt,
    })),
  });
}
