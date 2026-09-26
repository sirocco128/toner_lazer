"use server";

import { revalidatePath } from "next/cache";
import { updateContactInquiryStatus } from "@/lib/contact-inquiry-repository";
import {
  CONTACT_INQUIRY_STATUSES,
  type ContactInquiryStatus,
} from "@/lib/contact-inquiry-types";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";

export async function setContactInquiryStatusAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireOpsActor("quotes.write");
  if (!actor) return;
  const inquiryId = String(formData.get("inquiryId") || "").trim();
  const statusRaw = String(formData.get("status") || "").trim();
  if (
    !inquiryId ||
    !(CONTACT_INQUIRY_STATUSES as readonly string[]).includes(statusRaw)
  ) {
    return;
  }
  const updated = updateContactInquiryStatus(
    inquiryId,
    statusRaw as ContactInquiryStatus,
  );
  if (!updated) return;
  const meta = await requestMeta();
  writeOpsAudit({
    actor,
    action: "inquiry.status",
    status: "ok",
    resourceType: "contact_inquiry",
    resourceId: inquiryId,
    detail: { status: statusRaw },
    ...meta,
  });
  revalidatePath("/ops/inquiries");
}
