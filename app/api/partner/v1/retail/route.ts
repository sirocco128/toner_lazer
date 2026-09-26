import {
  partnerError,
  partnerJson,
  requirePartnerScope,
} from "@/lib/partner-api-http";
import {
  listPartnerCatalogRetail,
  parseCatalogLimit,
} from "@/lib/partner-catalog-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = requirePartnerScope(request, "catalog:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = parseCatalogLimit(url.searchParams.get("limit"));
  const q = (url.searchParams.get("q") || "").trim() || null;

  try {
    const data = await listPartnerCatalogRetail({ q, limit });
    return partnerJson({ ok: true, data });
  } catch {
    return partnerError(503, "catalog unavailable");
  }
}
