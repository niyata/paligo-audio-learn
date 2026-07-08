-- Paligo Inbox Phase 2 — packages + inbox_items (payload ใน D1 สำหรับ MVP local)

CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  schema TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('to-reviewer', 'to-student')),
  book_id TEXT NOT NULL,
  book_revision INTEGER,
  submission_id TEXT,
  answer_hash TEXT,
  payload_json TEXT NOT NULL,
  payload_bytes INTEGER NOT NULL,
  from_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_packages_book ON packages (book_id, book_revision);

CREATE TABLE IF NOT EXISTS inbox_items (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages (id) ON DELETE CASCADE,
  to_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  from_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled')),
  intended_recipient_label TEXT,
  book_title TEXT,
  subject TEXT,
  grade TEXT,
  expires_at TEXT NOT NULL,
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inbox_to_user ON inbox_items (to_user_id, status, created_at DESC);
