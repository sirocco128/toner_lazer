/** Path helpers for SEO catalog / overlay — kept tiny to avoid import cycles. */

export function normalizeSeoPath(path: string): string {
  const trimmed = path.trim() || "/";
  if (trimmed === "/") return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, "");
}
