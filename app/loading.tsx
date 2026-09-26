export default function Loading() {
  return (
    <div
      className="mx-auto max-w-content px-page py-16"
      role="status"
      aria-live="polite"
      aria-label="กำลังโหลด"
    >
      <div className="h-8 w-48 animate-pulse rounded-lg bg-forest-mist" />
      <div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded bg-forest-mist/80" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className="space-y-3">
            <div className="aspect-[4/3] animate-pulse rounded-2xl bg-forest-mist" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-forest-mist" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-forest-mist/70" />
          </div>
        ))}
      </div>
      <span className="sr-only">กำลังโหลดเนื้อหา</span>
    </div>
  );
}
