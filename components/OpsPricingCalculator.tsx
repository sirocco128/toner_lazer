"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  computeOpsPricingAction,
  searchOpsCatalogAction,
} from "@/app/actions/ops-pricing";
import { PriceDisclaimer } from "@/components/PriceDisclaimer";
import {
  FormulaBandLegend,
} from "@/components/FormulaCheckNote";
import { FormulaRecheckPanel } from "@/components/FormulaRecheckPanel";
import { PricingFormulaGuide } from "@/components/PricingFormulaGuide";
import type { OpsCatalogItem, OpsQuoteRow } from "@/lib/ops-pricing";
import { DEFAULT_PACKAGING_MAX_THB, DEFAULT_PACKAGING_MIN_THB } from "@/lib/product-price-options";
import { formatThb } from "@/lib/th-billing";
import { PRICE_DISCLAIMER_FULL } from "@/lib/ux-copy";

type Brand = {
  name: string;
  legalName: string;
  phone: string;
  email: string;
  lineId: string;
};

type BasketItem = {
  slug: string;
  name: string;
  image: string;
  qty: number;
  sellMin: number;
  sellMax: number;
  includeFreight: boolean;
  includePackaging: boolean;
  /** ต้นทุนลงเรือ/ชุด — เฉพาะผู้เห็นต้นทุน */
  landedCostThb?: number;
  /** กำไรขั้นต้นต่อชุด (ขาย − ลงเรือ) */
  gpPerSetThb?: number;
  /** กำไรขั้นต้นทั้งออเดอร์ของชุดนี้ */
  gpOrderThb?: number;
  /** GP% = กำไรต่อชุด / ราคาขายต่อชุด */
  gpPercent?: number;
};

function calcGpPerSetThb(sellThb: number, landedCostThb: number): number {
  return Math.round(sellThb - landedCostThb);
}

function calcGpPercent(sellThb: number, landedCostThb: number): number {
  if (!(sellThb > 0)) return 0;
  return Math.round(((sellThb - landedCostThb) / sellThb) * 1000) / 10;
}

const MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function money(n: number): string {
  return formatThb(n);
}

