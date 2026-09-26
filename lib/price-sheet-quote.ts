/**
 * Build an ops quote_requests row from Sheet3 Final lines.
 */

import { PRODUCT_INTEREST_MAX, type QuoteRequestInput } from "@/lib/quote-types";
import type { PriceSheetParams } from "@/lib/price-sheet";
import type { OpsActor } from "@/lib/ops-roles";

export type PriceSheetQuoteContact = {
  company?: string;
  name?: string;
  phone?: string;
  email?: string;
};

export type PriceSheetQuoteLineInput = {
  id: string;
  name: string;
  qty: number;
  sellThb: number;
  error?: string;
};

export type PriceSheetQuoteLine = {
  id: string;
  name: string;
  slug?: string;
  qty: number;
  sellThb: number;
  lineTotal: number;
};

export function priceSheetQuoteLines(
  rows: PriceSheetQuoteLineInput[],
  slugsById: Record<string, string | undefined> = {},
): PriceSheetQuoteLine[] {
  return rows
    .filter((row) => !row.error && row.sellThb > 0 && row.qty > 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: slugsById[row.id],
      qty: row.qty,
      sellThb: row.sellThb,
      lineTotal: Math.round(row.sellThb * row.qty * 100) / 100,
    }));
}

export function buildPriceSheetQuoteInput(options: {
  actor: OpsActor;
  lines: PriceSheetQuoteLine[];
  params: PriceSheetParams;
  grandTotal: number;
  contact?: PriceSheetQuoteContact;
}): QuoteRequestInput {
  const { actor, lines, params, grandTotal, contact } = options;
  if (lines.length === 0) {
    throw new Error("ไม่มีแถวราคา Final ที่สร้างใบเสนอราคาได้");
  }

  const quantity = lines.reduce((sum, line) => sum + line.qty, 0);
  const interest = lines
    .map(
      (line) =>
        `${line.name}${line.slug ? ` (${line.slug})` : ""} × ${line.qty} @ ${line.sellThb}`,
    )
    .join(" · ")
    .slice(0, PRODUCT_INTEREST_MAX);

  const detailLines = [
    "สร้างจาก /ops/price-sheet Sheet3",
    `โปรไฟล์ ${params.profile} · FX ${params.cnyToThb}`,
    `ยอดรวมประมาณ ${grandTotal.toLocaleString("th-TH")} บาท`,
    "",
    ...lines.map(
      (line, i) =>
        `${i + 1}. ${line.id} ${line.name} × ${line.qty} = ${line.lineTotal} (${line.sellThb}/ชุด)${line.slug ? ` · ${line.slug}` : ""}`,
    ),
    "",
    "ไม่ใช่ใบยืนยันสั่งซื้อ — รอเซลล์ปรับสถานะใน /ops/quotes",
  ];

  const firstSlug = lines.find((line) => line.slug)?.slug;
  const avgBudget = Math.round(
    lines.reduce((sum, line) => sum + line.sellThb, 0) / lines.length,
  );

  return {
    name: (contact?.name || actor.name || actor.email).trim().slice(0, 120),
    company: (contact?.company || "Ops · ชีตราคา 3 แท็บ").trim().slice(0, 160),
    email: (contact?.email || actor.email).trim().slice(0, 160),
    phone: (contact?.phone || "-").trim().slice(0, 40) || "-",
    quantity: Math.max(1, quantity),
    consent: true,
    budgetPerSet: avgBudget > 0 ? avgBudget : undefined,
    productInterest: interest,
    productSlug: firstSlug,
    decorationMethod: "not-sure",
    detail: detailLines.join("\n").slice(0, 4000),
    landingPath: "/ops/price-sheet",
    utmSource: "ops",
    utmMedium: "price-sheet",
    utmCampaign: "sheet3-final",
  };
}
