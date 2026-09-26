import { NextResponse } from "next/server";
import {
  createSopGuideSessionToken,
  isSopGuideConfigured,
  SOP_GUIDE_COOKIE,
  verifySopGuideToken,
} from "@/lib/sop-guide-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_TTL_SEC = 12 * 60 * 60;

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

function attachSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SOP_GUIDE_COOKIE,
    value: createSopGuideSessionToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
  return response;
}

function buildSopRedirect(
  request: Request,
  w?: string | null,
  s?: string | null,
  invalid = false,
) {
  const url = new URL("/sop", request.url);
  if (w) url.searchParams.set("w", w);
  if (s) url.searchParams.set("s", s);
  if (invalid) url.searchParams.set("token", "invalid");
  return url;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = String(searchParams.get("token") || "");
  const w = searchParams.get("w");
  const s = searchParams.get("s");

  if (!isSopGuideConfigured() || !verifySopGuideToken(token)) {
    return NextResponse.redirect(buildSopRedirect(request, w, s, true));
  }

  return attachSessionCookie(
    NextResponse.redirect(buildSopRedirect(request, w, s)),
  );
}

export async function POST(request: Request) {
  if (!isSopGuideConfigured()) {
    return NextResponse.json(
      { ok: false, error: "คู่มือยังไม่เปิดใช้งาน" },
      { status: 503 },
    );
  }

  let token = "";
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      token?: string;
    } | null;
    token = String(body?.token || "");
  } else {
    const form = await request.formData().catch(() => null);
    token = String(form?.get("token") || "");
  }

  if (!verifySopGuideToken(token)) {
    return NextResponse.json(
      { ok: false, error: "โทเค็นไม่ถูกต้อง" },
      { status: 401 },
    );
  }

  return attachSessionCookie(NextResponse.json({ ok: true }));
}
