import type {
  OrderEventRecord,
  OrderRecord,
  PaymentRecord,
  BillingDocumentRecord,
} from "@/lib/order-types";
import type { QuoteRequestRecord, QuoteSalesTimelineEntry } from "@/lib/quote-types";
import type {
  PartnerBillingDocument,
  PartnerOrder,
  PartnerOrderEvent,
  PartnerPayment,
  PartnerQuote,
  PartnerQuoteTimelineEntry,
} from "@/lib/partner-api-types";

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function leadExtras(rawPayload: string): {
  streetAddress: string | null;
  district: string | null;
  subdistrict: string | null;
  zip: string | null;
  taxId: string | null;
} {
  try {
    const parsed = JSON.parse(rawPayload) as Record<string, unknown>;
    return {
      streetAddress: asOptionalString(parsed.streetAddress),
      district: asOptionalString(parsed.district),
      subdistrict: asOptionalString(parsed.subdistrict),
      zip: asOptionalString(parsed.zip),
      taxId: asOptionalString(parsed.taxId),
    };
  } catch {
    return {
      streetAddress: null,
      district: null,
      subdistrict: null,
      zip: null,
      taxId: null,
    };
  }
}

export function serializePartnerQuote(row: QuoteRequestRecord): PartnerQuote {
  const extras = leadExtras(row.rawPayload);
  return {
    requestId: row.requestId,
    submittedAt: row.submittedAt,
    leadStatus: row.leadStatus,
    webhookStatus: row.webhookStatus,
    webhookDeliveredAt: row.webhookDeliveredAt,
    customerId: row.customerId,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    quantity: row.quantity,
    budgetPerSet: row.budgetPerSet,
    neededDate: row.neededDate,
    streetAddress: extras.streetAddress,
    province: row.province,
    district: extras.district,
    subdistrict: extras.subdistrict,
    zip: extras.zip,
    taxId: extras.taxId,
    billingBranch: row.billingBranch,
    productInterest: row.productInterest,
    productSlug: row.productSlug,
    decorationMethod: row.decorationMethod,
    detail: row.detail,
    consentAt: row.consentAt,
    landingPath: row.landingPath,
    referrer: row.referrer,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    utmTerm: row.utmTerm,
    utmContent: row.utmContent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializePartnerQuoteTimeline(
  entry: QuoteSalesTimelineEntry,
): PartnerQuoteTimelineEntry {
  return {
    createdAt: entry.createdAt,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    note: entry.note,
  };
}

export function serializePartnerOrder(row: OrderRecord): PartnerOrder {
  return {
    orderId: row.orderId,
    quoteRequestId: row.quoteRequestId,
    customerId: row.customerId,
    company: row.company,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    billingName: row.billingName,
    billingTaxId: row.billingTaxId,
    billingAddress: row.billingAddress,
    billingBranch: row.billingBranch,
    shipToName: row.shipToName,
    shipToPhone: row.shipToPhone,
    shipToAddress: row.shipToAddress,
    shipToProvince: row.shipToProvince,
    productSummary: row.productSummary,
    quantity: row.quantity,
    currency: row.currency,
    vatRate: row.vatRate,
    vatMode: row.vatMode,
    subtotalExVat: row.subtotalExVat,
    vatAmount: row.vatAmount,
    totalAmount: row.totalAmount,
    depositMode: row.depositMode,
    depositPercent: row.depositPercent,
    depositAmount: row.depositAmount,
    remainingAmount: row.remainingAmount,
    paidAmount: row.paidAmount,
    paymentStatus: row.paymentStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializePartnerPayment(row: PaymentRecord): PartnerPayment {
  return {
    paymentId: row.paymentId,
    kind: row.kind,
    amount: row.amount,
    method: row.method,
    status: row.status,
    customerReference: row.customerReference,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializePartnerDocument(
  row: BillingDocumentRecord,
): PartnerBillingDocument {
  return {
    documentId: row.documentId,
    documentType: row.documentType,
    status: row.status,
    subtotalExVat: row.subtotalExVat,
    vatAmount: row.vatAmount,
    grandTotal: row.grandTotal,
    issuedAt: row.issuedAt,
    voidedAt: row.voidedAt,
  };
}

export function serializePartnerOrderEvent(row: OrderEventRecord): PartnerOrderEvent {
  return {
    eventType: row.eventType,
    message: row.message,
    createdAt: row.createdAt,
  };
}
