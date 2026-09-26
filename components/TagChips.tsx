import Link from "next/link";

export function TagChips({
  tags,
  hrefBase,
}: {
  tags: string[];
  /** e.g. `/ops/orders?tag=` — each chip filters that list */
  hrefBase?: string;
}) {
  if (!tags.length) {
    return <span className="text-ink/45">—</span>;
  }
  return (
    <ul className="flex flex-wrap gap-1">
      {tags.map((tag) => {
        const chip = (
          <span className="rounded-full bg-forest-mist px-2 py-0.5 text-xs text-forest">
            {tag}
          </span>
        );
        return (
          <li key={tag}>
            {hrefBase ? (
              <Link
                href={`${hrefBase}${encodeURIComponent(tag)}`}
                className="underline-offset-2 hover:underline"
              >
                {chip}
              </Link>
            ) : (
              chip
            )}
          </li>
        );
      })}
    </ul>
  );
}
