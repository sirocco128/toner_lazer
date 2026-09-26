"use client";

import { useState } from "react";

type Props = {
  orderId: string;
  customerUrl: string;
  contactName?: string | null;
};

export function CopyCustomerOrderLink({
  orderId,
  customerUrl,
  contactName,
}: Props) {
  const [copied, setCopied] = useState<"url" | "message" | null>(null);

  const greeting = contactName?.trim() ? `คุณ${contactName.trim()}` : "คุณลูกค้า";
  const message = [
    `สวัสดี${greeting}`,
    "",
    `ลิงก์ติดตามออเดอร์ ${orderId} ชำระเงิน และแจ้งปัญหาสินค้า:`,
    customerUrl,
    "",
    "กรุณาเปิดจากลิงก์นี้โดยตรง และอย่าแชร์ต่อให้ผู้อื่น",
  ].join("\n");

  async function copy(kind: "url" | "message") {
    const text = kind === "url" ? customerUrl : message;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-forest/15 bg-forest-mist/40 p-3 text-sm">
      <p className="font-medium text-forest">ลิงก์ลูกค้า (magic link)</p>
      <a
        href={customerUrl}
        className="mt-1 block break-all text-xs text-forest underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {customerUrl}
      </a>
      <p className="mt-2 text-xs text-ink/60">
        คัดลอกส่งอีเมลหรือ LINE ให้ลูกค้าหลังเปิดออเดอร์หรือขอชำระเงิน
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copy("url")}
          className="rounded-full border border-forest/20 bg-paper px-3 py-1.5 text-xs font-semibold text-forest hover:bg-paper/80"
        >
          {copied === "url" ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์"}
        </button>
        <button
          type="button"
          onClick={() => void copy("message")}
          className="rounded-full bg-forest px-3 py-1.5 text-xs font-semibold text-paper hover:opacity-90"
        >
          {copied === "message" ? "คัดลอกข้อความแล้ว" : "คัดลอกข้อความ LINE/อีเมล"}
        </button>
      </div>
    </div>
  );
}
