/** Shared SEO length rules (aligned with Strapi shared.seo). */

export const SEO_TITLE_MAX = 60;
export const SEO_TITLE_MIN = 8;
export const SEO_DESC_MIN = 120;
export const SEO_DESC_MAX = 160;

export function clampSeoTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, SEO_TITLE_MAX);
}

export function clampSeoDescription(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= SEO_DESC_MAX) return text;
  const cut = text.slice(0, SEO_DESC_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace >= SEO_DESC_MIN ? cut.slice(0, lastSpace) : cut).trim();
}

export function isValidSeoTitle(value: string): boolean {
  const n = value.trim().length;
  return n >= SEO_TITLE_MIN && n <= SEO_TITLE_MAX;
}

export function isValidSeoDescription(value: string): boolean {
  const n = value.trim().length;
  return n >= SEO_DESC_MIN && n <= SEO_DESC_MAX;
}

const DESC_PAD =
  " สกรีนโลโก้ได้ สั่งผลิตตามออเดอร์แล้วผลิตจากจีน ขอใบเสนอราคาได้โดยไม่ชำระเงินบนเว็บ";

/** Ensure a description sits in the 120–160 window without inventing prices. */
export function fitSeoDescription(value: string): string {
  let text = clampSeoDescription(value);
  let guard = 0;
  while (text.length < SEO_DESC_MIN && guard < 4) {
    text = clampSeoDescription(`${text}${DESC_PAD}`);
    guard += 1;
  }
  return text;
}
