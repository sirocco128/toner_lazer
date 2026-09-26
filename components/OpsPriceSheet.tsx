"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  computePriceSheetAction,
  createOpsQuoteFromPriceSheetAction,
  resolvePriceSheetProductAction,
  searchPriceSheetCatalogAction,
} from "@/app/actions/ops-price-sheet";
import {
  FormulaBandLegend,
  FormulaCheckNote,
} from "@/components/FormulaCheckNote";
import type { OpsCatalogItem } from "@/lib/ops-pricing";
import {
  canClientComputePriceSheet,
  computePriceSheetRows,
  DEFAULT_PRICE_SHEET_PARAMS,
  inlandDefaults,
  markupBandTable,
  PRICE_SHEET_TEMPLATE_HREF,
  priceSheetGrandTotal,
  sofBandTable,
  type PriceSheetComputedRow,
  type PriceSheetParams,
  type PriceSheetProductInput,
  type PriceSheetTab,
} from "@/lib/price-sheet";
import {
  clearPriceSheetDraft,
  loadPriceSheetDraft,
  savePriceSheetDraft,
  type PriceSheetDraft,
} from "@/lib/price-sheet-draft";
import {
  addItem,
  emitBasketChanged,
  loadBasketFromStorage,
  saveBasketToStorage,
} from "@/lib/quote-basket";
import { formatThb } from "@/lib/th-billing";

const TABS: { id: PriceSheetTab; label: string; hint: string }[] = [
  { id: "sheet1", label: "Sheet1 · สูตร", hint: "พารามิเตอร์ / แบนด์ SOF·Markup" },
  { id: "sheet2", label: "Sheet2 · ต้นทุน", hint: "แคตตาล็อก × qty × ลงเรือ" },
  { id: "sheet3", label: "Sheet3 · Final", hint: "พรีวิวราคาขาย" },
];

const MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function money(n: number): string {
  return formatThb(n);
}

function calcGpPerSetThb(sellThb: number, landedCostThb: number): number {
  return Math.round(sellThb - landedCostThb);
}

function calcGpPercent(sellThb: number, landedCostThb: number): number {
  if (!(sellThb > 0)) return 0;
  return Math.round(((sellThb - landedCostThb) / sellThb) * 1000) / 10;
}

