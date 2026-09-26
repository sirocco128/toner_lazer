import { getDb } from "@/lib/database";
import type { FreightOrigin } from "@/lib/alibaba/types";
import {
  isFactoryCurrency,
  isFactoryPlatform,
} from "@/lib/factory-po-types";
import {
  isFactoryStatus,
  type FactoryRecord,
  type FactoryStatus,
} from "@/lib/factory-registry-types";

type FactoryRow = {
  id: number;
  factory_code: string;
  name: string;
  name_cn: string | null;
  legal_name: string | null;
  platform: string;
  shop_url: string | null;
  shop_id: string | null;
  origin: string | null;
  city: string | null;
  address: string | null;
  contact_name: string | null;
  wechat: string | null;
  phone: string | null;
  email: string | null;
  default_currency: string;
  payment_terms: string | null;
  bank_name: string | null;
  bank_account: string | null;
  alipay: string | null;
  moq_notes: string | null;
  lead_days: number | null;
  qc_notes: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const ORIGINS = new Set<FreightOrigin>(["yiwu", "guangzhou_shenzhen"]);

function mapFactory(row: FactoryRow): FactoryRecord {
  return {
    id: row.id,
    factoryCode: row.factory_code,
    name: row.name,
    nameCn: row.name_cn,
    legalName: row.legal_name,
    platform: isFactoryPlatform(row.platform) ? row.platform : "other",
    shopUrl: row.shop_url,
    shopId: row.shop_id,
    origin: row.origin && ORIGINS.has(row.origin as FreightOrigin)
      ? (row.origin as FreightOrigin)
      : null,
    city: row.city,
    address: row.address,
    contactName: row.contact_name,
    wechat: row.wechat,
    phone: row.phone,
    email: row.email,
    defaultCurrency: isFactoryCurrency(row.default_currency)
      ? row.default_currency
      : "CNY",
    paymentTerms: row.payment_terms,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    alipay: row.alipay,
    moqNotes: row.moq_notes,
    leadDays: row.lead_days == null ? null : Number(row.lead_days),
    qcNotes: row.qc_notes,
    status: isFactoryStatus(row.status) ? row.status : "active",
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type InsertFactoryParams = Omit<FactoryRecord, "id">;

export function getFactoryById(id: number): FactoryRecord | null {
  if (!Number.isInteger(id) || id < 1) return null;
  const row = getDb()
    .prepare(`SELECT * FROM factories WHERE id = ?`)
    .get(id) as FactoryRow | undefined;
  return row ? mapFactory(row) : null;
}

export function getFactoryByCode(code: string): FactoryRecord | null {
  const factoryCode = String(code || "").trim().toUpperCase();
  if (!factoryCode) return null;
  const row = getDb()
    .prepare(`SELECT * FROM factories WHERE factory_code = ?`)
    .get(factoryCode) as FactoryRow | undefined;
  return row ? mapFactory(row) : null;
}

export function listFactories(params?: {
  q?: string;
  status?: FactoryStatus | "all";
  limit?: number;
}): FactoryRecord[] {
  const q = (params?.q || "").trim();
  const status = params?.status ?? "all";
  const limit = Math.min(400, Math.max(1, params?.limit ?? 200));
  const clauses: string[] = [];
  const binds: (string | number)[] = [];
  if (status !== "all") {
    clauses.push("status = ?");
    binds.push(status);
  }
  if (q) {
    const like = `%${q}%`;
    clauses.push(
      `(factory_code LIKE ? OR name LIKE ? OR name_cn LIKE ? OR city LIKE ? OR wechat LIKE ? OR contact_name LIKE ?)`,
    );
    binds.push(like, like, like, like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(
      `SELECT * FROM factories ${where} ORDER BY status ASC, name ASC, id ASC LIMIT ?`,
    )
    .all(...binds, limit) as FactoryRow[];
  return rows.map(mapFactory);
}

export function listFactoriesForPicker(): FactoryRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM factories
       WHERE status IN ('active', 'paused')
       ORDER BY status ASC, name ASC, id ASC
       LIMIT 400`,
    )
    .all() as FactoryRow[];
  return rows.map(mapFactory);
}

export function nextFactoryCode(): string {
  const row = getDb()
    .prepare(
      `SELECT factory_code FROM factories
       WHERE factory_code GLOB 'FAC[0-9][0-9][0-9][0-9]*'
       ORDER BY LENGTH(factory_code) DESC, factory_code DESC
       LIMIT 1`,
    )
    .get() as { factory_code: string } | undefined;
  const last = row?.factory_code ? Number(row.factory_code.replace(/^FAC/i, "")) : 0;
  const n = Number.isFinite(last) ? last + 1 : 1;
  return `FAC${String(n).padStart(4, "0")}`;
}

export function insertFactory(params: InsertFactoryParams): FactoryRecord {
  getDb()
    .prepare(
      `INSERT INTO factories (
        factory_code, name, name_cn, legal_name, platform, shop_url, shop_id,
        origin, city, address, contact_name, wechat, phone, email,
        default_currency, payment_terms, bank_name, bank_account, alipay,
        moq_notes, lead_days, qc_notes, status, notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
    )
    .run(
      params.factoryCode,
      params.name,
      params.nameCn,
      params.legalName,
      params.platform,
      params.shopUrl,
      params.shopId,
      params.origin,
      params.city,
      params.address,
      params.contactName,
      params.wechat,
      params.phone,
      params.email,
      params.defaultCurrency,
      params.paymentTerms,
      params.bankName,
      params.bankAccount,
      params.alipay,
      params.moqNotes,
      params.leadDays,
      params.qcNotes,
      params.status,
      params.notes,
      params.createdAt,
      params.updatedAt,
    );
  const saved = getFactoryByCode(params.factoryCode);
  if (!saved) throw new Error("factory_insert_failed");
  return saved;
}

export function updateFactory(params: FactoryRecord): FactoryRecord {
  getDb()
    .prepare(
      `UPDATE factories SET
        factory_code = ?, name = ?, name_cn = ?, legal_name = ?, platform = ?,
        shop_url = ?, shop_id = ?, origin = ?, city = ?, address = ?,
        contact_name = ?, wechat = ?, phone = ?, email = ?, default_currency = ?,
        payment_terms = ?, bank_name = ?, bank_account = ?, alipay = ?,
        moq_notes = ?, lead_days = ?, qc_notes = ?, status = ?, notes = ?,
        updated_at = ?
       WHERE id = ?`,
    )
    .run(
      params.factoryCode,
      params.name,
      params.nameCn,
      params.legalName,
      params.platform,
      params.shopUrl,
      params.shopId,
      params.origin,
      params.city,
      params.address,
      params.contactName,
      params.wechat,
      params.phone,
      params.email,
      params.defaultCurrency,
      params.paymentTerms,
      params.bankName,
      params.bankAccount,
      params.alipay,
      params.moqNotes,
      params.leadDays,
      params.qcNotes,
      params.status,
      params.notes,
      params.updatedAt,
      params.id,
    );
  const saved = getFactoryById(params.id);
  if (!saved) throw new Error("factory_not_found");
  return saved;
}

export function countPosForFactory(factoryId: number): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM factory_pos WHERE factory_id = ?`)
    .get(factoryId) as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export type FactoryListRow = FactoryRecord & { poCount: number };

export function listFactoriesWithPoCount(params?: {
  q?: string;
  status?: FactoryStatus | "all";
}): FactoryListRow[] {
  const rows = listFactories(params);
  return rows.map((factory) => ({
    ...factory,
    poCount: countPosForFactory(factory.id),
  }));
}
