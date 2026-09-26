import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({
  title,
  description,
  actionHref = "/contact",
  actionLabel = "ขอใบเสนอราคา",
}: EmptyStateProps) {
  return (
    <div
      className="mt-12 rounded-3xl border border-dashed border-forest/20 bg-forest-mist/50 px-5 py-12 text-center backdrop-blur-md sm:px-6 sm:py-14"
      role="status"
    >
      <h2 className="text-xl font-bold text-forest">{title}</h2>
      {description ? (
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink/70">
          {description}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={actionHref}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-forest transition hover:bg-brass-soft"
        >
          {actionLabel}
        </Link>
        <Link
          href="/premium-giftset"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest transition hover:bg-paper"
        >
          ดูชุดของขวัญองค์กร
        </Link>
      </div>
    </div>
  );
}
