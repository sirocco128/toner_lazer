/**
 * Thai amount-in-words for tax invoices / receipts (จำนวนเงินเป็นตัวอักษร).
 */

const ONES = [
  "",
  "หนึ่ง",
  "สอง",
  "สาม",
  "สี่",
  "ห้า",
  "หก",
  "เจ็ด",
  "แปด",
  "เก้า",
] as const;

function readBelowMillion(n: number): string {
  if (n <= 0) return "";
  const hundredThousand = Math.floor(n / 100_000);
  const tenThousand = Math.floor((n % 100_000) / 10_000);
  const thousand = Math.floor((n % 10_000) / 1_000);
  const hundred = Math.floor((n % 1_000) / 100);
  const ten = Math.floor((n % 100) / 10);
  const one = n % 10;

  let out = "";
  if (hundredThousand) out += `${ONES[hundredThousand]}แสน`;
  if (tenThousand) out += `${ONES[tenThousand]}หมื่น`;
  if (thousand) out += `${ONES[thousand]}พัน`;
  if (hundred) out += `${ONES[hundred]}ร้อย`;
  if (ten === 1) out += "สิบ";
  else if (ten === 2) out += "ยี่สิบ";
  else if (ten > 2) out += `${ONES[ten]}สิบ`;
  if (one === 1 && ten > 0) out += "เอ็ด";
  else if (one === 1 && n >= 100 && ten === 0) out += "เอ็ด";
  else if (one) out += ONES[one];
  return out;
}

function readInteger(n: number): string {
  if (n === 0) return "ศูนย์";
  if (n < 0) return `ลบ${readInteger(-n)}`;
  const parts: string[] = [];
  let remaining = n;
  let scale = 0;
  while (remaining > 0) {
    const group = remaining % 1_000_000;
    if (group) {
      const chunk = readBelowMillion(group);
      const suffix = scale > 0 ? "ล้าน".repeat(scale) : "";
      parts.unshift(`${chunk}${suffix}`);
    }
    remaining = Math.floor(remaining / 1_000_000);
    scale += 1;
  }
  return parts.join("");
}

/** 1.00 → หนึ่งบาทถ้วน · 21.50 → ยี่สิบเอ็ดบาทห้าสิบสตางค์ */
export function bahtText(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  const satangTotal = Math.round(amount * 100);
  const sign = satangTotal < 0 ? "ลบ" : "";
  const abs = Math.abs(satangTotal);
  const baht = Math.floor(abs / 100);
  const satang = abs % 100;
  const bahtWords = `${sign}${readInteger(baht)}บาท`;
  if (satang === 0) return `${bahtWords}ถ้วน`;
  return `${bahtWords}${readInteger(satang)}สตางค์`;
}
