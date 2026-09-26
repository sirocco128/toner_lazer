/** Customer CRM types for local ops console (not NextERP). */

export const CUSTOMER_STATUSES = ["active", "inactive"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_TYPES = [
  "company",
  "government",
  "education",
  "agency",
  "individual",
] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  company: "บริษัท",
  government: "ราชการ",
  education: "สถานศึกษา",
  agency: "เอเจนซี",
  individual: "บุคคล",
};

export const CUSTOMER_SOURCES = [
  "web_rfq",
  "line",
  "referral",
  "manual",
  "import",
] as const;
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];

export const CUSTOMER_SOURCE_LABELS: Record<CustomerSource, string> = {
  web_rfq: "เว็บขอใบเสนอราคา",
  line: "ไลน์",
  referral: "แนะนำ",
  manual: "กรอกเอง",
  import: "นำเข้า",
};

export const CONTACT_STATUSES = ["active", "inactive"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export type CustomerRecord = {
  id: number;
  company: string;
  email: string;
  phone: string | null;
  contactName: string | null;
  notes: string | null;
  status: CustomerStatus;
  quoteCount: number;
  lastQuoteAt: string | null;
  lineId: string | null;
  taxId: string | null;
  billingName: string | null;
  billingAddress: string | null;
  billingBranch: string;
  customerType: CustomerType;
  source: CustomerSource;
  tags: string[];
  defaultShipProvince: string | null;
  orderCount: number;
  lastOrderAt: string | null;
  mergedIntoId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerContactRecord = {
  id: number;
  customerId: number;
  name: string | null;
  email: string;
  phone: string | null;
  lineId: string | null;
  lineUserId: string | null;
  lineDisplayName: string | null;
  roleTitle: string | null;
  isPrimary: boolean;
  isBilling: boolean;
  status: ContactStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertCustomerFromQuoteParams = {
  company: string;
  email: string;
  phone: string;
  contactName: string;
  quoteSubmittedAt: string;
  province?: string | null;
  taxId?: string | null;
  billingBranch?: string | null;
};

export type CreateCustomerParams = {
  company: string;
  email: string;
  phone?: string | null;
  contactName?: string | null;
  notes?: string | null;
  status?: CustomerStatus;
  lineId?: string | null;
  taxId?: string | null;
  billingName?: string | null;
  billingAddress?: string | null;
  billingBranch?: string;
  customerType?: CustomerType;
  source?: CustomerSource;
  tags?: string[];
  defaultShipProvince?: string | null;
};

export type UpdateCustomerParams = {
  id: number;
  company?: string;
  phone?: string | null;
  contactName?: string | null;
  notes?: string | null;
  status?: CustomerStatus;
  lineId?: string | null;
  taxId?: string | null;
  billingName?: string | null;
  billingAddress?: string | null;
  billingBranch?: string;
  customerType?: CustomerType;
  source?: CustomerSource;
  tags?: string[];
  defaultShipProvince?: string | null;
};

export type ListCustomersOptions = {
  q?: string;
  status?: CustomerStatus | "all";
  customerType?: CustomerType | "all";
  source?: CustomerSource | "all";
  tag?: string;
  taxReady?: "all" | "ready" | "missing";
  province?: string;
  hasOrders?: "all" | "yes" | "no";
  includeMerged?: boolean;
  limit?: number;
  offset?: number;
};

export type UpsertCustomerContactParams = {
  id?: number;
  customerId: number;
  name?: string | null;
  email: string;
  phone?: string | null;
  lineId?: string | null;
  roleTitle?: string | null;
  isPrimary?: boolean;
  isBilling?: boolean;
  status?: ContactStatus;
  notes?: string | null;
};

export {
  parseOpsTags as parseCustomerTags,
  serializeOpsTags as serializeCustomerTags,
} from "@/lib/ops-tags";

export function isCustomerType(value: string): value is CustomerType {
  return (CUSTOMER_TYPES as readonly string[]).includes(value);
}

export function isCustomerSource(value: string): value is CustomerSource {
  return (CUSTOMER_SOURCES as readonly string[]).includes(value);
}
