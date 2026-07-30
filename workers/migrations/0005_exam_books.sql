-- Paligo exam books — online-first user book library

CREATE TABLE IF NOT EXISTS exam_books (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  payload_bytes INTEGER NOT NULL,
  status TEXT,
  client_updated_at TEXT,
  server_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  PRIMARY KEY (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_books_user_updated
  ON exam_books (user_id, deleted_at, server_updated_at DESC);
