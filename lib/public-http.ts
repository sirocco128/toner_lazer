import { NextResponse } from "next/server";
import { publicCorsHeaders } from "@/lib/public-cors";
import { allowPublicLookup } from "@/lib/public-api-limit";

export function publicJson(
  request: Request,
  body: unknown,
  status = 200,
  methods = "GET, OPTIONS",
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...publicCorsHeaders(request, methods),
    },
  });
}

export function publicError(
  request: Request,
  status: number,
  error: string,
  extra?: Record<string, unknown>,
  methods = "GET, OPTIONS",
): NextResponse {
  return publicJson(
    request,
    { ok: false, error, ...extra },
    status,
    methods,
  );
}

export function requirePublicCatalogRate(
  request: Request,
): NextResponse | null {
  if (!allowPublicLookup(request, "public-catalog")) {
    return publicError(request, 429, "rate limited");
  }
  return null;
}

export function requirePublicBriefRate(request: Request): NextResponse | null {
  if (!allowPublicLookup(request, "public-brief")) {
    return publicError(request, 429, "rate limited", undefined, "POST, OPTIONS");
  }
  return null;
}
