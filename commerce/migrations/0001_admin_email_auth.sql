CREATE TABLE admin_login_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_admin_login_codes_email_created
  ON admin_login_codes(email, created_at DESC);

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_admin_sessions_expires
  ON admin_sessions(expires_at);
