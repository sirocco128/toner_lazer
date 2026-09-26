/**
 * Pure mapping from CMS model + entry → Next.js paths/tags.
 * Used by POST /api/revalidate (and unit tests).
 */

export const REVALIDATE_MODELS = [
  "product",
  "gift-set-category",
  "article",
  "faq",
  "portfolio",
] as const;

export type RevalidateModel = (typeof REVALIDATE_MODELS)[number];

export type RevalidateEntry = {
  slug?: string;
  category?: string;
};

export type RevalidateTargets = {
  paths: string[];
  tags: string[];
};

export function mapRevalidateTargets(
  model: RevalidateModel,
  entry?: RevalidateEntry,
): RevalidateTargets {
  const slug = entry?.slug;
  const categorySlug = entry?.category || entry?.slug;
  const paths: string[] = [];
  const tags: string[] = [];

  switch (model) {
    case "product":
      paths.push("/", "/products", "/catalog", "/sitemap.xml");
      if (slug) paths.push(`/products/${slug}`);
      if (categorySlug) {
        paths.push(`/giftset/${categorySlug}`);
        paths.push(`/catalog/${categorySlug}`);
      }
      tags.push("products");
      if (slug) tags.push(`product:${slug}`);
      if (categorySlug) tags.push(`category:${categorySlug}`);
      break;
    case "gift-set-category":
      paths.push("/", "/premium-giftset", "/catalog", "/sitemap.xml");
      if (slug) {
        paths.push(`/giftset/${slug}`);
        paths.push(`/catalog/${slug}`);
      }
      tags.push("categories");
      if (slug) tags.push(`category:${slug}`);
      break;
    case "article":
      paths.push("/blog", "/sitemap.xml");
      if (slug) paths.push(`/blog/${slug}`);
      tags.push("articles");
      if (slug) tags.push(`article:${slug}`);
      break;
    case "faq":
      paths.push("/premium-giftset");
      tags.push("faqs");
      break;
    case "portfolio":
      paths.push("/portfolio", "/sitemap.xml");
      if (slug) paths.push(`/portfolio/${slug}`);
      tags.push("portfolios");
      if (slug) tags.push(`portfolio:${slug}`);
      break;
    default: {
      const _exhaustive: never = model;
      throw new Error(`unsupported model: ${_exhaustive}`);
    }
  }

  return { paths, tags };
}
