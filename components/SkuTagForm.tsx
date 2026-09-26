"use client";

import { useActionState } from "react";
import { updateSkuTagsAction } from "@/app/actions/ops-products";
import type { OpsActionResult } from "@/app/actions/ops";
import { OpsTagField } from "@/components/OpsTagField";

const initial: OpsActionResult | null = null;

export function SkuTagForm({
  productId,
  tags,
  suggestions,
}: {
  productId: string;
  tags: string[];
  suggestions: string[];
}) {
  const [state, action, pending] = useActionState(updateSkuTagsAction, initial);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-forest/15 bg-paper p-4">
      <input type="hidden" name="productId" value={productId} />
      <OpsTagField
        key={tags.join(",")}
        defaultTags={tags}
        suggestions={suggestions}
        label="แท็กสินค้า"
        hint="เก็บใน SmartGift MySQL ไม่ใช่แท็กลูกค้า/ออเดอร์"
      />
      {state?.ok ? <p className="text-sm text-forest">บันทึกแท็กแล้ว</p> : null}
      {state && !state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-forest px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : "บันทึกแท็ก"}
      </button>
    </form>
  );
}
