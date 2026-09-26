"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { buyerQuotePath } from "@/lib/assistant-public";
import { isBuyerAssistantEnabled } from "@/lib/feature-flags";
import {
  BUYER_ASSISTANT_CHIPS,
  BUYER_ASSISTANT_CTA,
  BUYER_ASSISTANT_INTRO,
  BUYER_ASSISTANT_TITLE,
} from "@/lib/ux-copy";

const HIDDEN_PREFIXES = ["/contact", "/privacy", "/terms", "/quote-basket"];

type Turn = { role: "user" | "assistant"; content: string };

export function BuyerAssistantWidget() {
  const pathname = usePathname() || "/";
  const enabled = isBuyerAssistantEnabled();
  const hidden =
    pathname === "/ops" ||
    pathname.startsWith("/ops/") ||
    HIDDEN_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (!open || !thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [open, turns, error, busy]);

  const chips = useMemo(() => [...BUYER_ASSISTANT_CHIPS], []);
  const quoteHref = buyerQuotePath(
    turns.filter((turn) => turn.role === "user").map((turn) => turn.content),
  );

  if (!enabled || hidden) return null;

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setDraft("");
    setBusy(true);
    setError(null);
    setTurns((prev) => [...prev, { role: "user", content }]);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: content, history: turns.slice(-6) }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.reply) {
        throw new Error(json.error || "ถามไม่สำเร็จ");
      }
      setTurns((prev) => [...prev, { role: "assistant", content: json.reply || "" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ถามไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none fixed right-4 z-40 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-6">
      {open ? (
        <div className="pointer-events-auto mb-3 flex h-[min(28rem,70vh)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-forest/15 bg-paper shadow-[0_16px_48px_rgba(20,53,42,0.16)]">
          <div className="flex items-start justify-between gap-2 bg-forest px-4 py-3 text-paper">
            <div>
              <p className="text-sm font-semibold">{BUYER_ASSISTANT_TITLE}</p>
              <p className="mt-1 text-xs text-paper/80">{BUYER_ASSISTANT_INTRO}</p>
            </div>
            <button
              type="button"
              className="rounded-full border border-paper/30 px-2 py-1 text-xs"
              onClick={() => setOpen(false)}
            >
              ปิด
            </button>
          </div>
          <div
            ref={threadRef}
            className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm"
          >
            {turns.map((turn, index) => (
              <div
                key={`${turn.role}-${index}`}
                className={
                  turn.role === "user"
                    ? "ml-8 rounded-2xl bg-forest px-3 py-2 text-paper"
                    : "mr-4 rounded-2xl bg-forest-mist px-3 py-2 text-ink"
                }
              >
                {turn.content}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="rounded-full border border-forest/20 px-3 py-1.5 text-left text-xs text-forest hover:bg-forest-mist"
                  onClick={() => void send(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
            {error ? (
              <p className="text-xs text-red-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <form
            className="border-t border-forest/10 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <label className="sr-only" htmlFor="buyer-assistant-input">
              คำถาม
            </label>
            <div className="flex gap-2">
              <input
                id="buyer-assistant-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={500}
                placeholder="พิมพ์คำถาม…"
                className="min-w-0 flex-1 rounded-full border border-forest/20 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brass px-3 py-2 text-sm font-semibold text-forest disabled:opacity-60"
              >
                {busy ? "…" : "ส่ง"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-ink/60">
              ต้องการตัวเลขที่ตรงงาน?{" "}
              <Link href={quoteHref} className="underline underline-offset-2">
                ขอใบเสนอราคา
              </Link>
            </p>
          </form>
        </div>
      ) : null}
      <button
        type="button"
        className="pointer-events-auto rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-paper shadow-lg hover:bg-forest-light"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {BUYER_ASSISTANT_CTA}
      </button>
    </div>
  );
}
