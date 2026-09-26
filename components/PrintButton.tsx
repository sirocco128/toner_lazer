"use client";

export function PrintButton({ label = "พิมพ์" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-forest px-3 py-1.5 text-sm text-paper print:hidden"
    >
      {label}
    </button>
  );
}
