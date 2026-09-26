"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import {
  diffKnowledgeAction,
  syncKnowledgeAction,
} from "@/app/actions/ops-knowledge-sync";
import type {
  KnowledgeChange,
  KnowledgeDiff,
  KnowledgeSyncLogRow,
} from "@/lib/ops-knowledge-sync";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusTone(status: KnowledgeChange["status"]): string {
  switch (status) {
    case "new":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "changed":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "stale":
      return "bg-rose-50 text-rose-800 border-rose-200";
    default:
      return "bg-ink/5 text-ink/70 border-ink/10";
  }
}

function statusLabel(status: KnowledgeChange["status"]): string {
  switch (status) {
    case "new":
      return "ใหม่";
    case "changed":
      return "เปลี่ยน";
    case "stale":
      return "ล้าสมัย";
    default:
      return "ตรงแล้ว";
  }
}

export function OpsKnowledgeSyncPanel({
  initialLogs,
  config,
}: {
  initialLogs: KnowledgeSyncLogRow[];
  config: {
    apiUrl: string;
    trantechRoot: string;
    localScriptExists: boolean;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [note, setNote] = useState(
    "กด «ดูสิ่งที่เปลี่ยน» ก่อน แล้วพิมพ์ อัปเดต เพื่อซิงค์คลัง Smart Gift",
  );
  const [diff, setDiff] = useState<KnowledgeDiff | null>(null);
  const [source, setSource] = useState<"api" | "local" | null>(null);
  const [confirm, setConfirm] = useState("");
  const [logs, setLogs] = useState(initialLogs);
  const [openLogId, setOpenLogId] = useState<number | null>(null);

  const pendingChanges = useMemo(
    () => (diff?.changes || []).filter((c) => c.status !== "match"),
    [diff],
  );
  const matchedCount = (diff?.changes || []).filter((c) => c.status === "match").length;

  function refreshFromResult(data: KnowledgeDiff, src: "api" | "local", mode: "diff" | "sync") {
    setDiff(data);
    setSource(src);
    setError("");
    setNote(
      mode === "sync" && data.applied
        ? `อัปเดตคลังแล้วผ่าน ${src} · เขียน ${(data.written || []).join(", ") || "—"}`
        : `เปรียบเทียบแล้วผ่าน ${src} · เปลี่ยน ${data.changedCount} หัวข้อ`,
    );
    const row: KnowledgeSyncLogRow = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      actorEmail: null,
      actorName: null,
      mode,
      status: "ok",
      applied: !!data.applied,
      changedCount: data.changedCount,
      written: data.written || [],
      changes: (data.changes || []).filter((c) => c.status !== "match"),
      catalog: data.catalog,
      summary: data.summary,
      source: src,
      errorMessage: null,
    };
    setLogs((prev) => [row, ...prev].slice(0, 40));
  }

  function onDiff() {
    startTransition(async () => {
      const res = await diffKnowledgeAction();
      if (!res.ok) {
        setError(res.error);
        setNote("อ่านความต่างไม่สำเร็จ");
        return;
      }
      refreshFromResult(res.data, res.source, "diff");
    });
  }

  function onSync() {
    startTransition(async () => {
      const res = await syncKnowledgeAction({ confirm });
      if (!res.ok) {
        setError(res.error);
        setNote("อัปเดตไม่สำเร็จ");
        return;
      }
      setConfirm("");
      refreshFromResult(res.data, res.source, "sync");
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-forest/15 bg-paper p-4 text-sm text-ink/75">
        <p>
          ซิงค์ข้อเท็จจริงที่เว็บเผยแพร่เข้าคลัง{" "}
          <code className="text-xs">docs/kb/terabis</code> ของ TranTech AI —
          ไม่เขียนราคาแคตตาล็อก และไม่เปิดต้นทุนโรงงาน
        </p>
        <p className="mt-2 text-xs text-ink/55">
          API: {config.apiUrl}
          {" · "}
          Local: {config.trantechRoot}
          {config.localScriptExists ? " (สคริปต์พร้อม)" : " (ไม่พบสคริปต์)"}
          {source ? ` · รอบล่าสุดผ่าน ${source}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={onDiff}
          className="inline-flex min-h-11 items-center rounded border border-forest/30 bg-white px-4 py-2 text-sm text-forest disabled:opacity-50"
        >
          ดูสิ่งที่เปลี่ยน
        </button>
        <label className="text-sm">
          <span className="block text-xs text-ink/55">พิมพ์ «อัปเดต» เพื่อยืนยัน</span>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 min-h-11 w-40 rounded border border-forest/20 bg-white px-3"
            placeholder="อัปเดต"
            disabled={pending}
          />
        </label>
        <button
          type="button"
          disabled={pending || confirm.trim() !== "อัปเดต"}
          onClick={onSync}
          className="inline-flex min-h-11 items-center rounded bg-forest px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          อัปเดตคลังความรู้
        </button>
      </div>

      <p className="text-sm text-ink/70">{note}</p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {diff ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-forest/15 bg-white p-3">
              <p className="text-xs text-ink/55">ซิงค์ล่าสุดใน KB</p>
              <p className="mt-1 text-sm font-medium text-forest">
                {formatWhen(diff.lastSyncAt)}
              </p>
            </div>
            <div className="rounded-lg border border-forest/15 bg-white p-3">
              <p className="text-xs text-ink/55">หัวข้อที่เปลี่ยน</p>
              <p className="mt-1 text-sm font-medium text-forest">
                {diff.changedCount}
                {matchedCount ? (
                  <span className="font-normal text-ink/50"> · ตรงแล้ว {matchedCount}</span>
                ) : null}
              </p>
            </div>
            <div className="rounded-lg border border-forest/15 bg-white p-3">
              <p className="text-xs text-ink/55">แคตตาล็อก</p>
              <p className="mt-1 text-sm font-medium text-forest">
                {diff.catalog.offerCount ?? "—"} รายการ
              </p>
              <p className="text-xs text-ink/55">
                มีราคา {diff.catalog.pricedCount ?? "—"} · รอใส่ราคา{" "}
                {diff.catalog.unpricedCount ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border border-forest/15 bg-white p-3">
              <p className="text-xs text-ink/55">สถานะแหล่ง</p>
              <p className="mt-1 text-sm font-medium text-forest">
                {diff.sourceOk ? "อ่านเว็บได้" : "อ่านเว็บไม่ได้"}
                {diff.canSync ? " · พร้อมซิงค์" : ""}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-forest/15">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-forest/5 text-xs text-ink/60">
                <tr>
                  <th className="px-3 py-2 font-medium">สถานะ</th>
                  <th className="px-3 py-2 font-medium">หัวข้อ</th>
                  <th className="px-3 py-2 font-medium">รายละเอียด</th>
                  <th className="px-3 py-2 font-medium">ไฟล์ KB</th>
                </tr>
              </thead>
              <tbody>
                {(pendingChanges.length ? pendingChanges : diff.changes).map((row) => (
                  <tr key={row.id} className="border-t border-forest/10">
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-xs ${statusTone(row.status)}`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-ink">{row.title}</td>
                    <td className="px-3 py-2 text-ink/75">{row.detail}</td>
                    <td className="px-3 py-2 text-xs text-ink/55">{row.kbFile || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {diff.summary ? (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-forest/10 bg-white p-3 text-xs text-ink/70">
              {diff.summary}
            </pre>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-forest">บันทึกอัปเดต</h2>
        <p className="mt-1 text-sm text-ink/65">
          ประวัติการกดดูความต่าง / อัปเดตจากหน้านี้ — ใช้วิเคราะห์ว่าใครซิงค์เมื่อไหร่ และเปลี่ยนอะไร
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-forest/15">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-forest/5 text-xs text-ink/60">
              <tr>
                <th className="px-3 py-2 font-medium">เวลา</th>
                <th className="px-3 py-2 font-medium">โหมด</th>
                <th className="px-3 py-2 font-medium">ผล</th>
                <th className="px-3 py-2 font-medium">เปลี่ยน</th>
                <th className="px-3 py-2 font-medium">ผู้กด</th>
                <th className="px-3 py-2 font-medium">ช่องทาง</th>
                <th className="px-3 py-2 font-medium">รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-ink/50">
                    ยังไม่มีบันทึก — กดดูสิ่งที่เปลี่ยนหรืออัปเดตเพื่อเริ่มประวัติ
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-t border-forest/10">
                      <td className="px-3 py-2 whitespace-nowrap">{formatWhen(row.createdAt)}</td>
                      <td className="px-3 py-2">{row.mode === "sync" ? "อัปเดต" : "เทียบ"}</td>
                      <td className="px-3 py-2">
                        {row.status === "ok" ? (
                          <span className="text-emerald-700">
                            {row.applied ? "เขียนแล้ว" : "สำเร็จ"}
                          </span>
                        ) : (
                          <span className="text-rose-700">ผิดพลาด</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.changedCount}</td>
                      <td className="px-3 py-2">
                        {row.actorName || row.actorEmail || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink/55">{row.source || "—"}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-forest underline-offset-2 hover:underline"
                          onClick={() =>
                            setOpenLogId((id) => (id === row.id ? null : row.id))
                          }
                        >
                          {openLogId === row.id ? "ซ่อน" : "วิเคราะห์"}
                        </button>
                      </td>
                    </tr>
                    {openLogId === row.id ? (
                      <tr className="border-t border-forest/5 bg-forest/[0.03]">
                        <td colSpan={7} className="px-3 py-3 text-xs text-ink/75">
                          {row.errorMessage ? (
                            <p className="text-rose-700">{row.errorMessage}</p>
                          ) : null}
                          {row.written.length ? (
                            <p className="mb-2">เขียนไฟล์: {row.written.join(", ")}</p>
                          ) : null}
                          {row.changes.length ? (
                            <ul className="list-disc space-y-1 pl-5">
                              {row.changes.map((c) => (
                                <li key={`${row.id}-${c.id}`}>
                                  <span className="font-medium">{c.title}</span>
                                  {" — "}
                                  {c.detail}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>{row.summary || "ไม่มีรายการเปลี่ยนในรอบนี้"}</p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
