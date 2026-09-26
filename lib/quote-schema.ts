import { z } from "zod";
import { cleanText } from "@/lib/sanitize";
import {
  DECORATION_METHODS,
  PRODUCT_INTEREST_MAX,
  type QuoteRequestInput,
} from "@/lib/quote-types";
import { isValidThaiTaxId } from "@/lib/th-billing";
import { formatThaiMailingAddress } from "@/lib/thai-address-format";
import { isValidEmail, isValidThaiPhone } from "@/lib/contact-validate";
import { EMAIL_INVALID, PHONE_INVALID } from "@/lib/ux-copy";
import {
  NEEDED_DATE_MIN_LEAD_DAYS,
  minNeededDateYmd,
} from "@/lib/bangkok-date";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function cleanedString(max: number, min = 0) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) return value;
      return cleanText(String(value));
    },
    min > 0
      ? z.string().min(min).max(max)
      : z.string().max(max),
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

function isRealCalendarDate(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export const quoteSchema = z
  .object({
    name: cleanedString(100, 2),
    company: cleanedString(160, 2),
    email: z.preprocess(
      (value) => cleanText(String(value ?? "")),
      z.string().refine(isValidEmail, { message: EMAIL_INVALID }),
    ),
    phone: z.preprocess(
      (value) => cleanText(String(value ?? "")),
      z.string().refine(isValidThaiPhone, { message: PHONE_INVALID }),
    ),
    quantity: z.coerce.number().int().min(1).max(1_000_000),
    consent: z.preprocess((value) => {
      if (value === true || value === "true" || value === "on" || value === "1") {
        return true;
      }
      return false;
    }, z.literal(true, { errorMap: () => ({ message: "Consent is required" }) })),
    budgetPerSet: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }, z.number().positive().max(10_000_000).optional()),
    neededDate: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      return cleanText(String(value));
    }, z.string().regex(DATE_PATTERN).optional()),
    province: optionalCleanedString(100),
    district: optionalCleanedString(80),
    subdistrict: optionalCleanedString(80),
    streetAddress: optionalCleanedString(300),
    zip: optionalCleanedString(10),
    taxId: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      const digits = String(value).replace(/\D/g, "");
      return digits.length === 0 ? undefined : digits;
    }, z
      .string()
      .length(13)
      .refine((value) => isValidThaiTaxId(value), "Invalid tax ID")
      .optional()),
    billingBranch: optionalCleanedString(160),
    productInterest: optionalCleanedString(PRODUCT_INTEREST_MAX),
    productSlug: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      const cleaned = cleanText(String(value));
      return cleaned.length === 0 ? undefined : cleaned;
    }, z
      .string()
      .max(160)
      .refine((v) => SLUG_PATTERN.test(v), "Invalid product slug")
      .optional()),
    decorationMethod: z.preprocess(
      (value) => {
        const cleaned = cleanText(String(value ?? "not-sure"));
        return cleaned || "not-sure";
      },
      z.enum(DECORATION_METHODS),
    ),
    detail: optionalCleanedString(2000),
    landingPath: optionalCleanedString(500),
    referrer: optionalCleanedString(1000),
    utmSource: optionalCleanedString(200),
    utmMedium: optionalCleanedString(200),
    utmCampaign: optionalCleanedString(300),
    utmTerm: optionalCleanedString(300),
    utmContent: optionalCleanedString(300),
    website: z.preprocess((value) => {
      if (value === undefined || value === null) return "";
      return String(value);
    }, z.string().max(500).optional()),
    startedAt: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }, z.number().int().positive().optional()),
  })
  .superRefine((data, ctx) => {
    if (!data.neededDate) return;
    if (!isRealCalendarDate(data.neededDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["neededDate"],
        message: "Invalid calendar date",
      });
      return;
    }
    const minDate = minNeededDateYmd();
    if (data.neededDate < minDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["neededDate"],
        message: `วันที่ต้องการใช้งานต้องไม่เร็วกว่า ${minDate} (วันนี้บวก ${NEEDED_DATE_MIN_LEAD_DAYS} วัน)`,
      });
    }
  });

export type QuoteSchemaOutput = z.infer<typeof quoteSchema>;

export function parseQuoteFormData(
  formData: FormData,
): {
  success: true;
  data: QuoteRequestInput;
} | {
  success: false;
  fieldErrors: Record<string, string>;
} {
  const raw: Record<string, FormDataEntryValue | undefined> = {
    name: formData.get("name") ?? undefined,
    company: formData.get("company") ?? undefined,
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    quantity: formData.get("quantity") ?? undefined,
    consent: formData.get("consent") ?? undefined,
    budgetPerSet: formData.get("budgetPerSet") ?? undefined,
    neededDate: formData.get("neededDate") ?? undefined,
    province: formData.get("province") ?? undefined,
    district: formData.get("district") ?? undefined,
    subdistrict: formData.get("subdistrict") ?? undefined,
    streetAddress: formData.get("streetAddress") ?? undefined,
    zip: formData.get("zip") ?? undefined,
    taxId: formData.get("taxId") ?? undefined,
    billingBranch: formData.get("billingBranch") ?? undefined,
    productInterest: formData.get("productInterest") ?? undefined,
    productSlug: formData.get("productSlug") ?? undefined,
    decorationMethod: formData.get("decorationMethod") ?? undefined,
    detail: formData.get("detail") ?? undefined,
    landingPath: formData.get("landingPath") ?? undefined,
    referrer: formData.get("referrer") ?? undefined,
    utmSource: formData.get("utmSource") ?? undefined,
    utmMedium: formData.get("utmMedium") ?? undefined,
    utmCampaign: formData.get("utmCampaign") ?? undefined,
    utmTerm: formData.get("utmTerm") ?? undefined,
    utmContent: formData.get("utmContent") ?? undefined,
    website: formData.get("website") ?? undefined,
    startedAt: formData.get("startedAt") ?? undefined,
  };

  const parsed = quoteSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      ...parsed.data,
      province:
        formatThaiMailingAddress({
          streetAddress: parsed.data.streetAddress,
          province: parsed.data.province,
          district: parsed.data.district,
          subdistrict: parsed.data.subdistrict,
          zip: parsed.data.zip,
        }) || parsed.data.province,
    } as QuoteRequestInput,
  };
}

export {
  NEEDED_DATE_MIN_LEAD_DAYS,
  bangkokTodayYmd,
  bangkokYmdPlusDays,
  minNeededDateYmd,
} from "@/lib/bangkok-date";
