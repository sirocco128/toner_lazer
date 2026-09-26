import Link from "next/link";
import { opsPageHref, type OpsPageWindow } from "@/lib/ops-pagination";

type OpsPagerProps = {
  pathname: string;
  params: Record<string, string | undefined>;
  window: OpsPageWindow;
};

function pageItems(totalPages: number, current: number): Array<number | "gap"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: Array<number | "gap"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) items.push("gap");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push("gap");
  items.push(totalPages);
  return items;
}

export function OpsPager({ pathname, params, window }: OpsPagerProps) {
  if (window.total === 0) return null;

  const { page, totalPages, from, to, total } = window;
  const prevHref = page > 1 ? opsPageHref(pathname, params, page - 1) : null;
  const nextHref =
    page < totalPages ? opsPageHref(pathname, params, page + 1) : null;

  return (
    <nav
      className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="หน้าของรายการ"
    >
      <p className="text-sm text-ink/65">
        แสดง {from}–{to} จาก {total} รายการ
      </p>
      {totalPages > 1 ? (
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            {prevHref ? (
              <Link
                href={prevHref}
                className="inline-flex min-h-11 items-center rounded border border-forest/20 px-3 text-sm text-forest"
              >
                ก่อนหน้า
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center rounded border border-forest/10 px-3 text-sm text-ink/35">
                ก่อนหน้า
              </span>
            )}
          </li>
          {pageItems(totalPages, page).map((item, index) =>
            item === "gap" ? (
              <li key={`gap-${index}`} className="px-1 text-ink/40">
                …
              </li>
            ) : (
              <li key={item}>
                <Link
                  href={opsPageHref(pathname, params, item)}
                  aria-current={item === page ? "page" : undefined}
                  className={
                    item === page
                      ? "inline-flex min-h-11 min-w-11 items-center justify-center rounded bg-forest px-3 text-sm font-semibold text-paper"
                      : "inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-forest/20 px-3 text-sm text-forest"
                  }
                >
                  {item}
                </Link>
              </li>
            ),
          )}
          <li>
            {nextHref ? (
              <Link
                href={nextHref}
                className="inline-flex min-h-11 items-center rounded border border-forest/20 px-3 text-sm text-forest"
              >
                ถัดไป
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center rounded border border-forest/10 px-3 text-sm text-ink/35">
                ถัดไป
              </span>
            )}
          </li>
        </ol>
      ) : null}
    </nav>
  );
}
