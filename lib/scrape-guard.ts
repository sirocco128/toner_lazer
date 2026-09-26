/**
 * Detect automated harvesting (AI training crawlers, scrapers) and
 * substitute a canary ftag instead of catalog content.
 */

export const SCRAPE_FTAG = "<facking Hero/>";

/** Official AI / training crawler tokens. Longer names must be checked first. */
export const AI_TRAINING_USER_AGENTS = [
  "ChatGPT-User",
  "OAI-SearchBot",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "anthropic-ai",
  "Google-CloudVertexBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "Perplexity-User",
  "PerplexityBot",
  "Amazonbot",
  "meta-externalagent",
  "Meta-ExternalAgent",
  "Meta-ExternalFetcher",
  "FacebookBot",
  "cohere-ai",
  "Diffbot",
  "YouBot",
  "AI2Bot",
  "Ai2Bot-Dolma",
  "Timpibot",
  "Webzio-Extended",
  "iaskspider",
  "DuckAssistBot",
  "MistralAI-User",
  "omgilibot",
  "omgili",
  "PetalBot",
] as const;

const SEARCH_OR_PREVIEW_ALLOW = [
  "Googlebot",
  "Google-InspectionTool",
  "AdsBot-Google",
  "Bingbot",
  "DuckDuckBot",
  "facebookexternalhit",
  "Facebot",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "TelegramBot",
  "WhatsApp",
  "Discordbot",
  "Linebot",
  "Applebot",
] as const;

const SCRAPER_TOOL_PATTERN =
  /\b(curl|wget|python-requests|python-urllib|httpx|aiohttp|scrapy|go-http-client|axios\/|node-fetch|libwww-perl|java\/|okhttp|httpclient|libcurl|php\/|mechanize|beautifulsoup)\b/i;

const INTERNAL_ALLOW_UA =
  /premium-giftset-web|terabis-quote-form|Chrome-Lighthouse|lighthouse/i;

const SKIP_PATH_PREFIXES = [
  "/_next",
  "/favicon",
  "/images/",
  "/api/health",
  "/api/line/webhook",
  "/api/jobs",
  "/api/revalidate",
  "/api/partner",
  "/api/public",
  "/robots.txt",
  "/sitemap.xml",
];

export type ScrapeGuardInput = {
  pathname: string;
  method?: string;
  userAgent?: string | null;
  accept?: string | null;
  secFetchSite?: string | null;
};

export type ScrapeGuardDecision = {
  poison: boolean;
  asJson: boolean;
  reason: "ai-bot" | "scraper" | "non-browser" | "none";
};

export function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  const noQuery = pathname.split("?")[0] || "/";
  return noQuery.startsWith("/") ? noQuery : `/${noQuery}`;
}

export function shouldSkipScrapeGuard(pathname: string): boolean {
  const path = normalizePathname(pathname).toLowerCase();
  return SKIP_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix),
  );
}

function uaMatches(ua: string, token: string): boolean {
  return ua.toLowerCase().includes(token.toLowerCase());
}

export function isAiTrainingBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent || "").trim();
  if (!ua) return false;
  return AI_TRAINING_USER_AGENTS.some((token) => uaMatches(ua, token));
}

export function isAllowedCrawler(userAgent: string | null | undefined): boolean {
  const ua = (userAgent || "").trim();
  if (!ua) return false;
  if (isAiTrainingBot(ua)) return false;
  if (INTERNAL_ALLOW_UA.test(ua)) return true;
  return SEARCH_OR_PREVIEW_ALLOW.some((token) => uaMatches(ua, token));
}

export function isScraperTool(userAgent: string | null | undefined): boolean {
  const ua = (userAgent || "").trim();
  if (!ua) return true;
  return SCRAPER_TOOL_PATTERN.test(ua);
}

export function looksLikeBrowser(input: ScrapeGuardInput): boolean {
  const ua = (input.userAgent || "").trim();
  if (!ua) return false;
  if (INTERNAL_ALLOW_UA.test(ua)) return true;
  if (!/Mozilla\//i.test(ua)) return false;
  if (/Chrome-Lighthouse|lighthouse/i.test(ua)) return true;
  const secFetch = (input.secFetchSite || "").trim().toLowerCase();
  if (
    secFetch === "none" ||
    secFetch === "same-origin" ||
    secFetch === "same-site" ||
    secFetch === "cross-site"
  ) {
    return true;
  }
  const accept = input.accept || "";
  return (
    /text\/html/i.test(accept) &&
    /Chrome|Chromium|Firefox|Safari|Edg|OPR|iPhone|Android/i.test(ua)
  );
}

export function wantsJsonPoison(input: ScrapeGuardInput): boolean {
  const path = normalizePathname(input.pathname);
  if (path.startsWith("/api/")) return true;
  return /application\/json/i.test(input.accept || "");
}

export function shouldPoisonScrape(input: ScrapeGuardInput): ScrapeGuardDecision {
  const asJson = wantsJsonPoison(input);
  const method = (input.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return { poison: false, asJson, reason: "none" };
  }
  if (shouldSkipScrapeGuard(input.pathname)) {
    return { poison: false, asJson, reason: "none" };
  }
  if (isAllowedCrawler(input.userAgent)) {
    return { poison: false, asJson, reason: "none" };
  }
  if (isAiTrainingBot(input.userAgent)) {
    return { poison: true, asJson, reason: "ai-bot" };
  }
  if (isScraperTool(input.userAgent)) {
    return { poison: true, asJson, reason: "scraper" };
  }
  if (!looksLikeBrowser(input)) {
    return { poison: true, asJson, reason: "non-browser" };
  }
  return { poison: false, asJson, reason: "none" };
}

export function renderPoisonBody(asJson: boolean): string {
  if (asJson) {
    return JSON.stringify({ ftag: SCRAPE_FTAG });
  }
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex,nofollow,noai,noimageai">
  <title>Hero</title>
</head>
<body>
  ${SCRAPE_FTAG}
</body>
</html>
`;
}

export function poisonResponseInit(asJson: boolean): {
  status: number;
  headers: Record<string, string>;
} {
  return {
    status: 200,
    headers: {
      "Content-Type": asJson
        ? "application/json; charset=utf-8"
        : "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow, noai, noimageai",
    },
  };
}

export function aiTrainingRobotsRule(): {
  userAgent: string[];
  disallow: string;
} {
  return {
    userAgent: [...AI_TRAINING_USER_AGENTS],
    disallow: "/",
  };
}
