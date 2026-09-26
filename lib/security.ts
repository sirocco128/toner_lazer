import { timingSafeEqual } from "node:crypto";

/** Max body size for CMS revalidate webhook (runbook §31 / route guard). */
export const REVALIDATE_MAX_PAYLOAD_BYTES = 65_536;

/**
 * Compare two secrets in constant time.
 * Returns false when lengths differ (after encoding).
 */
export function timingSafeEqualString(
  expected: string,
  provided: string,
): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Validate Authorization: Bearer <token> against a configured secret.
 * Fails closed when the configured secret is empty.
 */
export function verifyBearerToken(
  authorizationHeader: string | null,
  secret: string,
): boolean {
  if (!authorizationHeader || !secret) return false;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match?.[1]) return false;
  return timingSafeEqualString(secret, match[1].trim());
}

export function isSecretConfigured(
  secret: string | undefined | null,
  minLength = 32,
): boolean {
  const value = (secret ?? "").trim();
  if (value.length < minLength) return false;
  const lowered = value.toLowerCase();
  if (
    lowered.includes("replace-with") ||
    lowered.includes("changeme") ||
    lowered.includes("placeholder")
  ) {
    return false;
  }
  return true;
}

/** UTF-8 byte-length payload guard for revalidate (and similar) routes. */
export function isUtf8PayloadTooLarge(
  raw: string,
  maxBytes = REVALIDATE_MAX_PAYLOAD_BYTES,
): boolean {
  return new TextEncoder().encode(raw).length > maxBytes;
}
