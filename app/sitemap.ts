import type { MetadataRoute } from "next";
import { getArticles, getProducts } from "@/lib/strapi";
import { site } from "@/lib/site";

/** Gift-set routes from the baseline redirect to /toner and stay out of the sitemap. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url.replace(/\/$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    "/",
    "/toner",
    "/products",
    "/about",
    "/blog",
    "/contact",
    "/issues",
    "/privacy",
    "/terms",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" || path === "/toner" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/toner" ? 0.9 : 0.7,
  }));

  const [products, articles] = await Promise.all([getProducts(), getArticles()]);

  const dynamicEntries: MetadataRoute.Sitemap = [
    ...products.map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...articles.map((article) => ({
      url: `${base}/blog/${article.slug}`,
      lastModified: article.updatedAt
        ? new Date(article.updatedAt)
        : article.publishedAt
          ? new Date(article.publishedAt)
          : now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

  return [...staticEntries, ...dynamicEntries];
}
