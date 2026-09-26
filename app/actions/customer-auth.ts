"use server";

import { redirect } from "next/navigation";
import {
  authenticateCustomer,
  clearCustomerSession,
  setCustomerSession,
} from "@/lib/customer-auth";

export async function customerLoginAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const actor = authenticateCustomer(username, password);
  if (!actor) {
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }
  await setCustomerSession(actor);
  redirect("/orders");
}

export async function customerLogoutAction(): Promise<void> {
  await clearCustomerSession();
  redirect("/account");
}
