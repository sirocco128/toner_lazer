export default function FactoryPoLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="กำลังโหลดใบสั่งโรงงาน">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-forest/10" />
      <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-forest/10" />
      <div className="mt-6 h-10 w-full animate-pulse rounded-lg bg-forest/10" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((key) => (
          <div
            key={key}
            className="h-14 animate-pulse rounded-lg border border-forest/10 bg-paper"
          />
        ))}
      </div>
      <span className="sr-only">กำลังโหลดใบสั่งโรงงาน</span>
    </div>
  );
}
