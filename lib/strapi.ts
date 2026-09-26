/**
 * CMS data access — mock mode or Strapi fetch.
 * Server-side modules only (RSC / Route Handlers). Do not import from client components.
 */

import {
  articles as mockArticles,
  categories as mockCategories,
  faqs as mockFaqs,
  portfolios as mockPortfolios,
  products as mockProducts,
  type Article,
  type Category,
  type Faq,
  type Portfolio,
  type Product,
} from "@/lib/data";
import {
  STRAPI_MAX_PAGES,
  STRAPI_PAGE_SIZE,
  adaptArticles,
  adaptCategories,
  adaptFaqs,
  adaptPortfolios,
  adaptProducts,
  type MediaResolveOptions,
} from "@/lib/strapi-adapter";
import { alibabaEstimatesEnabled, overlayOffersOnProducts } from "@/lib/alibaba/overlay";
import { loadOffersFromFile } from "@/lib/alibaba/offers";
import type { AlibabaOffer } from "@/lib/alibaba/types";
import { cache } from "react";
import { isNexterpMysqlEnabled } from "@/lib/nexterp-mysql";
import { isSmartgiftMysqlEnabled } from "@/lib/smartgift-mysql";
import { getStrapiApiUrl } from "@/lib/strapi-url";
import {
  getCmsMode,
  shouldFetchStrapiEditorial,
} from "@/lib/strapi-mode";
import {
  getNexterpProductBySlug,
  listNexterpCategories,
  listNexterpProducts,
} from "@/lib/nexterp-products";
import {
  canonicalCategorySlug,
  getSmartgiftOfferBySlug,
  listSmartgiftCategories,
  listSmartgiftOffers,
} from "@/lib/smartgift-products";
import { overlaySkuOnProducts, getCatalogProductFromSkuSlug } from "@/lib/sku-catalog-overlay";
import {
  getLivePublicArticleBySlug,
  listLivePublicArticles,
} from "@/lib/article-repository";

const REVALIDATE = {
  categories: 3600,
  products: 300,
  articles: 3600,
  faqs: 86_400,
  portfolios: 3600,
} as const;

function fallbackEnabled(): boolean {
  return (process.env.STRAPI_FALLBACK_TO_MOCK || "").toLowerCase() === "true";
}

function getStrapiUrl(): string {
  return getStrapiApiUrl();
}

function getTimeoutMs(): number {
  const raw = Number(process.env.STRAPI_FETCH_TIMEOUT_MS || 8000);
  return Number.isFinite(raw) && raw > 0 ? raw : 8000;
}

function mediaOptions(): MediaResolveOptions {
  return {
    strapiUrl: getStrapiUrl(),
    remoteImageUrls: process.env.NEXT_IMAGE_REMOTE_URLS ?? "",
  };
}

let cachedOffers: AlibabaOffer[] | null = null;

function offersForOverlay(): AlibabaOffer[] {
  if (!alibabaEstimatesEnabled()) return [];
  if (cachedOffers) return cachedOffers;
  try {
    cachedOffers = loadOffersFromFile();
  } catch {
    cachedOffers = [];
  }
  return cachedOffers;
}

function withAlibabaEstimates(products: Product[]): Product[] {
  return overlayOffersOnProducts(products, offersForOverlay(), {
    remoteImageUrls: process.env.NEXT_IMAGE_REMOTE_URLS ?? "",
  });
}

async function withCatalog(products: Product[]): Promise<Product[]> {
  return overlaySkuOnProducts(withAlibabaEstimates(products));
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const token = (process.env.STRAPI_API_TOKEN || "").trim();
  const publicRead =
    (process.env.STRAPI_PUBLIC_READ || "").toLowerCase() === "true";
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (!publicRead) {
    throw new Error("STRAPI_API_TOKEN is required unless STRAPI_PUBLIC_READ=true");
  }
  return headers;
}

