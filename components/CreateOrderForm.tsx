"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createOrderFromQuoteAction,
} from "@/app/actions/ops-orders";
import type { OpsActionResult } from "@/app/actions/ops";
import { ThaiAddressFields } from "@/components/ThaiAddressFields";
import type { ThaiMailingParts } from "@/lib/thai-address-format";
import {
  calculateDepositPlan,
  formatThb,
  splitVat,
} from "@/lib/th-billing";

const initial: OpsActionResult | null = null;

export function CreateOrderForm({
  quoteRequestId,
  company,
  defaultSummary,
  defaultQuantity,
  billingName = "",
  billingTaxId = "",
  billingAddress = "",
  billingBranch = "สำนักงานใหญ่",
  shipToName = "",
  shipToPhone = "",
  shipToStreetAddress = "",
  shipToProvince = "",
  shipToDistrict = "",
  shipToSubdistrict = "",
  shipToZip = "",
}: {
  quoteRequestId: string;
  company: string;
  defaultSummary: string;
  defaultQuantity: number;
  billingName?: string;
  billingTaxId?: string;
  billingAddress?: string;
  billingBranch?: string;
  shipToName?: string;
  shipToPhone?: string;
  shipToStreetAddress?: string;
  shipToProvince?: string;
  shipToDistrict?: string;
  shipToSubdistrict?: string;
  shipToZip?: string;
}) {
  const [state, action, pending] = useActionState(
    createOrderFromQuoteAction,
    initial,
  );
  const [amount, setAmount] = useState("");
  const [vatMode, setVatMode] = useState<"exclusive" | "inclusive">("exclusive");
  const [depositMode, setDepositMode] = useState<"auto" | "percent" | "full">(
    "auto",
  );
  const [percent, setPercent] = useState("50");
  const [shipTo, setShipTo] = useState<ThaiMailingParts>({
    streetAddress: shipToStreetAddress,
    province: shipToProvince,
    district: shipToDistrict,
    subdistrict: shipToSubdistrict,
    zip: shipToZip,
  });

  const preview = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      const vat = splitVat({ amount: n, vatMode });
      const deposit = calculateDepositPlan({
        grandTotal: vat.grandTotal,
        mode: depositMode,
        percent: Number(percent) || 50,
      });
      return { vat, deposit };
    } catch {
      return null;
    }
  }, [amount, vatMode, depositMode, percent]);

  return (
    <form action={action} className="mt-6 space-y-4 rounded border border-forest/15 bg-paper p-4">
      <input type="hidden" name="quoteRequestId" value={quoteRequestId} />
      <h2 className="text-lg font-semibold text-forest">เปิดใบสั่งซื้อ / วางบิลมัดจำ</h2>
      <p className="text-sm text-ink/70">
        วงจรรายได้แบบบริษัทจด VAT ในไทย — ราคาสินค้า + ภาษีมูลค่าเพิ่ม 7% จากนั้นระบบคำนวณมัดจำหรือเก็บเต็มจำนวน
      </p>

      <label className="block text-sm">
        <span className="font-medium">ยอดตามใบเสนอราคา (บาท)</span>
        <input
          name="amount"
          type="number"
          min="1"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">ยอดที่กรอก</span>
        <select
          name="vatMode"
          value={vatMode}
          onChange={(e) => setVatMode(e.target.value as "exclusive" | "inclusive")}
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        >
          <option value="exclusive">ยังไม่รวม VAT 7% (มาตรฐานใบกำกับภาษี)</option>
          <option value="inclusive">รวม VAT 7% แล้ว</option>
        </select>
      </label>

      <label className="block text-sm">
        <span className="font-medium">วิธีเก็บมัดจำ</span>
        <select
          name="depositMode"
          value={depositMode}
          onChange={(e) =>
            setDepositMode(e.target.value as "auto" | "percent" | "full")
          }
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        >
          <option value="auto">ให้ระบบคำนวณ (≤ 10,000 บาท เก็บเต็ม / เกินนั้นมัดจำ 50%)</option>
          <option value="percent">กำหนดเปอร์เซ็นต์เอง</option>
          <option value="full">เก็บเต็มจำนวน</option>
        </select>
      </label>

      {depositMode === "percent" ? (
        <label className="block text-sm">
          <span className="font-medium">อัตรามัดจำ (%)</span>
          <input
            name="depositPercent"
            type="number"
            min="1"
            max="100"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
      ) : null}

      <label className="block text-sm">
        <span className="font-medium">รายการสินค้า</span>
        <input
          name="productSummary"
          defaultValue={defaultSummary}
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>
      <input type="hidden" name="quantity" value={defaultQuantity} />

      <label className="block text-sm">
        <span className="font-medium">ชื่อในใบกำกับภาษี (ผู้ซื้อ)</span>
        <input
          name="billingName"
          defaultValue={billingName || company}
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">เลขประจำตัวผู้เสียภาษีผู้ซื้อ (13 หลัก)</span>
        <input
          name="billingTaxId"
          inputMode="numeric"
          maxLength={13}
          defaultValue={billingTaxId}
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">ที่อยู่ผู้ซื้อ (ใบกำกับภาษี)</span>
        <textarea
          name="billingAddress"
          rows={2}
          defaultValue={billingAddress}
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">สาขา</span>
        <input
          name="billingBranch"
          defaultValue={billingBranch || "สำนักงานใหญ่"}
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>
      <p className="text-xs text-ink/60">ดึงจากข้อมูลลูกค้าถ้ามี — คนละส่วนกับที่อยู่จัดส่ง</p>

      <fieldset className="space-y-3 rounded border border-forest/10 p-3">
        <legend className="text-sm font-semibold text-forest">ที่อยู่จัดส่ง</legend>
        <label className="block text-sm">
          <span className="font-medium">ผู้รับ</span>
          <input
            name="shipToName"
            defaultValue={shipToName}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">โทรผู้รับ</span>
          <input
            name="shipToPhone"
            defaultValue={shipToPhone}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
        <ThaiAddressFields
          streetAddress={shipTo.streetAddress}
          province={shipTo.province}
          district={shipTo.district}
          subdistrict={shipTo.subdistrict}
          zip={shipTo.zip}
          onChange={setShipTo}
        />
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="saveBillingDefaults" value="1" defaultChecked />
        บันทึกเป็นค่าเริ่มต้นของลูกค้า
      </label>

      {preview ? (
        <dl className="grid gap-2 rounded bg-forest-mist/50 p-3 text-sm">
          <div className="flex justify-between">
            <dt>มูลค่าสินค้า</dt>
            <dd>{formatThb(preview.vat.subtotalExVat)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>ภาษีมูลค่าเพิ่ม {preview.vat.vatRate}%</dt>
            <dd>{formatThb(preview.vat.vatAmount)}</dd>
          </div>
          <div className="flex justify-between font-semibold text-forest">
            <dt>รวมทั้งสิ้น</dt>
            <dd>{formatThb(preview.vat.grandTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>
              {preview.deposit.collectFull ? "เก็บเต็มจำนวน" : `มัดจำ ${preview.deposit.appliedPercent}%`}
            </dt>
            <dd>{formatThb(preview.deposit.depositAmount)}</dd>
          </div>
          {!preview.deposit.collectFull ? (
            <div className="flex justify-between">
              <dt>ส่วนที่เหลือ (ชำระเมื่อเข้าคลัง)</dt>
              <dd>{formatThb(preview.deposit.remainingAmount)}</dd>
            </div>
          ) : null}
          <p className="text-xs text-ink/65">{preview.deposit.reason}</p>
        </dl>
      ) : null}

      {state && !state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-forest px-4 py-2 text-sm font-medium text-paper disabled:opacity-60"
      >
        {pending ? "กำลังเปิดออเดอร์…" : "เปิดออเดอร์และสร้าง QR พร้อมเพย์"}
      </button>
    </form>
  );
}
