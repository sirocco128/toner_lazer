/**
 * Strapi URLs for the ops console (browser) and server-side CMS fetch.
 * STRAPI_URL is often Docker-internal (host.docker.internal) — not clickable.
 * Node fetch to `localhost` can hang on IPv6 (::1) while Strapi listens on IPv4.
 */

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function withAdminPath(value: string): string {
  const trimmed = stripSlash(value);
  if (/\/admin$/i.test(trimmed)) return trimmed;
  return `${trimmed}/admin`;
}

function parseOrigin(raw: string): URL | null {
  try {
    return new URL(stripSlash(raw.trim().replace(/\/admin$/i, "")));
  } catch {
    return null;
  }
}

function configuredStrapiOrigin(): string {
  return stripSlash(process.env.STRAPI_URL || "http://localhost:1337");
}

/** Server fetch origin — force IPv4 loopback so Node does not wait on ::1. */
export function getStrapiApiUrl(): string {
  const url = parseOrigin(configuredStrapiOrigin());
  if (!url) return configuredStrapiOrigin();
  if (
    url.hostname === "localhost" ||
    url.hostname === "::1" ||
    url.hostname === "0.0.0.0" ||
    url.hostname === "::"
  ) {
    url.hostname = "127.0.0.1";
  }
  return url.origin;
}

function browserOrigin(raw: string): string {
  const url = parseOrigin(raw);
  if (!url) return stripSlash(raw).replace(/\/admin$/i, "");
  if (
    url.hostname === "host.docker.internal" ||
    url.hostname === "0.0.0.0" ||
    url.hostname === "::"
  ) {
    url.hostname = "localhost";
  }
  return url.origin;
}

/** Strapi admin login, for a new tab from /ops. */
export function getStrapiAdminUrl(): string {
  const explicit = (process.env.STRAPI_ADMIN_URL || "").trim();
  if (explicit) return withAdminPath(explicit);
  return withAdminPath(browserOrigin(configuredStrapiOrigin()));
}
