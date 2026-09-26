import { getOrderRepository } from "@/lib/order-repository";
import {
  FULFILLMENT_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderRecord,
} from "@/lib/order-types";
import { listQuoteRequests, getQuoteByRequestId } from "@/lib/quote-repository";
import { LOGO_DECORATION_OPTIONS } from "@/lib/product-decoration";
import {
  PRODUCT_KIND_LABELS,
  PRODUCT_KINDS,
  classifyProductKind,
  productLabelFromParts,
  type ProductKind,
} from "@/lib/product-kind";
import type { QuoteRequestRecord } from "@/lib/quote-types";

export type CustomerKindSummary = {
  kind: ProductKind;
  label: string;
  orderCount: number;
  quantity: number;
  amount: number;
};

export type CustomerSalesOrderRow = {
  order: OrderRecord;
  kind: ProductKind;
  kindLabel: string;
  productLabel: string;
  decorationLabel: string | null;
  paymentLabel: string;
  fulfillmentLabel: string;
};

export type CustomerSalesHistory = {
  kindsBought: CustomerKindSummary[];
  orders: CustomerSalesOrderRow[];
  inquiredKinds: CustomerKindSummary[];
};

function decorationLabel(method: string | null | undefined): string | null {
  if (!method || method === "not-sure") return null;
  return LOGO_DECORATION_OPTIONS.find((row) => row.value === method)?.label ?? method;
}

function emptyKindMap(): Map<ProductKind, CustomerKindSummary> {
  return new Map(
    PRODUCT_KINDS.map((kind) => [
      kind,
      { kind, label: PRODUCT_KIND_LABELS[kind], orderCount: 0, quantity: 0, amount: 0 },
    ]),
  );
}

function addKind(
  map: Map<ProductKind, CustomerKindSummary>,
  kind: ProductKind,
  qty: number,
  amount: number,
): void {
  const row = map.get(kind);
  if (!row) return;
  row.orderCount += 1;
  row.quantity += qty;
  row.amount += amount;
}

export function buildCustomerSalesHistory(customerId: number): CustomerSalesHistory {
  const orders = getOrderRepository().listOrders({ customerId, limit: 200 });
  const quotes = listQuoteRequests({ customerId, limit: 200 });
  const quoteById = new Map(quotes.map((row) => [row.requestId, row]));
  const bought = emptyKindMap();
  const inquired = emptyKindMap();
  const orderedQuoteIds = new Set(
    orders.map((row) => row.quoteRequestId).filter((id): id is string => Boolean(id)),
  );

  const orderRows: CustomerSalesOrderRow[] = orders.map((order) => {
    const quote = order.quoteRequestId
      ? quoteById.get(order.quoteRequestId)
      : undefined;
    const kind = classifyProductKind({
      productSlug: quote?.productSlug,
      productInterest: quote?.productInterest,
      productSummary: order.productSummary,
    });
    if (order.fulfillmentStatus !== "cancelled") {
      addKind(bought, kind, order.quantity, order.totalAmount);
    }
    return {
      order,
      kind,
      kindLabel: PRODUCT_KIND_LABELS[kind],
      productLabel: productLabelFromParts({
        productSlug: quote?.productSlug,
        productInterest: quote?.productInterest,
        productSummary: order.productSummary,
      }),
      decorationLabel: decorationLabel(quote?.decorationMethod),
      paymentLabel: PAYMENT_STATUS_LABELS[order.paymentStatus],
      fulfillmentLabel: FULFILLMENT_LABELS[order.fulfillmentStatus],
    };
  });

  for (const quote of quotes) {
    if (orderedQuoteIds.has(quote.requestId)) continue;
    const kind = classifyProductKind({
      productSlug: quote.productSlug,
      productInterest: quote.productInterest,
    });
    addKind(inquired, kind, quote.quantity, 0);
  }

  return {
    kindsBought: [...bought.values()].filter((row) => row.orderCount > 0),
    orders: orderRows,
    inquiredKinds: [...inquired.values()].filter((row) => row.orderCount > 0),
  };
}

export function purchaseKindLabelsForCustomers(
  customerIds: number[],
): Map<number, string[]> {
  const result = new Map<number, string[]>();
  if (customerIds.length === 0) return result;
  const idSet = new Set(customerIds);
  const orders = getOrderRepository().listOrders({ limit: 2000 });
  const kindsByCustomer = new Map<number, Set<ProductKind>>();
  const quoteCache = new Map<string, QuoteRequestRecord | null>();
  function quoteFor(requestId: string | null | undefined): QuoteRequestRecord | undefined {
    if (!requestId) return undefined;
    if (!quoteCache.has(requestId)) {
      quoteCache.set(requestId, getQuoteByRequestId(requestId));
    }
    return quoteCache.get(requestId) ?? undefined;
  }

  for (const order of orders) {
    if (order.customerId == null || !idSet.has(order.customerId)) continue;
    if (order.fulfillmentStatus === "cancelled") continue;
    const quote = quoteFor(order.quoteRequestId);
    const kind = classifyProductKind({
      productSlug: quote?.productSlug,
      productInterest: quote?.productInterest,
      productSummary: order.productSummary,
    });
    const set = kindsByCustomer.get(order.customerId) ?? new Set<ProductKind>();
    set.add(kind);
    kindsByCustomer.set(order.customerId, set);
  }

  for (const [id, kinds] of kindsByCustomer) {
    result.set(
      id,
      PRODUCT_KINDS.filter((kind) => kinds.has(kind)).map((kind) => PRODUCT_KIND_LABELS[kind]),
    );
  }
  return result;
}
