import { getDb } from "@/lib/database";
import {
  isFactoryCurrency,
  type FactoryPlatform,
  type FactoryPoRecord,
  type FactoryPoStatus,
  type FreightMode,
} from "@/lib/factory-po-types";

type FactoryPoRow = {
  id: number;
  po_id: string;
  order_id: string;
  status: string;
  factory_id?: number | null;
  factory_name: string;
  factory_contact: string | null;
  factory_platform: string;
  source_offer_id: string | null;
  product_name: string;
  quantity: number;
  color: string | null;
  material: string | null;
  decoration_method: string | null;
  logo_position: string | null;
  logo_notes: string | null;
  packaging_notes: string | null;
  qc_notes: string | null;
  factory_currency?: string | null;
  fx_cny_thb: number;
  factory_unit_cny: number;
  factory_amount_cny: number;
  factory_thb: number;
  inland_thb: number;
  freight_thb: number;
  import_duty_thb: number;
  customs_fee_thb: number;
  packing_thb: number;
  last_mile_thb: number;
  landed_total_thb: number;
  freight_mode: string | null;
  ship_to_name: string | null;
  ship_to_phone: string | null;
  ship_to_address: string | null;
  ship_to_province: string | null;
  tracking_cn: string | null;
  tracking_th: string | null;
  notes: string | null;
  destination_mode?: string | null;
  received_qty?: number | null;
  receive_mode?: string | null;
  asn_eta?: string | null;
  asn_qty?: number | null;
  asn_container?: string | null;
  created_at: string;
  updated_at: string;
};

export type InsertFactoryPoParams = Omit<
  FactoryPoRecord,
  | "id"
  | "destinationMode"
  | "receivedQty"
  | "receiveMode"
  | "asnEta"
  | "asnQty"
  | "asnContainer"
>;

