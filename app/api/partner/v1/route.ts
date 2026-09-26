import {
  PARTNER_API_VERSION,
  authenticatePartner,
  partnerError,
  partnerJson,
} from "@/lib/partner-api-http";
import { PARTNER_SCOPES } from "@/lib/partner-api-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = authenticatePartner(request);
  if (!auth.ok) return auth.response;
  if (
    !auth.principal.scopes.includes("quotes:read") &&
    !auth.principal.scopes.includes("orders:read") &&
    !auth.principal.scopes.includes("catalog:read")
  ) {
    return partnerError(403, "forbidden");
  }

  return partnerJson({
    ok: true,
    version: PARTNER_API_VERSION,
    scopes: PARTNER_SCOPES,
    resources: [
      {
        method: "GET",
        path: "/api/partner/v1/quotes",
        scope: "quotes:read",
        query: ["updated_since", "cursor", "limit"],
      },
      {
        method: "GET",
        path: "/api/partner/v1/quotes/{requestId}",
        scope: "quotes:read",
      },
      {
        method: "GET",
        path: "/api/partner/v1/orders",
        scope: "orders:read",
        query: ["updated_since", "cursor", "limit"],
      },
      {
        method: "GET",
        path: "/api/partner/v1/orders/{orderId}",
        scope: "orders:read",
      },
      {
        method: "GET",
        path: "/api/partner/v1/products",
        scope: "catalog:read",
        query: ["q", "category", "limit"],
      },
      {
        method: "GET",
        path: "/api/partner/v1/promotions",
        scope: "catalog:read",
        query: ["limit"],
      },
      {
        method: "GET",
        path: "/api/partner/v1/retail",
        scope: "catalog:read",
        query: ["q", "limit"],
      },
    ],
  });
}
