"use server";

import { redirect } from "next/navigation";
import {
  clearSopGuideSessionCookie,
  isSopGuideConfigured,
  setSopGuideSessionCookie,
  verifySopGuideToken,
} from "@/lib/sop-guide-auth";

export type SopUnlockResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sopUnlockAction(
  _prev: SopUnlockResult | null,
  formData: FormData,
): Promise<SopUnlockResult> {
  if (!isSopGuideConfigured()) {
    return { ok: false, error: "คู่มือยังไม่เปิดใช้งาน" };
  }
  const token = String(formData.get("token") || "");
  if (!verifySopGuideToken(token)) {
    return { ok: false, error: "โทเค็นไม่ถูกต้อง" };
  }
  await setSopGuideSessionCookie();
  redirect("/sop");
}

export async function sopLogoutAction(): Promise<void> {
  await clearSopGuideSessionCookie();
  redirect("/sop");
}
