import { TONER_SERVICE_POINTS } from "@/lib/toner-copy";

/**
 * Public brand defaults to Toner Lazer. The juristic person printed on tax
 * invoices, receipts and PromptPay (legal name, tax ID, address) is read from
 * COMPANY_* env vars. Until those are set it falls back to the entity the
 * baseline was built for (บริษัท เทราบิส จำกัด) — set the real toner company
 * before issuing any invoice. Do not invent phone, email, or LINE.
 */

function envOr(key: string, fallback: string): string {
  const value = (process.env[key] ?? "").trim();
  return value || fallback;
}

export const COMPANY = {
  brandName: envOr("COMPANY_BRAND_NAME", "Toner Lazer"),
  legalName: envOr("COMPANY_LEGAL_NAME", "บริษัท เทราบิส จำกัด"),
  legalNameEn: envOr("COMPANY_LEGAL_NAME_EN", "Terabiz Company Limited"),
  taxId: envOr("COMPANY_TAX_ID", "0105556003873"),
  registeredOn: envOr("COMPANY_REGISTERED_ON", "2013-01-09"),
  registeredOnTh: envOr("COMPANY_REGISTERED_ON_TH", "9 มกราคม 2556"),
  streetAddress: envOr("COMPANY_STREET_ADDRESS", "50/238 ซอยประชาอุทิศ 72"),
  locality: envOr("COMPANY_LOCALITY", "แขวงทุ่งครุ"),
  region: envOr("COMPANY_REGION", "เขตทุ่งครุ กรุงเทพมหานคร"),
  postalCode: envOr("COMPANY_POSTAL_CODE", "10140"),
  countryCode: "TH",
  countryTh: "ประเทศไทย",
  description: envOr(
    "COMPANY_DESCRIPTION",
    "ตลับหมึกเลเซอร์เทียบเท่าสำหรับองค์กรและหน่วยงานรัฐ ครบ HP Brother Samsung ประหยัดกว่าของแท้ เอกสารยื่นงานรัฐครบ ออกใบกำกับภาษีได้",
  ),
};

export const COMPANY_SERVICES = TONER_SERVICE_POINTS;

export function formatRegisteredAddress(parts?: {
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
}): string {
  const street = parts?.streetAddress || COMPANY.streetAddress;
  const locality = parts?.locality || COMPANY.locality;
  const region = parts?.region || COMPANY.region;
  const postal = parts?.postalCode || COMPANY.postalCode;
  return [street, locality, region, postal].filter(Boolean).join(" ");
}

export function isPlaceholderPhone(display: string, href: string): boolean {
  return /000/.test(display) || /000/.test(href);
}

export function isPlaceholderEmail(email: string): boolean {
  return /@example\.com$/i.test(email);
}

export function isPlaceholderLine(id: string, url: string): boolean {
  return /giftproasia/i.test(id) || /giftproasia/i.test(url);
}

const SCHEMA_DAY_TH: Record<string, string> = {
  Mo: "จันทร์",
  Tu: "อังคาร",
  We: "พุธ",
  Th: "พฤหัสบดี",
  Fr: "ศุกร์",
  Sa: "เสาร์",
  Su: "อาทิตย์",
};

/** Show schema.org hours like Mo-Sa 08:30-17:30 in Thai. Keep the raw value for JSON-LD. */
export function formatOpeningHoursDisplay(raw: string): string {
  const match = raw
    .trim()
    .match(/^([A-Za-z]{2})-([A-Za-z]{2})\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (!match?.[1] || !match[2] || !match[3] || !match[4]) return raw;
  const from = SCHEMA_DAY_TH[match[1]] || match[1];
  const to = SCHEMA_DAY_TH[match[2]] || match[2];
  const clock = (value: string) => value.replace(/^0/, "");
  return `${from}–${to} ${clock(match[3])}–${clock(match[4])} น.`;
}
