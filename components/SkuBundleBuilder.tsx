"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createBundleAction } from "@/app/actions/ops-products";
import type { OpsActionResult } from "@/app/actions/ops";
import { SkuSearchSelect } from "@/components/SkuSearchSelect";
import type { BundleComponentOption } from "@/lib/sku-master-types";

const initial: OpsActionResult | null = null;

type Line = { key: string; productId: string; qty: string };

export function SkuBundleBuilder({
  options,
}: {
  options: BundleComponentOption[];
}) {
  const [state, action, pending] = useActionState(createBundleAction, initial);
  const [lines, setLines] = useState<Line[]>([
    { key: "1", productId: "", qty: "1" },
  ]);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <label className="block text-sm">
        <span className="font-medium">ชื่อชุด (กำหนดเอง)</span>
        <input
          name="nameTh"
          required
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">ชื่ออังกฤษ</span>
        <input name="nameEn" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">คลาสบันเดิล</span>
          <select name="stockClass" defaultValue="B" className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
            <option value="B">B — ประกอบตามออเดอร์</option>
            <option value="A">A — ประกอบจากของในคลัง</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">ราคาขายของรหัสบันเดิล (บาท)</span>
          <input
            name="sellPriceThb"
            type="number"
            min={0}
            step="0.01"
            required
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
      </div>
      <p className="text-sm text-ink/70">
        เลือกชิ้น A/B เท่านั้น ฟอร์มนี้ไม่แสดงราคาชิ้น — ลูกค้าและเซลล์เห็นราคาของรหัสชุดเท่านั้น
      </p>
      <ul className="space-y-3">
        {lines.map((line) => (
          <li key={line.key} className="grid gap-2 sm:grid-cols-[1fr_6rem_auto]">
            <SkuSearchSelect
              name="componentProductId"
              options={options}
              value={line.productId}
              onChange={(productId) =>
                setLines((current) =>
                  current.map((item) =>
                    item.key === line.key ? { ...item, productId } : item,
                  ),
                )
              }
              required
            />
            <input
              name="componentQty"
              type="number"
              min={1}
              value={line.qty}
              onChange={(event) =>
                setLines((current) =>
                  current.map((item) =>
                    item.key === line.key ? { ...item, qty: event.target.value } : item,
                  ),
                )
              }
              className="rounded border border-forest/20 px-3 py-2 text-sm"
            />
            <button
              type="button"
              className="text-sm text-ink/60 underline-offset-2 hover:underline"
              onClick={() =>
                setLines((current) => current.filter((item) => item.key !== line.key))
              }
            >
              ลบ
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="rounded border border-forest/30 px-3 py-1.5 text-sm"
        onClick={() =>
          setLines((current) => [
            ...current,
            { key: String(Date.now()), productId: "", qty: "1" },
          ])
        }
      >
        เพิ่มรายการ
      </button>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-forest px-4 py-2 text-sm text-paper disabled:opacity-60"
        >
          {pending ? "กำลังสร้าง…" : "สร้างบันเดิล"}
        </button>
      </div>
    </form>
  );
}
