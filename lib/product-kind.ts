import { categories, products } from "@/lib/data";

export const PRODUCT_KINDS = [
  "tumbler",
  "stationery",
  "eco",
  "it",
  "team",
  "packaging",
  "other",
] as const;

export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  tumbler: "กระบอกน้ำ / แก้ว",
  stationery: "สมุด / ปากกา",
  eco: "ชุดรักษ์โลก",
  it: "อุปกรณ์ไอที",
  team: "ทริป / ทีมบิลดิ้ง",
  packaging: "ถุงผ้า / บรรจุภัณฑ์",
  other: "อื่นๆ",
};

const CATEGORY_SLUG_TO_KIND: Record<string, ProductKind> = {
  "tumbler-set": "tumbler",
  "eco-giftset": "eco",
  "it-set": "it",
  "team-building-set": "team",
  "eco-friendly": "eco",
  "classic-oriental": "stationery",
  "novelty-self-care": "tumbler",
  "executive-smart-tech": "it",
  "gift-set": "tumbler",
  drinkware: "tumbler",
  technology: "it",
  wellness: "tumbler",
  office: "stationery",
  bag: "packaging",
  eco: "eco",
  custom: "other",
};

const KIND_PATTERNS: Array<{ kind: ProductKind; pattern: RegExp }> = [
  { kind: "eco", pattern: /รักษ์โลก|รีไซเคิล|eco|ไม้ไผ่|หลอด/i },
  { kind: "it", pattern: /แฟลช|flash\s?drive|powerbank|พาวเวอร์แบงก์|สายชาร์จ|usb|ไอที|it[- ]?set|แกเจ็ต/i },
  { kind: "packaging", pattern: /ถุงผ้า|tote|บรรจุภัณฑ์|กล่องจั่ว|packaging/i },
  { kind: "team", pattern: /ทีมบิล|ทริปบริษัท|เสื้อ|หมวก|team.?build/i },
  { kind: "tumbler", pattern: /กระบอก|แก้ว|tumbler|bottle|mug|สแตนเลส/i },
  { kind: "stationery", pattern: /สมุด|ปากกา|notebook|pen\b|สเตชันเนอรี่/i },
];

export function kindFromCategorySlug(slug: string | null | undefined): ProductKind | null {
  const key = String(slug || "").trim();
  if (!key) return null;
  return CATEGORY_SLUG_TO_KIND[key] ?? null;
}

export function classifyProductKind(input: {
  productSlug?: string | null;
  productInterest?: string | null;
  productSummary?: string | null;
}): ProductKind {
  const slug = String(input.productSlug || "").trim();
  if (slug) {
    const product = products.find((row) => row.slug === slug);
    const fromProduct = kindFromCategorySlug(product?.categorySlug);
    if (fromProduct) return fromProduct;
    const fromCategory = kindFromCategorySlug(slug);
    if (fromCategory) return fromCategory;
    const category = categories.find((row) => row.slug === slug);
    const fromNamed = kindFromCategorySlug(category?.slug);
    if (fromNamed) return fromNamed;
  }

  const hay = `${input.productInterest || ""} ${input.productSummary || ""} ${slug}`;
  for (const row of KIND_PATTERNS) {
    if (row.pattern.test(hay)) return row.kind;
  }
  return "other";
}

export function productLabelFromParts(input: {
  productSlug?: string | null;
  productInterest?: string | null;
  productSummary?: string | null;
}): string {
  const interest = String(input.productInterest || "").trim();
  if (interest) return interest;
  const slug = String(input.productSlug || "").trim();
  if (slug) {
    const product = products.find((row) => row.slug === slug);
    if (product) return product.name;
    const category = categories.find((row) => row.slug === slug);
    if (category) return category.name;
  }
  const summary = String(input.productSummary || "").trim();
  return summary || "สินค้าสั่งผลิตสกรีนโลโก้";
}
