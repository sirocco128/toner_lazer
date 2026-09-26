"use client";

import { useActionState } from "react";
import { updateEntityTagsAction } from "@/app/actions/ops-tags";
import type { OpsActionResult } from "@/app/actions/ops";
import { OpsTagField } from "@/components/OpsTagField";
import type { OpsTagEntityType } from "@/lib/ops-tags";

const initial: OpsActionResult | null = null;

export function EntityTagForm({
  entityType,
  entityId,
  tags,
  suggestions,
  label,
  hint,
  readOnly,
  compact,
}: {
  entityType: OpsTagEntityType;
  entityId: string;
  tags: string[];
  suggestions: string[];
  label: string;
  hint?: string;
  readOnly?: boolean;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(updateEntityTagsAction, initial);

  if (readOnly) {
    return (
      <div className={compact ? "" : "rounded-xl border border-forest/15 bg-paper p-4"}>
        <p className="text-sm font-medium text-forest">{label}</p>
        <p className="mt-2 text-sm text-ink/70">
          {tags.length ? tags.join(" · ") : "ยังไม่มีแท็ก"}
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className={
        compact
          ? "space-y-2"
          : "space-y-3 rounded-xl border border-forest/15 bg-paper p-4"
      }
    >
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <OpsTagField
        key={tags.join(",")}
        defaultTags={tags}
        suggestions={suggestions}
        label={label}
        hint={hint}
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
