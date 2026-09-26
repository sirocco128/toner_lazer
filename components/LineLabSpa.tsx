"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LineLabContact, LineLabToken } from "@/lib/line-oa";

type LabStatus = {
  enabled: boolean;
  testMode: boolean;
  webhookPath: string;
};

type ChatLine = {
  id: string;
  from: "buyer" | "system";
  text: string;
};

type SimulateResponse = {
  ok: boolean;
  error?: string;
  httpStatus?: number;
  webhook?: { ok: boolean; skipped?: boolean; processed?: number; bound?: number; error?: string };
  request?: { path: string; method: string; headers: Record<string, string>; body: unknown };
  contacts?: LineLabContact[];
  tokens?: LineLabToken[];
  token?: string;
  customerId?: number;
};

async function labFetch(init?: RequestInit): Promise<SimulateResponse & { status?: LabStatus }> {
  const response = await fetch("/api/ops/line-lab", {
    credentials: "same-origin",
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = (await response.json()) as SimulateResponse & { status?: LabStatus };
  if (!response.ok && !data.error) {
    data.error = `HTTP ${response.status}`;
    data.ok = false;
  }
  return data;
}

export function LineLabSpa({
  initialStatus,
  initialContacts = [],
  initialTokens = [],
}: {
  initialStatus: LabStatus;
  initialContacts?: LineLabContact[];
  initialTokens?: LineLabToken[];
}) {
  const [status, setStatus] = useState<LabStatus | null>(initialStatus);
  const [contacts, setContacts] = useState<LineLabContact[]>(initialContacts);
  const [tokens, setTokens] = useState<LineLabToken[]>(initialTokens);
  const [contactId, setContactId] = useState<number | "">(
    initialContacts[0]?.id ?? "",
  );
  const [lineUserId, setLineUserId] = useState("Ulab-user-001");
  const [displayName, setDisplayName] = useState("ผู้ทดสอบไลน์");
  const [draft, setDraft] = useState("");
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [last, setLast] = useState<SimulateResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => contacts.find((c) => c.id === contactId) || null,
    [contacts, contactId],
  );

  const applyLists = useCallback((data: SimulateResponse) => {
    if (data.contacts) {
      const nextContacts = data.contacts;
      setContacts(nextContacts);
      setContactId((current) => {
        if (current && nextContacts.some((c) => c.id === current)) return current;
        return nextContacts[0]?.id ?? "";
      });
    }
    if (data.tokens) setTokens(data.tokens);
  }, []);

  const load = useCallback(async () => {
    const data = await labFetch();
    if (!data.ok) {
      setError(data.error || "โหลดห้องทดลองไม่สำเร็จ");
      return;
    }
    setError(null);
    if (data.status) setStatus(data.status);
    applyLists(data);
  }, [applyLists]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      const data = await labFetch({
        method: "POST",
        body: JSON.stringify({ action, contactId, displayName, ...extra }),
      });
      applyLists(data);
      if (!data.ok) {
        setError(data.error || "ไม่สำเร็จ");
        return data;
      }
      setLast(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "เครือข่ายขัดข้อง");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function seed() {
    await run("seed");
  }

  async function issueToken() {
    if (!contactId) {
      setError("เลือกผู้ติดต่อก่อน");
      return;
    }
    const data = await run("token");
    if (data?.token) {
      setDraft(data.token);
      setChat((rows) => [
        ...rows,
        {
          id: `sys-${Date.now()}`,
          from: "system",
          text: `รหัสเชื่อมไลน์: ${data.token} — ส่งรหัสนี้จากฝั่งลูกค้า`,
        },
      ]);
    }
  }

  async function send(invalidSignature = false) {
    const text = draft.trim();
    if (!text) {
      setError("พิมพ์ข้อความหรือกดสร้างรหัสก่อน");
      return;
    }
    setChat((rows) => [
      ...rows,
      { id: `buy-${Date.now()}`, from: "buyer", text },
    ]);
    const data = await run("simulate", { text, lineUserId, invalidSignature });
    if (!data) return;
    const webhook = data.webhook;
    const reply = webhook?.skipped
      ? "Webhook ถูกข้าม (ยังไม่เปิด LINE OA)"
      : data.httpStatus === 401
        ? `ลายเซ็นไม่ผ่าน (${webhook?.error || "invalid signature"})`
        : webhook?.bound
          ? `ผูกไลน์สำเร็จ · ประมวลผล ${webhook.processed} เหตุการณ์`
          : `รับแล้ว แต่ยังไม่ผูก · ประมวลผล ${webhook?.processed ?? 0} เหตุการณ์ (ต้องมีรหัส TB- ในข้อความ)`;
    setChat((rows) => [
      ...rows,
      { id: `sys-${Date.now()}-r`, from: "system", text: reply },
    ]);
    if (data.httpStatus !== 401) setDraft("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-2xl border border-forest/15 bg-[#748189] shadow-sm">
        <header className="flex items-center gap-3 bg-[#06C755] px-4 py-3 text-white">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
            OA
          </span>
          <div>
            <p className="text-sm font-semibold">ไลน์ร้าน (จำลอง)</p>
            <p className="text-xs text-white/80">ส่งเหตุการณ์เข้า {status?.webhookPath || "/api/line/webhook"}</p>
          </div>
        </header>
        <div className="flex h-[420px] flex-col bg-[#748189]">
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
            {chat.length === 0 ? (
              <p className="rounded-lg bg-white/80 px-3 py-2 text-sm text-ink/70">
                ยังไม่มีข้อความ — สร้างรหัส TB- แล้วส่งจากช่องนี้เหมือนลูกค้าพิมพ์ในไลน์
              </p>
            ) : (
              chat.map((line) => (
                <p
                  key={line.id}
                  className={
                    line.from === "buyer"
                      ? "ml-12 rounded-2xl rounded-tr-sm bg-[#8DE37D] px-3 py-2 text-sm text-ink"
                      : "mr-12 rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-ink"
                  }
                >
                  {line.text}
                </p>
              ))
            )}
          </div>
          <form
            className="flex gap-2 bg-[#EEEEEE] p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(false);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="พิมพ์รหัส TB-… หรือข้อความอื่น"
              className="min-w-0 flex-1 rounded-full border border-black/10 px-4 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-[#06C755] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              ส่ง
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-forest/15 bg-paper p-4">
        <div>
          <h2 className="text-lg font-semibold text-forest">แผงทดลอง webhook</h2>
          <p className="mt-1 text-sm text-ink/70">
            {status?.testMode
              ? "โหมดทดลองท้องถิ่น — ไม่ต้องมี LINE Channel จริง"
              : status?.enabled
                ? "ใช้ Channel จริง"
                : "Webhook ยังปิดอยู่"}
          </p>
        </div>

        <label className="block text-sm">
          ผู้ติดต่อใน CRM
          <select
            value={contactId}
            onChange={(event) => setContactId(event.target.value ? Number(event.target.value) : "")}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          >
            {contacts.length === 0 ? (
              <option value="">ยังไม่มีผู้ติดต่อ</option>
            ) : (
              contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company} · {c.name || c.email}
                  {c.lineUserId ? " · ผูกแล้ว" : ""}
                </option>
              ))
            )}
          </select>
        </label>

        {selected?.lineUserId ? (
          <p className="text-sm text-forest">
            ผูกแล้ว: {selected.lineDisplayName || selected.lineUserId}
          </p>
        ) : null}

        <label className="block text-sm">
          LINE user id จำลอง
          <input
            value={lineUserId}
            onChange={(event) => setLineUserId(event.target.value)}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono text-xs"
          />
        </label>

        <label className="block text-sm">
          ชื่อที่แสดงในไลน์
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2 text-sm"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void seed()}
            className="rounded border border-forest px-3 py-1.5 text-sm text-forest disabled:opacity-60"
          >
            สร้างลูกค้าทดลอง
          </button>
          <button
            type="button"
            disabled={busy || !contactId}
            onClick={() => void issueToken()}
            className="rounded bg-forest px-3 py-1.5 text-sm text-paper disabled:opacity-60"
          >
            สร้างรหัส TB-
          </button>
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={() => void send(true)}
            className="rounded border border-red-700/40 px-3 py-1.5 text-sm text-red-800 disabled:opacity-60"
          >
            ส่งลายเซ็นผิด
          </button>
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {last?.request ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-forest">
              POST {last.request.path} → HTTP {last.httpStatus}
            </p>
            <pre className="max-h-56 overflow-auto rounded bg-forest-mist/60 p-3 text-xs">
              {JSON.stringify(
                {
                  headers: last.request.headers,
                  body: last.request.body,
                  response: last.webhook,
                },
                null,
                2,
              )}
            </pre>
          </div>
        ) : null}

        {tokens.length > 0 ? (
          <ul className="space-y-1 text-xs text-ink/70">
            {tokens.slice(0, 6).map((token) => (
              <li key={token.token} className="font-mono">
                {token.token} · {token.usedAt ? "ใช้แล้ว" : "ยังไม่ใช้"}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
