import type { MetadataRoute } from "next";
import {
  getArticles,
  getCategories,
  getPortfolios,
  getProducts,
} from "@/lib/strapi";
import { IDEA_THEMES, ideaThemePath } from "@/lib/seo-themes";
import { site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url.replace(/\/$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    "/",
    "/premium-giftset",
    "/products",
    "/catalog",
    "/ideas",
    "/customize-gift-set",
    "/about",
    "/portfolio",
    "/blog",
    "/contact",
    "/issues",
    "/privacy",
    "/terms",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency:
      path === "/" || path === "/premium-giftset" || path === "/ideas"
        ? "weekly"
        : "monthly",
    priority:
      path === "/"
        ? 1
        : path === "/premium-giftset" || path === "/ideas"
          ? 0.9
          : 0.7,
  }));

  const [categories, products, articles, portfolios] = await Promise.all([
    getCategories(),
    getProducts(),
    getArticles(),
    getPortfolios(),
  ]);

  const dynamicEntries: MetadataRoute.Sitemap = [
    ...categories.map((category) => ({
      url: `${base}/giftset/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map((category) => ({
      url: `${base}/catalog/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
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
    ...portfolios.map((item) => ({
      url: `${base}/portfolio/${item.slug}`,
      lastModified: item.completedAt ? new Date(item.completedAt) : now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...IDEA_THEMES.map((theme) => ({
      url: `${base}${ideaThemePath(theme.slug)}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ];

  return [...staticEntries, ...dynamicEntries];
}
