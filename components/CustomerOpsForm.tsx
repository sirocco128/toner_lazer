"use client";

import { useActionState } from "react";
import {
  updateCustomerOpsAction,
  type OpsActionResult,
} from "@/app/actions/ops";
import { createCustomerOpsAction } from "@/app/actions/ops-customers";
import { OpsTagField } from "@/components/OpsTagField";
import type { CustomerRecord } from "@/lib/customer-types";
import {
  CUSTOMER_SOURCES,
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
} from "@/lib/customer-types";

const initial: OpsActionResult | null = null;

export function CustomerOpsForm({
  customer,
  readOnly = false,
  mode = "edit",
  tagSuggestions = [],
}: {
  customer?: CustomerRecord;
  readOnly?: boolean;
  mode?: "edit" | "create";
  tagSuggestions?: string[];
}) {
  const action = mode === "create" ? createCustomerOpsAction : updateCustomerOpsAction;
  const [state, formAction, pending] = useActionState(action, initial);

  if (readOnly && customer) {
    return (
      <div className="mt-6 space-y-2 rounded border border-forest/15 bg-paper p-4 text-sm">
        <h2 className="text-lg font-semibold text-forest">ข้อมูลลูกค้า (ดูอย่างเดียว)</h2>
        <p>บริษัท: {customer.company}</p>
        <p>ผู้ติดต่อ: {customer.contactName || "—"}</p>
        <p>โทร: {customer.phone || "—"}</p>
        <p>ไลน์: {customer.lineId || "—"}</p>
        <p>เลขผู้เสียภาษี: {customer.taxId || "—"}</p>
        <p>สถานะ: {customer.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}</p>
        <p>แท็ก: {customer.tags.length ? customer.tags.join(" · ") : "—"}</p>
        <p className="whitespace-pre-wrap">{customer.notes || "ยังไม่มีบันทึก"}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-6 rounded border border-forest/15 bg-paper p-4">
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}
      <h2 className="text-lg font-semibold text-forest">
        {mode === "create" ? "เพิ่มลูกค้า" : "แก้ไขข้อมูลลูกค้า"}
      </h2>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-forest">บริษัทและผู้ติดต่อ</legend>
        <label className="block text-sm">
          <span className="font-medium">บริษัท</span>
          <input
            name="company"
            defaultValue={customer?.company || ""}
            required
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
        {mode === "create" ? (
          <label className="block text-sm">
            <span className="font-medium">อีเมล (คีย์ผู้ติดต่อหลัก)</span>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
        ) : (
          <p className="text-xs text-ink/60">อีเมลหลัก: {customer?.email}</p>
        )}
        <label className="block text-sm">
          <span className="font-medium">ผู้ติดต่อหลัก</span>
          <input
            name="contactName"
            defaultValue={customer?.contactName || ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">โทรศัพท์</span>
            <input
              name="phone"
              defaultValue={customer?.phone || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">ไลน์</span>
            <input
              name="lineId"
              defaultValue={customer?.lineId || ""}
              placeholder="@ หรือชื่อไลน์"
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-forest">ใบกำกับภาษี (ค่าเริ่มต้น)</legend>
        <label className="block text-sm">
          <span className="font-medium">ชื่อในใบกำกับภาษี</span>
          <input
            name="billingName"
            defaultValue={customer?.billingName || customer?.company || ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">เลขประจำตัวผู้เสียภาษี (13 หลัก)</span>
          <input
            name="taxId"
            inputMode="numeric"
            maxLength={13}
            defaultValue={customer?.taxId || ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">ที่อยู่ผู้ซื้อ (ไม่ใช่จังหวัดจัดส่ง)</span>
          <textarea
            name="billingAddress"
            rows={2}
            defaultValue={customer?.billingAddress || ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">สาขา</span>
            <input
              name="billingBranch"
              defaultValue={customer?.billingBranch || "สำนักงานใหญ่"}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">จังหวัดจัดส่งหลัก</span>
            <input
              name="defaultShipProvince"
              defaultValue={customer?.defaultShipProvince || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-forest">จัดกลุ่ม</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium">ประเภท</span>
            <select
              name="customerType"
              defaultValue={customer?.customerType || "company"}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              {CUSTOMER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CUSTOMER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">ที่มา</span>
            <select
              name="source"
              defaultValue={customer?.source || (mode === "create" ? "manual" : "web_rfq")}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              {CUSTOMER_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {CUSTOMER_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">สถานะ</span>
            <select
              name="status"
              defaultValue={customer?.status || "active"}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <OpsTagField
          defaultTags={customer?.tags || []}
          suggestions={tagSuggestions}
          label="แท็ก"
          hint="ติดกับลูกค้านี้ เช่น vip, hr, ปีใหม่ — ไม่โชว์บนใบกำกับหรือใบรับเงิน"
        />
        <label className="block text-sm">
          <span className="font-medium">บันทึกภายใน</span>
          <textarea
            name="notes"
            rows={4}
            defaultValue={customer?.notes || ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
      </fieldset>

      {state?.ok ? <p className="text-sm text-forest">บันทึกแล้ว</p> : null}
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
        {pending ? "กำลังบันทึก…" : mode === "create" ? "สร้างลูกค้า" : "บันทึก"}
      </button>
    </form>
  );
}
