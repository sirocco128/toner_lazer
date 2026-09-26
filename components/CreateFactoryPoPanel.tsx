"use client";

import { useState } from "react";
import { FactoryPoForm } from "@/components/FactoryPoForm";
import type { FactoryPoDraft } from "@/lib/factory-po-types";
import type { FactoryPickerOption } from "@/lib/factory-registry-types";

export function CreateFactoryPoPanel({
  orderId,
  defaults,
  factories = [],
}: {
  orderId: string;
  defaults: FactoryPoDraft;
  factories?: FactoryPickerOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={
          open
            ? "text-sm text-forest underline-offset-2 hover:underline"
            : "rounded bg-forest px-3 py-1.5 text-sm text-paper"
        }
      >
        {open ? "ซ่อนฟอร์ม" : "สร้างใบสั่งโรงงาน"}
      </button>
      {open ? (
        <div className="basis-full">
          <FactoryPoForm orderId={orderId} defaults={defaults} factories={factories} />
        </div>
      ) : null}
    </>
  );
}
