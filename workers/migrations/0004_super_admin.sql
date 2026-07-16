-- Super admin + platform feature flags
ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES users (id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO platform_settings (key, value_json)
VALUES (
  'platform_flags',
  '{"importExportEnabled":false,"inboxEnabled":true,"lineWebhookEnabled":false,"lineMessagingEnabled":false,"lineNotifyQueueEnabled":false,"notificationsEnabled":true,"crawlerIndexingAllowed":false,"maintenanceMode":false,"debugApiLogs":false}'
);

UPDATE users SET is_super_admin = 1
WHERE lower(email) IN ('tha.std@paligo.jp', '1.tha.tc@paligo.jp');
