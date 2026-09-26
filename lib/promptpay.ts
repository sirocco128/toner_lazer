/**
 * EMVCo PromptPay QR payload (BOT credit-transfer).
 * Supports mobile (01) and tax ID / national ID (02).
 */

function crc16ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(tag: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${tag}${len}${value}`;
}

export type PromptPayTargetType = "mobile" | "tax_id";

export function detectPromptPayTarget(raw: string): {
  type: PromptPayTargetType;
  value: string;
} {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 13) {
    return { type: "tax_id", value: digits };
  }
  let mobile = digits;
  if (mobile.startsWith("66") && mobile.length >= 11) {
    mobile = `0${mobile.slice(2)}`;
  }
  if (mobile.startsWith("0") && mobile.length >= 9 && mobile.length <= 10) {
    return { type: "mobile", value: mobile };
  }
  throw new Error("invalid_promptpay_id");
}

function merchantAccountValue(target: { type: PromptPayTargetType; value: string }): string {
  const aid = tlv("00", "A000000677010111");
  if (target.type === "tax_id") {
    return aid + tlv("02", target.value);
  }
  const national = `0066${target.value.replace(/^0/, "")}`;
  return aid + tlv("01", national);
}

export function buildPromptPayPayload(input: {
  promptPayId: string;
  amount?: number;
}): string {
  const target = detectPromptPayTarget(input.promptPayId);
  const amount =
    input.amount != null && Number.isFinite(input.amount)
      ? input.amount.toFixed(2)
      : null;

  const payloadNoCrc =
    tlv("00", "01") +
    tlv("01", amount ? "12" : "11") +
    tlv("29", merchantAccountValue(target)) +
    tlv("53", "764") +
    (amount ? tlv("54", amount) : "") +
    tlv("58", "TH") +
    "6304";

  return payloadNoCrc + crc16ccitt(payloadNoCrc);
}

export function getPromptPayConfig(): { id: string; label: string } {
  const id = (
    process.env.PROMPTPAY_ID ||
    process.env.SITE_TAX_ID ||
    ""
  ).trim();
  return {
    id,
    label: process.env.PROMPTPAY_LABEL?.trim() || "พร้อมเพย์บริษัท",
  };
}
