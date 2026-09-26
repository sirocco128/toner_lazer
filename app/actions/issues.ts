"use server";

import { headers } from "next/headers";
import { createIssueTicket } from "@/lib/ops-cycle-service";
import { getPublicOrder } from "@/lib/order-service";
import { consumeRateLimit } from "@/lib/quote-repository";
import { hashIp, resolveClientIp } from "@/lib/quote-service";

export type IssueActionState = {
  ok: boolean;
  issueId?: string;
  error?: string;
};

const ERRORS: Record<string, string> = {
  title_required: "กรุณาระบุหัวข้อปัญหา",
  detail_required: "กรุณาเล่ารายละเอียด",
  order_access_denied: "ไม่สามารถยืนยันออเดอร์ได้ กรุณาเปิดจากลิงก์ออเดอร์อีกครั้ง",
};

export async function submitPublicIssue(
  _prev: IssueActionState,
  formData: FormData,
): Promise<IssueActionState> {
  const h = await headers();
  const ipHash = hashIp(resolveClientIp(h));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const allowed = consumeRateLimit({
    keyHash: `issue-report:${ipHash}`,
    bucketStart: nowSeconds - (nowSeconds % 900),
    maxAttempts: 8,
    nowSeconds,
  });
  if (!allowed) {
    return { ok: false, error: "ส่งเรื่องบ่อยเกินไป กรุณารอสักครู่" };
  }

  const orderId = String(formData.get("orderId") || "").trim();
  const token = String(formData.get("token") || "").trim();
  let company = String(formData.get("company") || "").trim();
  let contactName = String(formData.get("contactName") || "").trim();
  let email = String(formData.get("email") || "").trim();
  let phone = String(formData.get("phone") || "").trim();

  if (orderId && token) {
    const bundle = getPublicOrder(orderId, token);
    if (!bundle) {
      return { ok: false, error: ERRORS.order_access_denied };
    }
    company = company || bundle.order.company || "";
    contactName = contactName || bundle.order.contactName || "";
    email = email || bundle.order.email || "";
    phone = phone || bundle.order.phone || "";
  }

  try {
    const issue = createIssueTicket({
      source: "public",
      company,
      contactName,
      email,
      phone,
      orderId,
      category: String(formData.get("category") || "other"),
      title: String(formData.get("title") || "").trim(),
      detail: String(formData.get("detail") || "").trim(),
    });
    return { ok: true, issueId: issue.issueId };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { ok: false, error: ERRORS[code] || "ส่งเรื่องไม่สำเร็จ กรุณาลองใหม่" };
  }
}
