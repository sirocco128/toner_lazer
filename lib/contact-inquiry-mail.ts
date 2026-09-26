import { COMPANY } from "@/lib/company";
import {
  CONTACT_CALLBACK_LABELS,
  CONTACT_TOPIC_LABELS,
  type ContactCallbackChannel,
  type ContactTopic,
} from "@/lib/contact-inquiry-types";

export type ContactAutoReplyInput = {
  name: string;
  inquiryId: string;
  topic: ContactTopic;
  callbackChannel: ContactCallbackChannel;
};

export function mailSignOff(): string {
  const fromEnv = (process.env.MAIL_SIGN_OFF || "").trim();
  return fromEnv || COMPANY.brandName;
}

export function mailFromName(): string {
  const fromEnv = (process.env.MAIL_FROM_NAME || "").trim();
  return fromEnv || COMPANY.legalName;
}

export function wantsEmailCallback(channel: ContactCallbackChannel): boolean {
  return channel === "email" || channel === "both";
}

export function composeContactAutoReply(input: ContactAutoReplyInput): {
  subject: string;
  text: string;
  html: string;
} {
  const topic = CONTACT_TOPIC_LABELS[input.topic];
  const channel = CONTACT_CALLBACK_LABELS[input.callbackChannel];
  const signOff = mailSignOff();
  const legal = COMPANY.legalName;
  const subject = `ได้รับข้อความของท่านแล้ว — ${legal}`;
  const text = [
    `สวัสดีคุณ ${input.name}`,
    "",
    "ขอขอบคุณที่ลูกค้าติดต่อเข้ามา",
    `ทางเราได้รับข้อความเรื่อง ${topic} เรียบร้อยแล้ว และจะรีบประสานงานเพื่อติดต่อกลับทาง${channel}`,
    "",
    `เลขอ้างอิง: ${input.inquiryId}`,
    "",
    "ด้วยความนับถือ",
    signOff,
    legal,
  ].join("\n");
  const html = `
    <p>สวัสดีคุณ ${escapeHtml(input.name)}</p>
    <p>ขอขอบคุณที่ลูกค้าติดต่อเข้ามา</p>
    <p>ทางเราได้รับข้อความเรื่อง <strong>${escapeHtml(topic)}</strong> เรียบร้อยแล้ว และจะรีบประสานงานเพื่อติดต่อกลับทาง${escapeHtml(channel)}</p>
    <p>เลขอ้างอิง: <code>${escapeHtml(input.inquiryId)}</code></p>
    <p>ด้วยความนับถือ<br/>${escapeHtml(signOff)}<br/>${escapeHtml(legal)}</p>
  `.trim();
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
