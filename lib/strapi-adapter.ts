import { z } from "zod";
import type {
  Article,
  Category,
  Faq,
  Portfolio,
  Product,
  SeoFields,
} from "@/lib/data";
import { cleanText, htmlToPlainText } from "@/lib/sanitize";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PAGE_SIZE = 100;
const MAX_PAGES = 25;

export class StrapiAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StrapiAdapterError";
  }
}

function cleaned(value: unknown, max?: number): string {
  const text = cleanText(String(value ?? ""));
  if (max !== undefined && text.length > max) {
    return text.slice(0, max);
  }
  return text;
}

function optionalNonNegative(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(SLUG_PATTERN);

const seoSchema = z.object({
  seoTitle: z.string().min(1).max(60),
  metaDescription: z.string().min(120).max(160),
  canonicalPath: z
    .string()
    .min(1)
    .max(500)
    .refine(
      (value) =>
        value.startsWith("/") &&
        !value.includes("?") &&
        !/^https?:\/\//i.test(value),
      "canonicalPath must be an internal path without query",
    ),
  ogImage: z.string().optional(),
  noIndex: z.boolean().optional(),
});

/**
 * Unwrap Strapi v4 `{ id, attributes }` / `{ data }` and v5 flattened entities.
 */
export function unwrapEntity(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;

  let current: unknown = input;

  if (
    current &&
    typeof current === "object" &&
    "data" in current &&
    (current as { data: unknown }).data !== undefined
  ) {
    current = (current as { data: unknown }).data;
  }

  if (Array.isArray(current)) {
    return null;
  }

  if (!current || typeof current !== "object") return null;

  const record = current as Record<string, unknown>;
  if (
    record.attributes &&
    typeof record.attributes === "object" &&
    !Array.isArray(record.attributes)
  ) {
    return {
      id: record.id,
      ...(record.attributes as Record<string, unknown>),
    };
  }

  return record;
}

export function unwrapCollection(input: unknown): unknown[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;

  if (typeof input === "object" && input !== null && "data" in input) {
    const data = (input as { data: unknown }).data;
    if (Array.isArray(data)) return data;
    if (data == null) return [];
    return [data];
  }

  return [];
}

function buildMediaAllowlist(
  strapiUrl: string,
  remoteUrls: string,
): Set<string> {
  const origins = new Set<string>();
  const candidates = [
    strapiUrl,
    ...remoteUrls.split(",").map((part) => part.trim()),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      // skip invalid
    }
  }
  return origins;
}

export type MediaResolveOptions = {
  strapiUrl: string;
  remoteImageUrls?: string;
  /** Explicit origin allowlist (used by tests and callers). */
  allowlistOrigins?: string[];
};

function resolveAllowlist(options: MediaResolveOptions): Set<string> {
  const origins = new Set<string>();

  for (const origin of options.allowlistOrigins ?? []) {
    if (origin) origins.add(origin.replace(/\/+$/, ""));
  }

  for (const origin of buildMediaAllowlist(
    options.strapiUrl,
    options.remoteImageUrls ?? process.env.NEXT_IMAGE_REMOTE_URLS ?? "",
  )) {
    origins.add(origin);
  }

  for (const extra of extraMediaOriginsFromEnv()) {
    origins.add(extra);
  }

  return origins;
}

function extraMediaOriginsFromEnv(): string[] {
  const origins: string[] = [];
  for (const raw of [
    process.env.MINIO_ENDPOINT,
    process.env.MINIO_PUBLIC_BASE_URL,
  ]) {
    const value = String(raw || "").trim();
    if (!value) continue;
    try {
      origins.push(new URL(value).origin);
    } catch {
      // skip invalid
    }
  }
  return origins;
}

/**
 * Resolve and validate media URLs against STRAPI_URL + allowlist.
 * Throws when an absolute URL is outside the allowlist.
 */
