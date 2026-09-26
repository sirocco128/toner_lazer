"use client";

import { useActionState } from "react";
import {
  createLineLinkTokenAction,
  upsertCustomerContactAction,
} from "@/app/actions/ops-customers";
import type { OpsActionResult } from "@/app/actions/ops";
import type { CustomerContactRecord } from "@/lib/customer-types";

const initial: OpsActionResult | null = null;

export function CustomerContactsPanel({
  customerId,
  contacts,
  readOnly,
  lineOaEnabled,
}: {
  customerId: number;
  contacts: CustomerContactRecord[];
  readOnly: boolean;
  lineOaEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    upsertCustomerContactAction,
    initial,
  );
  const [tokenState, tokenAction, tokenPending] = useActionState(
    createLineLinkTokenAction,
    initial,
  );

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-forest">ผู้ติดต่อ</h2>
      <ul className="mt-3 divide-y divide-forest/10 border-t border-forest/10">
        {contacts.length === 0 ? (
          <li className="py-4 text-sm text-ink/60">ยังไม่มีผู้ติดต่อ</li>
        ) : (
          contacts.map((c) => (
            <li key={c.id} className="py-3 text-sm">
              <p className="font-medium">
                {c.name || c.email}
                {c.isPrimary ? (
                  <span className="ml-2 text-xs text-forest">หลัก</span>
                ) : null}
                {c.isBilling ? (
                  <span className="ml-2 text-xs text-ink/55">วางบิล</span>
                ) : null}
              </p>
              <p className="text-ink/70">
                {c.email}
                {c.phone ? ` · ${c.phone}` : ""}
                {c.lineId ? ` · ไลน์ ${c.lineId}` : ""}
              </p>
              {c.lineUserId ? (
                <p className="text-xs text-forest">เชื่อม LINE OA แล้ว</p>
              ) : null}
              {c.roleTitle ? <p className="text-xs text-ink/55">{c.roleTitle}</p> : null}
            </li>
          ))
        )}
      </ul>

      {!readOnly ? (
        <form action={action} className="mt-4 grid gap-3 rounded border border-forest/15 bg-paper p-4 sm:grid-cols-2">
          <input type="hidden" name="customerId" value={customerId} />
          <h3 className="sm:col-span-2 text-sm font-semibold text-forest">เพิ่มผู้ติดต่อ</h3>
          <label className="text-sm">
            ชื่อ
            <input name="name" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
          <label className="text-sm">
            อีเมล
            <input name="email" type="email" required className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
          <label className="text-sm">
            โทร
            <input name="phone" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
          <label className="text-sm">
            ไลน์
            <input name="lineId" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
          <label className="text-sm">
            ตำแหน่ง
            <input name="roleTitle" placeholder="จัดซื้อ / การตลาด" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isPrimary" value="1" />
              ผู้ติดต่อหลัก
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isBilling" value="1" />
              ผู้รับวางบิล
            </label>
          </div>
          {state && !state.ok ? (
            <p className="sm:col-span-2 text-sm text-red-700">{state.error}</p>
          ) : null}
          {state?.ok ? <p className="sm:col-span-2 text-sm text-forest">บันทึกผู้ติดต่อแล้ว</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-forest px-4 py-2 text-sm font-medium text-paper disabled:opacity-60"
          >
            {pending ? "กำลังบันทึก…" : "เพิ่มผู้ติดต่อ"}
          </button>
        </form>
      ) : null}

      {lineOaEnabled && !readOnly && contacts.length > 0 ? (
        <form action={tokenAction} className="mt-4 rounded border border-dashed border-forest/25 p-4 text-sm">
          <input type="hidden" name="customerId" value={customerId} />
          <p className="font-medium text-forest">เชื่อมไลน์ทางการ</p>
          <p className="mt-1 text-ink/65">
            สร้างรหัสแล้วให้ลูกค้าส่งรหัสนี้ในแชทไลน์ร้าน เพื่อผูกบัญชี
          </p>
          <label className="mt-2 block">
            ผู้ติดต่อ
            <select name="contactId" className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.email}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={tokenPending}
            className="mt-3 rounded border border-forest px-3 py-1.5 text-sm"
          >
            สร้างรหัสเชื่อมไลน์
          </button>
          {tokenState && !tokenState.ok ? (
            <p className="mt-2 text-red-700">{tokenState.error}</p>
          ) : null}
          {tokenState?.ok && "token" in tokenState && typeof tokenState.token === "string" ? (
            <p className="mt-2 font-mono text-forest">{tokenState.token}</p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
