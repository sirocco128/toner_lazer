import { CATALOG_LOADING } from "@/lib/ux-copy";

type CatalogSkeletonProps = {
  label?: string;
  cards?: number;
};

export function CatalogSkeleton({
  label = CATALOG_LOADING,
  cards = 6,
}: CatalogSkeletonProps) {
  return (
    <div className="mt-8" role="status" aria-live="polite" aria-label={label}>
      <p className="text-sm text-ink/60">{label}</p>
      <p className="mt-1 text-xs text-ink/50">
        ฐานสินค้าอาจใช้เวลาสักครู่ หากนานเกินไป ส่งโจทย์ให้ทีมขายได้เลย
      </p>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }, (_, key) => (
          <li
            key={key}
            className="overflow-hidden rounded-2xl border border-forest/10 bg-paper/80 p-3"
          >
            <div className="media-frame media-frame--card animate-pulse rounded-xl" />
            <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-forest-mist" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-forest-mist/70" />
            <div className="mt-4 h-8 w-full animate-pulse rounded-full bg-forest-mist/80" />
          </li>
        ))}
      </ul>
      <span className="sr-only">{label}</span>
    </div>
  );
}
