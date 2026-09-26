import {
  listPartnerCatalogRetail,
  parseCatalogLimit,
} from "@/lib/partner-catalog-api";
import { publicOptionsResponse } from "@/lib/public-cors";
import {
  publicError,
  publicJson,
  requirePublicCatalogRate,
} from "@/lib/public-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return publicOptionsResponse(request, "GET, OPTIONS");
}

export async function GET(request: Request) {
  const limited = requirePublicCatalogRate(request);
  if (limited) return limited;

  const url = new URL(request.url);
  const limit = parseCatalogLimit(url.searchParams.get("limit"));
  const q = (url.searchParams.get("q") || "").trim() || null;

  try {
    const data = await listPartnerCatalogRetail({ q, limit });
    return publicJson(request, { ok: true, data });
  } catch {
    return publicError(request, 503, "catalog unavailable");
  }
}
