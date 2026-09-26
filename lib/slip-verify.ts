import { roundSatang } from "@/lib/th-billing";

export const SLIP_CHECK_STATUSES = [
  "pending",
  "match",
  "mismatch",
  "unreadable",
] as const;

export type SlipCheckStatus = (typeof SLIP_CHECK_STATUSES)[number];

export const SLIP_CHECK_STATUS_LABELS: Record<SlipCheckStatus, string> = {
  pending: "รอตรวจสลิป",
  match: "สลิปตรงยอดและบัญชี",
  mismatch: "สลิปไม่ตรง",
  unreadable: "อ่านสลิปไม่ได้",
};

export type SlipExtracted = {
  amount: number | null;
  payeeName: string | null;
  accountOrPromptPay: string | null;
  transferredAt: string | null;
  reference: string | null;
  bank: string | null;
  readable: boolean;
};

export type SlipExpected = {
  amount: number;
  promptPayId: string;
  accountName: string;
  bankAccountNo?: string | null;
};

export function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function amountsMatch(
  expected: number,
  extracted: number | null,
  tolerance = 0.02,
): boolean {
  if (extracted == null || !Number.isFinite(extracted)) return false;
  return Math.abs(roundSatang(expected) - roundSatang(extracted)) <= tolerance;
}

export function payeeMatches(expected: SlipExpected, extracted: SlipExtracted): boolean {
  const hay = `${extracted.accountOrPromptPay || ""} ${extracted.payeeName || ""}`;
  const hayDigits = digitsOnly(hay);
  const promptPay = digitsOnly(expected.promptPayId);
  if (promptPay.length >= 10 && hayDigits.includes(promptPay)) return true;
  const account = digitsOnly(expected.bankAccountNo || "");
  if (account.length >= 8 && hayDigits.includes(account)) return true;
  const name = (extracted.payeeName || "").replace(/\s+/g, "");
  if (name.includes("เทราบิส") || name.toLowerCase().includes("terabiz")) return true;
  if (promptPay.length >= 4 && hayDigits.includes(promptPay.slice(-4)) && name.includes("เทราบิส")) {
    return true;
  }
  return false;
}

export function evaluateSlip(
  expected: SlipExpected,
  extracted: SlipExtracted,
): { status: SlipCheckStatus; notes: string } {
  if (!extracted.readable || extracted.amount == null) {
    return { status: "unreadable", notes: "อ่านยอดจากสลิปไม่ได้ — ทีมบัญชีจะตรวจให้" };
  }
  const amtOk = amountsMatch(expected.amount, extracted.amount);
  const payeeOk = payeeMatches(expected, extracted);
  if (amtOk && payeeOk) {
    return {
      status: "match",
      notes: "สลิปตรงยอดและบัญชีพร้อมเพย์ — รอทีมบัญชียืนยันรับเงิน",
    };
  }
  if (!amtOk) {
    return {
      status: "mismatch",
      notes: `ยอดในสลิป ${extracted.amount.toFixed(2)} บาท ไม่ตรงยอดที่ต้องชำระ ${expected.amount.toFixed(2)} บาท`,
    };
  }
  return {
    status: "mismatch",
    notes: "ไม่พบเลขพร้อมเพย์หรือชื่อบัญชีบริษัทในสลิป",
  };
}

export function parseSlipExtracted(raw: string): SlipExtracted {
  const empty: SlipExtracted = {
    amount: null,
    payeeName: null,
    accountOrPromptPay: null,
    transferredAt: null,
    reference: null,
    bank: null,
    readable: false,
  };
  const match = String(raw || "").match(/\{[\s\S]*\}/);
  if (!match) return empty;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const amountRaw = parsed.amount;
    const amount =
      typeof amountRaw === "number"
        ? amountRaw
        : typeof amountRaw === "string"
          ? Number(String(amountRaw).replace(/,/g, ""))
          : null;
    const text = (key: string) => {
      const value = parsed[key];
      return typeof value === "string" && value.trim() ? value.trim() : null;
    };
    const readable = parsed.readable !== false && amount != null && Number.isFinite(amount);
    return {
      amount: amount != null && Number.isFinite(amount) ? amount : null,
      payeeName: text("payeeName"),
      accountOrPromptPay: text("accountOrPromptPay") || text("promptPay"),
      transferredAt: text("transferredAt"),
      reference: text("reference"),
      bank: text("bank"),
      readable,
    };
  } catch {
    return empty;
  }
}
