import type { Category, Product } from "@/lib/data";
import { productCoverImage } from "@/lib/product-media";

export const OTHER_CATALOG_GROUP_SLUG = "other";

export type CatalogBookProduct = {
  name: string;
  slug: string;
  description: string;
  material: string;
  minOrder: number;
  priceRange: string;
  image: string;
  categorySlug: string;
};

export type CatalogBookGroup = {
  slug: string;
  name: string;
  description: string;
  heroImage: string;
  products: CatalogBookProduct[];
};

export type CatalogCoverPage = {
  kind: "cover";
  title: string;
  subtitle: string;
  image: string;
  groupLabel: string;
  productCount: number;
};

export type CatalogSectionPage = {
  kind: "section";
  slug: string;
  name: string;
  description: string;
  image: string;
  count: number;
};

export type CatalogProductPage = {
  kind: "product";
  product: CatalogBookProduct;
  groupName: string;
};

export type CatalogClosingPage = {
  kind: "closing";
  title: string;
  body: string;
};

export type CatalogFilePage = {
  kind: "file";
  title: string;
  groupName: string;
  originalName: string;
  fileKind: "photo" | "pdf";
  image?: string;
  href?: string;
};

export type CatalogBookPage =
  | CatalogCoverPage
  | CatalogSectionPage
  | CatalogProductPage
  | CatalogFilePage
  | CatalogClosingPage;

export type CatalogBook = {
  groups: CatalogBookGroup[];
  pages: CatalogBookPage[];
  filterSlug: string | null;
};

function toBookProduct(product: Product): CatalogBookProduct {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    material: product.material,
    minOrder: product.minOrder,
    priceRange: product.priceRange,
    image: productCoverImage(product.images, product.categorySlug),
    categorySlug: product.categorySlug,
  };
}

export function groupCatalogProducts(
  products: Product[],
  categories: Category[],
  filterSlug?: string | null,
): CatalogBookGroup[] {
  const wanted = String(filterSlug || "").trim();
  const visible = wanted
    ? products.filter((product) => product.categorySlug === wanted)
    : products;

  const bySlug = new Map<string, Product[]>();
  for (const product of visible) {
    const key = product.categorySlug || OTHER_CATALOG_GROUP_SLUG;
    const list = bySlug.get(key) ?? [];
    list.push(product);
    bySlug.set(key, list);
  }

  const groups: CatalogBookGroup[] = [];
  for (const category of categories) {
    if (wanted && category.slug !== wanted) continue;
    const list = bySlug.get(category.slug) ?? [];
    bySlug.delete(category.slug);
    if (wanted || list.length > 0) {
      groups.push({
        slug: category.slug,
        name: category.name,
        description: category.description,
        heroImage: category.heroImage,
        products: list.map(toBookProduct),
      });
    }
  }

  const leftover = [...bySlug.values()].flat();
  if (leftover.length > 0 && (!wanted || wanted === OTHER_CATALOG_GROUP_SLUG)) {
    groups.push({
      slug: OTHER_CATALOG_GROUP_SLUG,
      name: "กลุ่มอื่น",
      description: "สินค้าที่ยังไม่ได้จัดหมวดบนเว็บ แต่สกรีนโลโก้ใส่ได้เช่นกัน",
      heroImage: productCoverImage(leftover[0]?.images, leftover[0]?.categorySlug),
      products: leftover.map(toBookProduct),
    });
  }

  return groups;
}

export function buildCatalogBook(options: {
  products: Product[];
  categories: Category[];
  filterSlug?: string | null;
  title: string;
  subtitle: string;
  closingTitle: string;
  closingBody: string;
}): CatalogBook {
  const filterSlug = String(options.filterSlug || "").trim() || null;
  const groups = groupCatalogProducts(
    options.products,
    options.categories,
    filterSlug,
  );
  const productCount = groups.reduce((sum, group) => sum + group.products.length, 0);
  const coverImage =
    groups.find((group) => group.heroImage)?.heroImage ||
    groups[0]?.products[0]?.image ||
    productCoverImage([]);
  const groupLabel =
    filterSlug && groups.length === 1 ? groups[0]!.name : "ทุกกลุ่มสินค้า";

  const pages: CatalogBookPage[] = [
    {
      kind: "cover",
      title: options.title,
      subtitle: options.subtitle,
      image: coverImage,
      groupLabel,
      productCount,
    },
  ];

  for (const group of groups) {
    if (!filterSlug || groups.length > 1) {
      pages.push({
        kind: "section",
        slug: group.slug,
        name: group.name,
        description: group.description,
        image: group.heroImage || group.products[0]?.image || coverImage,
        count: group.products.length,
      });
    }
    for (const product of group.products) {
      pages.push({
        kind: "product",
        product,
        groupName: group.name,
      });
    }
  }

  pages.push({
    kind: "closing",
    title: options.closingTitle,
    body: options.closingBody,
  });

  return { groups, pages, filterSlug };
}

/** 1-based page number matching FlipHTML5 `#p=` and in-app flip index. */
export function catalogPageNumberForSlug(
  pages: CatalogBookPage[],
  slug: string | null | undefined,
): number | null {
  const wanted = String(slug || "").trim();
  if (!wanted) return null;
  const index = pages.findIndex(
    (page) => page.kind === "product" && page.product.slug === wanted,
  );
  return index >= 0 ? index + 1 : null;
}

export function clampCatalogPage(
  pages: CatalogBookPage[],
  pageNumber: number | null | undefined,
): number | null {
  if (!pageNumber || pageNumber < 1) return null;
  if (pageNumber > pages.length) return pages.length;
  return pageNumber;
}
