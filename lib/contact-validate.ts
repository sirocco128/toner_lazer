/**
 * Client-safe email / Thai phone checks for the public quote form.
 */

import {
  EMAIL_INVALID,
  EMAIL_REQUIRED,
  PHONE_INVALID,
  PHONE_REQUIRED,
} from "@/lib/ux-copy";

export function normalizeThaiPhoneDigits(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("66") && digits.length >= 11 && digits.length <= 12) {
    digits = `0${digits.slice(2)}`;
  }
  return digits;
}

export function isValidThaiPhone(raw: string): boolean {
  const n = normalizeThaiPhoneDigits(raw);
  if (/^0[689]\d{8}$/.test(n)) return true;
  if (/^02\d{7}$/.test(n)) return true;
  if (/^0[3-7]\d{7,8}$/.test(n)) return true;
  return false;
}

export function isValidEmail(raw: string): boolean {
  const value = String(raw || "").trim();
  if (value.length < 6 || value.length > 254) return false;
  if (/\s/.test(value)) return false;
  const at = value.indexOf("@");
  if (at < 1 || at !== value.lastIndexOf("@")) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();
  if (!local || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  if (!/^[A-Za-z0-9._%+\-]+$/.test(local)) return false;
  if (
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(
      domain,
    )
  ) {
    return false;
  }
  const tld = domain.split(".").pop() || "";
  return /^[a-z]{2,}$/.test(tld);
}

export function emailFieldError(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return EMAIL_REQUIRED;
  if (!isValidEmail(value)) return EMAIL_INVALID;
  return "";
}

export function phoneFieldError(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return PHONE_REQUIRED;
  if (!isValidThaiPhone(value)) return PHONE_INVALID;
  return "";
}
