"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  deleteCatalogImageAction,
  saveCatalogImagesAction,
} from "@/app/actions/ops-catalog-images";
import type { OpsActionResult } from "@/app/actions/ops";
import type { CatalogSourceImage } from "@/lib/catalog-source-images";
import type { SourceImageCandidate } from "@/lib/alibaba/listing-urls";

type ProductOption = { slug: string; name: string };

const initial: OpsActionResult | null = null;

function proxySrc(imageUrl: string): string {
  return `/api/ops/catalog-images/proxy?url=${encodeURIComponent(imageUrl)}`;
}

function candidateKey(item: SourceImageCandidate): string {
  return `${item.pageUrl}|${item.imageUrl}`;
}

export function OpsCatalogImageSearch({
  products,
  saved,
}: {
  products: ProductOption[];
  saved: CatalogSourceImage[];
}) {
  const [query, setQuery] = useState("กระบอกน้ำสแตนเลส สกรีนโลโก้");
  const [productSlug, setProductSlug] = useState("");
  const [searching, startSearch] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<SourceImageCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveState, saveAction, savePending] = useActionState(
    saveCatalogImagesAction,
    initial,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteCatalogImageAction,
    initial,
  );

  const selectedItems = useMemo(
    () => candidates.filter((item) => selected.has(candidateKey(item))),
    [candidates, selected],
  );

  function toggle(item: SourceImageCandidate) {
    const key = candidateKey(item);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function search() {
    const q = query.trim();
    if (q.length < 2 || searching) return;
    startSearch(() => {
      void (async () => {
        setError(null);
        setCandidates([]);
        setSelected(new Set());
        setModel(null);
        const res = await fetch("/api/ops/catalog-images/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          model?: string;
          candidates?: SourceImageCandidate[];
        };
        if (!res.ok || !json.ok || !json.candidates) {
          setError(json.error || "ค้นหาไม่สำเร็จ");
          return;
        }
        setModel(json.model || null);
        setCandidates(json.candidates);
        setSelected(new Set(json.candidates.map(candidateKey)));
      })();
    });
  }

  return (
    <div className="space-y-8">
      <section className="rounded border border-forest/15 bg-paper p-5">
        <h2 className="font-semibold text-forest">ค้นด้วย Gemini บนเว็บจริง</h2>
        <p className="mt-1 text-sm text-ink/70">
          ระบบให้ Gemini ค้นหน้ารายการบน 1688 และ Alibaba.com แล้วเก็บเฉพาะลิงก์ที่ตรวจแล้ว
          ว่ารูปมาจากเซิร์ฟเวอร์รูปของเว็บนั้น ไม่สร้างรูปปลอม
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                search();
              }
            }}
            className="w-full rounded border border-forest/20 px-3 py-2 text-sm"
            placeholder="เช่น กระบอกน้ำสแตนเลส 礼品杯"
          />
          <button
            type="button"
            onClick={search}
            disabled={searching}
            className="rounded bg-forest px-4 py-2 text-sm text-paper disabled:opacity-60"
          >
            {searching ? "กำลังค้นเว็บ…" : "ค้นรูปจากเว็บโรงงาน"}
          </button>
        </div>
        {searching ? (
          <p className="mt-3 text-sm text-ink/70" role="status">
            กำลังให้ผู้ช่วยค้นหน้ารายการจริง — อาจใช้เวลาไม่เกินหนึ่งนาที ไม่ใช่หน้าเว็บค้าง
          </p>
        ) : null}
        <label className="mt-3 block text-sm" htmlFor="catalog-product-slug">
          <span className="font-medium">ผูกกับสินค้าในแคตตาล็อก (ไม่บังคับ)</span>
          <select
            id="catalog-product-slug"
            value={productSlug}
            onChange={(event) => setProductSlug(event.target.value)}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2 text-sm"
          >
            <option value="">— ไม่ผูกสินค้า —</option>
            {products.map((product) => (
              <option key={product.slug} value={product.slug}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
        {model ? (
          <p className="mt-2 text-xs text-ink/60">โมเดล: {model}</p>
        ) : null}
      </section>

      {candidates.length > 0 ? (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-forest">
              พบ {candidates.length} รูปจากเว็บจริง
            </h2>
            <form action={saveAction}>
              <input type="hidden" name="query" value={query} />
              <input type="hidden" name="productSlug" value={productSlug} />
              <input type="hidden" name="geminiModel" value={model || ""} />
              <input
                type="hidden"
                name="selected"
                value={JSON.stringify(selectedItems)}
              />
              <button
                type="submit"
                disabled={savePending || selectedItems.length === 0}
                className="rounded bg-brass px-4 py-2 text-sm text-ink disabled:opacity-60"
              >
                {savePending
                  ? "กำลังบันทึก…"
                  : `บันทึกที่เลือก (${selectedItems.length}) ลงฐานข้อมูล`}
              </button>
            </form>
          </div>
          {saveState && !saveState.ok ? (
            <p className="mb-3 text-sm text-red-800">{saveState.error}</p>
          ) : null}
          {saveState?.ok ? (
            <p className="mb-3 text-sm text-forest">บันทึกลงฐานข้อมูลแล้ว</p>
          ) : null}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((item) => {
              const key = candidateKey(item);
              const checked = selected.has(key);
              return (
                <li
                  key={key}
                  className={`overflow-hidden rounded-lg border ${
                    checked ? "border-forest" : "border-forest/15"
                  } bg-paper`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxySrc(item.imageUrl)}
                    alt={item.title}
                    className="h-40 w-full bg-forest-mist object-cover"
                  />
                  <div className="space-y-1 p-3 text-sm">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item)}
                        className="mt-1"
                      />
                      <span className="font-medium text-forest">{item.title}</span>
                    </label>
                    <p className="text-xs uppercase tracking-wide text-ink/60">
                      {item.platform}
                    </p>
                    <a
                      href={item.pageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-xs text-forest underline-offset-2 hover:underline"
                    >
                      {item.pageUrl}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-semibold text-forest">รูปที่บันทึกในฐานข้อมูล</h2>
        <p className="mt-1 text-sm text-ink/70">
          เก็บไว้ในเครื่องสำหรับงานภายใน ไม่ขึ้นหน้าร้านจนกว่าจะมีสิทธิ์ใช้ภาพ
        </p>
        {deleteState && !deleteState.ok ? (
          <p className="mt-2 text-sm text-red-800">{deleteState.error}</p>
        ) : null}
        {saved.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">ยังไม่มีรูปที่บันทึก</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((item) => (
              <li
                key={item.imageId}
                className="overflow-hidden rounded-lg border border-forest/15 bg-paper"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/ops/catalog-images/${item.imageId}/file`}
                  alt={item.title}
                  className="h-40 w-full object-cover bg-forest-mist"
                />
                <div className="space-y-1 p-3 text-sm">
                  <p className="font-medium text-forest">{item.title}</p>
                  <p className="text-xs text-ink/60">
                    {item.sourcePlatform}
                    {item.productSlug ? ` · ${item.productSlug}` : ""}
                  </p>
                  <p className="text-xs text-ink/50">ค้นว่า “{item.query}”</p>
                  <form action={deleteAction}>
                    <input type="hidden" name="imageId" value={item.imageId} />
                    <button
                      type="submit"
                      disabled={deletePending}
                      className="mt-2 text-xs text-red-800 underline-offset-2 hover:underline"
                    >
                      ลบออกจากฐานข้อมูล
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
