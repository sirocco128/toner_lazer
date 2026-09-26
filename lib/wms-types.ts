export const WMS_LOCATION_KINDS = ["bin", "qc", "staging"] as const;
export type WmsLocationKind = (typeof WMS_LOCATION_KINDS)[number];

export const WMS_MOVEMENT_KINDS = [
  "receive",
  "ship",
  "adjust",
  "transfer_out",
  "transfer_in",
  "reserve",
  "release",
  "consume_reserve",
  "void_receive",
  "qc_hold",
  "cycle_count",
] as const;
export type WmsMovementKind = (typeof WMS_MOVEMENT_KINDS)[number];

export const WMS_RESERVATION_STATUSES = ["open", "released", "consumed"] as const;
export type WmsReservationStatus = (typeof WMS_RESERVATION_STATUSES)[number];

export type WmsWarehouse = {
  id: number;
  warehouseCode: string;
  name: string;
  status: string;
  createdAt: string;
};

export type WmsLocation = {
  id: number;
  locationCode: string;
  warehouseCode: string;
  name: string;
  kind: WmsLocationKind | string;
  status: string;
  createdAt: string;
};

export type WmsBalance = {
  id: number;
  productKey: string;
  locationId: number;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  updatedAt: string;
  locationCode?: string;
  locationName?: string;
  warehouseCode?: string;
};

export type WmsMovement = {
  id: number;
  movementKey: string;
  kind: WmsMovementKind | string;
  productKey: string;
  locationId: number;
  qtyDelta: number;
  qtyReservedDelta: number;
  receiptId: string | null;
  orderId: string | null;
  poId: string | null;
  reservationId: string | null;
  memo: string | null;
  actor: string | null;
  createdAt: string;
};

export type WmsReservation = {
  id: number;
  reservationId: string;
  orderId: string;
  productKey: string;
  locationId: number;
  qty: number;
  status: WmsReservationStatus;
  createdAt: string;
  updatedAt: string;
  consumedAt: string | null;
  releasedAt: string | null;
};

export type WmsCycleCount = {
  id: number;
  countId: string;
  productKey: string;
  locationId: number;
  qtySystem: number;
  qtyCounted: number;
  qtyVariance: number;
  status: string;
  memo: string | null;
  actor: string | null;
  createdAt: string;
};

export const DEFAULT_LOCATION_CODE = "BIN-DEFAULT";
export const QC_LOCATION_CODE = "BIN-QC";
export const XDOCK_LOCATION_CODE = "BIN-XDOCK";

export const RECEIVE_MODES = ["cross_dock", "stock"] as const;
export type ReceiveMode = (typeof RECEIVE_MODES)[number];

export const RECEIVE_MODE_LABELS: Record<ReceiveMode, string> = {
  cross_dock: "Cross-dock — รับแล้วแพ็กส่ง (อย่าขึ้นชั้น)",
  stock: "เก็บเข้าชั้นวาง",
};
