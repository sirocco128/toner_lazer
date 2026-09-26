/**
 * smartgift-brief/1 → QuoteRequestInput for submitQuotePayload.
 * Fixed backend host: https://smartgift.next-dev.net
 */

import { z } from "zod";
import { cleanText } from "@/lib/sanitize";
import {
  isValidEmail,
  isValidThaiPhone,
  normalizeThaiPhoneDigits,
} from "@/lib/contact-validate";
import { EMAIL_INVALID, PHONE_INVALID } from "@/lib/ux-copy";
import {
  PRODUCT_INTEREST_MAX,
  type QuoteRequestInput,
} from "@/lib/quote-types";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SCHEMA_ID = "smartgift-brief/1";
const MIN_FORM_MS = 1_200;
const MAX_FORM_MS = 24 * 60 * 60 * 1000;

const optionalString = (max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    const cleaned = cleanText(String(value));
    return cleaned.length === 0 ? undefined : cleaned;
  }, z.string().max(max).optional());

const lineSchema = z
  .object({
    code: optionalString(160),
    name: optionalString(300),
    qty: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }, z.number().int().positive().max(1_000_000).optional()),
  })
  .passthrough();

const bundleGroupSchema = z
  .object({
    label: optionalString(160),
    qty: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }, z.number().int().positive().max(1_000_000).optional()),
    codes: z.array(z.string().max(160)).max(50).optional(),
  })
  .passthrough();

export const smartgiftBriefSchema = z.object({
  schema: z.literal(SCHEMA_ID),
  submitted_at: optionalString(64),
  source: optionalString(120),
  page_url: optionalString(1000),
  brief: z
    .object({
      recipient: optionalString(200),
      occasion: optionalString(200),
      tier: optionalString(80),
      qty: z.preprocess((value) => {
        if (value === undefined || value === null || value === "") {
          return undefined;
        }
        const n = Number(value);
        return Number.isFinite(n) ? n : value;
      }, z.number().int().positive().max(1_000_000).optional()),
    })
    .passthrough()
    .optional(),
  lines: z.array(lineSchema).max(100).optional(),
  bundle: z
    .object({
      groups: z.array(bundleGroupSchema).max(40).optional(),
    })
    .passthrough()
    .optional(),
  contact: z
    .object({
      name: z.preprocess(
        (value) => cleanText(String(value ?? "")),
        z.string().min(2).max(100),
      ),
      company: optionalString(160),
      email: z.preprocess(
        (value) => cleanText(String(value ?? "")),
        z.string().refine(isValidEmail, { message: EMAIL_INVALID }),
      ),
      phone: z.preprocess(
        (value) => cleanText(String(value ?? "")),
        z
          .string()
          .refine((v) => isValidThaiPhone(v), { message: PHONE_INVALID }),
      ),
      note: optionalString(2000),
    })
    .passthrough(),
  notes: optionalString(2000),
  consent: z.preprocess((value) => {
    if (value === true || value === "true" || value === "on" || value === "1") {
      return true;
    }
    return false;
  }, z.literal(true, { errorMap: () => ({ message: "Consent is required" }) })),
  startedAt: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }, z.number().int().positive().optional()),
  website: z.preprocess((value) => {
    if (value === undefined || value === null) return "";
    return String(value);
  }, z.string().max(500).optional()),
});

export type SmartgiftBriefInput = z.infer<typeof smartgiftBriefSchema>;

export type BriefMapSuccess = {
  ok: true;
  data: QuoteRequestInput;
};

export type BriefMapFailure = {
  ok: false;
  fieldErrors: Record<string, string[]>;
  formError: string;
};

function zodToFieldErrors(
  error: z.ZodError,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "form";
    if (!out[key]) out[key] = [];
    out[key].push(issue.message);
  }
  return out;
}

function landingPathFromPageUrl(pageUrl?: string): string | undefined {
  if (!pageUrl) return undefined;
  try {
    const url = new URL(pageUrl);
    const path = `${url.pathname}${url.search}${url.hash}` || "/";
    return path.slice(0, 500);
  } catch {
    return cleanText(pageUrl).slice(0, 500) || undefined;
  }
}

function resolveQuantity(input: SmartgiftBriefInput): number | null {
  if (input.brief?.qty && input.brief.qty > 0) return Math.floor(input.brief.qty);
  const lines = input.lines || [];
  let sum = 0;
  let any = false;
  for (const line of lines) {
    if (line.qty && line.qty > 0) {
      sum += Math.floor(line.qty);
      any = true;
    }
  }
  if (any && sum > 0) return sum;
  return null;
}

