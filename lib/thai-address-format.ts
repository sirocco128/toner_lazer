/**
 * Client-safe Thai address labels and mailing-line formatting.
 * Keep filesystem dataset loading in lib/thai-address.ts.
 */

export function normalizeThaiPlaceName(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/^จังหวัด/, "")
    .replace(/^อำเภอ/, "")
    .replace(/^เขต/, "")
    .replace(/^ตำบล/, "")
    .replace(/^แขวง/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBangkokProvince(raw: string): boolean {
  const n = normalizeThaiPlaceName(raw)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "");
  return (
    n === "กรุงเทพมหานคร" ||
    n === "กรุงเทพ" ||
    n === "กทม" ||
    n === "bangkok"
  );
}

export function thaiDistrictLabel(province: string): string {
  return isBangkokProvince(province) ? "เขต" : "อำเภอ";
}

export function thaiSubdistrictLabel(province: string): string {
  return isBangkokProvince(province) ? "แขวง" : "ตำบล";
}

export function formatShipToLabel(parts: {
  province?: string;
  district?: string;
  subdistrict?: string;
}): string {
  const province = normalizeThaiPlaceName(parts.province || "");
  const district = normalizeThaiPlaceName(parts.district || "");
  const subdistrict = normalizeThaiPlaceName(parts.subdistrict || "");
  if (isBangkokProvince(province) || (!province && isBangkokProvince(parts.province || ""))) {
    return [
      subdistrict ? `แขวง${subdistrict}` : "",
      district ? `เขต${district}` : "",
      province || parts.province ? "กรุงเทพมหานคร" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    subdistrict ? `ตำบล${subdistrict}` : "",
    district ? `อำเภอ${district}` : "",
    province ? `จังหวัด${province}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export type ThaiMailingParts = {
  streetAddress: string;
  province: string;
  district: string;
  subdistrict: string;
  zip: string;
};

export function formatThaiMailingAddress(parts: {
  streetAddress?: string;
  province?: string;
  district?: string;
  subdistrict?: string;
  zip?: string;
}): string {
  return [
    String(parts.streetAddress || "").trim(),
    formatShipToLabel(parts),
    String(parts.zip || "").trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

function looksLikeStreetLine(value: string): boolean {
  return /[0-9]|หมู่|ซอย|ถนน|ตรอก|อาคาร|ชั้น|เลขที่|ม\./.test(value);
}

/**
 * Split a composed Thai mailing line (or a province-only value) back into fields.
 * Used when quote.province stored the full address instead of just the province.
 */
export function parseThaiMailingAddress(raw: string): ThaiMailingParts {
  const empty: ThaiMailingParts = {
    streetAddress: "",
    province: "",
    district: "",
    subdistrict: "",
    zip: "",
  };
  let text = String(raw || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!text) return empty;

  let zip = "";
  const zipMatch = text.match(/(\d{5})\s*$/);
  if (zipMatch?.[1]) {
    zip = zipMatch[1];
    text = text.slice(0, -zipMatch[0].length).trim();
  }

  let province = "";
  const bangkokMatch = text.match(/(กรุงเทพมหานคร|กรุงเทพฯ|กรุงเทพ|กทม\.?)$/);
  const jangwatMatch = text.match(/จังหวัด([^\s]+)$/);
  if (bangkokMatch && !jangwatMatch) {
    province = "กรุงเทพมหานคร";
    text = text.slice(0, bangkokMatch.index ?? text.length).trim();
  } else if (jangwatMatch?.[1]) {
    province = normalizeThaiPlaceName(jangwatMatch[1]);
    if (isBangkokProvince(province)) province = "กรุงเทพมหานคร";
    text = text.slice(0, jangwatMatch.index ?? text.length).trim();
  }

  let district = "";
  const districtMatch = text.match(/(?:อำเภอ|เขต)([^\s]+)$/);
  if (districtMatch?.[1]) {
    district = normalizeThaiPlaceName(districtMatch[1]);
    text = text.slice(0, districtMatch.index ?? text.length).trim();
  }

  let subdistrict = "";
  const subMatch = text.match(/(?:ตำบล|แขวง)([^\s]+)$/);
  if (subMatch?.[1]) {
    subdistrict = normalizeThaiPlaceName(subMatch[1]);
    text = text.slice(0, subMatch.index ?? text.length).trim();
  }

  let streetAddress = text;
  if (!province && !district && !subdistrict && !zip && streetAddress) {
    if (!looksLikeStreetLine(streetAddress)) {
      province = normalizeThaiPlaceName(streetAddress);
      streetAddress = "";
    }
  }

  return { streetAddress, province, district, subdistrict, zip };
}

function isComposedMailingLine(value: string): boolean {
  return /ตำบล|แขวง|อำเภอ|เขต|จังหวัด|\d{5}/.test(value);
}

/** Prefer structured quote payload; fall back to parsing the composed province column. */
export function quoteShipToParts(quote: {
  province?: string | null;
  rawPayload?: string | null;
}): ThaiMailingParts {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(quote.rawPayload || "{}") as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const pick = (key: string) => String(raw[key] ?? "").trim();
  const parsed = parseThaiMailingAddress(
    String(quote.province || pick("province") || ""),
  );
  const rawProvince = pick("province");

  return {
    streetAddress: pick("streetAddress") || parsed.streetAddress,
    province:
      rawProvince && !isComposedMailingLine(rawProvince)
        ? normalizeThaiPlaceName(rawProvince)
        : parsed.province,
    district: pick("district") || parsed.district,
    subdistrict: pick("subdistrict") || parsed.subdistrict,
    zip: pick("zip") || parsed.zip,
  };
}

export function composeOrderShipTo(parts: {
  streetAddress?: string;
  province?: string;
  district?: string;
  subdistrict?: string;
  zip?: string;
}): { shipToAddress: string; shipToProvince: string } {
  const streetAddress = String(parts.streetAddress || "").trim();
  const province = normalizeThaiPlaceName(parts.province || "");
  const district = normalizeThaiPlaceName(parts.district || "");
  const subdistrict = normalizeThaiPlaceName(parts.subdistrict || "");
  const zip = String(parts.zip || "").trim();
  return {
    shipToAddress: formatThaiMailingAddress({
      streetAddress,
      province,
      district,
      subdistrict,
      zip,
    }),
    shipToProvince: province,
  };
}
