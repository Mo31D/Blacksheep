import type { D1DatabaseLike } from "../data/d1";
import { resolveEmailSender, type EmailProviderEnv } from "../notifications/email-provider";

export interface AdminAccessEnv extends EmailProviderEnv {
  DB?: D1DatabaseLike;
  ORDER_EMAIL_FROM?: string;
  ORDER_OWNER_EMAIL?: string;
}

export interface AdminIdentity {
  email: string;
  subject: string | null;
}

export interface AdminAccessResult {
  ok: boolean;
  status: number;
  identity?: AdminIdentity;
  code?: string;
}

const SESSION_COOKIE = "bs_admin_session";
const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

function normalizeEmail(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function cookieValue(request: Request, name: string): string | null {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomId(): string {
  return base64Url(randomBytes(18));
}

function randomSessionToken(): string {
  return base64Url(randomBytes(32));
}

function randomSixDigitCode(): string {
  const bytes = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0] >= limit);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function adminSessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

export function clearAdminSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function requestAdminLoginCode(
  env: AdminAccessEnv,
): Promise<{ ok: boolean; status: number; code?: string }> {
  if (!env.DB) return { ok: false, status: 503, code: "database_unavailable" };

  const email = normalizeEmail(env.ORDER_OWNER_EMAIL);
  if (!email || !env.ORDER_EMAIL_FROM) {
    return { ok: false, status: 503, code: "admin_email_not_configured" };
  }

  const resolved = resolveEmailSender(env);
  if (!resolved) {
    return { ok: false, status: 503, code: "email_provider_unavailable" };
  }

  const latest = await env.DB
    .prepare(
      `SELECT created_at AS createdAt
       FROM admin_login_codes
       WHERE email = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(email)
    .first<{ createdAt: string }>();

  if (
    latest?.createdAt &&
    Date.now() - new Date(latest.createdAt).getTime() < REQUEST_COOLDOWN_MS
  ) {
    return { ok: true, status: 204 };
  }

  const id = randomId();
  const code = randomSixDigitCode();
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  const codeHash = await sha256(`${id}:${email}:${code}`);

  await env.DB.batch([
    env.DB
      .prepare(
        `UPDATE admin_login_codes
         SET consumed_at = ?
         WHERE email = ? AND consumed_at IS NULL`,
      )
      .bind(createdAt, email),
    env.DB
      .prepare(
        `INSERT INTO admin_login_codes (
          id, email, code_hash, expires_at, attempts, consumed_at, created_at
        ) VALUES (?, ?, ?, ?, 0, NULL, ?)`,
      )
      .bind(id, email, codeHash, expiresAt, createdAt),
  ]);

  try {
    await resolved.sender.send({
      from: { email: env.ORDER_EMAIL_FROM, name: "The Black Sheep Shop" },
      to: email,
      subject: `Black Sheep admin login code: ${code}`,
      text: `Your Black Sheep admin login code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your Black Sheep admin login code is <strong style="font-size:24px;letter-spacing:4px">${code}</strong>.</p><p>It expires in 10 minutes. If you did not request this code, ignore this email.</p>`,
    });
  } catch {
    await env.DB
      .prepare(
        `UPDATE admin_login_codes
         SET consumed_at = ?
         WHERE id = ?`,
      )
      .bind(new Date().toISOString(), id)
      .run();
    return { ok: false, status: 503, code: "admin_code_email_failed" };
  }

  return { ok: true, status: 204 };
}

export async function verifyAdminLoginCode(
  code: string,
  env: AdminAccessEnv,
): Promise<
  | { ok: true; status: 200; token: string; identity: AdminIdentity }
  | { ok: false; status: number; code: string }
> {
  if (!env.DB) {
    return { ok: false, status: 503, code: "database_unavailable" };
  }

  const email = normalizeEmail(env.ORDER_OWNER_EMAIL);
  if (!email || !/^\d{6}$/.test(code)) {
    return { ok: false, status: 401, code: "admin_code_invalid" };
  }

  const row = await env.DB
    .prepare(
      `SELECT
         id,
         code_hash AS codeHash,
         expires_at AS expiresAt,
         attempts
       FROM admin_login_codes
       WHERE email = ? AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(email)
    .first<{
      id: string;
      codeHash: string;
      expiresAt: string;
      attempts: number;
    }>();

  if (!row) return { ok: false, status: 401, code: "admin_code_invalid" };

  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    await env.DB
      .prepare("UPDATE admin_login_codes SET consumed_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), row.id)
      .run();
    return { ok: false, status: 401, code: "admin_code_expired" };
  }

  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, status: 429, code: "admin_code_locked" };
  }

  const candidate = await sha256(`${row.id}:${email}:${code}`);
  if (!constantTimeEqual(candidate, row.codeHash)) {
    await env.DB
      .prepare("UPDATE admin_login_codes SET attempts = attempts + 1 WHERE id = ?")
      .bind(row.id)
      .run();
    return { ok: false, status: 401, code: "admin_code_invalid" };
  }

  const now = new Date();
  const token = randomSessionToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  await env.DB.batch([
    env.DB
      .prepare("UPDATE admin_login_codes SET consumed_at = ? WHERE id = ?")
      .bind(now.toISOString(), row.id),
    env.DB
      .prepare(
        `INSERT INTO admin_sessions (
          token_hash, email, expires_at, created_at
        ) VALUES (?, ?, ?, ?)`,
      )
      .bind(tokenHash, email, expiresAt, now.toISOString()),
  ]);

  return {
    ok: true,
    status: 200,
    token,
    identity: { email, subject: null },
  };
}

export async function revokeAdminSession(
  request: Request,
  env: AdminAccessEnv,
): Promise<void> {
  if (!env.DB) return;
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return;
  const tokenHash = await sha256(token);
  await env.DB
    .prepare("DELETE FROM admin_sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .run();
}

export async function verifyAdminAccess(
  request: Request,
  env: AdminAccessEnv,
): Promise<AdminAccessResult> {
  if (!env.DB) {
    return { ok: false, status: 503, code: "database_unavailable" };
  }

  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) {
    return { ok: false, status: 401, code: "admin_session_missing" };
  }

  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const session = await env.DB
    .prepare(
      `SELECT email, expires_at AS expiresAt
       FROM admin_sessions
       WHERE token_hash = ? AND expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, now)
    .first<{ email: string; expiresAt: string }>();

  if (!session) {
    return { ok: false, status: 401, code: "admin_session_invalid" };
  }

  const ownerEmail = normalizeEmail(env.ORDER_OWNER_EMAIL);
  if (!ownerEmail || normalizeEmail(session.email) !== ownerEmail) {
    return { ok: false, status: 403, code: "admin_identity_not_allowed" };
  }

  return {
    ok: true,
    status: 200,
    identity: {
      email: ownerEmail,
      subject: null,
    },
  };
}
