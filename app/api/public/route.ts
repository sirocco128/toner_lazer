import { publicOptionsResponse } from "@/lib/public-cors";
import { publicJson } from "@/lib/public-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Discovery for smg-ui public BFF (no API key). */
export async function OPTIONS(request: Request) {
  return publicOptionsResponse(request, "GET, OPTIONS");
}

export async function GET(request: Request) {
  return publicJson(request, {
    ok: true,
    version: "v1",
    base: "https://smartgift.next-dev.net",
    resources: [
      {
        method: "POST",
        path: "/api/public/brief",
        schema: "smartgift-brief/1",
        note: "Maps to quote intake → /ops/quotes",
      },
      {
        method: "GET",
        path: "/api/public/catalog/products",
        query: ["q", "category", "limit"],
      },
      {
        method: "GET",
        path: "/api/public/catalog/promotions",
        query: ["limit"],
      },
      {
        method: "GET",
        path: "/api/public/catalog/retail",
        query: ["q", "limit"],
      },
    ],
    partnerApi: "/api/partner/v1 (server-to-server, API key, no CORS)",
  });
}