function mapPo(row: FactoryPoRow): FactoryPoRecord {
  return {
    id: row.id,
    poId: row.po_id,
    orderId: row.order_id,
    status: row.status as FactoryPoStatus,
    factoryId: row.factory_id == null ? null : Number(row.factory_id),
    factoryName: row.factory_name,
    factoryContact: row.factory_contact,
    factoryPlatform: row.factory_platform as FactoryPlatform,
    sourceOfferId: row.source_offer_id,
    productName: row.product_name,
    quantity: row.quantity,
    color: row.color,
    material: row.material,
    decorationMethod: row.decoration_method,
    logoPosition: row.logo_position,
    logoNotes: row.logo_notes,
    packagingNotes: row.packaging_notes,
    qcNotes: row.qc_notes,
    factoryCurrency: isFactoryCurrency(String(row.factory_currency || "CNY"))
      ? (String(row.factory_currency || "CNY") as "CNY" | "USD")
      : "CNY",
    fxCnyThb: row.fx_cny_thb,
    factoryUnitCny: row.factory_unit_cny,
    factoryAmountCny: row.factory_amount_cny,
    factoryThb: row.factory_thb,
    inlandThb: row.inland_thb,
    freightThb: row.freight_thb,
    importDutyThb: row.import_duty_thb,
    customsFeeThb: row.customs_fee_thb,
    packingThb: row.packing_thb,
    lastMileThb: row.last_mile_thb,
    landedTotalThb: row.landed_total_thb,
    freightMode: (row.freight_mode as FreightMode | null) ?? null,
    shipToName: row.ship_to_name,
    shipToPhone: row.ship_to_phone,
    shipToAddress: row.ship_to_address,
    shipToProvince: row.ship_to_province,
    trackingCn: row.tracking_cn,
    trackingTh: row.tracking_th,
    notes: row.notes,
    destinationMode: row.destination_mode === "ship_to" ? "ship_to" : "warehouse",
    receiveMode: row.receive_mode === "stock" ? "stock" : "cross_dock",
    asnEta: row.asn_eta ?? null,
    asnQty:
      row.asn_qty == null || !Number.isFinite(Number(row.asn_qty))
        ? null
        : Math.floor(Number(row.asn_qty)),
    asnContainer: row.asn_container ?? null,
    receivedQty: row.received_qty ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function insertFactoryPo(params: InsertFactoryPoParams): FactoryPoRecord {
  getDb()
    .prepare(
      `INSERT INTO factory_pos (
        po_id, order_id, status, factory_id, factory_name, factory_contact, factory_platform,
        source_offer_id, product_name, quantity, color, material, decoration_method,
        logo_position, logo_notes, packaging_notes, qc_notes, factory_currency, fx_cny_thb,
        factory_unit_cny, factory_amount_cny, factory_thb, inland_thb, freight_thb,
        import_duty_thb, customs_fee_thb, packing_thb, last_mile_thb, landed_total_thb,
        freight_mode, ship_to_name, ship_to_phone, ship_to_address, ship_to_province,
        tracking_cn, tracking_th, notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
    )
    .run(
      params.poId,
      params.orderId,
      params.status,
      params.factoryId,
      params.factoryName,
      params.factoryContact,
      params.factoryPlatform,
      params.sourceOfferId,
      params.productName,
      params.quantity,
      params.color,
      params.material,
      params.decorationMethod,
      params.logoPosition,
      params.logoNotes,
      params.packagingNotes,
      params.qcNotes,
      params.factoryCurrency,
      params.fxCnyThb,
      params.factoryUnitCny,
      params.factoryAmountCny,
      params.factoryThb,
      params.inlandThb,
      params.freightThb,
      params.importDutyThb,
      params.customsFeeThb,
      params.packingThb,
      params.lastMileThb,
      params.landedTotalThb,
      params.freightMode,
      params.shipToName,
      params.shipToPhone,
      params.shipToAddress,
      params.shipToProvince,
      params.trackingCn,
      params.trackingTh,
      params.notes,
      params.createdAt,
      params.updatedAt,
    );
  const row = getFactoryPoByPoId(params.poId);
  if (!row) throw new Error("factory_po_insert_failed");
  return row;
}

export function updateFactoryPo(params: InsertFactoryPoParams): FactoryPoRecord {
  getDb()
    .prepare(
      `UPDATE factory_pos SET
        order_id = ?, status = ?, factory_id = ?, factory_name = ?, factory_contact = ?,
        factory_platform = ?, source_offer_id = ?, product_name = ?, quantity = ?,
        color = ?, material = ?, decoration_method = ?, logo_position = ?,
        logo_notes = ?, packaging_notes = ?, qc_notes = ?, factory_currency = ?, fx_cny_thb = ?,
        factory_unit_cny = ?, factory_amount_cny = ?, factory_thb = ?, inland_thb = ?,
        freight_thb = ?, import_duty_thb = ?, customs_fee_thb = ?, packing_thb = ?,
        last_mile_thb = ?, landed_total_thb = ?, freight_mode = ?, ship_to_name = ?,
        ship_to_phone = ?, ship_to_address = ?, ship_to_province = ?, tracking_cn = ?,
        tracking_th = ?, notes = ?, updated_at = ?
      WHERE po_id = ?`,
    )
    .run(
      params.orderId,
      params.status,
      params.factoryId,
      params.factoryName,
      params.factoryContact,
      params.factoryPlatform,
      params.sourceOfferId,
      params.productName,
      params.quantity,
      params.color,
      params.material,
      params.decorationMethod,
      params.logoPosition,
      params.logoNotes,
      params.packagingNotes,
      params.qcNotes,
      params.factoryCurrency,
      params.fxCnyThb,
      params.factoryUnitCny,
      params.factoryAmountCny,
      params.factoryThb,
      params.inlandThb,
      params.freightThb,
      params.importDutyThb,
      params.customsFeeThb,
      params.packingThb,
      params.lastMileThb,
      params.landedTotalThb,
      params.freightMode,
      params.shipToName,
      params.shipToPhone,
      params.shipToAddress,
      params.shipToProvince,
      params.trackingCn,
      params.trackingTh,
      params.notes,
      params.updatedAt,
      params.poId,
    );
  const row = getFactoryPoByPoId(params.poId);
  if (!row) throw new Error("factory_po_not_found");
  return row;
}

export function patchFactoryPoAsn(params: {
  poId: string;
  receiveMode: "stock" | "cross_dock";
  asnEta: string | null;
  asnQty: number | null;
  asnContainer: string | null;
  at: string;
}): void {
  getDb()
    .prepare(
      `UPDATE factory_pos
       SET receive_mode = ?, asn_eta = ?, asn_qty = ?, asn_container = ?, updated_at = ?
       WHERE po_id = ?`,
    )
    .run(
      params.receiveMode,
      params.asnEta,
      params.asnQty,
      params.asnContainer,
      params.at,
      params.poId,
    );
}

export function getFactoryPoByPoId(poId: string): FactoryPoRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM factory_pos WHERE po_id = ?`)
    .get(poId) as FactoryPoRow | undefined;
  return row ? mapPo(row) : null;
}

export function listFactoryPosByOrder(orderId: string): FactoryPoRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM factory_pos WHERE order_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .all(orderId) as FactoryPoRow[];
  return rows.map(mapPo);
}

export function listFactoryPos(params?: {
  q?: string;
  status?: FactoryPoStatus | "all";
  limit?: number;
}): FactoryPoRecord[] {
  const q = (params?.q || "").trim();
  const status = params?.status ?? "all";
  const limit = Math.min(200, Math.max(1, params?.limit ?? 80));
  const clauses: string[] = [];
  const binds: (string | number)[] = [];
  if (status !== "all") {
    clauses.push("status = ?");
    binds.push(status);
  }
  if (q) {
    clauses.push(
      `(po_id LIKE ? OR order_id LIKE ? OR factory_name LIKE ? OR product_name LIKE ? OR source_offer_id LIKE ? OR EXISTS (
         SELECT 1 FROM factories f WHERE f.id = factory_pos.factory_id
           AND (f.factory_code LIKE ? OR f.name LIKE ?)
       ))`,
    );
    const like = `%${q}%`;
    binds.push(like, like, like, like, like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(
      `SELECT * FROM factory_pos ${where} ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all(...binds, limit) as FactoryPoRow[];
  return rows.map(mapPo);
}

export function listFactoryPosByFactoryId(factoryId: number): FactoryPoRecord[] {
  if (!Number.isInteger(factoryId) || factoryId < 1) return [];
  const rows = getDb()
    .prepare(
      `SELECT * FROM factory_pos WHERE factory_id = ? ORDER BY created_at DESC, id DESC LIMIT 80`,
    )
    .all(factoryId) as FactoryPoRow[];
  return rows.map(mapPo);
}

/** Open factory POs still waiting on goods — for the ops overview card. */
export function countOpenInboundPos(): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM factory_pos
       WHERE status NOT IN ('cancelled', 'draft', 'received')
         AND COALESCE(received_qty, 0) < quantity`,
    )
    .get() as { n: number } | undefined;
  return Number(row?.n ?? 0);
}
