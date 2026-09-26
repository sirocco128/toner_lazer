import { z } from "zod";
import { cleanText } from "@/lib/sanitize";
import { isValidEmail, isValidThaiPhone } from "@/lib/contact-validate";
import { EMAIL_INVALID, PHONE_INVALID } from "@/lib/ux-copy";
import {
  CONTACT_CALLBACK_CHANNELS,
  CONTACT_TOPICS,
  type ContactInquiryInput,
} from "@/lib/contact-inquiry-types";

function cleanedString(max: number, min = 0) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) return value;
      return cleanText(String(value));
    },
    min > 0 ? z.string().min(min).max(max) : z.string().max(max),
  );
}

function optionalCleanedString(max: number) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined;
      const cleaned = cleanText(String(value));
      return cleaned.length === 0 ? undefined : cleaned;
    },
    z.string().max(max).optional(),
  );
}

export const contactInquirySchema = z.object({
  topic: z.enum(CONTACT_TOPICS, {
    errorMap: () => ({ message: "กรุณาเลือกหัวข้อ" }),
  }),
  name: cleanedString(100, 2),
  company: optionalCleanedString(160),
  email: z.preprocess(
    (value) => cleanText(String(value ?? "")),
    z.string().refine(isValidEmail, { message: EMAIL_INVALID }),
  ),
  phone: z.preprocess(
    (value) => cleanText(String(value ?? "")),
    z.string().refine(isValidThaiPhone, { message: PHONE_INVALID }),
  ),
  callbackChannel: z.enum(CONTACT_CALLBACK_CHANNELS, {
    errorMap: () => ({ message: "กรุณาเลือกช่องทางติดต่อกลับ" }),
  }),
  message: cleanedString(4000, 8),
  consent: z.preprocess((value) => {
    if (value === true || value === "true" || value === "on" || value === "1") {
      return true;
    }
    return false;
  }, z.literal(true, { errorMap: () => ({ message: "กรุณายินยอมให้ติดต่อกลับ" }) })),
  landingPath: optionalCleanedString(240),
  website: optionalCleanedString(200),
  startedAt: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }, z.number().optional()),
});

export function parseContactInquiryFormData(
  formData: FormData,
):
  | { success: true; data: ContactInquiryInput }
  | { success: false; fieldErrors: Record<string, string> } {
  const raw = {
    topic: formData.get("topic") ?? undefined,
    name: formData.get("name") ?? undefined,
    company: formData.get("company") ?? undefined,
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    callbackChannel: formData.get("callbackChannel") ?? undefined,
    message: formData.get("message") ?? undefined,
    consent: formData.get("consent") ?? undefined,
    landingPath: formData.get("landingPath") ?? undefined,
    website: formData.get("website") ?? undefined,
    startedAt: formData.get("startedAt") ?? undefined,
  };

  const parsed = contactInquirySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { success: false, fieldErrors };
  }

  return { success: true, data: parsed.data as ContactInquiryInput };
}
