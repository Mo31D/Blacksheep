CREATE TABLE IF NOT EXISTS admin_password_security (
  id TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO admin_password_security (id, failed_attempts, locked_until, updated_at)
VALUES ('owner', 0, NULL, CURRENT_TIMESTAMP);
