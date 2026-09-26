import { randomBytes } from "node:crypto";
import { listFactoryPosByOrder } from "@/lib/factory-po-repository";
import type { FactoryPoRecord } from "@/lib/factory-po-types";
import {
  deleteJournalBySourceKey,
  getAccount,
  getJournalBySourceKey,
  insertJournal,
  listJournals,
  sumAccountActivity,
} from "@/lib/ledger-repository";
import {
  ACCOUNT_CODES,
  bookTypeFromSourceKey,
  type JournalBookType,
  type JournalLineInput,
} from "@/lib/ledger-types";
import { costFromPo } from "@/lib/po-cost";
import { bangkokDateYmd } from "@/lib/bangkok-date";
import { roundSatang } from "@/lib/th-billing";

function createPrefixedId(prefix: string, now = new Date()): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${bangkokDateYmd(now)}-${suffix}`;
}

function bangkokDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function assertBalanced(lines: JournalLineInput[]): void {
  const debit = roundSatang(lines.reduce((sum, line) => sum + line.debit, 0));
  const credit = roundSatang(lines.reduce((sum, line) => sum + line.credit, 0));
  if (Math.abs(debit - credit) > 0.009) {
    throw new Error("unbalanced_journal");
  }
}

function compactLines(lines: JournalLineInput[]): JournalLineInput[] {
  return lines.filter((line) => line.debit > 0.0001 || line.credit > 0.0001);
}

export function upsertJournal(params: {
  sourceKey: string;
  memo: string;
  orderId?: string | null;
  poId?: string | null;
  postedBy?: string | null;
  at?: string;
  bookType?: JournalBookType;
  lines: JournalLineInput[];
}): void {
  const lines = compactLines(params.lines);
  if (lines.length === 0) {
    deleteJournalBySourceKey(params.sourceKey);
    return;
  }
  assertBalanced(lines);
  for (const line of lines) {
    const account = getAccount(line.accountCode);
    if (!account || !account.isPostable) {
      throw new Error("unknown_account");
    }
  }
  const existing = getJournalBySourceKey(params.sourceKey);
  const now = params.at ?? new Date().toISOString();
  const bookType = params.bookType ?? bookTypeFromSourceKey(params.sourceKey);
  if (existing) {
    const same =
      existing.memo === params.memo &&
      existing.bookType === bookType &&
      existing.lines.length === lines.length &&
      existing.lines.every((line, index) => {
        const next = lines[index];
        return (
          next &&
          line.accountCode === next.accountCode &&
          Math.abs(line.debit - next.debit) < 0.001 &&
          Math.abs(line.credit - next.credit) < 0.001
        );
      });
    if (same) return;
    deleteJournalBySourceKey(params.sourceKey);
  }
  insertJournal({
    entryId: createPrefixedId("JE", new Date(now)),
    sourceKey: params.sourceKey,
    entryDate: bangkokDate(now),
    memo: params.memo,
    orderId: params.orderId,
    poId: params.poId,
    postedBy: params.postedBy,
    createdAt: now,
    bookType,
    lines,
  });
}

export function postCashReceived(params: {
  paymentId: string;
  orderId: string;
  amount: number;
  kind: string;
  at: string;
  actor?: string | null;
}): void {
  const amount = roundSatang(params.amount);
  if (amount <= 0) return;
  upsertJournal({
    sourceKey: `cash:${params.paymentId}`,
    bookType: "cash_in",
    memo: `รับชำระ${params.kind} ${amount.toFixed(2)} บาท · ${params.orderId}`,
    orderId: params.orderId,
    postedBy: params.actor,
    at: params.at,
    lines: [
      { accountCode: ACCOUNT_CODES.cash, debit: amount, credit: 0, memo: "พร้อมเพย์" },
      {
        accountCode: ACCOUNT_CODES.unearnedDeposit,
        debit: 0,
        credit: amount,
        memo: "เงินรับล่วงหน้า",
      },
    ],
  });
}

function inventoriableFromPo(po: FactoryPoRecord): {
  factory: number;
  freight: number;
  importCost: number;
  total: number;
  packing: number;
  lastMile: number;
  factoryPayable: number;
  freightPayable: number;
} {
  const cost = costFromPo(po);
  const importCost = roundSatang(cost.importDutyThb + cost.customsFeeThb);
  const total = roundSatang(cost.productCostThb + cost.freightThb + importCost);
  return {
    factory: cost.productCostThb,
    freight: cost.freightThb,
    importCost,
    total,
    packing: cost.packingThb,
    lastMile: cost.lastMileThb,
    factoryPayable: cost.productCostThb,
    freightPayable: roundSatang(
      cost.freightThb + importCost + cost.packingThb + cost.lastMileThb,
    ),
  };
}

export function postPoLandedCost(params: {
  po: FactoryPoRecord;
  actor?: string | null;
  at?: string;
}): void {
  const po = params.po;
  const gitKey = `git:${po.poId}`;
  const cogsKey = `cogs:${po.poId}`;
  if (po.status === "cancelled" || po.status === "draft" || po.status === "sent") {
    deleteJournalBySourceKey(gitKey);
    deleteJournalBySourceKey(cogsKey);
    for (const entry of listJournals({ poId: po.poId, limit: 200 })) {
      if (entry.sourceKey.startsWith("inv:")) {
        deleteJournalBySourceKey(entry.sourceKey);
      }
    }
    return;
  }
  const cost = inventoriableFromPo(po);
  upsertJournal({
    sourceKey: gitKey,
    bookType: "purchase",
    memo: `ซื้อ / สินค้าระหว่างทาง · ${po.poId} · ${po.productName}`,
    orderId: po.orderId,
    poId: po.poId,
    postedBy: params.actor,
    at: params.at ?? po.updatedAt,
    lines: [
      {
        accountCode: ACCOUNT_CODES.inTransit,
        debit: cost.total,
        credit: 0,
        memo: "โรงงาน + ขนส่ง + นำเข้า",
      },
      {
        accountCode: ACCOUNT_CODES.lastMileExpense,
        debit: cost.lastMile,
        credit: 0,
        memo: "จัดส่งถึงลูกค้า",
      },
      {
        accountCode: ACCOUNT_CODES.packingExpense,
        debit: cost.packing,
        credit: 0,
        memo: "แพ็กในไทย",
      },
      {
        accountCode: ACCOUNT_CODES.factoryPayable,
        debit: 0,
        credit: cost.factoryPayable,
        memo: "เจ้าหนี้โรงงาน",
      },
      {
        accountCode: ACCOUNT_CODES.freightPayable,
        debit: 0,
        credit: cost.freightPayable,
        memo: "เจ้าหนี้ขนส่งและนำเข้า",
      },
    ],
  });
}

export function postInventoryReceipt(params: {
  po: FactoryPoRecord;
  receiptId: string;
  qtyReceived: number;
  destination: string;
  actor?: string | null;
  at?: string;
}): void {
  postPoLandedCost({ po: params.po, actor: params.actor, at: params.at });
  const sourceKey = `inv:${params.receiptId}`;
  if (params.destination !== "warehouse" || params.qtyReceived <= 0) {
    deleteJournalBySourceKey(sourceKey);
    return;
  }
  const cost = inventoriableFromPo(params.po);
  const share =
    params.po.quantity > 0
      ? roundSatang((cost.total * params.qtyReceived) / params.po.quantity)
      : 0;
  upsertJournal({
    sourceKey,
    bookType: "purchase",
    memo: `รับเข้าคลัง · ${params.receiptId} · ${params.po.poId}`,
    orderId: params.po.orderId,
    poId: params.po.poId,
    postedBy: params.actor,
    at: params.at,
    lines: [
      {
        accountCode: ACCOUNT_CODES.inventory,
        debit: share,
        credit: 0,
        memo: "สินค้าคงเหลือ",
      },
      {
        accountCode: ACCOUNT_CODES.inTransit,
        debit: 0,
        credit: share,
        memo: "โอนจากระหว่างทาง",
      },
    ],
  });
}

function postCogsForPo(params: {
  po: FactoryPoRecord;
  actor?: string | null;
  at: string;
}): void {
  if (params.po.status === "cancelled") {
    deleteJournalBySourceKey(`cogs:${params.po.poId}`);
    return;
  }
  postPoLandedCost({ po: params.po, actor: params.actor, at: params.at });
  const cost = inventoriableFromPo(params.po);
  const movedToStock = roundSatang(
    sumAccountActivity({
      accountCode: ACCOUNT_CODES.inventory,
      side: "debit",
      poId: params.po.poId,
      sourcePrefix: "inv:",
    }),
  );
  const fromStock = Math.min(cost.total, movedToStock);
  const fromTransit = roundSatang(cost.total - fromStock);
  upsertJournal({
    sourceKey: `cogs:${params.po.poId}`,
    bookType: "general",
    memo: `รับรู้ต้นทุนขาย · ${params.po.poId}`,
    orderId: params.po.orderId,
    poId: params.po.poId,
    postedBy: params.actor,
    at: params.at,
    lines: [
      {
        accountCode: ACCOUNT_CODES.factoryCogs,
        debit: cost.factory,
        credit: 0,
        memo: "ต้นทุนโรงงาน",
      },
      {
        accountCode: ACCOUNT_CODES.freightCogs,
        debit: cost.freight,
        credit: 0,
        memo: "ขนส่งจีน–ไทย",
      },
      {
        accountCode: ACCOUNT_CODES.importCogs,
        debit: cost.importCost,
        credit: 0,
        memo: "นำเข้า / พิธีการ",
      },
      {
        accountCode: ACCOUNT_CODES.inventory,
        debit: 0,
        credit: fromStock,
        memo: "ตัดสินค้าคงเหลือ",
      },
      {
        accountCode: ACCOUNT_CODES.inTransit,
        debit: 0,
        credit: fromTransit,
        memo: "ตัดสินค้าระหว่างทาง",
      },
    ],
  });
}

export function postRevenueRecognition(params: {
  orderId: string;
  subtotalExVat: number;
  vatAmount: number;
  grandTotal: number;
  at: string;
  actor?: string | null;
}): void {
  const subtotal = roundSatang(params.subtotalExVat);
  const vat = roundSatang(params.vatAmount);
  const grand = roundSatang(params.grandTotal);
  if (grand <= 0) return;
  const cashIn = roundSatang(
    sumAccountActivity({
      accountCode: ACCOUNT_CODES.unearnedDeposit,
      side: "credit",
      orderId: params.orderId,
      sourcePrefix: "cash:",
    }),
  );
  const unearned = Math.min(grand, cashIn);
  const ar = roundSatang(Math.max(0, grand - unearned));
  upsertJournal({
    sourceKey: `revenue:${params.orderId}`,
    bookType: "sales",
    memo: `รับรู้รายได้และ VAT ขาออก · ${params.orderId}`,
    orderId: params.orderId,
    postedBy: params.actor,
    at: params.at,
    lines: [
      {
        accountCode: ACCOUNT_CODES.unearnedDeposit,
        debit: unearned,
        credit: 0,
        memo: "โอนเงินมัดจำเป็นรายได้",
      },
      {
        accountCode: ACCOUNT_CODES.ar,
        debit: ar,
        credit: 0,
        memo: "ลูกหนี้ตามใบกำกับ",
      },
      { accountCode: ACCOUNT_CODES.sales, debit: 0, credit: subtotal, memo: "รายได้ขาย" },
      { accountCode: ACCOUNT_CODES.outputVat, debit: 0, credit: vat, memo: "VAT 7%" },
    ],
  });
  for (const po of listFactoryPosByOrder(params.orderId)) {
    postCogsForPo({ po, actor: params.actor, at: params.at });
  }
}

export function postSupplierPayment(params: {
  payId: string;
  poId: string;
  orderId?: string | null;
  amount: number;
  at: string;
  actor?: string | null;
  payableKind?: "factory" | "freight";
}): void {
  const amount = roundSatang(params.amount);
  if (amount <= 0) return;
  const kind = params.payableKind === "freight" ? "freight" : "factory";
  const payable =
    kind === "freight" ? ACCOUNT_CODES.freightPayable : ACCOUNT_CODES.factoryPayable;
  const label = kind === "freight" ? "เจ้าหนี้ขนส่งและนำเข้า" : "เจ้าหนี้โรงงาน";
  upsertJournal({
    sourceKey: `spay:${params.payId}`,
    bookType: "cash_out",
    memo: `จ่าย${label} ${amount.toFixed(2)} บาท · ${params.poId}`,
    orderId: params.orderId,
    poId: params.poId,
    postedBy: params.actor,
    at: params.at,
    lines: [
      {
        accountCode: payable,
        debit: amount,
        credit: 0,
        memo: `ลด${label}`,
      },
      {
        accountCode: ACCOUNT_CODES.cash,
        debit: 0,
        credit: amount,
        memo: kind === "freight" ? "จ่ายขนส่ง/นำเข้า" : "จ่ายโรงงาน",
      },
    ],
  });
}

export function postManualJournal(params: {
  memo: string;
  entryDate: string;
  lines: JournalLineInput[];
  actor?: string | null;
  orderId?: string | null;
  poId?: string | null;
}): string {
  const now = new Date().toISOString();
  const entryId = createPrefixedId("JE", new Date(params.entryDate || now));
  const sourceKey = `manual:${entryId}`;
  upsertJournal({
    sourceKey,
    bookType: "general",
    memo: params.memo.trim() || "ใบสำคัญทั่วไป",
    orderId: params.orderId,
    poId: params.poId,
    postedBy: params.actor,
    at: `${params.entryDate}T12:00:00+07:00`,
    lines: params.lines,
  });
  const saved = getJournalBySourceKey(sourceKey);
  if (!saved) throw new Error("journal_insert_failed");
  return saved.entryId;
}

export function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function journalsToCsv(
  entries: Array<{
    entryDate: string;
    entryId: string;
    memo: string;
    orderId: string | null;
    poId: string | null;
    bookType?: string;
    lines: Array<{
      accountCode: string;
      debit: number;
      credit: number;
      memo?: string | null;
    }>;
  }>,
  accountName: (code: string) => string,
): string {
  const header = [
    "สมุด",
    "วันที่",
    "เลขที่เอกสาร",
    "รหัสบัญชี",
    "ชื่อบัญชี",
    "เดบิต",
    "เครดิต",
    "คำอธิบาย",
    "ออเดอร์",
    "ใบสั่งโรงงาน",
  ].join(",");
  const rows = [header];
  for (const entry of entries) {
    for (const line of entry.lines) {
      rows.push(
        [
          csvEscape(entry.bookType || ""),
          csvEscape(entry.entryDate),
          csvEscape(entry.entryId),
          csvEscape(line.accountCode),
          csvEscape(accountName(line.accountCode)),
          csvEscape(line.debit.toFixed(2)),
          csvEscape(line.credit.toFixed(2)),
          csvEscape(line.memo || entry.memo),
          csvEscape(entry.orderId),
          csvEscape(entry.poId),
        ].join(","),
      );
    }
  }
  return `${rows.join("\n")}\n`;
}
