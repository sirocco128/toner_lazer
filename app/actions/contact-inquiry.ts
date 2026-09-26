"use server";

import { headers } from "next/headers";
import { parseContactInquiryFormData } from "@/lib/contact-inquiry-schema";
import { submitContactInquiryPayload } from "@/lib/contact-inquiry-service";
import type { ContactMailStatus } from "@/lib/contact-inquiry-types";

export type ContactInquiryFormValues = Record<string, string>;

export type ContactInquiryActionState = {
  ok: boolean;
  inquiryId?: string;
  mailSent?: boolean;
  mailStatus?: ContactMailStatus;
  fieldErrors?: Record<string, string[]>;
  formError?: string;
  values?: ContactInquiryFormValues;
};

function formDataToValues(formData: FormData): ContactInquiryFormValues {
  const values: ContactInquiryFormValues = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "website") {
      values[key] = value;
    }
  }
  return values;
}

export async function submitContactInquiry(
  _prev: ContactInquiryActionState,
  formData: FormData,
): Promise<ContactInquiryActionState> {
  const values = formDataToValues(formData);
  try {
    const parsed = parseContactInquiryFormData(formData);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: Object.fromEntries(
          Object.entries(parsed.fieldErrors).map(([key, message]) => [key, [message]]),
        ),
        formError: "กรุณาตรวจสอบข้อมูลในฟอร์ม",
        values,
      };
    }
    const headerList = await headers();
    const result = await submitContactInquiryPayload(parsed.data, {
      headers: headerList,
      userAgent: headerList.get("user-agent"),
    });
    if (result.ok) {
      return {
        ok: true,
        inquiryId: result.inquiryId,
        mailSent: result.mailSent,
        mailStatus: result.mailStatus,
      };
    }
    return {
      ok: false,
      fieldErrors: result.fieldErrors,
      formError: result.formError || "ส่งข้อความไม่สำเร็จ กรุณาลองใหม่",
      values,
    };
  } catch {
    return {
      ok: false,
      formError: "การเชื่อมต่อขัดข้อง กรุณาตรวจสอบอินเทอร์เน็ตแล้วกดส่งอีกครั้ง",
      values,
    };
  }
}
