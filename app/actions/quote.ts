"use server";

import { headers } from "next/headers";
import { parseQuoteFormData } from "@/lib/quote-schema";
import { submitQuotePayload } from "@/lib/quote-service";
import type { QuoteFieldErrors } from "@/lib/quote-types";

export type QuoteFormValues = Record<string, string>;

export type QuoteActionState = {
  ok: boolean;
  requestId?: string;
  fieldErrors?: QuoteFieldErrors;
  formError?: string;
  /** Echoed field values for recovery after validation / network errors */
  values?: QuoteFormValues;
};

function formDataToValues(formData: FormData): QuoteFormValues {
  const values: QuoteFormValues = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "website") {
      values[key] = value;
    }
  }
  return values;
}

export async function submitQuote(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const values = formDataToValues(formData);

  try {
    const parsed = parseQuoteFormData(formData);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.fieldErrors as QuoteFieldErrors,
        formError: "กรุณาตรวจสอบข้อมูลในฟอร์ม",
        values,
      };
    }

    const headerList = await headers();
    const result = await submitQuotePayload(parsed.data, {
      headers: headerList,
      userAgent: headerList.get("user-agent"),
    });

    if (result.ok) {
      return {
        ok: true,
        requestId: result.requestId,
      };
    }

    return {
      ok: false,
      fieldErrors: result.fieldErrors,
      formError:
        result.error ||
        "ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง หรือติดต่อผ่านโทรศัพท์ / LINE",
      values,
    };
  } catch {
    return {
      ok: false,
      formError:
        "การเชื่อมต่อขัดข้อง กรุณาตรวจสอบอินเทอร์เน็ตแล้วกดส่งอีกครั้ง — ข้อมูลที่กรอกยังอยู่ครบ",
      values,
    };
  }
}
