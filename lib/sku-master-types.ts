export const STOCK_CLASSES = ["A", "B", "C", "D"] as const;
export type StockClass = (typeof STOCK_CLASSES)[number];

export const SERIAL_STATUSES = ["on_hand", "moved", "sold"] as const;
export type SkuSerialStatus = (typeof SERIAL_STATUSES)[number];

export const STOCK_CLASS_LABELS: Record<StockClass, string> = {
  A: "มีของในคลัง พร้อมส่ง",
  B: "ไม่มีสต็อก สั่งตามออเดอร์",
  C: "ชำรุด / เคลียร์",
  D: "ซื้อซัพสำรอง ไม่ประจำ",
};

export const STOCK_CLASS_SHORT: Record<StockClass, string> = {
  A: "พร้อมส่ง",
  B: "สั่งผลิต",
  C: "เคลียร์",
  D: "ซัพสำรอง",
};

export const SERIAL_STATUS_LABELS: Record<SkuSerialStatus, string> = {
  on_hand: "ในคลัง",
  moved: "ย้ายแล้ว",
  sold: "ขายแล้ว",
};

export type BasicColor = {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string | null;
  hex: string | null;
  sortOrder: number;
};

export type OriProduct = {
  oriProductId: number;
  oriProductCode: string;
  oriProductNameTh: string;
  oriProductNameEng: string | null;
  colorId: number | null;
  colorNameTh: string | null;
  colorHex: string | null;
  notes: string | null;
  factoryId: number | null;
  /** Factory carton packing — same units as Excel import columns. */
  pcsPerCtn: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  cartonKg: number | null;
  dimsAreCarton: boolean;
  skuIds?: string[];
  displayImageUrl?: string;
};

export type OriListFilter = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type SkuRecord = {
  productId: string;
  stockClass: StockClass;
  runningNo: number;
  oriProductId: number | null;
  oriProductCode: string | null;
  oriProductNameTh: string | null;
  colorNameTh: string | null;
  nameTh: string;
  nameEn: string | null;
  sellPriceThb: number | null;
  isBundle: boolean;
  clearanceReason: string | null;
  catalogSlug: string | null;
  imageUrl: string | null;
  displayImageUrl: string;
  factoryUnitCny: number | null;
  factoryUnitUsd: number | null;
  unitLandedCostThb: number | null;
  forcedMinQty: number | null;
  /** From linked ORI packing (Excel per ctn / L×W×H / carton kg). */
  pcsPerCtn: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  cartonKg: number | null;
  dimsAreCarton: boolean;
  onHandQty: number;
  tags: string[];
};

export type BundleComponentOption = {
  productId: string;
  nameTh: string;
  stockClass: "A" | "B";
  oriProductCode: string | null;
};

export type SkuBundleItem = {
  componentProductId: string;
  qty: number;
  nameTh: string;
  stockClass: StockClass;
};

export type SkuSerial = {
  id: number;
  productId: string;
  serialNo: string;
  status: SkuSerialStatus;
};

export type SkuMove = {
  id: number;
  fromProductId: string;
  toProductId: string;
  serialNo: string;
  defectReason: string;
  clearancePriceThb: number;
  actorEmail: string | null;
  movedAt: string;
};

export type SkuGroup = {
  id: number;
  name: string;
  notes: string | null;
  itemCount: number;
};

export type SkuFileKind = "photo" | "document" | "other";

export type SkuFile = {
  id: number;
  productId: string | null;
  oriProductId: number | null;
  fileKind: SkuFileKind;
  originalName: string;
  objectKey: string;
  bucket: string;
  contentType: string;
  byteSize: number;
  isCover: boolean;
  createdAt: string;
  servePath: string;
};

export type SkuListFilter = {
  stockClass?: StockClass | "";
  tag?: string;
  groupId?: number;
  q?: string;
  limit?: number;
  offset?: number;
};
