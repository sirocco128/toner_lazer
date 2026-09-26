export const FACTORY_PO_STATUSES = [
  "draft",
  "sent",
  "confirmed",
  "producing",
  "shipped",
  "inbound",
  "received",
  "cancelled",
] as const;

export type FactoryPoStatus = (typeof FACTORY_PO_STATUSES)[number];

export const FACTORY_PO_STATUS_LABELS: Record<FactoryPoStatus, string> = {
  draft: "ร่าง",
  sent: "ส่งโรงงานแล้ว",
  confirmed: "โรงงานยืนยันแล้ว",
  producing: "กำลังผลิต",
  shipped: "ออกจากจีนแล้ว",
  inbound: "รอเข้าประเทศ",
  received: "รับเข้าคลังไทยแล้ว",
  cancelled: "ยกเลิก",
};

export const FACTORY_PLATFORMS = [
  "1688",
  "alibaba",
  "factory_direct",
  "other",
] as const;

export type FactoryPlatform = (typeof FACTORY_PLATFORMS)[number];

export const FACTORY_PLATFORM_LABELS: Record<FactoryPlatform, string> = {
  "1688": "1688",
  alibaba: "Alibaba",
  factory_direct: "โรงงานตรง",
  other: "อื่น ๆ",
};

export const FREIGHT_MODES = ["truck", "sea", "air", "other"] as const;
export type FreightMode = (typeof FREIGHT_MODES)[number];

export const FREIGHT_MODE_LABELS: Record<FreightMode, string> = {
  truck: "รถบรรทุก",
  sea: "เรือ",
  air: "เครื่องบิน",
  other: "อื่น ๆ",
};

export const FACTORY_CURRENCIES = ["CNY", "USD"] as const;
export type FactoryCurrency = (typeof FACTORY_CURRENCIES)[number];

export const FACTORY_CURRENCY_LABELS: Record<FactoryCurrency, string> = {
  CNY: "หยวน (CNY)",
  USD: "ดอลลาร์ (USD)",
};

export function isFactoryCurrency(value: string): value is FactoryCurrency {
  return (FACTORY_CURRENCIES as readonly string[]).includes(value);
}

export function factoryCurrencyCode(currency: FactoryCurrency): string {
  return currency;
}

export function factoryCurrencyNoun(currency: FactoryCurrency): string {
  return currency === "USD" ? "ดอลลาร์" : "หยวน";
}

export function factoryFxPairLabel(currency: FactoryCurrency): string {
  return currency === "USD" ? "ดอลลาร์→บาท" : "หยวน→บาท";
}

export function factoryFxPairCode(currency: FactoryCurrency): string {
  return currency === "USD" ? "USD→THB" : "CNY→THB";
}

export type FactoryPoRecord = {
  id: number;
  poId: string;
  orderId: string;
  status: FactoryPoStatus;
  factoryId: number | null;
  factoryName: string;
  factoryContact: string | null;
  factoryPlatform: FactoryPlatform;
  sourceOfferId: string | null;
  productName: string;
  quantity: number;
  color: string | null;
  material: string | null;
  decorationMethod: string | null;
  logoPosition: string | null;
  logoNotes: string | null;
  packagingNotes: string | null;
  qcNotes: string | null;
  factoryCurrency: FactoryCurrency;
  fxCnyThb: number;
  factoryUnitCny: number;
  factoryAmountCny: number;
  factoryThb: number;
  inlandThb: number;
  freightThb: number;
  importDutyThb: number;
  customsFeeThb: number;
  packingThb: number;
  lastMileThb: number;
  landedTotalThb: number;
  freightMode: FreightMode | null;
  shipToName: string | null;
  shipToPhone: string | null;
  shipToAddress: string | null;
  shipToProvince: string | null;
  trackingCn: string | null;
  trackingTh: string | null;
  notes: string | null;
  destinationMode: "warehouse" | "ship_to";
  /** stock = putaway · cross_dock = receive to BIN-XDOCK and pack */
  receiveMode: "stock" | "cross_dock";
  /** ETA Thailand (ISO date or datetime string) */
  asnEta: string | null;
  /** Expected qty from ASN */
  asnQty: number | null;
  /** Container / master B/L / overseas tracking note */
  asnContainer: string | null;
  receivedQty: number;
  createdAt: string;
  updatedAt: string;
};

export type FactoryPoDraft = {
  orderId: string;
  factoryId?: number | null;
  factoryName: string;
  productName: string;
  quantity: number;
  factoryCurrency: FactoryCurrency;
  fxCnyThb: number;
  shipToName: string | null;
  shipToPhone: string | null;
  shipToAddress: string | null;
  shipToProvince: string | null;
  destinationMode: "warehouse" | "ship_to";
  receiveMode?: "stock" | "cross_dock";
};

export type FactoryPoMoneyInput = {
  quantity: number;
  factoryUnitCny: number;
  factoryAmountCny?: number;
  fxCnyThb: number;
  inlandThb: number;
  freightThb: number;
  importDutyThb: number;
  customsFeeThb: number;
  packingThb: number;
  lastMileThb: number;
};

export type FactoryPoCostBuckets = {
  factoryThb: number;
  inlandThb: number;
  freightThb: number;
  importDutyThb: number;
  customsFeeThb: number;
  packingThb: number;
  lastMileThb: number;
  factoryAmountCny: number;
  factoryThbComputed: number;
  productCostThb: number;
  cogsThb: number;
  sellingExpenseThb: number;
  landedTotalThb: number;
};

export function isFactoryPoStatus(value: string): value is FactoryPoStatus {
  return (FACTORY_PO_STATUSES as readonly string[]).includes(value);
}

export function isFactoryPlatform(value: string): value is FactoryPlatform {
  return (FACTORY_PLATFORMS as readonly string[]).includes(value);
}

export function isFreightMode(value: string): value is FreightMode {
  return (FREIGHT_MODES as readonly string[]).includes(value);
}