async function strapiFetchJson(
  pathWithQuery: string,
  tags: string[],
  revalidate: number,
): Promise<unknown> {
  const url = `${getStrapiUrl()}${pathWithQuery.startsWith("/") ? "" : "/"}${pathWithQuery}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: authHeaders(),
      signal: controller.signal,
      next: {
        revalidate,
        tags,
      },
    });

    if (!response.ok) {
      throw new Error(`Strapi HTTP ${response.status} for ${pathWithQuery}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllPages(
  collectionPath: string,
  populate: string,
  tags: string[],
  revalidate: number,
): Promise<unknown[]> {
  const records: unknown[] = [];

  for (let page = 1; page <= STRAPI_MAX_PAGES; page += 1) {
    const query = new URLSearchParams({
      "pagination[page]": String(page),
      "pagination[pageSize]": String(STRAPI_PAGE_SIZE),
      publicationState: "live",
    });

    // Support both qs-style populate and simple populate=*
    if (populate.includes("=")) {
      for (const part of populate.split("&")) {
        const [key, value] = part.split("=");
        if (key && value) query.set(key, value);
      }
    } else {
      query.set("populate", populate);
    }

    const payload = await strapiFetchJson(
      `${collectionPath}?${query.toString()}`,
      tags,
      revalidate,
    );

    const pageData =
      payload &&
      typeof payload === "object" &&
      "data" in payload &&
      Array.isArray((payload as { data: unknown }).data)
        ? ((payload as { data: unknown[] }).data ?? [])
        : Array.isArray(payload)
          ? payload
          : [];

    records.push(...pageData);

    const pagination: { pageCount?: number } | undefined =
      payload &&
      typeof payload === "object" &&
      "meta" in payload
        ? (payload as { meta?: { pagination?: { pageCount?: number } } }).meta
            ?.pagination
        : undefined;

    const pageCount = pagination?.pageCount ?? 1;
    if (page >= pageCount) {
      return records;
    }
  }

  throw new Error(
    `Strapi pagination exceeded MAX_PAGES (${STRAPI_MAX_PAGES}) for ${collectionPath}`,
  );
}

async function withFallback<T>(
  label: string,
  loader: () => Promise<T>,
  mockValue: T,
): Promise<T> {
  if (!shouldFetchStrapiEditorial()) {
    return mockValue;
  }

  try {
    const result = await loader();
    if (
      fallbackEnabled() &&
      Array.isArray(result) &&
      result.length === 0 &&
      Array.isArray(mockValue) &&
      mockValue.length > 0
    ) {
      console.warn(
        `[strapi] ${label} returned empty; falling back to mock (STRAPI_FALLBACK_TO_MOCK)`,
      );
      return mockValue;
    }
    return result;
  } catch (error) {
    console.error(`[strapi] ${label} failed`, error);
    if (fallbackEnabled()) {
      console.warn(`[strapi] falling back to mock for ${label}`);
      return mockValue;
    }
    throw error;
  }
}

async function loadCategories(): Promise<Category[]> {
  if (getCmsMode() === "mysql") {
    try {
      if (isSmartgiftMysqlEnabled()) return await listSmartgiftCategories();
      return await listNexterpCategories();
    } catch (error) {
      console.error("[mysql] categories failed", error);
      if (fallbackEnabled()) return mockCategories;
      throw error;
    }
  }

  return withFallback(
    "categories",
    async () => {
      const records = await fetchAllPages(
        "/api/gift-set-categories",
        "*",
        ["categories"],
        REVALIDATE.categories,
      );
      return adaptCategories(records, mediaOptions());
    },
    mockCategories,
  );
}

export const getCategories = cache(loadCategories);

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  const wanted = canonicalCategorySlug(slug);
  const all = await getCategories();
  return (
    all.find((item) => item.slug === wanted) ??
    all.find((item) => item.slug === slug) ??
    null
  );
}

async function loadProducts(): Promise<Product[]> {
  if (getCmsMode() === "mysql") {
    try {
      const products = isSmartgiftMysqlEnabled()
        ? await listSmartgiftOffers({ pricedOnly: true, limit: 240 })
        : await listNexterpProducts({ limit: 240 });
      return withCatalog(products);
    } catch (error) {
      console.error("[mysql] products failed", error);
      if (fallbackEnabled()) return withCatalog(mockProducts);
      throw error;
    }
  }

  const products = await withFallback(
    "products",
    async () => {
      const records = await fetchAllPages(
        "/api/products",
        "*",
        ["products"],
        REVALIDATE.products,
      );
      return adaptProducts(records, mediaOptions());
    },
    mockProducts,
  );
  return withCatalog(products);
}

export const getProducts = cache(loadProducts);

export type PublicCatalog = {
  products: Product[];
  categories: Category[];
  unavailable: boolean;
};

/** Catalog pages: never throw a blank error screen when MySQL is slow or down. */
export async function getPublicCatalog(): Promise<PublicCatalog> {
  try {
    const [products, categories] = await Promise.all([
      getProducts(),
      getCategories(),
    ]);
    return { products, categories, unavailable: false };
  } catch (error) {
    console.error("[catalog] public catalog unavailable", error);
    return { products: [], categories: [], unavailable: true };
  }
}

export async function getPublicCategoryCatalog(slug: string): Promise<{
  category: Category | null;
  products: Product[];
  categories: Category[];
  unavailable: boolean;
}> {
  try {
    const [category, products, categories] = await Promise.all([
      getCategoryBySlug(slug),
      getProductsByCategory(slug),
      getCategories(),
    ]);
    return { category, products, categories, unavailable: false };
  } catch (error) {
    console.error("[catalog] category catalog unavailable", error);
    return { category: null, products: [], categories: [], unavailable: true };
  }
}

async function loadProductsByCategory(slug: string): Promise<Product[]> {
  const wanted = canonicalCategorySlug(slug);
  if (getCmsMode() === "mysql" && isSmartgiftMysqlEnabled()) {
    try {
      const products = await listSmartgiftOffers({
        categorySlug: wanted,
        pricedOnly: false,
        limit: 400,
      });
      return withCatalog(products);
    } catch (error) {
      console.error("[mysql] products by category failed", error);
      if (fallbackEnabled()) {
        return withCatalog(
          mockProducts.filter(
            (item) => item.categorySlug === wanted || item.categorySlug === slug,
          ),
        );
      }
      throw error;
    }
  }

  const products = await getProducts();
  return products.filter(
    (product) => product.categorySlug === wanted || product.categorySlug === slug,
  );
}

