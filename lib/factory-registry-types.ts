import type { FreightOrigin } from "@/lib/alibaba/types";
import {
  FACTORY_CURRENCIES,
  FACTORY_PLATFORMS,
  isFactoryCurrency,
  isFactoryPlatform,
  type FactoryCurrency,
  type FactoryPlatform,
} from "@/lib/factory-po-types";

export const FACTORY_STATUSES = ["active", "paused", "blocked"] as const;
export type FactoryStatus = (typeof FACTORY_STATUSES)[number];

export const FACTORY_STATUS_LABELS: Record<FactoryStatus, string> = {
  active: "ใช้งาน",
  paused: "พักสั่ง",
  blocked: "ระงับ",
};

export const FACTORY_ORIGIN_OPTIONS: Array<{
  value: FreightOrigin;
  label: string;
}> = [
  { value: "yiwu", label: "อี้อู" },
  { value: "guangzhou_shenzhen", label: "กว่างโจว / เซินเจิ้น" },
];

export const FACTORY_ORIGIN_LABELS: Record<FreightOrigin, string> = {
  yiwu: "อี้อู",
  guangzhou_shenzhen: "กว่างโจว / เซินเจิ้น",
};

export type FactoryRecord = {
  id: number;
  factoryCode: string;
  name: string;
  nameCn: string | null;
  legalName: string | null;
  platform: FactoryPlatform;
  shopUrl: string | null;
  shopId: string | null;
  origin: FreightOrigin | null;
  city: string | null;
  address: string | null;
  contactName: string | null;
  wechat: string | null;
  phone: string | null;
  email: string | null;
  defaultCurrency: FactoryCurrency;
  paymentTerms: string | null;
  bankName: string | null;
  bankAccount: string | null;
  alipay: string | null;
  moqNotes: string | null;
  leadDays: number | null;
  qcNotes: string | null;
  status: FactoryStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FactoryPickerOption = {
  id: number;
  factoryCode: string;
  name: string;
  platform: FactoryPlatform;
  contactName: string | null;
  wechat: string | null;
  phone: string | null;
  origin: FreightOrigin | null;
  status: FactoryStatus;
  defaultCurrency: FactoryCurrency;
};

export type SaveFactoryInput = {
  id?: number;
  factoryCode?: string;
  name: string;
  nameCn?: string | null;
  legalName?: string | null;
  platform?: string;
  shopUrl?: string | null;
  shopId?: string | null;
  origin?: string | null;
  city?: string | null;
  address?: string | null;
  contactName?: string | null;
  wechat?: string | null;
  phone?: string | null;
  email?: string | null;
  defaultCurrency?: string;
  paymentTerms?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  alipay?: string | null;
  moqNotes?: string | null;
  leadDays?: number | null;
  qcNotes?: string | null;
  status?: string;
  notes?: string | null;
};

export function isFactoryStatus(value: string): value is FactoryStatus {
  return (FACTORY_STATUSES as readonly string[]).includes(value);
}

export function factoryContactLine(factory: {
  contactName: string | null;
  wechat: string | null;
  phone: string | null;
}): string {
  return [factory.contactName, factory.wechat, factory.phone]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" · ");
}

export function toFactoryPickerOption(factory: FactoryRecord): FactoryPickerOption {
  return {
    id: factory.id,
    factoryCode: factory.factoryCode,
    name: factory.name,
    platform: factory.platform,
    contactName: factory.contactName,
    wechat: factory.wechat,
    phone: factory.phone,
    origin: factory.origin,
    status: factory.status,
    defaultCurrency: factory.defaultCurrency,
  };
}

export {
  FACTORY_CURRENCIES,
  FACTORY_PLATFORMS,
  isFactoryCurrency,
  isFactoryPlatform,
};
