"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveFactoryPoAction } from "@/app/actions/ops-factory-po";
import type { OpsActionResult } from "@/app/actions/ops";
import {
  FACTORY_CURRENCIES,
  FACTORY_CURRENCY_LABELS,
  FACTORY_PLATFORMS,
  FACTORY_PLATFORM_LABELS,
  FACTORY_PO_STATUSES,
  FACTORY_PO_STATUS_LABELS,
  FREIGHT_MODES,
  FREIGHT_MODE_LABELS,
  factoryFxPairLabel,
  factoryCurrencyNoun,
  type FactoryCurrency,
  type FactoryPlatform,
  type FactoryPoDraft,
  type FactoryPoRecord,
} from "@/lib/factory-po-types";
import { computePoCost } from "@/lib/po-cost";
import { formatThb } from "@/lib/th-billing";
import { LOGO_DECORATION_OPTIONS } from "@/lib/product-decoration";
import { FACTORY_MARKET_FX_USD_THB, SMARTGIFT_FX_CNY_THB } from "@/lib/alibaba/rates";
import { formatFxRate, rateForCurrency, type FxGuide } from "@/lib/fx-rates";
import {
  factoryContactLine,
  type FactoryPickerOption,
} from "@/lib/factory-registry-types";

const initial: OpsActionResult | null = null;

function num(value: number | null | undefined): string {
  if (value == null || value === 0) return "";
  return String(value);
}

function defaultFx(currency: FactoryCurrency): string {
  return String(currency === "USD" ? FACTORY_MARKET_FX_USD_THB : SMARTGIFT_FX_CNY_THB);
}

function formatGuideTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function FactoryPoForm({
  orderId,
  po,
  defaults,
  factories = [],
}: {
  orderId: string;
  po?: FactoryPoRecord | null;
  defaults?: FactoryPoDraft;
  factories?: FactoryPickerOption[];
}) {
  const [state, action, pending] = useActionState(saveFactoryPoAction, initial);
  const [factoryId, setFactoryId] = useState(
    String(po?.factoryId || defaults?.factoryId || ""),
  );
  const [factoryName, setFactoryName] = useState(
    po?.factoryName || defaults?.factoryName || "",
  );
  const [factoryPlatform, setFactoryPlatform] = useState<FactoryPlatform>(
    po?.factoryPlatform || "other",
  );
  const [factoryContact, setFactoryContact] = useState(po?.factoryContact || "");
  const [quantity, setQuantity] = useState(String(po?.quantity || defaults?.quantity || 1));
  const [unitCny, setUnitCny] = useState(num(po?.factoryUnitCny));
  const [amountCny, setAmountCny] = useState(num(po?.factoryAmountCny));
  const [currency, setCurrency] = useState<FactoryCurrency>(
    po?.factoryCurrency || defaults?.factoryCurrency || "CNY",
  );
  const [fx, setFx] = useState(
    String(
      po?.fxCnyThb ||
        defaults?.fxCnyThb ||
        (po?.factoryCurrency === "USD" || defaults?.factoryCurrency === "USD"
          ? FACTORY_MARKET_FX_USD_THB
          : SMARTGIFT_FX_CNY_THB),
    ),
  );
  const [guide, setGuide] = useState<FxGuide | null>(null);
  const [guideError, setGuideError] = useState("");
  const [guideLoading, setGuideLoading] = useState(true);
  const [inland, setInland] = useState(num(po?.inlandThb));
  const [freight, setFreight] = useState(num(po?.freightThb));
  const [duty, setDuty] = useState(num(po?.importDutyThb));
  const [customs, setCustoms] = useState(num(po?.customsFeeThb));
  const [packing, setPacking] = useState(num(po?.packingThb));
  const [lastMile, setLastMile] = useState(num(po?.lastMileThb));

  const preview = useMemo(() => {
    return computePoCost({
      quantity: Number(quantity) || 0,
      factoryUnitCny: Number(unitCny) || 0,
      factoryAmountCny: Number(amountCny) || undefined,
      fxCnyThb: Number(fx) || Number(defaultFx(currency)),
      inlandThb: Number(inland) || 0,
      freightThb: Number(freight) || 0,
      importDutyThb: Number(duty) || 0,
      customsFeeThb: Number(customs) || 0,
      packingThb: Number(packing) || 0,
      lastMileThb: Number(lastMile) || 0,
    });
  }, [quantity, unitCny, amountCny, fx, currency, inland, freight, duty, customs, packing, lastMile]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ops/fx-rates", { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json()) as Partial<FxGuide> & {
          ok?: boolean;
          error?: string;
        };
        if (!response.ok || json.ok === false) {
          throw new Error(json.error || "fx");
        }
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        if (typeof json.cnyThb !== "number" || typeof json.usdThb !== "number") {
          throw new Error("fx");
        }
        setGuide({
          cnyThb: json.cnyThb,
          usdThb: json.usdThb,
          source: String(json.source || ""),
          fetchedAt: String(json.fetchedAt || new Date().toISOString()),
          live: Boolean(json.live),
        });
      })
      .catch(() => {
        if (!cancelled) setGuideError("ดึงเรทตลาดไม่ได้ — ใช้ค่าในระบบเป็นไกด์");
      })
      .finally(() => {
        if (!cancelled) setGuideLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const noun = factoryCurrencyNoun(currency);
  const guideRate = guide ? rateForCurrency(guide, currency) : null;

  function applyGuideRate() {
    const next = guideRate || Number(defaultFx(currency));
    if (next > 0) setFx(String(next));
  }

  function onPickFactory(id: string) {
    setFactoryId(id);
    const fac = factories.find((row) => String(row.id) === id);
    if (!fac) return;
    setFactoryName(fac.name);
    setFactoryPlatform(fac.platform);
    setFactoryContact(factoryContactLine(fac));
    if (!po) {
      onCurrencyChange(fac.defaultCurrency);
    }
  }

  function onCurrencyChange(next: FactoryCurrency) {
    setCurrency(next);
    const nextGuide = guide ? rateForCurrency(guide, next) : Number(defaultFx(next));
    if (nextGuide > 0) setFx(String(nextGuide));
  }

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="orderId" value={orderId} />
      {po ? <input type="hidden" name="poId" value={po.poId} /> : null}
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <section className="rounded-xl border border-forest/15 bg-paper p-5">
        <h2 className="text-lg font-semibold text-forest">โรงงานจีน</h2>
        <p className="mt-1 text-sm text-ink/65">
          เลือกจากทะเบียนโรงงานก่อน — ชื่อในใบสั่งเป็นสำเนา ณ วันที่สั่ง
          ไม่แสดงบนเว็บลูกค้า
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">ทะเบียนโรงงาน</span>
            <select
              name="factoryId"
              value={factoryId}
              onChange={(e) => onPickFactory(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              <option value="">ยังไม่ผูกทะเบียน — พิมพ์ชื่อด้านล่าง</option>
              {factories.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.factoryCode} · {fac.name}
                  {fac.status === "paused" ? " (พักสั่ง)" : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink/55">
              เพิ่มโรงงานใหม่ที่เมนูทะเบียนโรงงาน แล้วกลับมาเลือกที่นี่
            </span>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">ชื่อโรงงาน / ผู้ขาย</span>
            <input
              name="factoryName"
              required
              value={factoryName}
              onChange={(e) => setFactoryName(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">ช่องทาง</span>
            <select
              name="factoryPlatform"
              value={factoryPlatform}
              onChange={(e) => setFactoryPlatform(e.target.value as FactoryPlatform)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              {FACTORY_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {FACTORY_PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">รหัสสินค้าโรงงาน (ถ้ามี)</span>
            <input
              name="sourceOfferId"
              defaultValue={po?.sourceOfferId || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">ผู้ติดต่อโรงงาน</span>
            <input
              name="factoryContact"
              value={factoryContact}
              onChange={(e) => setFactoryContact(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">สถานะใบสั่ง</span>
            <select
              name="status"
              defaultValue={po?.status || "draft"}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              {FACTORY_PO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {FACTORY_PO_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-forest/15 bg-paper p-5">
        <h2 className="text-lg font-semibold text-forest">สเปคผลิตและโลโก้</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">ชื่อสินค้า</span>
            <input
              name="productName"
              defaultValue={po?.productName || defaults?.productName || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">จำนวน</span>
            <input
              name="quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">สี</span>
            <input
              name="color"
              defaultValue={po?.color || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">วัสดุ</span>
            <input
              name="material"
              defaultValue={po?.material || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">วิธีสกรีนโลโก้</span>
            <select
              name="decorationMethod"
              defaultValue={po?.decorationMethod || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              <option value="">ยังไม่ระบุ</option>
              {LOGO_DECORATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">ตำแหน่งโลโก้</span>
            <input
              name="logoPosition"
              defaultValue={po?.logoPosition || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">รายละเอียดโลโก้ / สีพิมพ์</span>
            <textarea
              name="logoNotes"
              rows={3}
              defaultValue={po?.logoNotes || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">แพ็กเกจ / การ์ด / โบว์</span>
            <textarea
              name="packagingNotes"
              rows={2}
              defaultValue={po?.packagingNotes || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">จุดตรวจคุณภาพ</span>
            <textarea
              name="qcNotes"
              rows={2}
              defaultValue={po?.qcNotes || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-brass/40 bg-brass/5 p-5">
        <h2 className="text-lg font-semibold text-forest">ต้นทุนต่อใบสั่ง — จนถึงส่งลูกค้า</h2>
        <p className="mt-1 text-sm text-ink/65">
          เมื่อสถานะเป็น «โรงงานยืนยันแล้ว» ขึ้นไป ระบบจะลงบัญชีต้นทุนอัตโนมัติ
        </p>
        <input type="hidden" name="factoryCurrency" value={currency} />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium">สกุลเงินโรงงาน</span>
            <select
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value as FactoryCurrency)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              {FACTORY_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {FACTORY_CURRENCY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">ราคาต่อชิ้น ({noun})</span>
            <input
              name="factoryUnitCny"
              type="number"
              step="0.01"
              min={0}
              value={unitCny}
              onChange={(e) => setUnitCny(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">
              รวมโรงงาน ({noun}) — ว่างแล้วคูณจำนวน
            </span>
            <input
              name="factoryAmountCny"
              type="number"
              step="0.01"
              min={0}
              value={amountCny}
              onChange={(e) => setAmountCny(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-3">
            <span className="font-medium">อัตราแลกเปลี่ยน {factoryFxPairLabel(currency)}</span>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start">
              <input
                name="fxCnyThb"
                type="number"
                step="0.0001"
                min={0.01}
                value={fx}
                onChange={(e) => setFx(e.target.value)}
                className="w-full rounded border border-forest/20 px-3 py-2 sm:max-w-xs"
              />
              <div className="min-w-0 flex-1 text-xs text-ink/65">
                {guideLoading ? (
                  <p>กำลังดึงเรทตลาดมาเป็นไกด์…</p>
                ) : guideRate ? (
                  <p>
                    ไกด์วันนี้{" "}
                    <span className="font-medium text-forest">
                      {formatFxRate(guideRate)} บาท / 1 {noun}
                    </span>
                    {guide?.live ? " จากตลาด" : " (ค่าในระบบ)"}
                    {guide?.fetchedAt ? ` · ${formatGuideTime(guide.fetchedAt)}` : ""}
                    {guide?.source ? ` · ${guide.source}` : ""}
                  </p>
                ) : (
                  <p>{guideError || "ยังไม่มีเรทไกด์"}</p>
                )}
                <button
                  type="button"
                  onClick={applyGuideRate}
                  className="mt-1 font-medium text-forest underline-offset-2 hover:underline"
                >
                  ใช้เรทไกด์ในช่องนี้
                </button>
                <p className="mt-1">เรทที่ใช้คิดต้นทุนแก้ได้ — ไกด์เป็นแค่ค่าตลาดวันนี้</p>
              </div>
            </div>
          </label>
          <label className="block text-sm">
            <span className="font-medium">ขนส่งในจีน (บาท)</span>
            <input
              name="inlandThb"
              type="number"
              step="0.01"
              min={0}
              value={inland}
              onChange={(e) => setInland(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">ขนส่งจีน–ไทย (บาท)</span>
            <input
              name="freightThb"
              type="number"
              step="0.01"
              min={0}
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">รูปแบบขนส่ง</span>
            <select
              name="freightMode"
              defaultValue={po?.freightMode || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              <option value="">ยังไม่ระบุ</option>
              {FREIGHT_MODES.map((m) => (
                <option key={m} value={m}>
                  {FREIGHT_MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">ภาษีนำเข้า (บาท)</span>
            <input
              name="importDutyThb"
              type="number"
              step="0.01"
              min={0}
              value={duty}
              onChange={(e) => setDuty(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">ค่าพิธีการศุลกากร (บาท)</span>
            <input
              name="customsFeeThb"
              type="number"
              step="0.01"
              min={0}
              value={customs}
              onChange={(e) => setCustoms(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">แพ็กในไทย (บาท)</span>
            <input
              name="packingThb"
              type="number"
              step="0.01"
              min={0}
              value={packing}
              onChange={(e) => setPacking(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">จัดส่งถึงลูกค้า (บาท)</span>
            <input
              name="lastMileThb"
              type="number"
              step="0.01"
              min={0}
              value={lastMile}
              onChange={(e) => setLastMile(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-paper px-3 py-2">
            <dt className="text-xs text-ink/55">โรงงานจาก{noun} (บาท)</dt>
            <dd className="font-semibold">{formatThb(preview.factoryThb)}</dd>
          </div>
          <div className="rounded-lg bg-paper px-3 py-2">
            <dt className="text-xs text-ink/55">ต้นทุนขาย</dt>
            <dd className="font-semibold">{formatThb(preview.cogsThb)}</dd>
          </div>
          <div className="rounded-lg bg-paper px-3 py-2">
            <dt className="text-xs text-ink/55">ค่าจัดส่ง/แพ็ก</dt>
            <dd className="font-semibold">{formatThb(preview.sellingExpenseThb)}</dd>
          </div>
          <div className="rounded-lg bg-forest px-3 py-2 text-paper">
            <dt className="text-xs text-paper/70">ต้นทุนลงเรือรวม</dt>
            <dd className="text-lg font-semibold">{formatThb(preview.landedTotalThb)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-forest/15 bg-paper p-5">
        <h2 className="text-lg font-semibold text-forest">นำส่งลูกค้าในไทย</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">ปลายทางรับของ</span>
            <select
              name="destinationMode"
              defaultValue={po?.destinationMode || defaults?.destinationMode || "warehouse"}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              <option value="warehouse">เข้าคลังไทย</option>
              <option value="ship_to">ไม่เข้าคลัง — ส่งตรงลูกค้า</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">โหมดรับเข้าคลัง</span>
            <select
              name="receiveMode"
              defaultValue={po?.receiveMode || defaults?.receiveMode || "cross_dock"}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              <option value="cross_dock">
                Cross-dock — รับแล้วแพ็กส่ง (อย่าขึ้นชั้น)
              </option>
              <option value="stock">เก็บเข้าชั้นวาง</option>
            </select>
            <span className="mt-1 block text-xs text-ink/55">
              ของสั่งผลิตตามออเดอร์แนะนำ Cross-dock
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">ผู้รับ</span>
            <input
              name="shipToName"
              defaultValue={po?.shipToName || defaults?.shipToName || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">โทรศัพท์</span>
            <input
              name="shipToPhone"
              defaultValue={po?.shipToPhone || defaults?.shipToPhone || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">ที่อยู่จัดส่ง</span>
            <textarea
              name="shipToAddress"
              rows={2}
              defaultValue={po?.shipToAddress || defaults?.shipToAddress || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">จังหวัด</span>
            <input
              name="shipToProvince"
              defaultValue={po?.shipToProvince || defaults?.shipToProvince || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">เลขติดตามจีน</span>
            <input
              name="trackingCn"
              defaultValue={po?.trackingCn || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">เลขตู้ / B/L (ASN)</span>
            <input
              name="asnContainer"
              defaultValue={po?.asnContainer || ""}
              placeholder="ตู้ / master B/L"
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">ETA ถึงไทย (ASN)</span>
            <input
              type="date"
              name="asnEta"
              defaultValue={(po?.asnEta || "").slice(0, 10)}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">จำนวนตาม ASN</span>
            <input
              name="asnQty"
              type="number"
              min={0}
              defaultValue={po?.asnQty ?? ""}
              placeholder="ว่าง = ใช้จำนวนในใบสั่ง"
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">เลขติดตามไทย</span>
            <input
              name="trackingTh"
              defaultValue={po?.trackingTh || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">หมายเหตุภายใน</span>
            <textarea
              name="notes"
              rows={2}
              defaultValue={po?.notes || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
        </div>
      </section>

      {state && !state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-forest px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : po ? "บันทึกใบสั่งโรงงาน" : "สร้างใบสั่งโรงงาน"}
      </button>
    </form>
  );
}