export const getProductsByCategory = cache(loadProductsByCategory);

async function loadProductBySlug(
  slug: string,
): Promise<Product | null> {
  if (getCmsMode() === "mysql") {
    try {
      const product = isSmartgiftMysqlEnabled()
        ? await getSmartgiftOfferBySlug(slug)
        : await getNexterpProductBySlug(slug);
      if (product) return (await withCatalog([product]))[0] ?? null;
      const fromSku = await getCatalogProductFromSkuSlug(slug);
      if (fromSku) return fromSku;
      const demo = mockProducts.find((item) => item.slug === slug) ?? null;
      return demo ? (await withCatalog([demo]))[0] ?? null : null;
    } catch (error) {
      console.error("[mysql] product failed", error);
      if (fallbackEnabled()) {
        const demo = mockProducts.find((item) => item.slug === slug) ?? null;
        return demo ? (await withCatalog([demo]))[0] ?? null : null;
      }
      throw error;
    }
  }

  if (getCmsMode() === "mock") {
    const product = mockProducts.find((item) => item.slug === slug) ?? null;
    return product ? (await withCatalog([product]))[0] ?? null : null;
  }

  const product = await withFallback(
    `product:${slug}`,
    async () => {
      const query = new URLSearchParams({
        "filters[slug][$eq]": slug,
        "pagination[pageSize]": "1",
        populate: "*",
        publicationState: "live",
      });
      const payload = await strapiFetchJson(
        `/api/products?${query.toString()}`,
        ["products", `product:${slug}`],
        REVALIDATE.products,
      );
      const adapted = adaptProducts(payload, mediaOptions());
      return adapted[0] ?? null;
    },
    mockProducts.find((item) => item.slug === slug) ?? null,
  );
  return product ? (await withCatalog([product]))[0] ?? null : null;
}

export const getProductBySlug = cache(loadProductBySlug);

async function fetchStrapiArticles(): Promise<Article[]> {
  const records = await fetchAllPages(
    "/api/articles",
    "*",
    ["articles"],
    REVALIDATE.articles,
  );
  return adaptArticles(records, mediaOptions());
}

async function loadArticles(): Promise<Article[]> {
  if (getCmsMode() === "mysql") {
    try {
      return await listLivePublicArticles();
    } catch (error) {
      console.error("[mysql] articles failed", error);
      if (shouldFetchStrapiEditorial()) {
        return withFallback("articles", fetchStrapiArticles, mockArticles);
      }
      return [];
    }
  }

  return withFallback("articles", fetchStrapiArticles, mockArticles);
}

export const getArticles = cache(loadArticles);

async function fetchStrapiArticleBySlug(slug: string): Promise<Article | null> {
  const query = new URLSearchParams({
    "filters[slug][$eq]": slug,
    "pagination[pageSize]": "1",
    populate: "*",
    publicationState: "live",
  });
  const payload = await strapiFetchJson(
    `/api/articles?${query.toString()}`,
    ["articles", `article:${slug}`],
    REVALIDATE.articles,
  );
  const adapted = adaptArticles(payload, mediaOptions());
  return adapted[0] ?? null;
}

async function loadArticleBySlug(
  slug: string,
): Promise<Article | null> {
  const mockHit = () => mockArticles.find((item) => item.slug === slug) ?? null;

  if (getCmsMode() === "mysql") {
    try {
      const live = await getLivePublicArticleBySlug(slug);
      if (live) return live;
    } catch (error) {
      console.error("[mysql] article failed", error);
    }
    if (shouldFetchStrapiEditorial()) {
      return withFallback(`article:${slug}`, () => fetchStrapiArticleBySlug(slug), mockHit());
    }
    return mockHit();
  }

  if (!shouldFetchStrapiEditorial()) {
    return mockHit();
  }

  return withFallback(
    `article:${slug}`,
    () => fetchStrapiArticleBySlug(slug),
    mockHit(),
  );
}

export const getArticleBySlug = cache(loadArticleBySlug);

async function loadFaqs(): Promise<Faq[]> {
  return withFallback(
    "faqs",
    async () => {
      const records = await fetchAllPages(
        "/api/faqs",
        "*",
        ["faqs"],
        REVALIDATE.faqs,
      );
      return adaptFaqs(records).sort((a, b) => a.order - b.order);
    },
    [...mockFaqs].sort((a, b) => a.order - b.order),
  );
}

export const getFaqs = cache(loadFaqs);

async function loadPortfolios(): Promise<Portfolio[]> {
  return withFallback(
    "portfolios",
    async () => {
      const records = await fetchAllPages(
        "/api/portfolios",
        "*",
        ["portfolios"],
        REVALIDATE.portfolios,
      );
      return adaptPortfolios(records, mediaOptions());
    },
    mockPortfolios,
  );
}

export const getPortfolios = cache(loadPortfolios);

export async function getPortfolioBySlug(
  slug: string,
): Promise<Portfolio | null> {
  const all = await getPortfolios();
  return all.find((item) => item.slug === slug) ?? null;
}
