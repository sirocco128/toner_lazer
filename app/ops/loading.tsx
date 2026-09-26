export default function OpsLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="กำลังโหลดคอนโซล">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-forest/10" />
      <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-forest/10" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div
            key={key}
            className="rounded-xl border border-forest/10 bg-paper p-5"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-forest/10" />
            <div className="mt-3 h-8 w-12 animate-pulse rounded bg-forest/10" />
            <div className="mt-3 h-3 w-40 animate-pulse rounded bg-forest/10" />
          </div>
        ))}
      </div>
      <span className="sr-only">กำลังโหลดคอนโซล Smart Gift</span>
    </div>
  );
}
