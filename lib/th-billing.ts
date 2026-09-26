/**
 * Thai VAT + document helpers for a VAT-registered company (ภ.พ.30).
 * Goods sales: output VAT 7%. No withholding on goods (WHT is for services).
 */

export const THAI_VAT_RATE = 7;
export const DEFAULT_DEPOSIT_PERCENT = 50;
/** Grand total at/under this amount → collect 100% (small-order rule). */
export const FULL_PAYMENT_THRESHOLD_THB = 10_000;

export const VAT_MODES = ["exclusive", "inclusive"] as const;
export type VatMode = (typeof VAT_MODES)[number];

export const DEPOSIT_MODES = ["auto", "percent", "full"] as const;
export type DepositMode = (typeof DEPOSIT_MODES)[number];

export type VatBreakdown = {
  vatMode: VatMode;
  vatRate: number;
  subtotalExVat: number;
  vatAmount: number;
  grandTotal: number;
};

export type DepositPlan = {
  mode: DepositMode;
  appliedPercent: number;
  collectFull: boolean;
  depositAmount: number;
  remainingAmount: number;
  reason: string;
};

export function roundSatang(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function satang(value: number): number {
  return Math.round(value * 100);
}

export function fromSatang(cents: number): number {
  return roundSatang(cents / 100);
}

export function splitVat(input: {
  amount: number;
  vatMode?: VatMode;
  vatRate?: number;
}): VatBreakdown {
  const vatMode = input.vatMode ?? "exclusive";
  const vatRate = input.vatRate ?? THAI_VAT_RATE;
  const amount = roundSatang(input.amount);
  if (!(amount > 0) || !Number.isFinite(amount)) {
    throw new Error("invalid_amount");
  }
  if (vatMode === "inclusive") {
    const grandTotal = amount;
    const subtotalExVat = roundSatang(grandTotal / (1 + vatRate / 100));
    const vatAmount = roundSatang(grandTotal - subtotalExVat);
    return { vatMode, vatRate, subtotalExVat, vatAmount, grandTotal };
  }
  const subtotalExVat = amount;
  const vatAmount = roundSatang(subtotalExVat * (vatRate / 100));
  const grandTotal = roundSatang(subtotalExVat + vatAmount);
  return { vatMode, vatRate, subtotalExVat, vatAmount, grandTotal };
}

/**
 * Deposit is a percent of the **grand total the customer pays** (รวม VAT).
 * Auto: เต็มจำนวน when grand ≤ threshold, otherwise default 50%.
 */
export function calculateDepositPlan(input: {
  grandTotal: number;
  mode: DepositMode;
  percent?: number;
  fullPaymentThreshold?: number;
}): DepositPlan {
  const grand = roundSatang(input.grandTotal);
  if (!(grand > 0)) throw new Error("invalid_amount");
  const threshold = input.fullPaymentThreshold ?? FULL_PAYMENT_THRESHOLD_THB;
  const requested = input.percent ?? DEFAULT_DEPOSIT_PERCENT;

  if (input.mode === "full") {
    return {
      mode: input.mode,
      appliedPercent: 100,
      collectFull: true,
      depositAmount: grand,
      remainingAmount: 0,
      reason: "เก็บเต็มจำนวนตามที่ตกลงในใบเสนอราคา",
    };
  }

  if (input.mode === "auto" && grand <= threshold) {
    return {
      mode: input.mode,
      appliedPercent: 100,
      collectFull: true,
      depositAmount: grand,
      remainingAmount: 0,
      reason: `ยอดรวมไม่เกิน ${threshold.toLocaleString("th-TH")} บาท จึงเก็บเต็มจำนวน`,
    };
  }

  const percent = Math.min(100, Math.max(1, roundSatang(requested)));
  if (percent >= 100) {
    return {
      mode: input.mode,
      appliedPercent: 100,
      collectFull: true,
      depositAmount: grand,
      remainingAmount: 0,
      reason: "อัตรามัดจำ 100% จึงเก็บเต็มจำนวน",
    };
  }

  const depositAmount = fromSatang(Math.round((satang(grand) * percent) / 100));
  const remainingAmount = roundSatang(grand - depositAmount);
  return {
    mode: input.mode,
    appliedPercent: percent,
    collectFull: remainingAmount <= 0,
    depositAmount,
    remainingAmount: Math.max(0, remainingAmount),
    reason:
      "สินค้าสั่งผลิตจากจีน เก็บมัดจำก่อนเปิดงานผลิต ส่วนที่เหลือชำระเมื่อสินค้าเข้าคลังในไทย",
  };
}

export function formatThb(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatThbPlain(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Buddhist calendar period YYYYMM for Thai document running numbers. */
export function buddhistPeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year + 543}${month}`;
}

export function formatThaiDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "long",
      timeZone: "Asia/Bangkok",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatThaiDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function normalizeThaiTaxId(raw: string | null | undefined): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 13) return digits;
  return digits.length ? digits : null;
}

export function isValidThaiTaxId(raw: string | null | undefined): boolean {
  const id = normalizeThaiTaxId(raw);
  if (!id || id.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(id[i]) * (13 - i);
  }
  const check = (11 - (sum % 11)) % 10;
  return check === Number(id[12]);
}
