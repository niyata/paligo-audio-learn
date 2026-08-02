-- Paligo Inbox Phase 6 — account-backed chat rooms
-- Stores non-pairing inbox rooms so contacts/groups sync across browsers.

CREATE TABLE IF NOT EXISTS inbox_rooms (
  owner_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  room_type TEXT NOT NULL CHECK (room_type IN ('personal', 'group')),
  thread_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (owner_user_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_rooms_owner_updated ON inbox_rooms (owner_user_id, updated_at DESC);
