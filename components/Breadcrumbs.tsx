import Link from "next/link";

export type BreadcrumbItem = {
  href?: string;
  label: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (!items.length) return null;

  return (
    <nav aria-label="เส้นทางหน้า" className="mb-6 text-sm text-ink/60">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="transition hover:text-forest">
            หน้าแรก
          </Link>
        </li>
        {items.map((item) => (
          <li key={`${item.href ?? ""}-${item.label}`} className="flex items-center gap-1.5">
            <span aria-hidden className="text-ink/30">
              /
            </span>
            {item.href ? (
              <Link href={item.href} className="transition hover:text-forest">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-forest">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
