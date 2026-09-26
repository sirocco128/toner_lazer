import { NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_TTL_MS,
  buildGoogleAuthorizeUrl,
  createGoogleOAuthPending,
  googleAuthRedirectUri,
  googleOAuthCookieOrigin,
  isLoopbackHostname,
  isOpsGoogleAuthConfigured,
} from "@/lib/ops-google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function GET(request: Request) {
  const publicOrigin = googleOAuthCookieOrigin(request.url, request.headers);
  if (!isOpsGoogleAuthConfigured()) {
    const loginUrl = new URL("/ops/login", publicOrigin);
    loginUrl.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(loginUrl);
  }

  // Collapse localhost ↔ 127.0.0.1 onto NEXT_PUBLIC_SITE_URL before setting the cookie.
  try {
    const requestHost = new URL(request.url).hostname;
    const preferredHost = new URL(publicOrigin).hostname;
    if (
      isLoopbackHostname(requestHost) &&
      isLoopbackHostname(preferredHost) &&
      new URL(request.url).origin !== publicOrigin
    ) {
      return NextResponse.redirect(new URL("/api/ops/auth/google", publicOrigin));
    }
  } catch {
    /* continue with public origin */
  }

  const redirectUri = googleAuthRedirectUri(request.url, request.headers);
  const pending = createGoogleOAuthPending(Date.now(), redirectUri);
  const response = NextResponse.redirect(
    buildGoogleAuthorizeUrl(pending.state, pending.verifier, redirectUri),
  );
  response.cookies.set({
    name: GOOGLE_OAUTH_COOKIE,
    value: pending.cookieValue,
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: GOOGLE_OAUTH_TTL_MS / 1000,
  });
  return response;
}
