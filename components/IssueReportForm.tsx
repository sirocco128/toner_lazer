"use client";

import { useActionState } from "react";
import {
  submitPublicIssue,
  type IssueActionState,
} from "@/app/actions/issues";
import {
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_LABELS,
  type IssueCategory,
} from "@/lib/ops-cycle-types";
import { ISSUE_REPORT_INTRO } from "@/lib/ux-copy";
import { cn } from "@/lib/utils";

const initial: IssueActionState = { ok: false };

export type IssuePrefill = {
  orderId: string;
  token: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
};

export function IssueReportForm({
  prefill = null,
}: {
  prefill?: IssuePrefill | null;
}) {
  const [state, action, pending] = useActionState(submitPublicIssue, initial);
  const locked = Boolean(prefill?.orderId && prefill?.token);

  if (state.ok && state.issueId) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-forest/20 bg-forest-mist/50 p-6"
      >
        <p className="text-lg font-semibold text-forest">รับเรื่องแล้ว</p>
        <p className="mt-2 text-sm text-ink/80">
          เลขเรื่อง{" "}
          <span className="font-mono font-semibold">{state.issueId}</span> —
          ทีมจะติดต่อกลับตามข้อมูลที่ให้ไว้ ไม่มีการชำระเงินในขั้นตอนนี้
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {!locked ? (
        <p className="text-sm leading-relaxed text-ink/75">{ISSUE_REPORT_INTRO}</p>
      ) : null}
      {prefill?.token ? (
        <input type="hidden" name="token" value={prefill.token} />
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-forest">ประเภทปัญหา</legend>
        <div className="flex flex-wrap gap-2">
          {ISSUE_CATEGORIES.map((c) => (
            <CategoryChip key={c} value={c} />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">บริษัท / หน่วยงาน</span>
          <input
            name="company"
            defaultValue={prefill?.company ?? ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">ชื่อผู้ติดต่อ</span>
          <input
            name="contactName"
            required
            defaultValue={prefill?.contactName ?? ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">อีเมล</span>
          <input
            name="email"
            type="email"
            defaultValue={prefill?.email ?? ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">โทรศัพท์</span>
          <input
            name="phone"
            defaultValue={prefill?.phone ?? ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">เลขออเดอร์{locked ? "" : " (ถ้ามี)"}</span>
          <input
            name="orderId"
            defaultValue={prefill?.orderId ?? ""}
            readOnly={locked}
            className={cn(
              "mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono",
              locked && "bg-forest-mist/40 text-ink/80",
            )}
            placeholder="เช่น ORD-…"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">หัวข้อ</span>
        <input
          name="title"
          required
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">รายละเอียด</span>
        <textarea
          name="detail"
          required
          rows={5}
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {pending ? "กำลังส่ง…" : "ส่งเรื่อง"}
      </button>
    </form>
  );
}

function CategoryChip({ value }: { value: IssueCategory }) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name="category"
        value={value}
        defaultChecked={value === "other"}
        className="peer sr-only"
      />
      <span className="inline-flex rounded-full border border-forest/20 px-3 py-1.5 text-xs font-medium text-ink/80 transition peer-checked:border-forest peer-checked:bg-forest peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brass">
        {ISSUE_CATEGORY_LABELS[value]}
      </span>
    </label>
  );
}
