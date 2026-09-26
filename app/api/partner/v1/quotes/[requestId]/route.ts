import { getQuoteByRequestId, listQuoteSalesTimeline } from "@/lib/quote-repository";
import { partnerError, partnerJson, requirePartnerScope } from "@/lib/partner-api-http";
import {
  serializePartnerQuote,
  serializePartnerQuoteTimeline,
} from "@/lib/partner-api-serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ requestId: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = requirePartnerScope(request, "quotes:read");
  if (!auth.ok) return auth.response;

  const { requestId: raw } = await params;
  const requestId = (raw || "").trim();
  if (!requestId) return partnerError(400, "invalid requestId");

  const row = getQuoteByRequestId(requestId);
  if (!row) return partnerError(404, "not found");

  return partnerJson({
    ok: true,
    data: serializePartnerQuote(row),
    timeline: listQuoteSalesTimeline(requestId, 20).map(serializePartnerQuoteTimeline),
  });
}
