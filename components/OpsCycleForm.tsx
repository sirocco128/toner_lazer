"use client";

import { useActionState } from "react";
import type { OpsActionResult } from "@/app/actions/ops";

const initial: OpsActionResult | null = null;

export function OpsCycleForm({
  action,
  submitLabel,
  children,
  encType,
}: {
  action: (
    prev: OpsActionResult | null,
    formData: FormData,
  ) => Promise<OpsActionResult>;
  submitLabel: string;
  children: React.ReactNode;
  encType?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="space-y-4" encType={encType}>
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}
      {children}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-forest px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : submitLabel}
      </button>
    </form>
  );
}
