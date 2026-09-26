/**
 * Shared read-token gate for the /sop operations guide SPA.
 * Cookie is HMAC-signed with ADMIN_SESSION_SECRET (same family as ops_session).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  isSecretConfigured,
  timingSafeEqualString,
} from "@/lib/security";

export const SOP_GUIDE_COOKIE = "sop_guide";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const TOKEN_MIN_LENGTH = 16;

function sessionSecret(): string {
  return (process.env.ADMIN_SESSION_SECRET || "").trim();
}

export function getConfiguredSopGuideToken(): string {
  return (process.env.SOP_GUIDE_TOKEN || "").trim();
}

export function isSopGuideConfigured(): boolean {
  const token = getConfiguredSopGuideToken();
  if (token.length < TOKEN_MIN_LENGTH) return false;
  if (!isSecretConfigured(sessionSecret(), 32)) return false;
  return true;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
}

function signaturesMatch(sig: string, expected: string): boolean {
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function createSopGuideSessionToken(now = Date.now()): string {
  const exp = now + SESSION_TTL_MS;
  const payload = `v1.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySopGuideSessionToken(
  token: string | undefined | null,
  now = Date.now(),
): boolean {
  if (!token || !isSopGuideConfigured()) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expRaw, sig] = parts;
  if (version !== "v1" || !expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < now) return false;
  const payload = `${version}.${expRaw}`;
  return signaturesMatch(sig, sign(payload));
}

export function verifySopGuideToken(provided: string): boolean {
  if (!isSopGuideConfigured()) return false;
  const expected = getConfiguredSopGuideToken();
  return timingSafeEqualString(expected, provided.trim());
}

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function setSopGuideSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SOP_GUIDE_COOKIE, createSopGuideSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSopGuideSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SOP_GUIDE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export const hasSopGuideAccess = cache(async function hasSopGuideAccess(): Promise<boolean> {
  if (!isSopGuideConfigured()) return false;
  const jar = await cookies();
  return verifySopGuideSessionToken(jar.get(SOP_GUIDE_COOKIE)?.value);
});
