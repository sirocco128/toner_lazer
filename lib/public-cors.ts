/**
 * CORS for smg-ui → public BFF on this host (smartgift.next-dev.net).
 * Partner API stays server-to-server (no CORS).
 */

const DEV_DEFAULT_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function parseOriginList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      try {
        return new URL(item).origin;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => Boolean(origin));
}

/** Allowed browser origins for /api/public/* */
export function listPublicSmgOrigins(): string[] {
  const configured = parseOriginList(process.env.PUBLIC_SMG_ORIGINS);
  if (process.env.NODE_ENV !== "production") {
    return [...new Set([...configured, ...DEV_DEFAULT_ORIGINS])];
  }
  return configured;
}

export function resolvePublicCorsOrigin(
  requestOrigin: string | null,
): string | null {
  if (!requestOrigin) return null;
  let origin: string;
  try {
    origin = new URL(requestOrigin).origin;
  } catch {
    return null;
  }
  const allowed = listPublicSmgOrigins();
  if (allowed.includes(origin)) return origin;
  return null;
}

export function publicCorsHeaders(
  request: Request,
  methods = "GET, POST, OPTIONS",
): HeadersInit {
  const origin = resolvePublicCorsOrigin(request.headers.get("origin"));
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function publicOptionsResponse(
  request: Request,
  methods = "GET, POST, OPTIONS",
): Response {
  return new Response(null, {
    status: 204,
    headers: publicCorsHeaders(request, methods),
  });
}
