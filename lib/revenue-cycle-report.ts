/**
 * Operational revenue-cycle report for the gift-set ops console.
 * Quote → order → deposit → factory → inbound → balance → tax invoice → delivery.
 * Gross profit / factory CNY stay in finance.read / factory.read surfaces.
 */

import { getDb } from "@/lib/database";
import { buildExecutivePnl, defaultFinanceRange } from "@/lib/finance-report";
import { csvEscape } from "@/lib/ledger-service";
import { countApprovalQueue } from "@/lib/payment-approval";
import {
  FACTORY_PO_STATUS_LABELS,
  type FactoryPoStatus,
} from "@/lib/factory-po-types";
import {
  FULFILLMENT_LABELS,
  PAYMENT_STATUS_LABELS,
  type FulfillmentStatus,
  type PaymentStatus,
} from "@/lib/order-types";
import { actorMay, type OpsActor } from "@/lib/ops-roles";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/quote-types";
import { roundSatang } from "@/lib/th-billing";

export { defaultFinanceRange };

export const DECORATION_REPORT_LABELS: Record<string, string> = {
  "screen-print": "สกรีน",
  emboss: "ปั๊มนูน",
  "full-color": "พิมพ์สี",
  "uv-print": "UV",
  laser: "เลเซอร์",
  embroidery: "ปัก",
  "not-sure": "ยังไม่ระบุ",
};

export type NamedCount = {
  key: string;
  label: string;
  count: number;
  amount: number;
};

export type CycleException = {
  kind: string;
  label: string;
  href: string;
  title: string;
  company: string;
  amount: number;
  when: string;
};

export type CycleStage = {
  id: string;
  label: string;
  hint: string;
  count: number;
  amount: number;
  href: string;
};

export type RevenueCycleReport = {
  fromDate: string;
  toDate: string;
  quoteCount: number;
  wonCount: number;
  lostCount: number;
  openLeadCount: number;
  quoteToWonPct: number;
  orderCount: number;
  billedAmount: number;
  collectedAmount: number;
  openArAmount: number;
  depositDueAmount: number;
  balanceDueAmount: number;
  approvalQueue: number;
  quoteByStatus: NamedCount[];
  orderByPayment: NamedCount[];
  orderByFulfillment: NamedCount[];
  quoteByProvince: NamedCount[];
  quoteByProduct: NamedCount[];
  quoteByDecoration: NamedCount[];
  quoteByUtm: NamedCount[];
  factoryByStatus: NamedCount[];
  stages: CycleStage[];
  exceptions: CycleException[];
  showGrossProfit: boolean;
  showFactory: boolean;
  grossProfit: number | null;
  missingCostCount: number;
};

export type RevenueCycleVisibility = {
  showGrossProfit: boolean;
  showFactory: boolean;
};

export function revenueCycleVisibility(actor: OpsActor): RevenueCycleVisibility {
  return {
    showGrossProfit: actorMay(actor, "finance.read"),
    showFactory: actorMay(actor, "factory.read"),
  };
}

type AggRow = { bucket: string; count: number; amount: number };

function ymdRange(fromDate: string, toDate: string): { fromDate: string; toDate: string } {
  const fallback = defaultFinanceRange();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : fallback.fromDate;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? toDate : fallback.toDate;
  return { fromDate: from, toDate: to };
}

function named(
  rows: AggRow[],
  labelOf: (key: string) => string,
): NamedCount[] {
  return rows
    .map((row) => ({
      key: row.bucket || "ไม่ระบุ",
      label: labelOf(row.bucket || "ไม่ระบุ"),
      count: Number(row.count || 0),
      amount: roundSatang(Number(row.amount || 0)),
    }))
    .filter((row) => row.count > 0 || row.amount > 0);
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return roundSatang((part / whole) * 100);
}

function quoteAgg(sql: string, fromDate: string, toDate: string): AggRow[] {
  return getDb()
    .prepare(
      `${sql}
       WHERE date(submitted_at) >= date(?) AND date(submitted_at) <= date(?)
       GROUP BY 1
       ORDER BY count DESC, amount DESC
       LIMIT 12`,
    )
    .all(fromDate, toDate) as AggRow[];
}

function orderAgg(sql: string, fromDate: string, toDate: string): AggRow[] {
  return getDb()
    .prepare(
      `${sql}
       WHERE fulfillment_status <> 'cancelled'
         AND date(created_at) >= date(?) AND date(created_at) <= date(?)
       GROUP BY 1
       ORDER BY count DESC, amount DESC`,
    )
    .all(fromDate, toDate) as AggRow[];
}