function formatGpPercent(value: number): string {
  return `${value.toLocaleString("th-TH", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function sourceLabel(source: PriceSheetComputedRow["source"]): string {
  if (source === "landed") return "ลงเรือ";
  if (source === "unit_landed") return "SKU ลงเรือ";
  return "แคตตาล็อก";
}

function previewDateLine(): string {
  return new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildSummaryText(
  rows: PriceSheetComputedRow[],
  grandTotal: number,
  params: PriceSheetParams,
): string {
  const lines = [
    "Smart Gift · สรุปราคา Final",
    previewDateLine(),
    `โปรไฟล์ ${params.profile} · FX ${params.cnyToThb}`,
    "",
    ...rows.map(
      (row, i) =>
        `${i + 1}. ${row.name} × ${row.qty.toLocaleString("th-TH")} = ${formatThb(row.sellThb * row.qty)} (${formatThb(row.sellThb)}/ชุด)`,
    ),
    "",
    `ยอดรวม ${formatThb(grandTotal)}`,
    "ไม่ใช่ใบยืนยันสั่งซื้อ",
  ];
  return lines.join("\n");
}

function draftDiffersFromInitial(
  draft: PriceSheetDraft,
  initialProducts: PriceSheetProductInput[],
): boolean {
  return (
    JSON.stringify(draft.products) !== JSON.stringify(initialProducts) ||
    JSON.stringify(draft.params) !==
      JSON.stringify({ ...DEFAULT_PRICE_SHEET_PARAMS })
  );
}

export function OpsPriceSheet({
  canSeeCost,
  catalog,
  initialProducts,
}: {
  canSeeCost: boolean;
  catalog: OpsCatalogItem[];
  initialProducts: PriceSheetProductInput[];
}) {
  const [tab, setTab] = useState<PriceSheetTab>("sheet2");
  const [params, setParams] = useState<PriceSheetParams>({
    ...DEFAULT_PRICE_SHEET_PARAMS,
  });
  const [products, setProducts] =
    useState<PriceSheetProductInput[]>(initialProducts);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [catalogItems, setCatalogItems] = useState(catalog);
  const [serverRows, setServerRows] = useState<PriceSheetComputedRow[] | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [draftOffer, setDraftOffer] = useState<PriceSheetDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [basketAddedCount, setBasketAddedCount] = useState<number | null>(
    null,
  );
  const [quoteContact, setQuoteContact] = useState({
    company: "",
    name: "",
    phone: "",
  });
  const [opsQuoteHref, setOpsQuoteHref] = useState<string | null>(null);
  const [opsQuoteId, setOpsQuoteId] = useState<string | null>(null);
  const initialProductsRef = useRef(initialProducts);

  const useClientCompute = canClientComputePriceSheet(products, canSeeCost);

  const clientRows = useMemo(
    () => (useClientCompute ? computePriceSheetRows(products, params) : []),
    [useClientCompute, products, params],
  );

  const rows = useMemo(
    () => (useClientCompute ? clientRows : (serverRows ?? [])),
    [useClientCompute, clientRows, serverRows],
  );
  const grandTotal = useMemo(() => priceSheetGrandTotal(rows), [rows]);
  const inland = inlandDefaults();

  useEffect(() => {
    const draft = loadPriceSheetDraft();
    if (!draft || !draftDiffersFromInitial(draft, initialProductsRef.current)) {
      setDraftReady(true);
      return;
    }
    const ageMs = Date.now() - new Date(draft.savedAt).getTime();
    const autoRestore = ageMs >= 0 && ageMs < 1000 * 60 * 60 * 24;
    if (autoRestore) {
      setProducts(draft.products);
      setParams(draft.params);
    } else {
      setDraftOffer(draft);
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const handle = setTimeout(() => {
      savePriceSheetDraft(params, products);
    }, 400);
    return () => clearTimeout(handle);
  }, [draftReady, params, products]);

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await searchPriceSheetCatalogAction(query);
        if (result.ok) setCatalogItems(result.items);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (useClientCompute) {
      setServerRows(null);
      return;
    }
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await computePriceSheetAction({
          lines: products.map((p) => ({
            slug: p.slug,
            qty: p.qty,
            name: p.name,
            factoryCny: p.factoryCny,
          })),
          params: { ...params },
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError("");
        setServerRows(result.rows as PriceSheetComputedRow[]);
      });
    }, 280);
    return () => clearTimeout(handle);
  }, [useClientCompute, products, params]);

  function patchParams(patch: Partial<PriceSheetParams>) {
    setParams((prev) => ({ ...prev, ...patch }));
  }

  function patchProduct(
    id: string,
    patch: Partial<Pick<PriceSheetProductInput, "qty" | "factoryCny" | "name">>,
  ) {
    setProducts((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removeProduct(id: string) {
    setProducts((prev) => prev.filter((row) => row.id !== id));
  }

  function addFromCatalog(item: OpsCatalogItem) {
    if (products.some((row) => row.slug === item.slug)) {
      setError("สินค้านี้มีใน Sheet2 แล้ว");
      return;
    }
    startTransition(async () => {
      const result = await resolvePriceSheetProductAction(item.slug);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError("");
      setProducts((prev) => [...prev, result.product]);
      setTab("sheet2");
    });
  }

  function restoreDraft() {
    if (!draftOffer) return;
    setProducts(draftOffer.products);
    setParams(draftOffer.params);
    setDraftOffer(null);
  }

  function dismissDraftOffer() {
    setDraftOffer(null);
  }

  function handleClearDraft() {
    clearPriceSheetDraft();
    setProducts(initialProductsRef.current);
    setParams({ ...DEFAULT_PRICE_SHEET_PARAMS });
    setDraftOffer(null);
    setError("");
  }

  const handleCopySummary = useCallback(async () => {
    const text = buildSummaryText(rows, grandTotal, params);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2500);
    } catch {
      setCopyStatus("failed");
      setTimeout(() => setCopyStatus("idle"), 2500);
    }
  }, [rows, grandTotal, params]);

  function handleAddToQuoteBasket() {
    let basket = loadBasketFromStorage();
    let added = 0;
    for (const product of products) {
      if (!product.slug) continue;
      const row =
        rows.find((r) => r.id === product.id || r.name === product.name) ??
        rows[products.findIndex((p) => p.id === product.id)];
      const sell = row && !row.error ? row.sellThb : undefined;
      basket = addItem(basket, {
        productSlug: product.slug,
        productName: product.name,
        quantity: product.qty,
        minOrder: product.qty,
        estimatedUnitMin: sell,
        estimatedUnitMax: sell,
      });
      added += 1;
    }
    if (added === 0) {
      setError("ไม่มีแถวที่มี slug ในตะกร้า — เลือกจากแคตตาล็อกก่อน");
      return;
    }
    saveBasketToStorage(basket);
    emitBasketChanged();
    setBasketAddedCount(added);
    setError("");
  }

  function handleCreateOpsQuote() {
    if (rows.length === 0) {
      setError("ยังไม่มีแถว Final");
      return;
    }
    const slugsById: Record<string, string | undefined> = {};
    for (const product of products) {
      slugsById[product.id] = product.slug;
    }
    startTransition(async () => {
      const result = await createOpsQuoteFromPriceSheetAction({
        rows: rows.map((row) => ({
          id: row.id,
          name: row.name,
          qty: row.qty,
          sellThb: row.sellThb,
          error: row.error,
        })),
        params,
        slugsById,
        contact: quoteContact,
      });
      if (!result.ok) {
        setError(result.error);
        setOpsQuoteHref(null);
        setOpsQuoteId(null);
        return;
      }
      setError("");
      setOpsQuoteHref(result.href);
      setOpsQuoteId(result.requestId);
    });
  }

  const sluggedCount = products.filter((p) => p.slug).length;
  const quoteableCount = rows.filter(
    (row) => !row.error && row.sellThb > 0 && row.qty > 0,
  ).length;

  return (
    <div className="space-y-4">
      {draftOffer ? (
        <div
          className="print:hidden flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brass/40 bg-brass/10 px-4 py-3 text-sm"
          role="status"
        >
          <p className="text-ink/80">
            พบร่างที่บันทึกไว้ (
            {new Date(draftOffer.savedAt).toLocaleString("th-TH")}) —{" "}
            {draftOffer.products.length} รายการ
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              className="rounded bg-forest px-3 py-1.5 text-sm font-medium text-paper"
            >
              คืนค่าร่าง
            </button>
            <button
              type="button"
              onClick={dismissDraftOffer}
              className="rounded border border-forest/20 px-3 py-1.5 text-sm hover:border-brass/40"
            >
              ใช้ค่าเริ่มต้น
            </button>
          </div>
        </div>
      ) : null}

      <div className="print:hidden flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink/70">
            Sheet2 ดึงจากแคตตาล็อกจริง · สูตรขายอิง{" "}
            <code className="text-xs">computeUnitLanded</code>
            {!canSeeCost
              ? " · บัญชีเซลล์เห็นราคาขาย (ไม่เปิดต้นทุนโรงงาน)"
              : ""}
            {pending ? " · กำลังอัปเดต…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleClearDraft}
            className="rounded border border-forest/20 px-3 py-2 text-sm text-ink/70 hover:border-brass/50"
          >
            ล้างร่าง
          </button>
          <a
            href={PRICE_SHEET_TEMPLATE_HREF}
            download
            className="rounded border border-forest/20 px-3 py-2 text-sm hover:border-brass/50"
          >
            ดาวน์โหลด Excel 3 ชีต
          </a>
          <Link
            href="/ops/pricing"
            className="rounded border border-forest/20 px-3 py-2 text-sm hover:border-brass/50"
          >
            เครื่องคิดราคา
          </Link>
          <button
            type="button"
            onClick={() => {
              setTab("sheet3");
              setPreviewOpen(true);
            }}
            className="rounded bg-forest px-3 py-2 text-sm font-medium text-paper"
          >
            พรีวิว Final
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div
        role="tablist"
        aria-label="ชีตราคา"
        className="print:hidden flex flex-wrap gap-2 border-b border-forest/10 pb-2"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-3 py-2 text-left text-sm ${
                active
                  ? "bg-forest text-paper"
                  : "border border-forest/15 bg-paper text-ink hover:border-brass/40"
              }`}
            >
              <span className="block font-medium">{item.label}</span>
              <span
                className={`block text-xs ${active ? "text-paper/80" : "text-ink/55"}`}
              >
                {item.hint}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "sheet1" ? (
        <section className="rounded-xl border border-forest/15 bg-paper p-4">
          <h2 className="text-lg font-semibold text-forest">
            Sheet1 · สูตรและพารามิเตอร์
          </h2>
          <p className="mt-1 text-xs text-ink/60">
            เปลี่ยนค่าแล้ว Sheet2–3 คำนวณใหม่ทันที · แบนด์ SOF/Markup อ่านอย่างเดียว
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              FX CNY→THB
              <input
                type="number"
                step="0.01"
                min={1}
                value={params.cnyToThb}
                onChange={(e) =>
                  patchParams({ cnyToThb: Number(e.target.value) || 5 })
                }
                className="mt-1 w-full rounded border border-forest/20 bg-[#FFF8E7] px-3 py-2"
              />
            </label>
            <label className="text-sm">
              โปรไฟล์
              <select
                value={params.profile}
                onChange={(e) =>
                  patchParams({
                    profile:
                      e.target.value === "corporate" ? "corporate" : "standard",
                  })
                }
                className="mt-1 w-full rounded border border-forest/20 bg-[#FFF8E7] px-3 py-2"
              >
                <option value="standard">standard</option>
                <option value="corporate">corporate</option>
              </select>
            </label>
            <label className="text-sm">
              เดือนขนส่ง
              <select
                value={params.month}
                onChange={(e) => patchParams({ month: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-forest/20 bg-[#FFF8E7] px-3 py-2"
              >
                {MONTHS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              โหมดขนส่ง
              <select
                value={params.forceMode || "auto"}
                onChange={(e) => {
                  const v = e.target.value;
                  patchParams({
                    forceMode: v === "truck" || v === "sea" ? v : undefined,
                  });
                }}
                className="mt-1 w-full rounded border border-forest/20 bg-[#FFF8E7] px-3 py-2"
              >
                <option value="auto">auto</option>
                <option value="truck">truck</option>
                <option value="sea">sea</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.includeFreight}
                onChange={(e) =>
                  patchParams({ includeFreight: e.target.checked })
                }
              />
              รวมค่าขนส่งจีน→ไทย
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.includePackaging}
                onChange={(e) =>
                  patchParams({ includePackaging: e.target.checked })
                }
              />
              รวมแพ็กเกจ ({params.packagingMinThb}–{params.packagingMaxThb} บาท)
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-forest/10 bg-forest-mist/20 p-3">
            <p className="text-sm font-medium text-forest">สมการหลัก</p>
            <p className="mt-1 whitespace-pre-line text-xs text-ink/70">
              {`ลงเรือ = โรงงานบาท + ขนส่งในจีน + รถ/เรือจีน→ไทย
ขาย = ปัด(ลงเรือ × SOF × markup)
โรงงานบาท = โรงงานCNY × FX
inland default = ${inland.rateCnyPerCbm} CNY/CBM (min ${inland.minCny})`}
            </p>
            <FormulaBandLegend profile={params.profile} className="mt-3" />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-forest text-left text-paper">
                    <th className="px-3 py-2">SOF · จำนวน</th>
                    <th className="px-3 py-2">ตัวคูณ</th>
                  </tr>
                </thead>
                <tbody>
                  {sofBandTable().map((row) => (
                    <tr key={row.maxQtyLabel} className="border-b border-forest/10">
                      <td className="px-3 py-1.5">{row.maxQtyLabel}</td>
                      <td className="px-3 py-1.5 font-mono">{row.sof.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-forest text-left text-paper">
                    <th className="px-3 py-2">Markup · ลงเรือ</th>
                    <th className="px-3 py-2">ตัวคูณ</th>
                  </tr>
                </thead>
                <tbody>
                  {markupBandTable().map((row) => (
                    <tr key={row.maxCostLabel} className="border-b border-forest/10">
                      <td className="px-3 py-1.5">{row.maxCostLabel}</td>
                      <td className="px-3 py-1.5 font-mono">{row.markup.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "sheet2" ? (
        <section className="rounded-xl border border-forest/15 bg-paper p-4">
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="rounded-lg border border-forest/10 p-3">
              <h2 className="text-sm font-semibold text-forest">แคตตาล็อก</h2>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาชื่อ / slug"
                className="mt-2 w-full rounded border border-forest/20 px-3 py-2 text-sm"
              />
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto sm:max-h-64 lg:max-h-[28rem]">
                {catalogItems.map((item) => {
                  const added = products.some((row) => row.slug === item.slug);
                  return (
                    <li key={item.slug}>
                      <button
                        type="button"
                        disabled={added || pending}
                        onClick={() => addFromCatalog(item)}
                        className={`flex w-full gap-2 rounded-lg border p-2 text-left text-sm disabled:opacity-50 ${
                          added
                            ? "border-brass/40 bg-brass/10"
                            : "border-forest/10 hover:border-brass/40"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded object-cover bg-forest-mist/40"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-forest line-clamp-2">
                            {item.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-ink/55">
                            {item.priceRange}
                            {item.hasOffer ? " · มี offer" : ""}
                            {added ? " · อยู่ในชีต" : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-forest">
                    Sheet2 · สินค้าจากแคตตาล็อก
                  </h2>
                  <p className="mt-1 text-xs text-ink/60">
                    เลือกจากซ้าย · แก้ qty / โรงงาน CNY · ลำดับคิดราคา: offer ลงเรือ →
                    SKU ลงเรือ → ราคาแคตตาล็อก
                  </p>
                </div>
              </div>

              {!products.length ? (
                <div className="mt-6 rounded-lg border border-dashed border-forest/20 bg-forest-mist/10 p-8 text-center">
                  <p className="text-base font-medium text-forest">
                    ยังไม่มีสินค้าในชีต
                  </p>
                  <p className="mt-2 text-sm text-ink/60">
                    เลือกจากแคตตาล็อกด้านบน (มือถือ) หรือด้านซ้าย (จอใหญ่)
                    แล้วกดเพิ่มเข้า Sheet2
                  </p>
                  <p className="mt-3 text-xs text-ink/45">
                    ค้นหาชื่อหรือ slug · ระบบจะดึง offer / SKU ลงเรืออัตโนมัติ
                  </p>
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-[1180px] w-full text-sm">
                    <thead>
                      <tr className="bg-forest text-left text-paper">
                        <th className="px-2 py-2">สินค้า / ชุด</th>
                        <th className="px-2 py-2">qty</th>
                        {canSeeCost ? (
                          <th className="px-2 py-2">โรงงาน CNY</th>
                        ) : null}
                        {canSeeCost ? <th className="px-2 py-2">ลงเรือ</th> : null}
                        <th className="px-2 py-2">SOF</th>
                        {canSeeCost ? (
                          <th className="px-2 py-2">Markup</th>
                        ) : null}
                        <th className="px-2 py-2">ขาย/ชุด</th>
                        {canSeeCost ? <th className="px-2 py-2">GP/ชุด</th> : null}
                        {canSeeCost ? <th className="px-2 py-2">GP%</th> : null}
                        {canSeeCost ? (
                          <th className="px-2 py-2">GP การขายนี้</th>
                        ) : null}
                        <th className="px-2 py-2">แหล่ง</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => {
                        const row =
                          rows.find(
                            (r) => r.id === product.id || r.name === product.name,
                          ) ??
                          rows[
                            products.findIndex((p) => p.id === product.id)
                          ];
                        return (
                          <tr
                            key={product.id}
                            className="border-b border-forest/10 align-top"
                          >
                            <td className="px-2 py-2">
                              <div className="flex gap-2">
                                {product.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={product.image}
                                    alt=""
                                    className="h-10 w-10 rounded object-cover"
                                  />
                                ) : null}
                                <div>
                                  <div className="font-medium text-forest">
                                    {product.name}
                                  </div>
                                  <div className="font-mono text-[10px] text-ink/50">
                                    {product.id}
                                    {product.slug ? ` · ${product.slug}` : ""}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={1}
                                value={product.qty}
                                onChange={(e) =>
                                  patchProduct(product.id, {
                                    qty: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                className="w-20 rounded border border-forest/20 bg-[#FFF8E7] px-2 py-1"
                              />
                            </td>
                            {canSeeCost ? (
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={product.factoryCny ?? ""}
                                  onChange={(e) =>
                                    patchProduct(product.id, {
                                      factoryCny:
                                        e.target.value === ""
                                          ? undefined
                                          : Number(e.target.value),
                                    })
                                  }
                                  className="w-24 rounded border border-forest/20 bg-[#FFF8E7] px-2 py-1"
                                  disabled={!product.offer && !product.unitLandedCostThb}
                                />
                              </td>
                            ) : null}
                            {canSeeCost ? (
                              <td className="px-2 py-2 font-mono text-xs">
                                {row && !row.error && row.landedCostThb > 0
                                  ? money(row.landedCostThb)
                                  : "—"}
                                {row?.mode ? (
                                  <span className="mt-0.5 block text-[10px] text-ink/50">
                                    {row.mode}/{row.tier}
                                  </span>
                                ) : null}
                              </td>
                            ) : null}
                            <td className="px-2 py-2 font-mono">
                              {row ? row.sof.toFixed(2) : "—"}
                            </td>
                            {canSeeCost ? (
                              <td className="px-2 py-2 font-mono">
                                {row && row.markup > 0 ? row.markup.toFixed(2) : "—"}
                              </td>
                            ) : null}
                            <td className="px-2 py-2 font-semibold text-forest tabular-nums">
                              {row?.error ? (
                                <span className="text-xs font-normal text-amber-800">
                                  {row.error}
                                </span>
                              ) : row ? (
                                money(row.sellThb)
                              ) : (
                                "…"
                              )}
                            </td>
                            {canSeeCost ? (
                              <td className="px-2 py-2 font-medium text-forest tabular-nums">
                                {row && !row.error && row.landedCostThb > 0
                                  ? money(
                                      calcGpPerSetThb(
                                        row.sellThb,
                                        row.landedCostThb,
                                      ),
                                    )
                                  : "—"}
                              </td>
                            ) : null}
                            {canSeeCost ? (
                              <td className="px-2 py-2 tabular-nums">
                                {row && !row.error && row.landedCostThb > 0
                                  ? formatGpPercent(
                                      calcGpPercent(
                                        row.sellThb,
                                        row.landedCostThb,
                                      ),
                                    )
                                  : "—"}
                              </td>
                            ) : null}
                            {canSeeCost ? (
                              <td className="px-2 py-2 font-semibold text-forest tabular-nums">
                                {row && !row.error
                                  ? money(row.packageProfitThb)
                                  : "—"}
                              </td>
                            ) : null}
                            <td className="px-2 py-2 text-xs text-ink/60">
                              {row ? sourceLabel(row.source) : "…"}
                              {row?.meetsFloor === false ? (
                                <span className="mt-1 block text-red-700">BELOW</span>
                              ) : null}
                            </td>
                            <td className="px-2 py-2">
                              <button
                                type="button"
                                onClick={() => removeProduct(product.id)}
                                className="text-xs text-red-700 underline-offset-2 hover:underline"
                              >
                                ลบ
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {canSeeCost && rows[0]?.formulaNote ? (
                <div className="mt-4 rounded border border-forest/10 p-3">
                  <p className="text-xs font-medium text-forest">
                    รีเช็คสูตรแถวแรก
                  </p>
                  <FormulaCheckNote note={rows[0].formulaNote} className="mt-2" />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "sheet3" ? (
        <section className="rounded-xl border border-forest/15 bg-paper p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-forest">
                Sheet3 · ราคา Final
              </h2>
              <p className="mt-1 text-xs text-ink/60">
                พรีวิวฝั่งลูกค้า — อ่านอย่างเดียว · แก้ที่ Sheet1/Sheet2
              </p>
            </div>
            <div className="print:hidden flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded border border-forest/20 px-3 py-2 text-sm hover:border-brass/40"
              >
                พิมพ์
              </button>
              <button
                type="button"
                onClick={() => void handleCopySummary()}
                className="rounded border border-forest/20 px-3 py-2 text-sm hover:border-brass/40"
              >
                {copyStatus === "copied"
                  ? "คัดลอกแล้ว"
                  : copyStatus === "failed"
                    ? "คัดลอกไม่ได้"
                    : "คัดลอกสรุป"}
              </button>
              <button
                type="button"
                onClick={handleAddToQuoteBasket}
                disabled={sluggedCount === 0 || pending}
                className="rounded border border-brass/50 bg-brass/10 px-3 py-2 text-sm font-medium text-forest hover:border-brass disabled:opacity-50"
              >
                ใส่ตะกร้าใบเสนอราคา
                {sluggedCount > 0 ? ` (${sluggedCount})` : ""}
              </button>
              <button
                type="button"
                onClick={handleCreateOpsQuote}
                disabled={quoteableCount === 0 || pending}
                className="rounded bg-forest px-3 py-2 text-sm font-medium text-paper hover:bg-forest/90 disabled:opacity-50"
              >
                สร้างใบเสนอราคา Ops
                {quoteableCount > 0 ? ` (${quoteableCount})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen((v) => !v)}
                className="rounded border border-forest/20 px-3 py-2 text-sm"
              >
                {previewOpen ? "ซ่อนพรีวิวใบราคา" : "แสดงพรีวิวใบราคา"}
              </button>
            </div>
          </div>

          <div className="print:hidden mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-ink/70">
              บริษัทลูกค้า
              <input
                value={quoteContact.company}
                onChange={(e) =>
                  setQuoteContact((c) => ({ ...c, company: e.target.value }))
                }
                className="mt-1 w-full rounded border border-forest/20 bg-white px-2 py-1.5 text-sm"
                placeholder="ชื่อบริษัท"
              />
            </label>
            <label className="text-xs text-ink/70">
              ผู้ติดต่อ
              <input
                value={quoteContact.name}
                onChange={(e) =>
                  setQuoteContact((c) => ({ ...c, name: e.target.value }))
                }
                className="mt-1 w-full rounded border border-forest/20 bg-white px-2 py-1.5 text-sm"
                placeholder="ชื่อผู้ติดต่อ"
              />
            </label>
            <label className="text-xs text-ink/70">
              โทร
              <input
                value={quoteContact.phone}
                onChange={(e) =>
                  setQuoteContact((c) => ({ ...c, phone: e.target.value }))
                }
                className="mt-1 w-full rounded border border-forest/20 bg-white px-2 py-1.5 text-sm"
                placeholder="เบอร์ติดต่อ"
              />
            </label>
          </div>

          {opsQuoteHref && opsQuoteId ? (
            <p className="print:hidden mt-3 text-sm text-forest">
              สร้างใบเสนอราคา Ops แล้ว · {opsQuoteId} ·{" "}
              <Link
                href={opsQuoteHref}
                className="font-medium text-brass underline-offset-2 hover:underline"
              >
                เปิดใน /ops/quotes
              </Link>
            </p>
          ) : null}

          {basketAddedCount != null && basketAddedCount > 0 ? (
            <p className="print:hidden mt-3 text-sm text-forest">
              เพิ่ม {basketAddedCount} รายการในตะกร้าแล้ว ·{" "}
              <Link
                href="/quote-basket"
                className="font-medium text-brass underline-offset-2 hover:underline"
              >
                ไปตะกร้าใบเสนอราคา
              </Link>
            </p>
          ) : null}

          <div className="print:hidden mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-forest text-left text-paper">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">รหัส</th>
                  <th className="px-3 py-2">ชุดที่จำหน่าย</th>
                  <th className="px-3 py-2">จำนวน</th>
                  <th className="px-3 py-2">ราคา/ชุด</th>
                  <th className="px-3 py-2">รวมขาย</th>
                  {canSeeCost ? <th className="px-3 py-2">ทุน/ชุด</th> : null}
                  {canSeeCost ? <th className="px-3 py-2">GP/ชุด</th> : null}
                  {canSeeCost ? <th className="px-3 py-2">GP%</th> : null}
                  {canSeeCost ? (
                    <th className="px-3 py-2">GP การขายนี้</th>
                  ) : null}
                  <th className="px-3 py-2">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const unitGp =
                    row.landedCostThb > 0
                      ? calcGpPerSetThb(row.sellThb, row.landedCostThb)
                      : null;
                  const unitPct =
                    row.landedCostThb > 0
                      ? calcGpPercent(row.sellThb, row.landedCostThb)
                      : null;
                  return (
                    <tr key={row.id} className="border-b border-forest/10">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.qty.toLocaleString("th-TH")}
                      </td>
                      <td className="px-3 py-2 font-semibold text-forest tabular-nums">
                        {money(row.sellThb)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {money(row.sellThb * row.qty)}
                      </td>
                      {canSeeCost ? (
                        <td className="px-3 py-2 tabular-nums">
                          {row.landedCostThb > 0
                            ? money(row.landedCostThb)
                            : "—"}
                        </td>
                      ) : null}
                      {canSeeCost ? (
                        <td className="px-3 py-2 font-medium text-forest tabular-nums">
                          {unitGp != null ? money(unitGp) : "—"}
                        </td>
                      ) : null}
                      {canSeeCost ? (
                        <td className="px-3 py-2 tabular-nums">
                          {unitPct != null ? formatGpPercent(unitPct) : "—"}
                        </td>
                      ) : null}
                      {canSeeCost ? (
                        <td className="px-3 py-2 font-semibold text-forest tabular-nums">
                          {money(row.packageProfitThb)}
                        </td>
                      ) : null}
                      <td className="px-3 py-2">
                        {row.meetsFloor ? "ผ่านพื้น" : "ต่ำกว่าพื้น"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-forest-mist/40 font-semibold text-forest">
                  <td className="px-3 py-3" colSpan={5}>
                    รวม Final ทั้งใบ · ทุกชุด
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {money(grandTotal)}
                  </td>
                  {canSeeCost ? (
                    <>
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3 tabular-nums">
                        {formatGpPercent(
                          grandTotal > 0
                            ? Math.round(
                                (rows.reduce(
                                  (sum, row) => sum + row.packageProfitThb,
                                  0,
                                ) /
                                  grandTotal) *
                                  1000,
                              ) / 10
                            : 0,
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {money(
                          rows.reduce(
                            (sum, row) => sum + row.packageProfitThb,
                            0,
                          ),
                        )}
                      </td>
                    </>
                  ) : null}
                  <td className="px-3 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>

          {previewOpen ? (
            <div className="mt-6 rounded-xl border border-dashed border-brass/50 bg-[#FFFDF8] p-5 shadow-sm print:mt-0 print:border-solid print:shadow-none">
              <p className="text-xs uppercase tracking-wide text-ink/50">
                Preview · ใบเสนอราคาแบบย่อ
              </p>
              <h3 className="mt-1 text-xl font-semibold text-forest">
                Smart Gift · สรุปราคา Final
              </h3>
              <p className="mt-1 text-sm text-ink/65">{previewDateLine()}</p>
              <p className="mt-1 text-sm text-ink/65">
                โปรไฟล์ {params.profile} · FX {params.cnyToThb} ·{" "}
                {params.includeFreight ? "รวมขนส่ง" : "ไม่รวมขนส่ง"}
                {params.includePackaging ? " · รวมแพ็กเกจ" : ""}
              </p>
              <ul className="mt-4 space-y-2">
                {rows.map((row) => (
                  <li
                    key={`preview-${row.id}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-forest/10 pb-2 text-sm"
                  >
                    <span>
                      <span className="font-medium text-forest">{row.name}</span>
                      <span className="ml-2 text-ink/55">
                        × {row.qty.toLocaleString("th-TH")} ชุด
                      </span>
                    </span>
                    <span className="font-semibold">
                      {money(row.sellThb)}
                      <span className="ml-2 font-normal text-ink/55">
                        รวม {money(row.sellThb * row.qty)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-right text-lg font-bold text-forest">
                ยอดรวม {money(grandTotal)}
              </p>
              <p className="mt-3 text-xs font-medium text-ink/55">
                ไม่ใช่ใบยืนยันสั่งซื้อ
              </p>
              <p className="mt-1 text-xs text-ink/50">
                ราคาประมาณการจากสูตรลงเรือ — อาจเปลี่ยนตาม qty และโปรไฟล์ขนส่ง
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
