import { SMART_GIFT_PARTNER_POINTS } from "@/lib/smart-gift-method";

/**
 * Public brand is Smart Gift. The registered juristic person, tax ID, and
 * address stay บริษัท เทราบิส จำกัด (DBD 0105556003873) so invoices and
 * payment slips match the bank account. Do not invent phone, email, or LINE.
 */

export const COMPANY = {
  brandName: "Smart Gift",
  legalName: "บริษัท เทราบิส จำกัด",
  legalNameEn: "Terabiz Company Limited",
  taxId: "0105556003873",
  registeredOn: "2013-01-09",
  registeredOnTh: "9 มกราคม 2556",
  streetAddress: "50/238 ซอยประชาอุทิศ 72",
  locality: "แขวงทุ่งครุ",
  region: "เขตทุ่งครุ กรุงเทพมหานคร",
  postalCode: "10140",
  countryCode: "TH",
  countryTh: "ประเทศไทย",
  description:
    "ของพรีเมียมครบทุกหมวดสำหรับทุกแบรนด์และทุกแคมเปญ สกรีนโลโก้ได้ สั่งผลิตตามแบบจากจีน แล้วขอใบเสนอราคา",
} as const;

export const COMPANY_SERVICES = SMART_GIFT_PARTNER_POINTS;

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
