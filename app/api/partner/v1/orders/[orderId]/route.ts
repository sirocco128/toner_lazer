import { getOrderRepository } from "@/lib/order-repository";
import { partnerError, partnerJson, requirePartnerScope } from "@/lib/partner-api-http";
import {
  serializePartnerDocument,
  serializePartnerOrder,
  serializePartnerOrderEvent,
  serializePartnerPayment,
} from "@/lib/partner-api-serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ orderId: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = requirePartnerScope(request, "orders:read");
  if (!auth.ok) return auth.response;

  const { orderId: raw } = await params;
  const orderId = (raw || "").trim();
  if (!orderId) return partnerError(400, "invalid orderId");

  const repo = getOrderRepository();
  const order = repo.getOrderByOrderId(orderId);
  if (!order) return partnerError(404, "not found");

  return partnerJson({
    ok: true,
    data: serializePartnerOrder(order),
    payments: repo.listPaymentsByOrder(orderId).map(serializePartnerPayment),
    documents: repo.listDocumentsByOrder(orderId).map(serializePartnerDocument),
    events: repo.listEvents(orderId).slice(0, 20).map(serializePartnerOrderEvent),
  });
}
