export const LEDGER_ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "cogs",
  "expense",
] as const;

export type LedgerAccountType = (typeof LEDGER_ACCOUNT_TYPES)[number];

export const LEDGER_ACCOUNT_TYPE_LABELS: Record<LedgerAccountType, string> = {
  asset: "สินทรัพย์",
  liability: "หนี้สิน",
  equity: "ส่วนของเจ้าของ",
  revenue: "รายได้",
  cogs: "ต้นทุนขาย",
  expense: "ค่าใช้จ่าย",
};

export const JOURNAL_BOOKS = [
  "sales",
  "purchase",
  "cash_in",
  "cash_out",
  "general",
] as const;

export type JournalBookType = (typeof JOURNAL_BOOKS)[number];

export const JOURNAL_BOOK_LABELS: Record<JournalBookType, string> = {
  sales: "สมุดรายวันขาย",
  purchase: "สมุดรายวันซื้อ",
  cash_in: "สมุดรายวันรับเงิน",
  cash_out: "สมุดรายวันจ่ายเงิน",
  general: "สมุดรายวันทั่วไป",
};

export type LedgerAccount = {
  code: string;
  nameTh: string;
  nameEn: string;
  type: LedgerAccountType;
  sortOrder: number;
  normalBalance: "debit" | "credit";
  isHeader: boolean;
  isPostable: boolean;
};

export type JournalLineInput = {
  accountCode: string;
  debit: number;
  credit: number;
  memo?: string | null;
};

export type JournalLineRecord = JournalLineInput & {
  id: number;
  entryId: string;
  lineNo: number;
};

export type JournalEntryRecord = {
  id: number;
  entryId: string;
  sourceKey: string;
  entryDate: string;
  memo: string;
  orderId: string | null;
  poId: string | null;
  postedBy: string | null;
  createdAt: string;
  bookType: JournalBookType;
  lines: JournalLineRecord[];
};

export const ACCOUNT_CODES = {
  cash: "1110",
  ar: "1120",
  inTransit: "1130",
  inventory: "1140",
  inputVat: "1150",
  otherCurrentAsset: "1190",
  unearnedDeposit: "2110",
  outputVat: "2120",
  factoryPayable: "2130",
  freightPayable: "2140",
  capital: "3100",
  retainedEarnings: "3200",
  sales: "4100",
  otherIncome: "4200",
  fxGain: "4300",
  factoryCogs: "5100",
  freightCogs: "5200",
  importCogs: "5300",
  lastMileExpense: "5400",
  packingExpense: "5500",
  fxLoss: "5600",
  officeExpense: "5700",
  depreciation: "5800",
} as const;

export function isJournalBookType(
  value: string | null | undefined,
): value is JournalBookType {
  return (JOURNAL_BOOKS as readonly string[]).includes(String(value || ""));
}

export function isLedgerAccountType(
  value: string | null | undefined,
): value is LedgerAccountType {
  return (LEDGER_ACCOUNT_TYPES as readonly string[]).includes(String(value || ""));
}

export function bookTypeFromSourceKey(sourceKey: string): JournalBookType {
  if (sourceKey.startsWith("cash:")) return "cash_in";
  if (sourceKey.startsWith("spay:")) return "cash_out";
  if (sourceKey.startsWith("revenue:")) return "sales";
  if (sourceKey.startsWith("git:") || sourceKey.startsWith("inv:")) return "purchase";
  return "general";
}