export function buildRevenueCycleReport(params: {
  fromDate: string;
  toDate: string;
  visibility: RevenueCycleVisibility;
}): RevenueCycleReport {
  const { fromDate, toDate } = ymdRange(params.fromDate, params.toDate);
  const db = getDb();

  const quoteByStatus = named(
    quoteAgg(
      `SELECT lead_status AS bucket, COUNT(*) AS count,
              COALESCE(SUM(COALESCE(budget_per_set, 0) * quantity), 0) AS amount
       FROM quote_requests`,
      fromDate,
      toDate,
    ),
    (key) => LEAD_STATUS_LABELS[key as LeadStatus] || key,
  );
  const quoteCount = quoteByStatus.reduce((sum, row) => sum + row.count, 0);
  const wonCount = quoteByStatus.find((row) => row.key === "won")?.count ?? 0;
  const lostCount = quoteByStatus.find((row) => row.key === "lost")?.count ?? 0;
  const openLeadCount = quoteByStatus
    .filter((row) => ["new", "contacted", "quoted"].includes(row.key))
    .reduce((sum, row) => sum + row.count, 0);

  const orderByPayment = named(
    orderAgg(
      `SELECT payment_status AS bucket, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS amount
       FROM orders`,
      fromDate,
      toDate,
    ),
    (key) => PAYMENT_STATUS_LABELS[key as PaymentStatus] || key,
  );
  const orderByFulfillment = named(
    orderAgg(
      `SELECT fulfillment_status AS bucket, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS amount
       FROM orders`,
      fromDate,
      toDate,
    ),
    (key) => FULFILLMENT_LABELS[key as FulfillmentStatus] || key,
  );

  const orderTotals = db
    .prepare(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(total_amount), 0) AS billed,
              COALESCE(SUM(paid_amount), 0) AS collected,
              COALESCE(SUM(CASE WHEN payment_status = 'deposit_due' THEN deposit_amount ELSE 0 END), 0) AS deposit_due,
              COALESCE(SUM(CASE WHEN payment_status = 'balance_due' THEN remaining_amount ELSE 0 END), 0) AS balance_due
       FROM orders
       WHERE fulfillment_status <> 'cancelled'
         AND date(created_at) >= date(?) AND date(created_at) <= date(?)`,
    )
    .get(fromDate, toDate) as {
    count: number;
    billed: number;
    collected: number;
    deposit_due: number;
    balance_due: number;
  };

  const collectedInRange = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS amount
       FROM payments
       WHERE status = 'confirmed'
         AND date(COALESCE(confirmed_at, created_at)) >= date(?)
         AND date(COALESCE(confirmed_at, created_at)) <= date(?)`,
    )
    .get(fromDate, toDate) as { amount: number };

  const quoteByProvince = named(
    quoteAgg(
      `SELECT COALESCE(NULLIF(trim(province), ''), 'ไม่ระบุ') AS bucket, COUNT(*) AS count,
              COALESCE(SUM(COALESCE(budget_per_set, 0) * quantity), 0) AS amount
       FROM quote_requests`,
      fromDate,
      toDate,
    ),
    (key) => key,
  );
  const quoteByProduct = named(
    quoteAgg(
      `SELECT COALESCE(NULLIF(trim(product_interest), ''), NULLIF(trim(product_slug), ''), 'ไม่ระบุสินค้า') AS bucket,
              COUNT(*) AS count,
              COALESCE(SUM(COALESCE(budget_per_set, 0) * quantity), 0) AS amount
       FROM quote_requests`,
      fromDate,
      toDate,
    ),
    (key) => key,
  );
  const quoteByDecoration = named(
    quoteAgg(
      `SELECT decoration_method AS bucket, COUNT(*) AS count,
              COALESCE(SUM(COALESCE(budget_per_set, 0) * quantity), 0) AS amount
       FROM quote_requests`,
      fromDate,
      toDate,
    ),
    (key) => DECORATION_REPORT_LABELS[key] || key,
  );
  const quoteByUtm = named(
    quoteAgg(
      `SELECT COALESCE(NULLIF(trim(utm_source), ''), 'ตรงเว็บ / ไม่มี UTM') AS bucket, COUNT(*) AS count,
              COALESCE(SUM(COALESCE(budget_per_set, 0) * quantity), 0) AS amount
       FROM quote_requests`,
      fromDate,
      toDate,
    ),
    (key) => key,
  );

  let factoryByStatus: NamedCount[] = [];
  if (params.visibility.showFactory) {
    factoryByStatus = named(
      db
        .prepare(
          `SELECT status AS bucket, COUNT(*) AS count, COALESCE(SUM(landed_total_thb), 0) AS amount
           FROM factory_pos
           WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
           GROUP BY 1
           ORDER BY count DESC`,
        )
        .all(fromDate, toDate) as AggRow[],
      (key) => FACTORY_PO_STATUS_LABELS[key as FactoryPoStatus] || key,
    );
  }

  const billedAmount = roundSatang(Number(orderTotals.billed || 0));
  const collectedAmount = roundSatang(Number(collectedInRange.amount || 0));
  const depositDueAmount = roundSatang(Number(orderTotals.deposit_due || 0));
  const balanceDueAmount = roundSatang(Number(orderTotals.balance_due || 0));
  const openArAmount = roundSatang(depositDueAmount + balanceDueAmount);

  const stages: CycleStage[] = [
    {
      id: "new",
      label: "คำขอใหม่",
      hint: "ยังไม่ได้ติดต่อ",
      count: quoteByStatus.find((row) => row.key === "new")?.count ?? 0,
      amount: quoteByStatus.find((row) => row.key === "new")?.amount ?? 0,
      href: "/ops/quotes?status=new",
    },
    {
      id: "quoted",
      label: "ส่งใบเสนอราคา",
      hint: "รอลูกค้าตอบ",
      count: quoteByStatus.find((row) => row.key === "quoted")?.count ?? 0,
      amount: quoteByStatus.find((row) => row.key === "quoted")?.amount ?? 0,
      href: "/ops/quotes?status=quoted",
    },
    {
      id: "won",
      label: "ปิดการขาย",
      hint: "พร้อมเปิดออเดอร์",
      count: wonCount,
      amount: quoteByStatus.find((row) => row.key === "won")?.amount ?? 0,
      href: "/ops/quotes?status=won",
    },
    {
      id: "deposit",
      label: "รอมัดจำ",
      hint: "ยังสั่งโรงงานไม่ได้",
      count: orderByPayment.find((row) => row.key === "deposit_due")?.count ?? 0,
      amount: depositDueAmount,
      href: "/ops/orders?payment=deposit_due",
    },
    {
      id: "balance",
      label: "รอส่วนที่เหลือ",
      hint: "ของถึงแล้วค้างชำระ",
      count: orderByPayment.find((row) => row.key === "balance_due")?.count ?? 0,
      amount: balanceDueAmount,
      href: "/ops/orders?payment=balance_due",
    },
    {
      id: "delivered",
      label: "ส่งถึงลูกค้า",
      hint: "จบวงจรส่งมอบ",
      count: orderByFulfillment.find((row) => row.key === "delivered")?.count ?? 0,
      amount: orderByFulfillment.find((row) => row.key === "delivered")?.amount ?? 0,
      href: "/ops/orders?fulfillment=delivered",
    },
  ];

  const exceptions: CycleException[] = [];
  const wonWithoutOrder = db
    .prepare(
      `SELECT q.request_id, q.company, q.submitted_at,
              COALESCE(q.budget_per_set, 0) * q.quantity AS amount
       FROM quote_requests q
       LEFT JOIN orders o ON o.quote_request_id = q.request_id
       WHERE q.lead_status = 'won'
         AND o.order_id IS NULL
         AND date(q.submitted_at) >= date(?) AND date(q.submitted_at) <= date(?)
       ORDER BY q.submitted_at DESC
       LIMIT 20`,
    )
    .all(fromDate, toDate) as Array<{
    request_id: string;
    company: string;
    submitted_at: string;
    amount: number;
  }>;
  for (const row of wonWithoutOrder) {
    exceptions.push({
      kind: "won_no_order",
      label: "ปิดการขายแล้วยังไม่เปิดออเดอร์",
      href: `/ops/quotes/${encodeURIComponent(row.request_id)}`,
      title: row.request_id,
      company: row.company,
      amount: roundSatang(row.amount),
      when: row.submitted_at,
    });
  }

  const moneyStuck = db
    .prepare(
      `SELECT order_id, company, created_at, payment_status,
              CASE
                WHEN payment_status = 'deposit_due' THEN deposit_amount
                ELSE remaining_amount
              END AS amount
       FROM orders
       WHERE fulfillment_status <> 'cancelled'
         AND payment_status IN ('deposit_due', 'balance_due')
         AND date(created_at) >= date(?) AND date(created_at) <= date(?)
       ORDER BY created_at DESC
       LIMIT 30`,
    )
    .all(fromDate, toDate) as Array<{
    order_id: string;
    company: string;
    created_at: string;
    payment_status: string;
    amount: number;
  }>;
  for (const row of moneyStuck) {
    exceptions.push({
      kind: row.payment_status,
      label:
        row.payment_status === "deposit_due"
          ? "รอมัดจำ — สั่งผลิตไม่ได้"
          : "รอส่วนที่เหลือ — ยังออกใบกำกับไม่ได้",
      href: `/ops/orders/${encodeURIComponent(row.order_id)}`,
      title: row.order_id,
      company: row.company,
      amount: roundSatang(row.amount),
      when: row.created_at,
    });
  }

  if (params.visibility.showFactory) {
    const missingPo = db
      .prepare(
        `SELECT o.order_id, o.company, o.created_at, o.total_amount AS amount
         FROM orders o
         WHERE o.fulfillment_status <> 'cancelled'
           AND o.payment_status IN ('deposit_paid', 'balance_due', 'paid')
           AND date(o.created_at) >= date(?) AND date(o.created_at) <= date(?)
           AND NOT EXISTS (
             SELECT 1 FROM factory_pos p
             WHERE p.order_id = o.order_id AND p.status <> 'cancelled'
           )
         ORDER BY o.created_at DESC
         LIMIT 20`,
      )
      .all(fromDate, toDate) as Array<{
      order_id: string;
      company: string;
      created_at: string;
      amount: number;
    }>;
    for (const row of missingPo) {
      exceptions.push({
        kind: "missing_po",
        label: "รับมัดจำแล้วแต่ยังไม่มีใบสั่งโรงงาน",
        href: `/ops/orders/${encodeURIComponent(row.order_id)}`,
        title: row.order_id,
        company: row.company,
        amount: roundSatang(row.amount),
        when: row.created_at,
      });
    }
  }

  let grossProfit: number | null = null;
  let missingCostCount = 0;
  if (params.visibility.showGrossProfit) {
    const pnl = buildExecutivePnl({ fromDate, toDate });
    grossProfit = pnl.grossProfit;
    missingCostCount = pnl.missingCostCount;
  }

  return {
    fromDate,
    toDate,
    quoteCount,
    wonCount,
    lostCount,
    openLeadCount,
    quoteToWonPct: pct(wonCount, quoteCount),
    orderCount: Number(orderTotals.count || 0),
    billedAmount,
    collectedAmount,
    openArAmount,
    depositDueAmount,
    balanceDueAmount,
    approvalQueue: countApprovalQueue(),
    quoteByStatus,
    orderByPayment,
    orderByFulfillment,
    quoteByProvince,
    quoteByProduct,
    quoteByDecoration,
    quoteByUtm,
    factoryByStatus,
    stages,
    exceptions,
    showGrossProfit: params.visibility.showGrossProfit,
    showFactory: params.visibility.showFactory,
    grossProfit,
    missingCostCount,
  };
}

