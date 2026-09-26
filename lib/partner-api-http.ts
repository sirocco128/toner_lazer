import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/quote-repository";
import { hashIp, resolveClientIp } from "@/lib/quote-service";
import {
  isPartnerApiConfigured,
  touchPartnerKeyLastUsed,
  verifyDbPartnerToken,
  verifyEnvPartnerToken,
} from "@/lib/partner-api-keys";
import type { PartnerPrincipal, PartnerScope } from "@/lib/partner-api-types";

export const PARTNER_API_VERSION = "v1";

function readIntEnv(key: string, fallback: number): number {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function extractBearer(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || null;
}

function allowPartnerRate(principal: PartnerPrincipal, request: Request): boolean {
  try {
    const ip = resolveClientIp(request.headers);
    const ipHash = hashIp(`partner:${principal.keyId}:${ip}`);
    const windowMinutes = readIntEnv("QUOTE_RATE_LIMIT_WINDOW_MINUTES", 15);
    const maxAttempts = readIntEnv("PARTNER_API_RATE_LIMIT_MAX", 120);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bucketStart = nowSeconds - (nowSeconds % (windowMinutes * 60));
    return consumeRateLimit({
      keyHash: ipHash,
      bucketStart,
      maxAttempts,
      nowSeconds,
    });
  } catch {
    return true;
  }
}

export function partnerError(
  status: number,
  error: string,
): NextResponse<{ ok: false; error: string }> {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export type PartnerAuthOk = { ok: true; principal: PartnerPrincipal };
export type PartnerAuthFail = {
  ok: false;
  response: NextResponse<{ ok: false; error: string }>;
};

export function authenticatePartner(
  request: Request,
): PartnerAuthOk | PartnerAuthFail {
  if (!isPartnerApiConfigured()) {
    return { ok: false, response: partnerError(503, "not configured") };
  }

  const token = extractBearer(request.headers.get("authorization"));
  if (!token) {
    return { ok: false, response: partnerError(401, "unauthorized") };
  }

  const principal = verifyEnvPartnerToken(token) ?? verifyDbPartnerToken(token);
  if (!principal) {
    return { ok: false, response: partnerError(401, "unauthorized") };
  }
  if (!allowPartnerRate(principal, request)) {
    return { ok: false, response: partnerError(429, "rate limited") };
  }
  touchPartnerKeyLastUsed(principal.keyId);
  return { ok: true, principal };
}

export function requirePartnerScope(
  request: Request,
  scope: PartnerScope,
): PartnerAuthOk | PartnerAuthFail {
  const auth = authenticatePartner(request);
  if (!auth.ok) return auth;
  if (!auth.principal.scopes.includes(scope)) {
    return { ok: false, response: partnerError(403, "forbidden") };
  }
  return auth;
}

export function partnerJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
