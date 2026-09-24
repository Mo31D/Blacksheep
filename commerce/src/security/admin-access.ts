import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
} from "jose";

export interface AdminAccessEnv {
  ADMIN_HOSTNAME?: string;
  ADMIN_TEAM_DOMAIN?: string;
  ADMIN_ACCESS_AUD?: string;
  ADMIN_ALLOWED_EMAILS?: string;
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

const jwksByDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function normalizedTeamDomain(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("admin_team_domain_must_be_https");
  return url.origin;
}

function allowedEmails(value?: string): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function verifyAdminAccess(
  request: Request,
  env: AdminAccessEnv,
): Promise<AdminAccessResult> {
  const url = new URL(request.url);
  if (!env.ADMIN_HOSTNAME || url.hostname !== env.ADMIN_HOSTNAME) {
    return { ok: false, status: 404, code: "admin_host_not_found" };
  }

  if (!env.ADMIN_TEAM_DOMAIN || !env.ADMIN_ACCESS_AUD) {
    return { ok: false, status: 503, code: "admin_access_not_configured" };
  }

  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) {
    return { ok: false, status: 403, code: "admin_access_token_missing" };
  }

  try {
    const teamDomain = normalizedTeamDomain(env.ADMIN_TEAM_DOMAIN);
    let jwks = jwksByDomain.get(teamDomain);
    if (!jwks) {
      jwks = createRemoteJWKSet(
        new URL(`${teamDomain}/cdn-cgi/access/certs`),
      );
      jwksByDomain.set(teamDomain, jwks);
    }

    const { payload } = await jwtVerify(token, jwks, {
      issuer: teamDomain,
      audience: env.ADMIN_ACCESS_AUD,
    });

    const email =
      typeof (payload as JWTPayload & { email?: unknown }).email === "string"
        ? String((payload as JWTPayload & { email: string }).email)
            .trim()
            .toLowerCase()
        : "";

    if (!email) {
      return { ok: false, status: 403, code: "admin_identity_missing" };
    }

    const allow = allowedEmails(env.ADMIN_ALLOWED_EMAILS);
    if (allow.size && !allow.has(email)) {
      return { ok: false, status: 403, code: "admin_identity_not_allowed" };
    }

    return {
      ok: true,
      status: 200,
      identity: {
        email,
        subject: typeof payload.sub === "string" ? payload.sub : null,
      },
    };
  } catch {
    return { ok: false, status: 403, code: "admin_access_token_invalid" };
  }
}