export function resolveMediaUrl(
  value: unknown,
  options: MediaResolveOptions,
): string | null {
  const allowlist = resolveAllowlist(options);
  const url = extractMediaUrl(value);
  if (!url) return null;

  if (url.startsWith("javascript:") || url.startsWith("data:")) {
    throw new StrapiAdapterError(`Disallowed media URL scheme: ${url}`);
  }

  if (url.startsWith("/")) {
    try {
      const base = new URL(options.strapiUrl);
      return new URL(url, base).toString();
    } catch {
      return null;
    }
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new StrapiAdapterError(`Disallowed media protocol: ${url}`);
    }
    if (!allowlist.has(parsed.origin)) {
      throw new StrapiAdapterError(
        `Media origin not allowlisted: ${parsed.origin}`,
      );
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof StrapiAdapterError) throw error;
    return null;
  }
}

function extractMediaUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractMediaUrl(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.url === "string") return record.url;
    if (record.data !== undefined) return extractMediaUrl(record.data);
    if (record.attributes !== undefined) {
      return extractMediaUrl(record.attributes);
    }
  }

  return null;
}

function extractMediaUrls(
  value: unknown,
  options: MediaResolveOptions,
): string[] {
  if (!value) return [];
  const items = Array.isArray(value)
    ? value
    : typeof value === "object" &&
        value !== null &&
        "data" in value &&
        Array.isArray((value as { data: unknown }).data)
      ? ((value as { data: unknown[] }).data ?? [])
      : [value];

  const urls: string[] = [];
  for (const item of items) {
    const resolved = resolveMediaUrl(item, options);
    if (resolved) urls.push(resolved);
  }
  return urls;
}

