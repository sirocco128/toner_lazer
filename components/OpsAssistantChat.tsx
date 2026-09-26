"use client";

import { FormEvent, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };
type ToolHit = { tool: string; summary: string };

const CHIPS = [
  "สรุปคำขอล่าสุด",
  "ร่างข้อความ LINE",
  "ค้นหาสินค้า กระบอกน้ำ",
  "ร่าง SEO ธีมธรรมชาติ แล้วบันทึกลงเว็บ",
];

export function OpsAssistantChat() {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [tools, setTools] = useState<ToolHit[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setDraft("");
    setBusy(true);
    setError(null);
    setTurns((prev) => [...prev, { role: "user", content }]);
    try {
      const res = await fetch("/api/ops/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        tools?: ToolHit[];
        error?: string;
      };
      if (!res.ok || !json.ok || !json.reply) {
        throw new Error(json.error || "ถามไม่สำเร็จ");
      }
      setTools(json.tools || []);
      setTurns((prev) => [...prev, { role: "assistant", content: json.reply || "" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ถามไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <div className="rounded border border-forest/15 bg-paper">
      <div className="flex flex-wrap gap-2 border-b border-forest/10 px-4 py-3">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className="rounded-full border border-forest/20 px-3 py-1.5 text-xs text-forest hover:bg-forest-mist"
            onClick={() => void send(chip)}
          >
            {chip}
          </button>
        ))}
      </div>
      <div className="min-h-[16rem] space-y-3 px-4 py-4 text-sm">
        {turns.length === 0 ? (
          <p className="text-ink/70">
        สรุปคำขอ ร่างข้อความติดต่อลูกค้า ค้นสินค้า หรือร่าง SEO แล้วบันทึกลงหน้าเว็บ —
        ผู้ช่วยไม่ออกใบเสนอราคาและไม่เปิดต้นทุนโรงงาน
          </p>
        ) : (
          turns.map((turn, index) => (
            <div
              key={`${turn.role}-${index}`}
              className={
                turn.role === "user"
                  ? "ml-10 whitespace-pre-wrap rounded bg-forest px-3 py-2 text-paper"
                  : "mr-6 whitespace-pre-wrap rounded bg-forest-mist px-3 py-2"
              }
            >
              {turn.content}
            </div>
          ))
        )}
        {tools.length > 0 ? (
          <p className="text-xs text-ink/55">
            เครื่องมือ: {tools.map((item) => item.summary).join(" · ")}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-forest/10 p-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={800}
          placeholder="เช่น สรุป RFQ-… หรือ ร่างข้อความ LINE"
          className="min-w-0 flex-1 rounded border border-forest/20 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-forest px-4 py-2 text-sm font-medium text-paper disabled:opacity-60"
        >
          {busy ? "กำลังคิด…" : "ส่ง"}
        </button>
      </form>
    </div>
  );
}
