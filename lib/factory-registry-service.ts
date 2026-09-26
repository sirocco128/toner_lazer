import { isCommercialProductId } from "@/lib/sku-master-ids";
import type { FreightOrigin } from "@/lib/alibaba/types";
import {
  getFactoryByCode,
  getFactoryById,
  insertFactory,
  listFactoriesForPicker,
  nextFactoryCode,
  updateFactory,
} from "@/lib/factory-registry-repository";
import {
  isFactoryStatus,
  toFactoryPickerOption,
  type FactoryPickerOption,
  type FactoryRecord,
  type SaveFactoryInput,
} from "@/lib/factory-registry-types";
import {
  isFactoryCurrency,
  isFactoryPlatform,
} from "@/lib/factory-po-types";

const ORIGINS = new Set<FreightOrigin>(["yiwu", "guangzhou_shenzhen"]);

function blankToNull(value: string | null | undefined): string | null {
  const text = String(value || "").trim();
  return text ? text : null;
}

export function normalizeFactoryCode(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

export function assertFactoryCode(code: string): void {
  if (!code) throw new Error("factory_code_required");
  if (code.length > 32) throw new Error("factory_code_too_long");
  if (isCommercialProductId(code)) throw new Error("factory_code_is_sku");
}

export function saveFactory(input: SaveFactoryInput): FactoryRecord {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("factory_name_required");

  const existing = input.id ? getFactoryById(input.id) : null;
  if (input.id && !existing) throw new Error("factory_not_found");

  let factoryCode = normalizeFactoryCode(input.factoryCode || existing?.factoryCode || "");
  if (!factoryCode) factoryCode = nextFactoryCode();
  assertFactoryCode(factoryCode);

  const clash = getFactoryByCode(factoryCode);
  if (clash && clash.id !== existing?.id) throw new Error("factory_code_taken");

  const platformRaw = input.platform || "";
  const platform = isFactoryPlatform(platformRaw)
    ? platformRaw
    : existing?.platform ?? "other";
  const statusRaw = input.status || "";
  const status = isFactoryStatus(statusRaw)
    ? statusRaw
    : existing?.status ?? "active";
  const currencyRaw = input.defaultCurrency || "";
  const defaultCurrency = isFactoryCurrency(currencyRaw)
    ? currencyRaw
    : existing?.defaultCurrency ?? "CNY";
  const originRaw = String(input.origin || "").trim();
  const origin = ORIGINS.has(originRaw as FreightOrigin)
    ? (originRaw as FreightOrigin)
    : null;
  const leadRaw = input.leadDays;
  const leadDays =
    leadRaw == null || Number.isNaN(Number(leadRaw)) || Number(leadRaw) <= 0
      ? null
      : Math.round(Number(leadRaw));

  const now = new Date().toISOString();
  const record = {
    factoryCode,
    name,
    nameCn: blankToNull(input.nameCn),
    legalName: blankToNull(input.legalName),
    platform,
    shopUrl: blankToNull(input.shopUrl),
    shopId: blankToNull(input.shopId),
    origin,
    city: blankToNull(input.city),
    address: blankToNull(input.address),
    contactName: blankToNull(input.contactName),
    wechat: blankToNull(input.wechat),
    phone: blankToNull(input.phone),
    email: blankToNull(input.email),
    defaultCurrency,
    paymentTerms: blankToNull(input.paymentTerms),
    bankName: blankToNull(input.bankName),
    bankAccount: blankToNull(input.bankAccount),
    alipay: blankToNull(input.alipay),
    moqNotes: blankToNull(input.moqNotes),
    leadDays,
    qcNotes: blankToNull(input.qcNotes),
    status,
    notes: blankToNull(input.notes),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (existing) {
    return updateFactory({ ...record, id: existing.id });
  }
  return insertFactory(record);
}

export function listFactoriesForPoForm(currentId?: number | null): FactoryPickerOption[] {
  const rows = listFactoriesForPicker();
  if (currentId) {
    const current = getFactoryById(currentId);
    if (current && !rows.some((row) => row.id === current.id)) {
      rows.unshift(current);
    }
  }
  return rows.map(toFactoryPickerOption);
}

export function resolveFactoryForPo(
  factoryId: number | null | undefined,
  existingPo = false,
): FactoryRecord | null {
  if (!factoryId) return null;
  const factory = getFactoryById(factoryId);
  if (!factory) {
    if (existingPo) return null;
    throw new Error("factory_not_found");
  }
  if (factory.status === "blocked" && !existingPo) throw new Error("factory_blocked");
  return factory;
}
