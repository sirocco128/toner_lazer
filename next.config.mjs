import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string | undefined} value
 * @returns {string[]}
 */
function parseRemoteImageOrigins(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return new URL(entry).origin;
      } catch {
        return null;
      }
    })
    .filter((origin) => Boolean(origin));
}

/**
 * @param {string | undefined} value
 * @returns {string | null}
 */
function safeOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const isDev = process.env.NODE_ENV !== "production";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const isHttpsSite = siteUrl.startsWith("https://");
const isSecureProduction = process.env.NODE_ENV === "production" && isHttpsSite;

const mediaOrigins = [
  ...parseRemoteImageOrigins(process.env.NEXT_IMAGE_REMOTE_URLS),
  safeOrigin(process.env.STRAPI_URL),
  safeOrigin(process.env.MINIO_ENDPOINT),
  safeOrigin(process.env.MINIO_PUBLIC_BASE_URL),
]
  .flatMap((origin) => {
    if (!origin) return [];
    try {
      const url = new URL(origin);
      if (url.hostname === "localhost") {
        const ipv4 = new URL(origin);
        ipv4.hostname = "127.0.0.1";
        return [origin, ipv4.origin];
      }
      if (url.hostname === "127.0.0.1") {
        const named = new URL(origin);
        named.hostname = "localhost";
        return [origin, named.origin];
      }
    } catch {
      return [origin];
    }
    return [origin];
  })
  .filter((origin, index, list) => origin && list.indexOf(origin) === index);

/** @type {import('next').RemotePattern[]} */
const remotePatterns = mediaOrigins.flatMap((origin) => {
  try {
    const url = new URL(/** @type {string} */ (origin));
    return [
      {
        protocol: url.protocol.replace(":", ""),
        hostname: url.hostname,
        port: url.port || undefined,
        pathname: "/**",
      },
    ];
  } catch {
    return [];
  }
});

/**
 * @returns {string}
 */
function buildContentSecurityPolicy() {
  const scriptSrc = isDev
    ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
    : ["'self'", "'unsafe-inline'"];
  scriptSrc.push("https://www.googletagmanager.com");

  const connectSrc = [
    "'self'",
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://www.googletagmanager.com",
    "https://*.googletagmanager.com",
    "https://*.analytics.google.com",
  ];
  const strapiOrigin = safeOrigin(process.env.STRAPI_URL);
  if (strapiOrigin) connectSrc.push(strapiOrigin);
  try {
    if (strapiOrigin) {
      const url = new URL(strapiOrigin);
      if (url.hostname === "localhost") {
        url.hostname = "127.0.0.1";
        connectSrc.push(url.origin);
      } else if (url.hostname === "127.0.0.1") {
        url.hostname = "localhost";
        connectSrc.push(url.origin);
      }
    }
  } catch {
    /* ignore */
  }
  if (isDev) {
    connectSrc.push("ws:", "wss:");
  }

  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    ...mediaOrigins,
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://www.googletagmanager.com",
    "https://*.googletagmanager.com",
  ];

  /** @type {Record<string, string[]>} */
  const directives = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "script-src": scriptSrc,
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": imgSrc,
    "font-src": ["'self'", "data:"],
    "connect-src": connectSrc,
    "media-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "frame-src": [
      "'self'",
      "https://online.fliphtml5.com",
      "https://fliphtml5.com",
      "https://*.fliphtml5.com",
    ],
  };

  // Do not emit upgrade-insecure-requests here.
  // The public site is already HTTPS via Cloudflare; emitting this on the
  // origin breaks LAN HTTP access (e.g. http://192.168.1.30:33100) because
  // browsers upgrade CSS/JS to https://<lan-ip> which has no TLS.

  return Object.entries(directives)
    .map(([key, values]) =>
      values.length === 0 ? key : `${key} ${values.join(" ")}`,
    )
    .join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.1.35",
    "100.71.141.126",
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns,
  },
  async headers() {
    /** @type {{ key: string; value: string }[]} */
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: buildContentSecurityPolicy(),
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-DNS-Prefetch-Control",
        value: "off",
      },
      {
        key: "X-Permitted-Cross-Domain-Policies",
        value: "none",
      },
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin",
      },
      {
        key: "Permissions-Policy",
        value:
          "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
      },
      {
        key: "X-Robots-Tag",
        value: "noai, noimageai",
      },
    ];

    if (isSecureProduction) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Help Next resolve packages when workspace path contains spaces (iCloud).
  outputFileTracingRoot: path.join(__dirname),
  // Keep work-manual markdown available to the Node runtime (Ops /ops/manual).
  outputFileTracingIncludes: {
    "/ops/manual": ["./docs/**/*"],
    "/api/ops/manual": ["./docs/**/*"],
  },
};

export default nextConfig;
