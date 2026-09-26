import { randomBytes } from "node:crypto";
import { bangkokDateYmd } from "@/lib/bangkok-date";
import {
  composeContactAutoReply,
  wantsEmailCallback,
} from "@/lib/contact-inquiry-mail";
import { insertContactInquiry } from "@/lib/contact-inquiry-repository";
import type {
  ContactInquiryInput,
  ContactMailStatus,
} from "@/lib/contact-inquiry-types";
import { isGmailSmtpConfigured, sendGmail } from "@/lib/gmail-smtp";
import { consumeRateLimit } from "@/lib/quote-repository";
import { hashIp, resolveClientIp } from "@/lib/quote-service";

const MIN_FORM_MS = 1_200;
const MAX_FORM_MS = 24 * 60 * 60 * 1000;

export type ContactInquirySubmitSuccess = {
  ok: true;
  inquiryId: string;
  mailSent: boolean;
  mailStatus: ContactMailStatus;
  neutral?: boolean;
};

export type ContactInquirySubmitFailure = {
  ok: false;
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

export type ContactInquirySubmitResult =
  | ContactInquirySubmitSuccess
  | ContactInquirySubmitFailure;

export type SubmitContactInquiryContext = {
  headers: Headers;
  userAgent?: string | null;
};

export function createInquiryId(now = new Date()): string {
  const datePart = bangkokDateYmd(now);
  const suffix = randomBytes(6).toString("hex").toUpperCase();
  return `CT-${datePart}-${suffix}`;
}

function toFieldErrors(
  errors: Record<string, string>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, message] of Object.entries(errors)) {
    out[key] = [message];
  }
  return out;
}

export async function submitContactInquiryPayload(
  input: ContactInquiryInput,
  context: SubmitContactInquiryContext,
): Promise<ContactInquirySubmitResult> {
  if (input.website && input.website.trim().length > 0) {
    return {
      ok: true,
      inquiryId: createInquiryId(),
      mailSent: false,
      mailStatus: "skipped",
      neutral: true,
    };
  }

  const startedAt = input.startedAt;
  if (!startedAt || !Number.isFinite(startedAt)) {
    return {
      ok: false,
      formError: "กรุณาเปิดฟอร์มใหม่แล้วส่งอีกครั้ง",
      fieldErrors: toFieldErrors({ startedAt: "Missing form start time" }),
    };
  }
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_FORM_MS || elapsed > MAX_FORM_MS) {
    return {
      ok: false,
      formError: "ไม่สามารถส่งข้อความได้ในขณะนี้ กรุณาลองใหม่",
      fieldErrors: toFieldErrors({ form: "Invalid form timing" }),
    };
  }

  const ipHash = hashIp(resolveClientIp(context.headers));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const allowed = consumeRateLimit({
    keyHash: `contact-inquiry:${ipHash}`,
    bucketStart: nowSeconds - (nowSeconds % 900),
    maxAttempts: 6,
    nowSeconds,
  });
  if (!allowed) {
    return { ok: false, formError: "ส่งข้อความบ่อยเกินไป กรุณารอสักครู่" };
  }

  const inquiryId = createInquiryId();
  const submittedAt = new Date().toISOString();
  const shouldMail = wantsEmailCallback(input.callbackChannel);
  let mailStatus: ContactMailStatus = "skipped";
  let mailError: string | null = null;
  let mailSentAt: string | null = null;
  let mailSent = false;

  if (shouldMail) {
    if (!isGmailSmtpConfigured()) {
      mailStatus = "skipped";
      mailError = "not_configured";
    } else {
      const letter = composeContactAutoReply({
        name: input.name,
        inquiryId,
        topic: input.topic,
        callbackChannel: input.callbackChannel,
      });
      const sent = await sendGmail({
        to: input.email,
        subject: letter.subject,
        text: letter.text,
        html: letter.html,
      });
      if (sent.ok) {
        mailStatus = "sent";
        mailSent = true;
        mailSentAt = new Date().toISOString();
      } else {
        mailStatus = "failed";
        mailError = sent.error;
      }
    }
  }

  insertContactInquiry({
    inquiryId,
    submittedAt,
    topic: input.topic,
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    callbackChannel: input.callbackChannel,
    message: input.message,
    consentAt: submittedAt,
    mailStatus,
    mailError,
    mailSentAt,
    ipHash,
    userAgent: context.userAgent || null,
    landingPath: input.landingPath || "/contact",
  });

  return { ok: true, inquiryId, mailSent, mailStatus };
}
