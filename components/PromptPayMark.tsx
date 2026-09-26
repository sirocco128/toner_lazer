export function PromptPayMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded bg-[#1BA0E2] px-2 py-0.5 text-[11px] font-bold tracking-wide text-white ${className}`}
    >
      พร้อมเพย์
    </span>
  );
}
