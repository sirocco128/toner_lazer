/**
 * Google Sign-In for the ops console.
 * Staff-only: verified Google emails must already exist in ops_staff or env seeds.
 */

import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  isSecretConfigured,
  timingSafeEqualString,
} from "@/lib/security";
import { isOpsAuthConfigured } from "@/lib/ops-auth";

export type { GoogleOAuthError } from "@/lib/ops-google-errors";
export {
  GOOGLE_LOGIN_ERROR_MESSAGES,
  isGoogleLoginError,
} from "@/lib/ops-google-errors";

export const GOOGLE_OAUTH_COOKIE = "ops_google_oauth";
export const GOOGLE_OAUTH_TTL_MS = 10 * 60 * 1000;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URLS = [
  "https://www.googleapis.com/oauth2/v3/userinfo",
  "https://openidconnect.googleapis.com/userinfo",
] as const;

function sessionSecret(): string {
  return (process.env.ADMIN_SESSION_SECRET || "").trim();
}

function googleClientId(): string {
  return (process.env.GOOGLE_CLIENT_ID || "").trim();
}

function googleClientSecret(): string {
  return (process.env.GOOGLE_CLIENT_SECRET || "").trim();
}

export function googleHostedDomain(): string {
  return (process.env.GOOGLE_HOSTED_DOMAIN || "").trim().toLowerCase();
}

export function siteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
    .trim()
    .replace(/\/+$/, "");
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") return raw;
  } catch {
    /* fall through */
  }
  return "http://localhost:3000";
}

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/** Docker / Node bind-all hosts are not valid browser origins. */
export function isBindAllHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "0.0.0.0" || host === "::";
}

function originPort(url: URL): string {
  return url.port || (url.protocol === "https:" ? "443" : "80");
}

function headerValue(
  headers: Headers | Record<string, string | null | undefined> | undefined,
  name: string,
): string {
  if (!headers) return "";
  if (headers instanceof Headers) return (headers.get(name) || "").trim();
  const direct = headers[name] ?? headers[name.toLowerCase()];
  return String(direct || "").trim();
}

/**
 * Host that must own the PKCE cookie. Prefer reverse-proxy hosts, collapse
 * loopback aliases to NEXT_PUBLIC_SITE_URL, and never publish 0.0.0.0.
 */
export function googleOAuthCookieOrigin(
  requestUrl: string,
  headers?: Headers | Record<string, string | null | undefined>,
): string {
  const site = siteOrigin();
  const forwardedHost = headerValue(headers, "x-forwarded-host").split(",")[0]?.trim() || "";
  if (forwardedHost) {
    const forwardedProto = headerValue(headers, "x-forwarded-proto").split(",")[0]?.trim() || "";
    const proto =
      forwardedProto === "http" || forwardedProto === "https"
        ? forwardedProto
        : new URL(site).protocol.replace(":", "");
    try {
      return new URL(`${proto}://${forwardedHost}`).origin;
    } catch {
      /* fall through */
    }
  }

  try {
    const req = new URL(requestUrl);
    const preferred = new URL(site);
    if (isBindAllHostname(req.hostname)) {
      return preferred.origin;
    }
    if (
      isLoopbackHostname(req.hostname) &&
      isLoopbackHostname(preferred.hostname) &&
      originPort(req) === originPort(preferred) &&
      req.protocol === preferred.protocol
    ) {
      return preferred.origin;
    }
    return req.origin;
  } catch {
    return site;
  }
}

export function googleAuthRedirectUri(
  requestUrl?: string,
  headers?: Headers | Record<string, string | null | undefined>,
): string {
  const origin = requestUrl
    ? googleOAuthCookieOrigin(requestUrl, headers)
    : siteOrigin();
  return `${origin}/api/ops/auth/google/callback`;
}

