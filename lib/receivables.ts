/**
 * Receivables (ลูกหนี้) for credit orders: due dates and aging buckets.
 * Dates are calendar days in Asia/Bangkok, formatted YYYY-MM-DD.
 */

export const AGING_BUCKETS = ["not_due", "d1_30", "d31_60", "d61_90", "d90_plus", "no_due"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  not_due: "ยังไม่ถึงกำหนด",
  d1_30: "เกินกำหนด 1–30 วัน",
  d31_60: "เกินกำหนด 31–60 วัน",
  d61_90: "เกินกำหนด 61–90 วัน",
  d90_plus: "เกินกำหนดมากกว่า 90 วัน",
  no_due: "ยังไม่วางบิล",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bangkok calendar date of an instant, YYYY-MM-DD. */
export function bangkokYmd(date: Date): string {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Due date = Bangkok date of `from` plus `days` calendar days. */
export function computeDueDate(from: Date, days: number): string {
  const start = bangkokYmd(from);
  const d = new Date(`${start}T00:00:00Z`);
  return new Date(d.getTime() + Math.max(0, Math.floor(days)) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Whole days past due (negative = days left). */
export function daysPastDue(dueDate: string, today: Date): number {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${bangkokYmd(today)}T00:00:00Z`);
  return Math.round((now - due) / DAY_MS);
}

export function agingBucket(dueDate: string | null, today: Date): AgingBucket {
  if (!dueDate) return "no_due";
  const late = daysPastDue(dueDate, today);
  if (late <= 0) return "not_due";
  if (late <= 30) return "d1_30";
  if (late <= 60) return "d31_60";
  if (late <= 90) return "d61_90";
  return "d90_plus";
}

export type ReceivableInput = {
  orderId: string;
  company: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string | null;
  creditDays: number;
};

export type ReceivableRow<T extends ReceivableInput = ReceivableInput> = T & {
  outstanding: number;
  bucket: AgingBucket;
  daysPastDue: number | null;
};

export type ReceivablesSummary<T extends ReceivableInput = ReceivableInput> = {
  rows: ReceivableRow<T>[];
  totals: Record<AgingBucket, number>;
  totalOutstanding: number;
  overdueOutstanding: number;
};

function roundBaht(n: number): number {
  return Math.round(n * 100) / 100;
}

export function summarizeReceivables<T extends ReceivableInput>(
  orders: T[],
  today: Date,
): ReceivablesSummary<T> {
  const totals = Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>;
  const rows: ReceivableRow<T>[] = [];
  for (const order of orders) {
    const outstanding = roundBaht(order.totalAmount - order.paidAmount);
    if (outstanding <= 0.005) continue;
    const bucket = agingBucket(order.dueDate, today);
    rows.push({
      ...order,
      outstanding,
      bucket,
      daysPastDue: order.dueDate ? daysPastDue(order.dueDate, today) : null,
    });
    totals[bucket] = roundBaht(totals[bucket] + outstanding);
  }
  rows.sort((a, b) => (b.daysPastDue ?? -99999) - (a.daysPastDue ?? -99999));
  const totalOutstanding = roundBaht(rows.reduce((s, r) => s + r.outstanding, 0));
  const overdueOutstanding = roundBaht(
    totals.d1_30 + totals.d31_60 + totals.d61_90 + totals.d90_plus,
  );
  return { rows, totals, totalOutstanding, overdueOutstanding };
}