function toCanonicalPath(value: unknown, fallbackPath: string): string {
  const raw = cleaned(value, 500);
  if (!raw) return fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return url.pathname || fallbackPath;
    } catch {
      return fallbackPath;
    }
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function adaptSeo(
  raw: unknown,
  fallbackPath: string,
  ogFallback?: string,
  mediaOptions?: MediaResolveOptions,
): SeoFields {
  const entity = unwrapEntity(raw) ?? (raw as Record<string, unknown> | null);
  const openGraph = unwrapEntity(entity?.openGraph) ?? null;
  const robots = cleaned(entity?.metaRobots, 120).toLowerCase();
  const mediaOg =
    (mediaOptions
      ? resolveMediaUrl(entity?.metaImage, mediaOptions) ||
        resolveMediaUrl(openGraph?.ogImage, mediaOptions) ||
        resolveMediaUrl(entity?.ogImage, mediaOptions)
      : undefined) || undefined;

  const candidate = {
    seoTitle: cleaned(entity?.seoTitle ?? entity?.metaTitle, 60),
    metaDescription: cleaned(
      entity?.metaDescription ?? entity?.description,
      160,
    ),
    canonicalPath: toCanonicalPath(
      entity?.canonicalPath ?? entity?.canonicalURL,
      fallbackPath,
    ),
    ogImage: mediaOg || ogFallback,
    noIndex:
      Boolean(entity?.noIndex) ||
      robots.includes("noindex"),
  };

  const parsed = seoSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new StrapiAdapterError(
      `Invalid SEO fields: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }

  return {
    ...parsed.data,
    ...(candidate.ogImage ? { ogImage: candidate.ogImage } : {}),
  };
}

function relationSlug(value: unknown): string | null {
  const entity = unwrapEntity(value);
  if (!entity) return null;
  const slug = cleaned(entity.slug, 160);
  return SLUG_PATTERN.test(slug) ? slug : null;
}

export function adaptProduct(
  input: unknown,
  options: MediaResolveOptions,
): Product | null {
  try {
    const entity = unwrapEntity(input);
    if (!entity) return null;

    const slug = cleaned(entity.slug, 160);
    slugSchema.parse(slug);

    const images = extractMediaUrls(entity.images, options);
    if (images.length < 1) {
      throw new StrapiAdapterError("Product requires at least one image");
    }

    const categorySlug =
      relationSlug(entity.category) ||
      cleaned(entity.categorySlug, 160) ||
      "";
    if (!SLUG_PATTERN.test(categorySlug)) {
      throw new StrapiAdapterError("Product requires a valid category slug");
    }

    const priceMin = Number(entity.priceMin ?? 0);
    const priceMax = Number(entity.priceMax ?? priceMin);
    if (!Number.isFinite(priceMin) || priceMin < 0) {
      throw new StrapiAdapterError("Invalid priceMin");
    }
    if (!Number.isFinite(priceMax) || priceMax < priceMin) {
      throw new StrapiAdapterError("priceMax must be >= priceMin");
    }

    const minOrder = Number(entity.minOrder ?? 30);
    if (
      !Number.isInteger(minOrder) ||
      minOrder < 1 ||
      minOrder > 1_000_000
    ) {
      throw new StrapiAdapterError("Invalid minOrder");
    }

    const currency = cleaned(entity.currency || "THB") || "THB";
    if (currency !== "THB") {
      throw new StrapiAdapterError("Unsupported currency");
    }

    const descriptionHtml = String(entity.description ?? "");
    const description = htmlToPlainText(descriptionHtml) || cleaned(descriptionHtml);
    if (!description) {
      throw new StrapiAdapterError("Product description required");
    }

    const name = cleaned(entity.name, 200);
    if (!name) throw new StrapiAdapterError("Product name required");

    const seo = adaptSeo(
      entity.seo,
      `/products/${slug}`,
      images[0],
      options,
    );

    const priceRange =
      cleaned(entity.priceRange, 120) ||
      `${priceMin}–${priceMax} บาท/ชุด`;

    const priceExFreightMin = optionalNonNegative(entity.priceExFreightMin);
    const priceExFreightMax = optionalNonNegative(entity.priceExFreightMax);
    const packagingMin = optionalNonNegative(entity.packagingMin);
    const packagingMax = optionalNonNegative(entity.packagingMax);

    const enableCustomDesign = Boolean(entity.enableCustomDesign);
    const presetRaw = cleaned(entity.customDesignPreset, 40);
    const customDesignPreset =
      presetRaw === "tumbler_set" || presetRaw === "product_photo"
        ? presetRaw
        : enableCustomDesign
          ? ("product_photo" as const)
          : undefined;

    return {
      name,
      slug,
      description,
      material: cleaned(entity.material, 200),
      minOrder,
      priceRange,
      priceMin,
      priceMax,
      ...(priceExFreightMin !== undefined ? { priceExFreightMin } : {}),
      ...(priceExFreightMax !== undefined ? { priceExFreightMax } : {}),
      ...(packagingMin !== undefined ? { packagingMin } : {}),
      ...(packagingMax !== undefined ? { packagingMax } : {}),
      currency: "THB",
      images,
      categorySlug,
      seo,
      ...(enableCustomDesign ? { enableCustomDesign: true } : {}),
      ...(customDesignPreset ? { customDesignPreset } : {}),
    };
  } catch (error) {
    console.error("[strapi-adapter] skip product", error);
    return null;
  }
}

export function adaptCategory(
  input: unknown,
  options: MediaResolveOptions,
): Category | null {
  try {
    const entity = unwrapEntity(input);
    if (!entity) return null;

    const slug = cleaned(entity.slug, 160);
    slugSchema.parse(slug);

    const heroImage = resolveMediaUrl(entity.heroImage, options);
    if (!heroImage) {
      throw new StrapiAdapterError("Category requires a valid hero image");
    }

    const name = cleaned(entity.name, 200);
    const description = cleaned(entity.description, 2000);
    if (!name || !description) {
      throw new StrapiAdapterError("Category name/description required");
    }

    const seo = adaptSeo(entity.seo, `/giftset/${slug}`, heroImage, options);

    return {
      name,
      slug,
      description,
      heroImage,
      seo,
    };
  } catch (error) {
    console.error("[strapi-adapter] skip category", error);
    return null;
  }
}

export function adaptArticle(
  input: unknown,
  options: MediaResolveOptions,
): Article | null {
  try {
    const entity = unwrapEntity(input);
    if (!entity) return null;

    const slug = cleaned(entity.slug, 160);
    slugSchema.parse(slug);

    const cover = resolveMediaUrl(entity.cover, options);
    if (!cover) {
      throw new StrapiAdapterError("Article requires a valid cover");
    }

    const title = cleaned(entity.title, 200);
    const excerpt = cleaned(entity.excerpt, 200);
    const body = String(entity.body ?? "");
    const author = cleaned(entity.author, 120);

    if (!title || !excerpt || !body || !author) {
      throw new StrapiAdapterError("Article fields incomplete");
    }

    const seo = adaptSeo(entity.seo, `/blog/${slug}`, cover, options);

    return {
      title,
      slug,
      excerpt,
      body,
      cover,
      author,
      publishedAt: String(
        entity.publishedAt ?? entity.createdAt ?? new Date().toISOString(),
      ),
      updatedAt: String(
        entity.updatedAt ?? entity.publishedAt ?? new Date().toISOString(),
      ),
      seo,
    };
  } catch (error) {
    console.error("[strapi-adapter] skip article", error);
    return null;
  }
}

export function adaptFaq(input: unknown): Faq | null {
  try {
    const entity = unwrapEntity(input);
    if (!entity) return null;

    const question = cleaned(entity.question, 300);
    const answer = cleaned(entity.answer, 4000);
    if (!question || !answer) {
      throw new StrapiAdapterError("FAQ incomplete");
    }

    const order = Number(entity.order ?? 0);
    return {
      question,
      answer,
      order: Number.isFinite(order) ? order : 0,
    };
  } catch (error) {
    console.error("[strapi-adapter] skip faq", error);
    return null;
  }
}

export function adaptPortfolio(
  input: unknown,
  options: MediaResolveOptions,
): Portfolio | null {
  try {
    const entity = unwrapEntity(input);
    if (!entity) return null;

    const slug = cleaned(entity.slug, 160);
    slugSchema.parse(slug);

    const image = resolveMediaUrl(entity.image, options);
    if (!image) {
      throw new StrapiAdapterError("Portfolio requires a valid image");
    }

    const title = cleaned(entity.title, 200);
    const client = cleaned(entity.client, 200);
    const summary = cleaned(entity.summary, 2000);
    if (!title || !client || !summary) {
      throw new StrapiAdapterError("Portfolio fields incomplete");
    }

    let services: string[] = [];
    if (Array.isArray(entity.services)) {
      services = entity.services.map((item) => cleaned(item, 100)).filter(Boolean);
    }

    const quantity = Number(entity.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new StrapiAdapterError("Invalid portfolio quantity");
    }

    return {
      title,
      slug,
      client,
      industry: cleaned(entity.industry, 120),
      summary,
      image,
      services,
      quantity,
      completedAt: cleaned(entity.completedAt, 32),
      featured: Boolean(entity.featured),
    };
  } catch (error) {
    console.error("[strapi-adapter] skip portfolio", error);
    return null;
  }
}

function adaptMany<T>(
  input: unknown,
  adapter: (item: unknown) => T | null,
  label: string,
): T[] {
  const items = unwrapCollection(input);
  if (items.length === 0) return [];

  const adapted: T[] = [];
  for (const item of items) {
    const value = adapter(item);
    if (value) adapted.push(value);
  }

  if (adapted.length === 0) {
    throw new StrapiAdapterError(
      `All ${label} records failed validation`,
    );
  }

  return adapted;
}

export function adaptProducts(
  input: unknown,
  options: MediaResolveOptions,
): Product[] {
  return adaptMany(input, (item) => adaptProduct(item, options), "product");
}

export function adaptCategories(
  input: unknown,
  options: MediaResolveOptions,
): Category[] {
  return adaptMany(input, (item) => adaptCategory(item, options), "category");
}

export function adaptArticles(
  input: unknown,
  options: MediaResolveOptions,
): Article[] {
  return adaptMany(input, (item) => adaptArticle(item, options), "article");
}

export function adaptFaqs(input: unknown): Faq[] {
  return adaptMany(input, (item) => adaptFaq(item), "faq");
}

export function adaptPortfolios(
  input: unknown,
  options: MediaResolveOptions,
): Portfolio[] {
  return adaptMany(
    input,
    (item) => adaptPortfolio(item, options),
    "portfolio",
  );
}

export const STRAPI_PAGE_SIZE = PAGE_SIZE;
export const STRAPI_MAX_PAGES = MAX_PAGES;
