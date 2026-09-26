import { site } from "@/lib/site";

export function BrandLogo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        viewBox="0 0 36 36"
        className="h-9 w-9 shrink-0"
        aria-hidden
      >
        <rect width="36" height="36" rx="11" className="fill-forest dark:fill-paper" />
        <path
          d="M18 8.2c-1.7 0-3.1 1.1-3.7 2.6-.6-1.5-2-2.6-3.7-2.6-2.2 0-3.8 1.7-3.8 3.7 0 2.6 2.4 4.4 7.5 7.4 5.1-3 7.5-4.8 7.5-7.4 0-2-1.6-3.7-3.8-3.7Z"
          className="fill-brass"
        />
        <rect x="9" y="18.2" width="18" height="10.2" rx="2.2" className="fill-paper dark:fill-forest" />
        <path d="M17.1 18.2h1.8v10.2h-1.8z" className="fill-brass" />
        <path d="M9 21.4h18v1.6H9z" className="fill-brass/80" />
      </svg>
      <span className="leading-none">
        <span className="block text-[10px] font-medium uppercase tracking-[0.28em] text-ink/55 dark:text-paper/60">
          Smart
        </span>
        <span className="mt-0.5 block text-[1.15rem] font-semibold tracking-tight text-forest dark:text-paper">
          Gift
        </span>
      </span>
      <span className="sr-only">{site.name}</span>
    </span>
  );
}
