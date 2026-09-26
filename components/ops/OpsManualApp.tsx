"use client";

// Ops work manual SPA: TOC + MD fetch, filtered by signed-in Ops role.
// Aesthetic: handbook sidebar on forest/brass brand tokens.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { OpsManualGroup } from "@/lib/ops-manual-catalog";
import { OpsMermaidHost } from "@/components/ops/OpsMermaidHost";

type ActorInfo = {
  email: string;
  name: string;
  role: string;
  roleLabel: string;
};

type TocEntry = {
  id: string;
  title: string;
  summary: string;
  group: OpsManualGroup;
};

type GroupInfo = { id: OpsManualGroup; label: string };

type DocSection = {
  id: string;
  title: string;
  html: string;
};

type DocPayload = {
  id: string;
  title: string;
  summary: string;
  group: OpsManualGroup;
  file: string;
  html: string;
  sections: DocSection[];
};

export function OpsManualApp({
  actor,
  groups,
  initialToc,
}: {
  actor: ActorInfo;
  groups: GroupInfo[];
  initialToc: TocEntry[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [doc, setDoc] = useState<DocPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proseRef = useRef<HTMLDivElement | null>(null);
  const [proseEl, setProseEl] = useState<HTMLDivElement | null>(null);

  const bindProse = useCallback((node: HTMLDivElement | null) => {
    proseRef.current = node;
    setProseEl(node);
  }, []);

  const docId = searchParams.get("doc") || initialToc[0]?.id || "index";
  const sectionId = searchParams.get("sec") || "";

  const filteredToc = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("th");
    if (!q) return initialToc;
    return initialToc.filter(
      (entry) =>
        entry.title.toLocaleLowerCase("th").includes(q) ||
        entry.summary.toLocaleLowerCase("th").includes(q) ||
        entry.id.toLocaleLowerCase("th").includes(q),
    );
  }, [initialToc, query]);

  const groupedToc = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        entries: filteredToc.filter((e) => e.group === group.id),
      }))
      .filter((g) => g.entries.length > 0);
  }, [groups, filteredToc]);

  const selectDoc = useCallback(
    (nextDocId: string, nextSec?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("doc", nextDocId);
      if (nextSec) params.set("sec", nextSec);
      else params.delete("sec");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      setNavOpen(false);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/ops/manual?doc=${encodeURIComponent(docId)}`, {
      credentials: "same-origin",
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          doc?: DocPayload;
        } | null;
        if (!res.ok || !body?.ok || !body.doc) {
          throw new Error(body?.error || `โหลดเอกสารไม่สำเร็จ (${res.status})`);
        }
        return body.doc;
      })
      .then((payload) => {
        if (cancelled) return;
        setDoc(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDoc(null);
        setError(err instanceof Error ? err.message : "โหลดเอกสารไม่สำเร็จ");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [docId]);

  useEffect(() => {
    if (!doc || !sectionId) return;
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [doc, sectionId]);

  useEffect(() => {
    if (!docId && initialToc[0]) {
      selectDoc(initialToc[0].id);
    }
  }, [docId, initialToc, selectDoc]);

  return (
    <div className="ops-manual -mx-page -my-6 sm:-my-8">
      <div className="border-b border-brass/40 bg-forest px-page py-5 text-paper">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-soft">
              คู่มือการทำงาน · จาก docs/
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Work Manual
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-paper/75">
              เนื้อหาจากไฟล์ Markdown ในโปรเจกต์ — แสดงเฉพาะเอกสารที่สิทธิ์{" "}
              <span className="text-brass-soft">{actor.roleLabel}</span> เปิดได้
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-paper/25 px-3 py-1.5 text-sm lg:hidden"
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
            aria-controls="ops-manual-sidebar"
          >
            สารบัญ
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside
          id="ops-manual-sidebar"
          className={`border-forest/10 bg-paper/95 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:border-r ${
            navOpen
              ? "border-b shadow-md lg:shadow-none"
              : "hidden lg:block"
          }`}
        >
          <div className="p-4">
            <label className="block text-xs font-medium text-forest">
              ค้นหาเอกสาร
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="เช่น SOP, บอร์ด, ใบเสนอราคา"
                className="mt-1.5 w-full rounded-lg border border-forest/15 bg-forest-mist/40 px-3 py-2 text-sm"
              />
            </label>

            <nav className="mt-5 space-y-5" aria-label="สารบัญคู่มือ">
              {groupedToc.map((group) => (
                <div key={group.id}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brass">
                    {group.label}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {group.entries.map((entry) => {
                      const active = entry.id === docId;
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => selectDoc(entry.id)}
                            className={`w-full rounded-lg px-2.5 py-2 text-left text-sm transition ${
                              active
                                ? "bg-forest text-paper"
                                : "text-ink/80 hover:bg-forest-mist"
                            }`}
                          >
                            <span className="block font-medium">{entry.title}</span>
                            <span
                              className={`mt-0.5 block text-xs leading-snug ${
                                active ? "text-paper/70" : "text-ink/50"
                              }`}
                            >
                              {entry.summary}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {!groupedToc.length ? (
                <p className="text-sm text-ink/60">ไม่พบเอกสารที่ตรงคำค้น</p>
              ) : null}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 px-page py-6 sm:py-8">
          {loading ? (
            <p className="text-sm text-ink/60">กำลังโหลดเนื้อหา…</p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}

          {doc && !loading ? (
            <article className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass">
                docs/{doc.file}
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-forest sm:text-3xl">
                {doc.title}
              </h2>
              <p className="mt-2 text-sm text-ink/65">{doc.summary}</p>

              {doc.sections.length > 1 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {doc.sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => selectDoc(doc.id, section.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        sectionId === section.id
                          ? "border-forest bg-forest text-paper"
                          : "border-forest/20 bg-paper text-forest hover:bg-forest-mist"
                      }`}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              ) : null}

              <div
                ref={bindProse}
                className="ops-manual-prose mt-8 max-w-none text-[15px] leading-relaxed text-ink/90 [&_a]:text-forest [&_blockquote]:border-l-4 [&_blockquote]:border-brass/50 [&_blockquote]:pl-4 [&_blockquote]:text-ink/70 [&_code]:rounded [&_code]:bg-forest-mist/80 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:text-forest [&_h1]:mb-4 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-forest [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-forest [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:scroll-mt-24 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-forest [&_hr]:my-8 [&_hr]:border-forest/15 [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border [&_td]:border-forest/15 [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:border [&_th]:border-forest/20 [&_th]:bg-forest-mist/60 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-forest [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: doc.html }}
              />
              <OpsMermaidHost root={proseEl} revision={`${doc.id}:${doc.html.length}`} />
            </article>
          ) : null}
        </main>
      </div>
    </div>
  );
}
