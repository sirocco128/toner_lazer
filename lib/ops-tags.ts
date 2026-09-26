export const OPS_TAG_ENTITY_TYPES = ["customer", "order", "voucher"] as const;
export type OpsTagEntityType = (typeof OPS_TAG_ENTITY_TYPES)[number];

/** Quick-add labels for sales / accounting. Stored lowercase. */
export const SUGGESTED_OPS_TAGS = [
  "vip",
  "hr",
  "event",
  "esg",
  "ปีใหม่",
  "สงกรานต์",
  "ด่วน",
  "ตัวอย่าง",
  "พนักงานใหม่",
  "ของขวัญลูกค้า",
] as const;

export function isOpsTagEntityType(value: string): value is OpsTagEntityType {
  return (OPS_TAG_ENTITY_TYPES as readonly string[]).includes(value);
}

export function parseOpsTags(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) {
    return normalizeOpsTags(raw);
  }
  const text = String(raw || "").trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return normalizeOpsTags(parsed.map((item) => String(item)));
      }
    } catch {
      /* comma list */
    }
  }
  return normalizeOpsTags(text.split(/[,|]/));
}

export function normalizeOpsTags(tags: string[]): string[] {
  return [
    ...new Set(
      tags
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0 && item.length <= 40),
    ),
  ];
}

export function serializeOpsTags(tags: string[] | undefined): string | null {
  const unique = normalizeOpsTags(tags || []);
  return unique.length ? JSON.stringify(unique) : null;
}
