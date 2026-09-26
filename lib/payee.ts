import { COMPANY } from "@/lib/company";
import {
  detectPromptPayTarget,
  getPromptPayConfig,
  type PromptPayTargetType,
} from "@/lib/promptpay";

export type PayeeDetails = {
  methodLabel: string;
  promptPayType: PromptPayTargetType | null;
  promptPayTypeLabel: string;
  promptPayId: string;
  promptPayDisplay: string;
  promptPayLabel: string;
  accountName: string;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountDisplay: string | null;
};

export function formatPromptPayId(
  raw: string,
  type?: PromptPayTargetType,
): string {
  const digits = String(raw || "").replace(/\D/g, "");
  const kind = type ?? (digits.length === 13 ? "tax_id" : "mobile");
  if (kind === "tax_id" && digits.length === 13) {
    return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits || raw;
}

export function formatBankAccountNo(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 4)}-${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 9)}-${digits.slice(9)}`;
  }
  return raw.trim();
}

export function promptPayTypeLabel(type: PromptPayTargetType | null): string {
  if (type === "tax_id") return "เลขประจำตัวผู้เสียภาษี";
  if (type === "mobile") return "เบอร์มือถือ";
  return "พร้อมเพย์";
}

export function getPayeeDetails(): PayeeDetails {
  const config = getPromptPayConfig();
  let type: PromptPayTargetType | null = null;
  if (config.id) {
    try {
      type = detectPromptPayTarget(config.id).type;
    } catch {
      type = null;
    }
  }
  const bankName = (process.env.BANK_NAME || "").trim() || null;
  const bankAccountNo = (process.env.BANK_ACCOUNT_NO || "").trim() || null;
  const accountName =
    (process.env.BANK_ACCOUNT_NAME || "").trim() || COMPANY.legalName;
  return {
    methodLabel: "พร้อมเพย์",
    promptPayType: type,
    promptPayTypeLabel: promptPayTypeLabel(type),
    promptPayId: config.id,
    promptPayDisplay: config.id ? formatPromptPayId(config.id, type ?? undefined) : "",
    promptPayLabel: config.label,
    accountName,
    bankName,
    bankAccountNo,
    bankAccountDisplay: bankAccountNo ? formatBankAccountNo(bankAccountNo) : null,
  };
}
