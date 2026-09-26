import { mailFromName } from "@/lib/contact-inquiry-mail";

export function gmailUser(): string {
  return (process.env.GMAIL_USER || "").trim();
}

export function gmailAppPassword(): string {
  return (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
}

export function isGmailSmtpConfigured(): boolean {
  const user = gmailUser();
  const pass = gmailAppPassword();
  return user.includes("@") && pass.length >= 16;
}

export type SendGmailResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendGmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendGmailResult> {
  if (!isGmailSmtpConfigured()) {
    return { ok: false, error: "not_configured" };
  }
  try {
    const nodemailer = (await import("nodemailer")).default;
    const user = gmailUser();
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass: gmailAppPassword() },
    });
    await transporter.sendMail({
      from: `"${mailFromName()}" <${user}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "send_failed";
    return { ok: false, error: message.slice(0, 400) };
  }
}
