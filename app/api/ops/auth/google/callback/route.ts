import { NextRequest, NextResponse } from "next/server";
import { writeOpsAudit } from "@/lib/ops-audit";
import {
  authenticateOpsGoogleEmail,
  createOpsSessionToken,
  isOpsAuthConfigured,
  OPS_COOKIE,
} from "@/lib/ops-auth";
import {
  GOOGLE_OAUTH_COOKIE,
  exchangeGoogleAuthorizationCode,
  googleOAuthCookieOrigin,
  isOpsGoogleAuthConfigured,
  parseGoogleOAuthPending,
  type GoogleOAuthError,
} from "@/lib/ops-google-auth";
import { opsAuditContextFromHeaders } from "@/lib/ops-request-context";
import { timingSafeEqualString } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_TTL_SECONDS = 12 * 60 * 60;

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

function publicOrigin(request: NextRequest): string {
  return googleOAuthCookieOrigin(request.url, request.headers);
}

function loginRedirect(request: NextRequest, error: GoogleOAuthError) {
  const url = new URL("/ops/login", publicOrigin(request));
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  response.cookies.set({
    name: GOOGLE_OAUTH_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const ctx = opsAuditContextFromHeaders(request.headers);
  const params = request.nextUrl.searchParams;
  const oauthError = params.get("error");

  if (oauthError === "access_denied") {
    writeOpsAudit({
      action: "login",
      status: "denied",
      detail: { method: "google" },
      ...ctx,
      errorMessage: "google access denied",
    });
    return loginRedirect(request, "google_denied");
  }
  if (oauthError) {
    writeOpsAudit({
      action: "login",
      status: "denied",
      detail: { method: "google", oauthError },
      ...ctx,
      errorMessage: "google oauth error",
    });
    return loginRedirect(request, "google_failed");
  }

  if (!isOpsAuthConfigured() || !isOpsGoogleAuthConfigured()) {
    return loginRedirect(request, "google_not_configured");
  }

  const code = params.get("code") || "";
  const state = params.get("state") || "";
  const pendingCookie = request.cookies.get(GOOGLE_OAUTH_COOKIE)?.value;
  const pending = parseGoogleOAuthPending(pendingCookie);
  if (!code || !state || !pending || !timingSafeEqualString(pending.state, state)) {
    writeOpsAudit({
      action: "login",
      status: "denied",
      detail: {
        method: "google",
        hasCode: Boolean(code),
        hasState: Boolean(state),
        hasCookie: Boolean(pendingCookie),
      },
      ...ctx,
      errorMessage: "invalid google oauth state",
    });
    return loginRedirect(request, "google_invalid");
  }

  const exchanged = await exchangeGoogleAuthorizationCode(
    code,
    pending.verifier,
    fetch,
    pending.redirectUri,
  );
  if (!exchanged.ok) {
    const error: GoogleOAuthError =
      exchanged.reason === "unverified" ? "google_unverified" : "google_failed";
    writeOpsAudit({
      action: "login",
      status: "denied",
      detail: { method: "google", reason: exchanged.reason },
      ...ctx,
      errorMessage: exchanged.reason,
    });
    return loginRedirect(request, error);
  }

  const actor = authenticateOpsGoogleEmail(exchanged.identity.email);
  if (!actor) {
    writeOpsAudit({
      action: "login",
      status: "denied",
      detail: { method: "google", email: exchanged.identity.email },
      ...ctx,
      errorMessage: "google email is not ops staff",
    });
    return loginRedirect(request, "google_not_staff");
  }

  const homeUrl = new URL("/ops", publicOrigin(request));
  const response = NextResponse.redirect(homeUrl);
  response.cookies.set({
    name: OPS_COOKIE,
    value: createOpsSessionToken(Date.now(), actor),
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  response.cookies.set({
    name: GOOGLE_OAUTH_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
  writeOpsAudit({
    actor,
    action: "login",
    status: "ok",
    detail: { method: "google" },
    ...ctx,
  });
  return response;
}
