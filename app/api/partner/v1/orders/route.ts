import {
  partnerError,
  partnerJson,
  requirePartnerScope,
} from "@/lib/partner-api-http";
import {
  decodePartnerCursor,
  listPartnerOrderPage,
  parsePartnerLimit,
} from "@/lib/partner-api-query";
import { serializePartnerOrder } from "@/lib/partner-api-serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = requirePartnerScope(request, "orders:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const updatedSince = (url.searchParams.get("updated_since") || "").trim() || null;
  const cursor = decodePartnerCursor(url.searchParams.get("cursor"));
  if (url.searchParams.get("cursor") && !cursor) {
    return partnerError(400, "invalid cursor");
  }
  const limit = parsePartnerLimit(url.searchParams.get("limit"));
  const page = listPartnerOrderPage({ updatedSince, cursor, limit });

  return partnerJson({
    ok: true,
    data: page.rows.map(serializePartnerOrder),
    nextCursor: page.nextCursor,
  });
}