export function isOpsGoogleAuthConfigured(): boolean {
  if (!isOpsAuthConfigured()) return false;
  const id = googleClientId();
  const secret = googleClientSecret();
  if (!id.endsWith(".apps.googleusercontent.com")) return false;
  return isSecretConfigured(secret, 16);
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

type PendingOAuth = {
  v: 1 | 2;
  state: string;
  verifier: string;
  exp: number;
  redirectUri?: string;
};

export function createGoogleOAuthPending(
  now = Date.now(),
  redirectUri = googleAuthRedirectUri(),
): { state: string; verifier: string; cookieValue: string; redirectUri: string } {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const body: PendingOAuth = {
    v: 2,
    state,
    verifier,
    exp: now + GOOGLE_OAUTH_TTL_MS,
    redirectUri,
  };
  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const payload = `g1.${encoded}`;
  return {
    state,
    verifier,
    redirectUri,
    cookieValue: `${payload}.${sign(payload)}`,
  };
}

export function parseGoogleOAuthPending(
  token: string | undefined | null,
  now = Date.now(),
): PendingOAuth | null {
  if (!token || !isOpsAuthConfigured()) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 1) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload.startsWith("g1.") || !sig) return null;
  if (!timingSafeEqualString(sign(payload), sig)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload.slice(3), "base64url").toString("utf8"),
    ) as PendingOAuth;
    if (
      (parsed.v !== 1 && parsed.v !== 2) ||
      !Number.isFinite(parsed.exp) ||
      parsed.exp < now
    ) {
      return null;
    }
    if (!parsed.state || !parsed.verifier) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildGoogleAuthorizeUrl(
  state: string,
  verifier: string,
  redirectUri = googleAuthRedirectUri(),
): string {
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  const hd = googleHostedDomain();
  if (hd) params.set("hd", hd);
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleIdentity = {
  email: string;
  emailVerified: boolean;
  name: string;
  sub: string;
};

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
};

type UserInfoResponse = {
  iss?: string;
  aud?: unknown;
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
};

type ExchangeResult =
  | { ok: true; identity: GoogleIdentity }
  | { ok: false; reason: "token" | "userinfo" | "unverified" | "no_email" };

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function audienceMatches(aud: unknown, clientId: string): boolean {
  if (typeof aud === "string") return aud === clientId;
  if (Array.isArray(aud)) return aud.some((item) => item === clientId);
  return false;
}

function identityFromClaims(
  profile: UserInfoResponse,
  options: { requireAudience?: boolean } = {},
): ExchangeResult {
  if (options.requireAudience && !audienceMatches(profile.aud, googleClientId())) {
    return { ok: false, reason: "userinfo" };
  }
  const iss = String(profile.iss || "");
  if (
    options.requireAudience &&
    iss &&
    iss !== "https://accounts.google.com" &&
    iss !== "accounts.google.com"
  ) {
    return { ok: false, reason: "userinfo" };
  }
  const exp = Number(profile.exp);
  if (Number.isFinite(exp) && exp * 1000 < Date.now() - 60_000) {
    return { ok: false, reason: "userinfo" };
  }
  const email = String(profile.email || "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) return { ok: false, reason: "no_email" };
  if (!asBoolean(profile.email_verified)) {
    return { ok: false, reason: "unverified" };
  }
  return {
    ok: true,
    identity: {
      email,
      emailVerified: true,
      name: String(profile.name || "").trim(),
      sub: String(profile.sub || "").trim(),
    },
  };
}

function identityFromIdToken(idToken: string): ExchangeResult | null {
  const parts = idToken.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as UserInfoResponse;
    return identityFromClaims(parsed, { requireAudience: true });
  } catch {
    return null;
  }
}

async function identityFromUserinfo(
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<ExchangeResult> {
  let last: ExchangeResult = { ok: false, reason: "userinfo" };
  for (const url of GOOGLE_USERINFO_URLS) {
    try {
      const userRes = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      });
      const profile = (await userRes.json()) as UserInfoResponse;
      if (!userRes.ok) {
        last = { ok: false, reason: "userinfo" };
        continue;
      }
      const parsed = identityFromClaims(profile);
      if (parsed.ok || parsed.reason !== "userinfo") return parsed;
      last = parsed;
    } catch {
      last = { ok: false, reason: "userinfo" };
    }
  }
  return last;
}

export async function exchangeGoogleAuthorizationCode(
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
  redirectUri = googleAuthRedirectUri(),
): Promise<ExchangeResult> {
  const body = new URLSearchParams({
    code,
    client_id: googleClientId(),
    client_secret: googleClientSecret(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });

  let tokenJson: TokenResponse;
  try {
    const tokenRes = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    tokenJson = (await tokenRes.json()) as TokenResponse;
    if (!tokenRes.ok || (!tokenJson.access_token && !tokenJson.id_token)) {
      return { ok: false, reason: "token" };
    }
  } catch {
    return { ok: false, reason: "token" };
  }

  if (tokenJson.id_token) {
    const fromIdToken = identityFromIdToken(tokenJson.id_token);
    if (fromIdToken?.ok) return fromIdToken;
    if (fromIdToken?.reason === "unverified") return fromIdToken;
  }

  if (!tokenJson.access_token) return { ok: false, reason: "userinfo" };
  return identityFromUserinfo(tokenJson.access_token, fetchImpl);
}
