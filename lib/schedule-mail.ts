import { mailFromName, mailSignOff } from "@/lib/contact-inquiry-mail";
import { COMPANY } from "@/lib/company";
import {
  formatBangkokDateTime,
  formatBangkokTime,
} from "@/lib/bangkok-date";
import { isGmailSmtpConfigured, sendGmail } from "@/lib/gmail-smtp";
import { updateAttendeeNotifyResult } from "@/lib/schedule-repository";
import {
  SCHEDULE_KIND_LABELS,
  SCHEDULE_STATUS_LABELS,
  type ScheduleEvent,
} from "@/lib/schedule-types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type ScheduleMailAction =
  | "created"
  | "updated"
  | "cancelled"
  | "confirmed"
  | "booked";

const ACTION_SUBJECT: Record<ScheduleMailAction, string> = {
  created: "นัดหมายใหม่",
  updated: "อัปเดตนัดหมาย",
  cancelled: "ยกเลิกนัดหมาย",
  confirmed: "ยืนยันนัดหมาย",
  booked: "จองนัดหมายสำเร็จ",
};

export function composeScheduleNotifyMail(
  event: ScheduleEvent,
  action: ScheduleMailAction,
  recipientName?: string | null,
): { subject: string; text: string; html: string } {
  const kind = SCHEDULE_KIND_LABELS[event.kind];
  const status = SCHEDULE_STATUS_LABELS[event.status];
  const when = `${formatBangkokDateTime(event.startsAt)} – ${formatBangkokTime(event.endsAt)}`;
  const greet = recipientName?.trim() ? `สวัสดีคุณ ${recipientName.trim()}` : "สวัสดีค่ะ/ครับ";
  const subject = `${ACTION_SUBJECT[action]} — ${event.title} (${COMPANY.brandName})`;
  const lines = [
    greet,
    "",
    `${ACTION_SUBJECT[action]}`,
    `หัวข้อ: ${event.title}`,
    `ประเภท: ${kind}`,
    `สถานะ: ${status}`,
    `เวลา: ${when} (เวลาไทย)`,
    event.location ? `สถานที่: ${event.location}` : null,
    event.notes ? `รายละเอียด: ${event.notes}` : null,
    `รหัสนัด: ${event.id}`,
    "",
    "ด้วยความนับถือ",
    mailSignOff(),
    mailFromName(),
  ].filter((line): line is string => line !== null);
  const text = lines.join("\n");
  const html = `
    <p>${escapeHtml(greet)}</p>
    <p><strong>${escapeHtml(ACTION_SUBJECT[action])}</strong></p>
    <ul>
      <li>หัวข้อ: ${escapeHtml(event.title)}</li>
      <li>ประเภท: ${escapeHtml(kind)}</li>
      <li>สถานะ: ${escapeHtml(status)}</li>
      <li>เวลา: ${escapeHtml(when)} (เวลาไทย)</li>
      ${event.location ? `<li>สถานที่: ${escapeHtml(event.location)}</li>` : ""}
      ${event.notes ? `<li>รายละเอียด: ${escapeHtml(event.notes)}</li>` : ""}
      <li>รหัสนัด: <code>${escapeHtml(event.id)}</code></li>
    </ul>
    <p>ด้วยความนับถือ<br/>${escapeHtml(mailSignOff())}<br/>${escapeHtml(mailFromName())}</p>
  `.trim();
  return { subject, text, html };
}

export async function notifyScheduleAttendees(
  event: ScheduleEvent,
  action: ScheduleMailAction,
): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  if (!isGmailSmtpConfigured()) {
    return { sent: 0, skipped: event.attendees.filter((a) => a.notify).length, failed: 0 };
  }
  for (const attendee of event.attendees) {
    if (!attendee.notify) {
      skipped += 1;
      continue;
    }
    const mail = composeScheduleNotifyMail(event, action, attendee.name);
    const result = await sendGmail({
      to: attendee.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    updateAttendeeNotifyResult(attendee.id, result);
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return { sent, skipped, failed };
}
