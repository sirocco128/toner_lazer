"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProductConfiguration } from "@/lib/product-configurator-types";
import { minNeededDateYmd } from "@/lib/bangkok-date";

const CONFIG_DISCLAIMER =
  "เครื่องมือนี้ช่วยร่างสเปคเบื้องต้นเท่านั้น ไม่คำนวณราคา และไม่ยืนยันวันส่งมอบ — ส่งคำขอเพื่อให้ทีมขายยืนยันสเปคจริง";

const DECORATION_OPTIONS = [
  { value: "", label: "ยังไม่เลือก" },
  { value: "not-sure", label: "ยังไม่แน่ใจ" },
  { value: "screen-print", label: "สกรีน" },
  { value: "emboss", label: "ปั๊มนูน" },
  { value: "laser", label: "เลเซอร์" },
  { value: "full-color", label: "พิมพ์สี" },
  { value: "uv-print", label: "พิมพ์ UV" },
  { value: "embroidery", label: "ปัก" },
  { value: "foil", label: "ปั๊มฟอยล์" },
] as const;

const PACKAGING_OPTIONS = [
  { value: "", label: "ยังไม่เลือก" },
  { value: "rigid-box", label: "กล่องจั่วปัง / Rigid Box" },
  { value: "corrugated", label: "กล่องลูกฟูก" },
  { value: "magnetic", label: "กล่องแม่เหล็ก" },
  { value: "sleeve", label: "Sleeve / ปลอก" },
  { value: "custom", label: "สั่งทำพิเศษ" },
] as const;

type ProductConfiguratorStubProps = {
  productSlug?: string;
  productName?: string;
};

function buildSummary(config: ProductConfiguration): string[] {
  const lines: string[] = [];
  if (config.productName) lines.push(`สินค้า: ${config.productName}`);
  if (config.decorationMethod) lines.push(`วิธีตกแต่ง: ${config.decorationMethod}`);
  if (config.packagingType) lines.push(`บรรจุภัณฑ์: ${config.packagingType}`);
  if (config.quantity) lines.push(`จำนวน: ${config.quantity}`);
  if (config.deliveryDate) lines.push(`วันที่ต้องการ: ${config.deliveryDate}`);
  if (config.color) lines.push(`สี: ${config.color}`);
  if (config.material) lines.push(`วัสดุ: ${config.material}`);
  if (config.capacityOrSize) lines.push(`ขนาด/ความจุ: ${config.capacityOrSize}`);
  if (config.decorationPosition) {
    lines.push(`ตำแหน่งตกแต่ง: ${config.decorationPosition}`);
  }
  if (config.notes) lines.push(`หมายเหตุ: ${config.notes}`);
  return lines;
}

export function ProductConfiguratorStub({
  productSlug,
  productName,
}: ProductConfiguratorStubProps) {
  const [config, setConfig] = useState<ProductConfiguration>({
    productSlug,
    productName,
    quantity: undefined,
  });

  const summary = useMemo(() => buildSummary(config), [config]);

  const contactHref = useMemo(() => {
    const note = [
      "[ร่างสเปคจากตัวปรับแต่ง]",
      ...summary,
      "",
      "หมายเหตุ: ยังไม่มีราคาจากระบบ — กรุณายืนยันสเปคกับทีมขาย",
    ].join("\n");
    const params = new URLSearchParams({
      source: "product-configurator",
      note,
    });
    if (productSlug) params.set("product", productSlug);
    return `/contact?${params.toString()}`;
  }, [summary, productSlug]);

  const patch = (partial: Partial<ProductConfiguration>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };
  const minNeededDate = minNeededDateYmd();

  return (
    <section className="rounded-3xl border border-forest/10 bg-paper p-6 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-brass">
        ปรับแต่งเซ็ต (ทดลอง)
      </p>
      <h2 className="mt-2 text-2xl font-bold text-forest">
        ตัวปรับแต่งสินค้า (ทดลอง)
      </h2>
      <p className="mt-2 text-sm text-ink/70 leading-relaxed">{CONFIG_DISCLAIMER}</p>

      <form
        className="mt-8 grid gap-5 sm:grid-cols-2"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="block text-sm sm:col-span-2">
          <span className="font-semibold text-forest">วิธีตกแต่ง</span>
          <select
            value={config.decorationMethod ?? ""}
            onChange={(e) =>
              patch({ decorationMethod: e.target.value || undefined })
            }
            className="mt-1 min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            {DECORATION_OPTIONS.map((opt) => (
              <option key={opt.value || "empty"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="font-semibold text-forest">บรรจุภัณฑ์</span>
          <select
            value={config.packagingType ?? ""}
            onChange={(e) =>
              patch({ packagingType: e.target.value || undefined })
            }
            className="mt-1 min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            {PACKAGING_OPTIONS.map((opt) => (
              <option key={opt.value || "empty"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-semibold text-forest">จำนวน</span>
          <input
            type="number"
            min={1}
            step={1}
            value={config.quantity ?? ""}
            onChange={(e) => {
              const value = e.target.value ? Number(e.target.value) : undefined;
              patch({
                quantity:
                  value !== undefined && Number.isFinite(value)
                    ? Math.max(1, Math.floor(value))
                    : undefined,
              });
            }}
            placeholder="เช่น 100"
            className="mt-1 min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          />
        </label>

        <label className="block text-sm">
          <span className="font-semibold text-forest">วันที่ต้องการใช้งาน</span>
          <input
            type="date"
            min={minNeededDate}
            value={
              config.deliveryDate && config.deliveryDate >= minNeededDate
                ? config.deliveryDate
                : ""
            }
            onChange={(e) => {
              const next = e.target.value;
              patch({
                deliveryDate:
                  next && next < minNeededDate ? minNeededDate : next || undefined,
              });
            }}
            className="mt-1 min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          />
        </label>

        <label className="block text-sm">
          <span className="font-semibold text-forest">สี (ถ้ามี)</span>
          <input
            type="text"
            value={config.color ?? ""}
            onChange={(e) => patch({ color: e.target.value || undefined })}
            className="mt-1 min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          />
        </label>

        <label className="block text-sm">
          <span className="font-semibold text-forest">ขนาด / ความจุ</span>
          <input
            type="text"
            value={config.capacityOrSize ?? ""}
            onChange={(e) =>
              patch({ capacityOrSize: e.target.value || undefined })
            }
            className="mt-1 min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="font-semibold text-forest">หมายเหตุเพิ่มเติม</span>
          <textarea
            rows={3}
            value={config.notes ?? ""}
            onChange={(e) => patch({ notes: e.target.value || undefined })}
            className="mt-1 w-full rounded-xl border border-forest/20 bg-paper px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          />
        </label>
      </form>

      <div className="mt-8 rounded-2xl bg-forest-mist/50 px-5 py-4">
        <h3 className="text-sm font-semibold text-forest">สรุปสเปค (ยังไม่มีราคา)</h3>
        {summary.length ? (
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink/75">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink/60">ยังไม่ได้เลือกมิติการปรับแต่ง</p>
        )}
        <p className="mt-3 text-xs text-ink/55">
          ห้ามยืนยันราคาหรือวันส่งมอบขั้นสุดท้ายจนกว่าจะได้รับการยืนยันจาก Production /
          NextERP
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={contactHref}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-forest transition hover:bg-brass-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          ส่งสเปคไปขอใบเสนอราคา
        </Link>
        <Link
          href="/customize-gift-set"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
        >
          ออกแบบเซ็ตเอง
        </Link>
      </div>
    </section>
  );
}