export function revenueCycleToCsv(report: RevenueCycleReport): string {
  const lines = [
    ["ขั้น", "จำนวน", "มูลค่า"].join(","),
    ...report.stages.map((stage) =>
      [csvEscape(stage.label), stage.count, csvEscape(stage.amount)].join(","),
    ),
    "",
    ["สถานะใบเสนอราคา", "จำนวน", "งบประมาณโดยประมาณ"].join(","),
    ...report.quoteByStatus.map((row) =>
      [csvEscape(row.label), row.count, csvEscape(row.amount)].join(","),
    ),
    "",
    ["สถานะรับชำระ", "จำนวน", "มูลค่าออเดอร์"].join(","),
    ...report.orderByPayment.map((row) =>
      [csvEscape(row.label), row.count, csvEscape(row.amount)].join(","),
    ),
    "",
    ["จังหวัด", "จำนวนคำขอ", "งบประมาณโดยประมาณ"].join(","),
    ...report.quoteByProvince.map((row) =>
      [csvEscape(row.label), row.count, csvEscape(row.amount)].join(","),
    ),
    "",
    ["สินค้าที่สนใจ", "จำนวนคำขอ", "งบประมาณโดยประมาณ"].join(","),
    ...report.quoteByProduct.map((row) =>
      [csvEscape(row.label), row.count, csvEscape(row.amount)].join(","),
    ),
    "",
    ["วิธีสกรีน", "จำนวนคำขอ", "งบประมาณโดยประมาณ"].join(","),
    ...report.quoteByDecoration.map((row) =>
      [csvEscape(row.label), row.count, csvEscape(row.amount)].join(","),
    ),
  ];
  if (report.showFactory && report.factoryByStatus.length) {
    lines.push(
      "",
      ["สถานะใบสั่งโรงงาน", "จำนวน", "ต้นทุนรวม"].join(","),
      ...report.factoryByStatus.map((row) =>
        [csvEscape(row.label), row.count, csvEscape(row.amount)].join(","),
      ),
    );
  }
  lines.push(
    "",
    ["รายการค้างวงจร", "รหัส", "ลูกค้า", "มูลค่า"].join(","),
    ...report.exceptions.map((row) =>
      [csvEscape(row.label), csvEscape(row.title), csvEscape(row.company), csvEscape(row.amount)].join(
        ",",
      ),
    ),
  );
  return `\uFEFF${lines.join("\n")}\n`;
}