function resolveProductSlug(input: SmartgiftBriefInput): string | undefined {
  for (const line of input.lines || []) {
    const raw = (line.code || "").trim().toLowerCase();
    if (raw && SLUG_PATTERN.test(raw) && raw.length <= 160) return raw;
  }
  return undefined;
}

function buildProductInterest(input: SmartgiftBriefInput): string | undefined {
  const parts: string[] = [];
  for (const line of input.lines || []) {
    const label = line.code || line.name;
    if (!label) continue;
    parts.push(line.qty ? `${label}×${line.qty}` : label);
  }
  if (parts.length === 0) return undefined;
  return parts.join(", ").slice(0, PRODUCT_INTEREST_MAX);
}

function buildDetail(input: SmartgiftBriefInput): string | undefined {
  const rows: string[] = ["[smg-ui brief]"];
  const brief = input.brief;
  if (brief) {
    const bits = [
      brief.recipient ? `recipient=${brief.recipient}` : null,
      brief.occasion ? `occasion=${brief.occasion}` : null,
      brief.tier ? `tier=${brief.tier}` : null,
      brief.qty ? `qty=${brief.qty}` : null,
    ].filter(Boolean);
    if (bits.length) rows.push(bits.join("; "));
  }
  const interest = buildProductInterest(input);
  if (interest) rows.push(`lines: ${interest}`);
  const groups = input.bundle?.groups || [];
  if (groups.length) {
    const g = groups
      .map((group) => {
        const codes = (group.codes || []).join("+") || "-";
        return `${group.label || "group"}:${group.qty ?? "?"}[${codes}]`;
      })
      .join(", ");
    rows.push(`bundle: ${g}`);
  }
  if (input.contact.note) rows.push(`note: ${input.contact.note}`);
  if (input.notes) rows.push(`notes: ${input.notes}`);
  const text = rows.join("\n").trim();
  return text.length ? text.slice(0, 2000) : undefined;
}

/** Prefer client startedAt when timing is valid; else treat as finished fill. */
export function resolveBriefStartedAt(
  raw: number | undefined,
  now = Date.now(),
): number {
  if (raw && Number.isFinite(raw)) {
    const elapsed = now - raw;
    if (elapsed >= MIN_FORM_MS && elapsed <= MAX_FORM_MS) return raw;
  }
  return now - 2_000;
}

export function mapBriefToQuoteInput(
  input: SmartgiftBriefInput,
): QuoteRequestInput {
  const quantity = resolveQuantity(input);
  if (!quantity) {
    // Defensive — schema path should catch via adapter validateQuantity
    throw new Error("quantity_required");
  }

  const phoneDigits = normalizeThaiPhoneDigits(input.contact.phone);
  const company =
    input.contact.company && input.contact.company.length >= 2
      ? input.contact.company
      : "ไม่ระบุ";

  return {
    name: input.contact.name,
    company,
    email: input.contact.email,
    phone: phoneDigits,
    quantity,
    consent: true,
    decorationMethod: "not-sure",
    productInterest: buildProductInterest(input),
    productSlug: resolveProductSlug(input),
    detail: buildDetail(input),
    landingPath: landingPathFromPageUrl(input.page_url),
    utmSource: input.source || "smg-ui",
    website: input.website || "",
    startedAt: resolveBriefStartedAt(input.startedAt),
  };
}

export function parseAndMapSmartgiftBrief(
  body: unknown,
): BriefMapSuccess | BriefMapFailure {
  const parsed = smartgiftBriefSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: zodToFieldErrors(parsed.error),
      formError: "กรุณาตรวจสอบข้อมูลในแบบฟอร์ม",
    };
  }

  const quantity = resolveQuantity(parsed.data);
  if (!quantity) {
    return {
      ok: false,
      fieldErrors: {
        "brief.qty": ["ระบุจำนวน (brief.qty หรือ lines[].qty)"],
      },
      formError: "กรุณาตรวจสอบข้อมูลในแบบฟอร์ม",
    };
  }

  try {
    return { ok: true, data: mapBriefToQuoteInput(parsed.data) };
  } catch {
    return {
      ok: false,
      fieldErrors: { form: ["ไม่สามารถแปลง brief ได้"] },
      formError: "กรุณาตรวจสอบข้อมูลในแบบฟอร์ม",
    };
  }
}

export const SMARTGIFT_BRIEF_SCHEMA = SCHEMA_ID;
