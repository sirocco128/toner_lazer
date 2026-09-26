export const OPS_LIST_PAGE_SIZE = 50;

export type OpsPageWindow = {
  page: number;
  pageSize: number;
  offset: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
};

export function parseOpsPage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(String(value || "1"), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 9_999);
}

export function opsPageWindow(
  total: number,
  page: number,
  pageSize = OPS_LIST_PAGE_SIZE,
): OpsPageWindow {
  const safeTotal = Math.max(0, total);
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const offset = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageSize,
    offset,
    total: safeTotal,
    totalPages,
    from: safeTotal === 0 ? 0 : offset + 1,
    to: Math.min(offset + pageSize, safeTotal),
  };
}

export function opsPageHref(
  pathname: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value || value === "all") continue;
    qs.set(key, value);
  }
  if (page > 1) qs.set("page", String(page));
  const query = qs.toString();
  return query ? `${pathname}?${query}` : pathname;
}