export function OpsPricingCalculator({
  catalog,
  brand,
  canSeeCost,
  fxGuide,
  initialSlug,
}: {
  catalog: OpsCatalogItem[];
  brand: Brand;
  canSeeCost: boolean;
  fxGuide: { cnyThb: number; source: string; live: boolean };
  initialSlug?: string;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(catalog);
  const [slug, setSlug] = useState(initialSlug || "");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [mode, setMode] = useState<"auto" | "truck" | "sea">("auto");
  const [includeFreight, setIncludeFreight] = useState(true);
  const [includePackaging, setIncludePackaging] = useState(false);
  const [profile, setProfile] = useState<"standard" | "corporate">("standard");
  const [extraQty, setExtraQty] = useState("");
  const [origin, setOrigin] = useState("guangzhou_shenzhen");
  const [category, setCategory] = useState("general");
  const [cnyToThb, setCnyToThb] = useState(String(fxGuide.cnyThb));
  const [factoryCny, setFactoryCny] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [rows, setRows] = useState<OpsQuoteRow[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [product, setProduct] = useState<OpsCatalogItem | null>(
    catalog.find((item) => item.slug === initialSlug) || null,
  );
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [pending, startTransition] = useTransition();
  const [codeDraft, setCodeDraft] = useState(initialSlug || "");
  const [expandedQty, setExpandedQty] = useState<number | null>(null);

  const selected = product || items.find((item) => item.slug === slug) || null;

  function pickProduct(item: OpsCatalogItem) {
    setSlug(item.slug);
    setProduct(item);
    setCodeDraft(item.slug);
    setQuery(item.slug);
    setError("");
  }

  function applyProductCode(raw: string) {
    const code = raw.trim().toLowerCase();
    if (!code) return;
    const hit =
      items.find((item) => item.slug.toLowerCase() === code) ||
      catalog.find((item) => item.slug.toLowerCase() === code) ||
      items.find(
        (item) =>
          item.slug.toLowerCase().includes(code) ||
          item.name.toLowerCase().includes(code),
      ) ||
      catalog.find(
        (item) =>
          item.slug.toLowerCase().includes(code) ||
          item.name.toLowerCase().includes(code),
      );
    if (hit) {
      pickProduct(hit);
      return;
    }
    setSlug(code);
    setCodeDraft(raw.trim());
    setQuery(raw.trim());
    setError(
      `ยังไม่เจอ «${raw.trim()}» — ลองพิมพ์ชื่อชุด หรือเลือกจากรายการด้านล่างช่องค้น`,
    );
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await searchOpsCatalogAction(query);
        if (result.ok) setItems(result.items);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!slug) {
      setRows([]);
      setNote("เลือกสินค้าจากแคตตาล็อกเว็บ");
      return;
    }
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await computeOpsPricingAction({
          slug,
          extraQty: extraQty === "" ? undefined : Number(extraQty),
          includeFreight,
          includePackaging,
          month,
          profile,
          forceMode: mode === "auto" ? undefined : mode,
          origin,
          category,
          cnyToThb: Number(cnyToThb),
          factoryCny: factoryCny === "" ? undefined : Number(factoryCny),
          weightKg: weightKg === "" ? undefined : Number(weightKg),
          lengthCm: lengthCm === "" ? undefined : Number(lengthCm),
          widthCm: widthCm === "" ? undefined : Number(widthCm),
          heightCm: heightCm === "" ? undefined : Number(heightCm),
        });
        if (!result.ok) {
          setError(result.error);
          setRows([]);
          return;
        }
        setError("");
        setRows(result.rows);
        setNote(result.note);
        if (result.product) setProduct(result.product);
        const want =
          extraQty !== "" && Number.isFinite(Number(extraQty))
            ? Math.floor(Number(extraQty))
            : null;
        const hit =
          want != null
            ? result.rows.find((row) => row.qty === want)
            : undefined;
        setExpandedQty(hit?.qty ?? result.rows[0]?.qty ?? null);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [
    slug,
    extraQty,
    includeFreight,
    includePackaging,
    month,
    profile,
    mode,
    origin,
    category,
    cnyToThb,
    factoryCny,
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
  ]);

  const summary = useMemo(() => {
    if (!rows.length) return null;
    const maxRow = rows.reduce((a, b) => (b.sellThb > a.sellThb ? b : a));
    const minRow = rows.reduce((a, b) => (b.sellThb < a.sellThb ? b : a));
    const focus =
      (expandedQty != null
        ? rows.find((row) => row.qty === expandedQty)
        : undefined) || maxRow;
    return { maxRow, minRow, focus };
  }, [rows, expandedQty]);

  const sheetRows = useMemo(() => {
    if (basket.length) return basket;
    if (!selected || !rows.length) return [];
    const pick = rows[rows.length - 1]!;
    const landed = pick.cost?.landedCostThb;
    const unitGp =
      canSeeCost && landed != null ? calcGpPerSetThb(pick.sellThb, landed) : undefined;
    return [
      {
        slug: selected.slug,
        name: selected.name,
        image: selected.image,
        qty: pick.qty,
        sellMin: pick.sellMin,
        sellMax: pick.sellMax,
        includeFreight,
        includePackaging,
        landedCostThb: landed,
        gpPerSetThb: unitGp,
        gpOrderThb: pick.cost?.gpThb,
        gpPercent:
          canSeeCost && landed != null
            ? calcGpPercent(pick.sellThb, landed)
            : undefined,
      },
    ];
  }, [basket, selected, rows, includeFreight, includePackaging, canSeeCost]);

  const basketGpTotals = useMemo(() => {
    if (!canSeeCost || !basket.length) return null;
    let sell = 0;
    let cost = 0;
    let gp = 0;
    for (const item of basket) {
      const unitSell = item.sellMin;
      sell += unitSell * item.qty;
      if (item.landedCostThb != null) cost += item.landedCostThb * item.qty;
      if (item.gpOrderThb != null) gp += item.gpOrderThb;
    }
    return {
      sell,
      cost,
      gp,
      gpPercent: sell > 0 ? Math.round((gp / sell) * 1000) / 10 : 0,
    };
  }, [basket, canSeeCost]);

  function addCurrent() {
    if (!selected || !rows.length) return;
    const pick =
      rows.find((row) => extraQty && row.qty === Math.floor(Number(extraQty))) ||
      rows[rows.length - 1]!;
    const landed = pick.cost?.landedCostThb;
    setBasket((prev) => {
      const next = prev.filter((item) => item.slug !== selected.slug);
      next.push({
        slug: selected.slug,
        name: selected.name,
        image: selected.image,
        qty: pick.qty,
        sellMin: pick.sellMin,
        sellMax: pick.sellMax,
        includeFreight,
        includePackaging,
        landedCostThb: landed,
        gpPerSetThb:
          canSeeCost && landed != null
            ? calcGpPerSetThb(pick.sellThb, landed)
            : undefined,
        gpOrderThb: pick.cost?.gpThb,
        gpPercent:
          canSeeCost && landed != null
            ? calcGpPercent(pick.sellThb, landed)
            : undefined,
      });
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* 1) ค้นหา — เส้นทางหลัก */}
      <form
        className="rounded-xl border border-brass/40 bg-brass/[0.07] p-4 print:hidden sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          applyProductCode(codeDraft);
        }}
      >
        <label className="block">
          <span className="text-base font-semibold text-forest">
            ใส่รหัสหรือชื่อชุด
          </span>
          <span className="mt-0.5 block text-sm text-ink/60">
            แล้วกดดูราคา — ระบบรีเช็คสูตรให้อัตโนมัติ
          </span>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={codeDraft}
              onChange={(e) => {
                const v = e.target.value;
                setCodeDraft(v);
                setQuery(v);
              }}
              placeholder="เช่น bt00-0 หรือ กระบอกน้ำ"
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-forest/25 bg-paper px-4 py-3 text-base font-mono"
            />
            <button
              type="submit"
              className="rounded-lg bg-forest px-6 py-3 text-base font-semibold text-paper sm:shrink-0"
            >
              {pending ? "กำลังคิด…" : "ดูราคา"}
            </button>
          </div>
        </label>

        {items.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.slice(0, 6).map((item) => (
              <li key={item.slug}>
                <button
                  type="button"
                  onClick={() => pickProduct(item)}
                  className={`flex w-full gap-3 rounded-lg border bg-paper p-2 text-left text-sm hover:border-brass/60 ${
                    slug === item.slug
                      ? "border-brass ring-1 ring-brass/40"
                      : "border-forest/10"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded object-cover bg-forest-mist/40"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-forest line-clamp-1">
                      {item.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-ink/50">
                      {item.slug}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {/* 2) ผลลัพธ์สั้น ๆ */}
      {selected && summary ? (
        <section className="rounded-xl border border-forest/15 bg-paper p-4 print:hidden sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.image}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg object-cover bg-forest-mist/40"
              />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-forest line-clamp-2">
                  {selected.name}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-ink/50">
                  {selected.slug}
                </p>
                <p className="mt-1 text-xs text-ink/60">
                  {pending ? "กำลังคิดราคา…" : note}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addCurrent}
                disabled={!rows.length}
                className="rounded border border-forest/20 px-3 py-2 text-sm disabled:opacity-50"
              >
                ใส่ใบราคา
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!sheetRows.length}
                className="rounded bg-forest px-3 py-2 text-sm font-medium text-paper disabled:opacity-50"
              >
                พิมพ์
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-forest/10 bg-forest-mist/40 px-3 py-3">
              <p className="text-xs text-ink/55">แพงสุด · จำนวนน้อย</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-forest">
                {money(summary.maxRow.sellThb)}
              </p>
              <p className="text-xs text-ink/50">
                ที่ {summary.maxRow.qty} ชุด
              </p>
            </div>
            <div className="rounded-lg border border-forest/10 bg-forest-mist/40 px-3 py-3">
              <p className="text-xs text-ink/55">ถูกสุด · สั่งเยอะ</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-forest">
                {money(summary.minRow.sellThb)}
              </p>
              <p className="text-xs text-ink/50">
                ที่ {summary.minRow.qty} ชุด
              </p>
            </div>
            <div className="rounded-lg border border-brass/35 bg-brass/[0.08] px-3 py-3">
              <p className="text-xs text-ink/55">กำลังดู</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-forest">
                {money(summary.focus.sellThb)}
              </p>
              <p className="text-xs text-ink/50">
                {summary.focus.qty} ชุด
                {canSeeCost && summary.focus.cost
                  ? ` · GP ${money(summary.focus.cost.gpThb)}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-forest">เลือกจำนวน</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {rows.map((row) => (
                <button
                  key={row.qty}
                  type="button"
                  onClick={() => setExpandedQty(row.qty)}
                  className={`rounded-full border px-3 py-1.5 text-sm tabular-nums ${
                    expandedQty === row.qty
                      ? "border-forest bg-forest text-paper"
                      : "border-forest/20 bg-paper text-forest hover:border-forest/40"
                  }`}
                >
                  {row.qty} · {money(row.sellThb)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-forest">
              รีเช็คสูตรทีละขั้น
            </p>
            <FormulaRecheckPanel
              row={summary.focus}
              fx={Number(cnyToThb)}
            />
          </div>

          <PriceDisclaimer variant="short" className="mt-4" />
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-forest/20 bg-paper px-4 py-8 text-center print:hidden">
          <p className="text-sm text-ink/65">
            ยังไม่มีผลลัพธ์ — พิมพ์รหัสหรือชื่อชุดด้านบน แล้วกด{" "}
            <span className="font-medium text-forest">ดูราคา</span>
          </p>
        </section>
      )}

      {/* 3) ตั้งค่าง่าย + ขั้นสูงซ่อน */}
      <details className="rounded-xl border border-forest/15 bg-paper p-4 print:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-forest">
          จำนวนที่ลูกค้าขอ / โปรไฟล์ / ขนส่ง
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="text-ink/70">จำนวนที่ลูกค้าขอ</span>
            <input
              type="number"
              min={1}
              value={extraQty}
              onChange={(e) => setExtraQty(e.target.value)}
              placeholder="เช่น 80"
              className="mt-1 w-full rounded border border-forest/20 px-2 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-ink/70">เดือนจัดส่งจากจีน</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="mt-1 w-full rounded border border-forest/20 px-2 py-2"
            >
              {MONTHS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-ink/70">วิธีส่งจีน→ไทย</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
              className="mt-1 w-full rounded border border-forest/20 px-2 py-2"
            >
              <option value="auto">ตามกฎเว็บ</option>
              <option value="truck">บังคับรถ</option>
              <option value="sea">บังคับเรือ</option>
            </select>
          </label>
          {canSeeCost ? (
            <label className="text-sm">
              <span className="text-ink/70">
                อัตรา CNY→THB
                <span className="ml-1 text-xs text-ink/50">
                  {fxGuide.live ? fxGuide.source : "ค่าเริ่มต้น"}
                </span>
              </span>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={cnyToThb}
                onChange={(e) => setCnyToThb(e.target.value)}
                className="mt-1 w-full rounded border border-forest/20 px-2 py-2"
              />
            </label>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <div className="flex rounded border border-forest/20">
            <button
              type="button"
              className={`px-3 py-1.5 ${profile === "standard" ? "bg-forest text-paper" : ""}`}
              onClick={() => setProfile("standard")}
            >
              ทั่วไป
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 ${profile === "corporate" ? "bg-forest text-paper" : ""}`}
              onClick={() => setProfile("corporate")}
            >
              องค์กร
            </button>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeFreight}
              onChange={(e) => setIncludeFreight(e.target.checked)}
            />
            รวมขนส่งจากจีน
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includePackaging}
              onChange={(e) => setIncludePackaging(e.target.checked)}
            />
            รวมแพ็กไทย (+{DEFAULT_PACKAGING_MIN_THB}–{DEFAULT_PACKAGING_MAX_THB})
          </label>
        </div>
        {canSeeCost ? (
          <details className="mt-4 rounded border border-forest/10 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-forest">
              ต้นทุนโรงงาน / กล่อง (ผู้ดูแล)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label>
                ต้นทุน CNY/ชุด
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={factoryCny}
                  onChange={(e) => setFactoryCny(e.target.value)}
                  placeholder="จาก offer"
                  className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
                />
              </label>
              <label>
                คลังจีน
                <select
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
                >
                  <option value="guangzhou_shenzhen">กว่างโจว / เซินเจิ้น</option>
                  <option value="yiwu">อี้อู</option>
                </select>
              </label>
              <label>
                ประเภทสินค้า
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
                >
                  <option value="general">ทั่วไป</option>
                  <option value="electronic_tisi">ไฟฟ้า / มอก.</option>
                </select>
              </label>
              <label>
                กก./ชิ้น
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
                />
              </label>
              <label>
                กว้าง ซม.
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={lengthCm}
                  onChange={(e) => setLengthCm(e.target.value)}
                  className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
                />
              </label>
              <label>
                ยาว ซม.
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                  className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
                />
              </label>
              <label>
                สูง ซม.
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
                />
              </label>
            </div>
          </details>
        ) : null}
      </details>

      <details className="rounded-xl border border-forest/15 bg-paper p-4 print:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-forest">
          ดูสูตรสมการ (standard)
        </summary>
        <div className="mt-3">
          <PricingFormulaGuide profile={profile} />
        </div>
      </details>

      {rows.length ? (
        <details className="rounded-xl border border-forest/15 bg-paper p-4 print:hidden">
          <summary className="cursor-pointer text-sm font-semibold text-forest">
            ตารางบันไดจำนวนทั้งหมด
          </summary>
          <FormulaBandLegend profile={profile} className="mt-2" />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-forest/15 text-left text-ink/60">
                  <th className="py-2">จำนวน</th>
                  <th>ราคา/ชุด</th>
                  {includePackaging ? <th>ช่วงแพ็ก</th> : null}
                  {canSeeCost ? <th>ต้นทุน</th> : null}
                  {canSeeCost ? <th>GP ทั้งออเดอร์</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.qty}
                    className={`cursor-pointer border-b border-forest/10 hover:bg-forest-mist/30 ${
                      expandedQty === row.qty ? "bg-brass/5" : ""
                    }`}
                    onClick={() => setExpandedQty(row.qty)}
                  >
                    <td className="py-2 font-medium">{row.qty} ชุด</td>
                    <td className="font-semibold tabular-nums text-forest">
                      {money(row.sellThb)}
                    </td>
                    {includePackaging ? (
                      <td className="tabular-nums text-ink/70">
                        {money(row.sellMin)}–{money(row.sellMax)}
                      </td>
                    ) : null}
                    {canSeeCost ? (
                      <td className="tabular-nums">
                        {row.cost ? money(row.cost.landedCostThb) : "—"}
                      </td>
                    ) : null}
                    {canSeeCost ? (
                      <td className="tabular-nums font-semibold text-forest">
                        {row.cost ? money(row.cost.gpThb) : "—"}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {basket.length ? (
        <section className="rounded-xl border border-forest/15 bg-paper p-4 print:hidden">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-forest">
              รายการในใบราคา ({basket.length})
            </h2>
            <button
              type="button"
              className="text-sm text-ink/70 underline"
              onClick={() => setBasket([])}
            >
              ล้าง
            </button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-forest/15 text-left text-ink/60">
                  <th className="py-2">ชุด</th>
                  <th>จำนวน</th>
                  <th>ขาย/ชุด</th>
                  {canSeeCost ? <th>GP การขายนี้</th> : null}
                  <th>รวมขาย</th>
                </tr>
              </thead>
              <tbody>
                {basket.map((item) => (
                  <tr key={item.slug} className="border-b border-forest/10">
                    <td className="py-2 font-medium text-forest">{item.name}</td>
                    <td className="tabular-nums">{item.qty} ชุด</td>
                    <td className="tabular-nums">
                      {item.sellMin === item.sellMax
                        ? money(item.sellMin)
                        : `${money(item.sellMin)}–${money(item.sellMax)}`}
                    </td>
                    {canSeeCost ? (
                      <td className="tabular-nums font-semibold text-forest">
                        {item.gpOrderThb != null
                          ? money(item.gpOrderThb)
                          : "—"}
                      </td>
                    ) : null}
                    <td className="tabular-nums font-medium">
                      {money(item.sellMin * item.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {basketGpTotals ? (
                <tfoot>
                  <tr className="border-t border-forest/20 bg-forest-mist/50 font-semibold text-forest">
                    <td className="py-2" colSpan={3}>
                      รวม
                    </td>
                    {canSeeCost ? (
                      <td className="tabular-nums">
                        {money(basketGpTotals.gp)}
                      </td>
                    ) : null}
                    <td className="tabular-nums">
                      {money(basketGpTotals.sell)}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </section>
      ) : null}

      <section className="hidden print:block">
        <header className="border-b border-forest/20 pb-4">
          <p className="text-xs tracking-wide text-ink/55">ใบเสนอราคาโดยประมาณ</p>
          <h1 className="mt-1 text-2xl font-bold text-forest">{brand.legalName}</h1>
          <p className="text-sm text-ink/70">{brand.name}</p>
          <p className="mt-2 text-sm">
            โทร {brand.phone} · {brand.email} · LINE {brand.lineId}
          </p>
        </header>
        <ul className="mt-6 space-y-4">
          {sheetRows.map((item) => (
            <li key={item.slug} className="flex gap-4 border-b border-forest/10 pb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt=""
                className="h-24 w-24 object-cover"
              />
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="mt-1 text-sm">จำนวนอ้างอิง {item.qty} ชุด</p>
                <p className="mt-1 text-lg font-bold text-forest">
                  {item.sellMin === item.sellMax
                    ? `${money(item.sellMin)} / ชุด`
                    : `${money(item.sellMin)}–${money(item.sellMax)} / ชุด`}
                </p>
                <p className="text-xs text-ink/60">
                  {item.includeFreight
                    ? "รวมค่าขนส่งจากจีนโดยประมาณ"
                    : "ยังไม่รวมค่าขนส่งจากจีน"}
                  {item.includePackaging
                    ? " · รวมแพ็กในไทย"
                    : " · ยังไม่รวมแพ็กในไทย"}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs leading-relaxed text-ink/70">
          {PRICE_DISCLAIMER_FULL} ราคานี้ยังไม่รวม VAT 7%
        </p>
      </section>
    </div>
  );
}
