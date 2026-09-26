"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  resetPageSeoAction,
  savePageSeoAction,
} from "@/app/actions/seo";
import type { OpsActionResult } from "@/app/actions/ops";
import type { CatalogSeoPage } from "@/lib/page-seo";

type PageRow = CatalogSeoPage & { source: "default" | "override" };

const initial: OpsActionResult | null = null;

function kindLabel(kind: PageRow["kind"]): string {
  if (kind === "theme") return "ธีม";
  if (kind === "product") return "สินค้า";
  if (kind === "category") return "หมวด";
  if (kind === "article") return "บทความ";
  if (kind === "portfolio") return "ผลงาน";
  return "หน้า";
}

export function OpsSeoEditor({
  pages,
  canWrite,
}: {
  pages: PageRow[];
  canWrite: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState(pages[0]?.path || "/");
  const [saveState, saveAction, savePending] = useActionState(
    savePageSeoAction,
    initial,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetPageSeoAction,
    initial,
  );
  const [drafting, startDraft] = useTransition();
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [fields, setFields] = useState(() => {
    const first = pages[0];
    return {
      seoTitle: first?.seo.seoTitle || "",
      metaDescription: first?.seo.metaDescription || "",
      ogImage: first?.seo.ogImage || "",
      keywords: first?.keywords.join(", ") || first?.seo.keywords || "",
      noIndex: Boolean(first?.seo.noIndex),
    };
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (page) =>
        page.path.toLowerCase().includes(q) ||
        page.label.toLowerCase().includes(q),
    );
  }, [pages, query]);

  const selected = pages.find((page) => page.path === selectedPath) ?? pages[0];

  function loadPage(path: string) {
    const page = pages.find((item) => item.path === path);
    if (!page) return;
    setSelectedPath(path);
    setDraftNote(null);
    setFields({
      seoTitle: page.seo.seoTitle,
      metaDescription: page.seo.metaDescription,
      ogImage: page.seo.ogImage || "",
      keywords: page.keywords.join(", ") || page.seo.keywords || "",
      noIndex: Boolean(page.seo.noIndex),
    });
  }

  function draftWithAi() {
    if (!selected) return;
    startDraft(() => {
      void (async () => {
        setDraftNote(null);
        const res = await fetch("/api/ops/seo/draft", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: selected.path }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          draft?: {
            seoTitle: string;
            metaDescription: string;
            keywords: string;
            notes: string;
          };
        };
        if (!res.ok || !json.ok || !json.draft) {
          setDraftNote(json.error || "ร่างไม่สำเร็จ");
          return;
        }
        setFields((prev) => ({
          ...prev,
          seoTitle: json.draft!.seoTitle,
          metaDescription: json.draft!.metaDescription,
          keywords: json.draft!.keywords,
        }));
        setDraftNote(json.draft.notes);
      })();
    });
  }

  if (!selected) {
    return <p className="text-sm text-ink/70">ยังไม่มีหน้าให้แก้ SEO</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_1fr]">
      <aside className="rounded border border-forest/15 bg-paper p-4">
        <label className="block text-xs font-semibold text-forest">ค้นหาหน้า</label>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-2 w-full rounded border border-forest/20 px-3 py-2 text-sm"
          placeholder="ชื่อหน้า หรือ path"
        />
        <ul className="mt-3 max-h-[28rem] space-y-1 overflow-auto text-sm">
          {filtered.map((page) => (
            <li key={page.path}>
              <button
                type="button"
                onClick={() => loadPage(page.path)}
                className={`w-full rounded px-2 py-1.5 text-left ${
                  page.path === selected.path
                    ? "bg-forest text-paper"
                    : "hover:bg-forest-mist"
                }`}
              >
                <span className="block font-medium">{page.label}</span>
                <span className="block text-xs opacity-80">{page.path}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="rounded border border-forest/15 bg-paper p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-brass">
              {kindLabel(selected.kind)} · {selected.source === "override" ? "แก้บนเว็บแล้ว" : "ค่าตั้งต้น"}
            </p>
            <h2 className="text-lg font-semibold text-forest">{selected.label}</h2>
            <p className="text-xs text-ink/60">{selected.path}</p>
          </div>
          {canWrite ? (
            <button
              type="button"
              onClick={draftWithAi}
              disabled={drafting}
              className="rounded border border-forest/20 px-3 py-1.5 text-sm text-forest hover:bg-forest-mist disabled:opacity-60"
            >
              {drafting ? "กำลังร่าง…" : "ให้ AI ร่าง"}
            </button>
          ) : null}
        </div>

        {draftNote ? <p className="mt-3 text-sm text-ink/70">{draftNote}</p> : null}
        {saveState?.error ? (
          <p className="mt-3 text-sm text-red-700">{saveState.error}</p>
        ) : null}
        {saveState?.ok ? (
          <p className="mt-3 text-sm text-forest">บันทึกลงหน้าเว็บแล้ว</p>
        ) : null}
        {resetState?.ok ? (
          <p className="mt-3 text-sm text-forest">คืนค่าตั้งต้นแล้ว</p>
        ) : null}

        <form action={saveAction} className="mt-5 space-y-4">
          <input type="hidden" name="path" value={selected.path} />
          <label className="block text-sm">
            <span className="font-medium text-forest">Title ({fields.seoTitle.length}/60)</span>
            <input
              name="seoTitle"
              value={fields.seoTitle}
              onChange={(event) =>
                setFields((prev) => ({ ...prev, seoTitle: event.target.value }))
              }
              maxLength={60}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              disabled={!canWrite}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-forest">
              Description ({fields.metaDescription.length}/160)
            </span>
            <textarea
              name="metaDescription"
              value={fields.metaDescription}
              onChange={(event) =>
                setFields((prev) => ({
                  ...prev,
                  metaDescription: event.target.value,
                }))
              }
              maxLength={160}
              rows={4}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              disabled={!canWrite}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-forest">รูปแชร์ (OG)</span>
            <input
              name="ogImage"
              value={fields.ogImage}
              onChange={(event) =>
                setFields((prev) => ({ ...prev, ogImage: event.target.value }))
              }
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              disabled={!canWrite}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-forest">คีย์เวิร์ด (คั่นด้วยจุลภาค)</span>
            <input
              name="keywords"
              value={fields.keywords}
              onChange={(event) =>
                setFields((prev) => ({ ...prev, keywords: event.target.value }))
              }
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              disabled={!canWrite}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="noIndex"
              value="1"
              checked={fields.noIndex}
              onChange={(event) =>
                setFields((prev) => ({ ...prev, noIndex: event.target.checked }))
              }
              disabled={!canWrite}
            />
            ไม่ให้เครื่องมือค้นหาเก็บหน้านี้
          </label>
          {canWrite ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={savePending}
                className="rounded bg-forest px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
              >
                {savePending ? "กำลังบันทึก…" : "บันทึกลงหน้าเว็บ"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-ink/70">บัญชีนี้ดูได้อย่างเดียว</p>
          )}
        </form>

        {canWrite && selected.source === "override" ? (
          <form action={resetAction} className="mt-4">
            <input type="hidden" name="path" value={selected.path} />
            <button
              type="submit"
              disabled={resetPending}
              className="text-sm text-ink/70 underline disabled:opacity-60"
            >
              คืนค่าตั้งต้นของหน้านี้
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
