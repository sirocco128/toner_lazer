/**
 * Bottom-up simulation of the toner business (demo data + realistic estimates).
 *
 * Deterministic: same seed → same customers, orders and numbers. Pure module
 * (no DB); scripts/seed-toner-demo.mjs writes the result through the real
 * services and scripts/sim-toner.mjs prints the estimate report.
 *
 * Every assumption lives in SIM_ASSUMPTIONS so the report can print it and a
 * sales manager can argue with it.
 */

import {
  DEFAULT_TONER_PRICING,
  TONER_CATALOG,
  priceToner,
  type TonerItem,
  type TonerPricingConfig,
} from "@/lib/toner-catalog";

// ---------------------------------------------------------------------------
// Random numbers
// ---------------------------------------------------------------------------

export type Rng = {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  chance(p: number): boolean;
};

/** mulberry32 — small, fast, deterministic. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error("empty_pick");
      return item;
    },
    weighted: (items, weights) => {
      const total = weights.reduce((s, w) => s + w, 0);
      let r = next() * total;
      for (let i = 0; i < items.length; i += 1) {
        r -= weights[i] ?? 0;
        const item = items[i];
        if (r <= 0 && item !== undefined) return item;
      }
      const last = items[items.length - 1];
      if (last === undefined) throw new Error("empty_weighted");
      return last;
    },
    chance: (p) => next() < p,
  };
}

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

export type CustomerType =
  | "tambon"
  | "school"
  | "health_center"
  | "hospital"
  | "provincial_office"
  | "sme"
  | "corporate"
  | "dealer";

export type PriceTier = "direct" | "economy" | "dealer";

export type CustomerTypeProfile = {
  label: string;
  government: boolean;
  /** Toner cartridges the organisation uses per year (all suppliers). */
  annualCartridges: [number, number];
  /** Share of acquired customers of this type. */
  acquisitionWeight: number;
  tier: PriceTier;
  /** 0 = pays before shipping (PromptPay / transfer). */
  creditDays: number;
  /** Extra days late after the due date (government often pays late). */
  payDelayDays: [number, number];
  /** Minimum cartridges per order — they batch purchases. */
  minOrderQty: number;
  /** How many different cartridge models the fleet uses. */
  models: [number, number];
};

export const SIM_ASSUMPTIONS = {
  seed: 8,
  /** Months simulated; month 1 is setup with no customers yet. */
  months: 12,
  /** New customers won per month (sales visits + web + LINE), month 1..12. */
  newCustomersByMonth: [0, 4, 6, 8, 8, 9, 9, 10, 10, 10, 10, 10],
  /** Share of the customer's toner we win: first months after trial → steady state. */
  shareOfWalletStart: 0.5,
  shareOfWalletSteady: 0.85,
  monthsToSteadyShare: 3,
  /** Chance per month that a customer stops buying from us. */
  monthlyChurn: 0.01,
  /** Government spend by fiscal month (Oct=0 … Sep=11): slow start, year-end rush. */
  govSeasonality: [0.7, 0.8, 0.95, 1.0, 1.0, 1.0, 1.0, 0.95, 1.0, 1.15, 1.3, 1.35],
  /** Defective cartridges replaced free (sent again by dropship). */
  defectRate: 0.015,
  /** Share of each month's variable costs (business plan §6). */
  commissionRate: 0.03,
  bankFeeRate: 0.005,
  /** Fixed costs per month (business plan §7, year 1). */
  fixedCostPerMonth: 170_000,
  vatRate: 0.07,
  /** Plan revenue (business plan §9) for comparison, ex VAT. */
  planRevenueYear1: 5_450_000,
  /** Plan revenue in month 12 (business plan §9), ex VAT. */
  planMonth12Revenue: 850_000,
  /** One-off investment before the first sale (business plan §9, dropship). */
  oneOffInvestment: 600_000,
} as const;

export const CUSTOMER_TYPES: Record<CustomerType, CustomerTypeProfile> = {
  tambon: {
    label: "อบต. / เทศบาลตำบล",
    government: true,
    annualCartridges: [40, 120],
    acquisitionWeight: 30,
    tier: "direct",
    creditDays: 30,
    payDelayDays: [0, 25],
    minOrderQty: 6,
    models: [2, 3],
  },
  school: {
    label: "โรงเรียน",
    government: true,
    annualCartridges: [15, 60],
    acquisitionWeight: 24,
    tier: "direct",
    creditDays: 30,
    payDelayDays: [0, 20],
    minOrderQty: 4,
    models: [1, 2],
  },
  health_center: {
    label: "รพ.สต.",
    government: true,
    annualCartridges: [10, 30],
    acquisitionWeight: 10,
    tier: "direct",
    creditDays: 30,
    payDelayDays: [0, 30],
    minOrderQty: 3,
    models: [1, 2],
  },
  hospital: {
    label: "โรงพยาบาลรัฐ",
    government: true,
    annualCartridges: [200, 600],
    acquisitionWeight: 4,
    tier: "direct",
    creditDays: 60,
    payDelayDays: [5, 45],
    minOrderQty: 20,
    models: [3, 5],
  },
  provincial_office: {
    label: "หน่วยงานระดับจังหวัด / อำเภอ",
    government: true,
    annualCartridges: [100, 300],
    acquisitionWeight: 6,
    tier: "direct",
    creditDays: 30,
    payDelayDays: [0, 30],
    minOrderQty: 10,
    models: [2, 4],
  },
  sme: {
    label: "SME / สำนักงานเอกชน",
    government: false,
    annualCartridges: [10, 40],
    acquisitionWeight: 17,
    tier: "economy",
    creditDays: 0,
    payDelayDays: [0, 1],
    minOrderQty: 2,
    models: [1, 2],
  },
  corporate: {
    label: "บริษัท / โรงงาน",
    government: false,
    annualCartridges: [80, 400],
    acquisitionWeight: 8,
    tier: "direct",
    creditDays: 30,
    payDelayDays: [0, 10],
    minOrderQty: 10,
    models: [2, 4],
  },
  dealer: {
    label: "ตัวแทนจำหน่าย",
    government: false,
    annualCartridges: [240, 720],
    acquisitionWeight: 0,
    tier: "dealer",
    creditDays: 0,
    payDelayDays: [0, 1],
    minOrderQty: 20,
    models: [4, 8],
  },
};

/** Popularity of each cartridge in Thai offices (weights, not shares). */
export const SKU_POPULARITY: Record<string, number> = {
  "TL-HP-CE285A": 14,
  "TL-HP-CF217A": 10,
  "TL-HP-CF283A": 10,
  "TL-HP-CF279A": 6,
  "TL-HP-W1107A": 12,
  "TL-HP-CF226A": 8,
  "TL-BR-TN2380": 14,
  "TL-BR-TN1000": 8,
  "TL-BR-TN3350": 6,
  "TL-BR-TN240BK": 2,
  "TL-SS-D111S": 10,
};

/** Dealers join from month 6, one every other month. */
export const DEALER_JOIN_MONTHS = [6, 8, 10, 12];

const PROVINCES = [
  "ขอนแก่น", "นครราชสีมา", "อุดรธานี", "เชียงใหม่", "พิษณุโลก", "นครสวรรค์",
  "สุพรรณบุรี", "ชลบุรี", "ระยอง", "สุราษฎร์ธานี", "นครศรีธรรมราช", "สงขลา",
  "ปทุมธานี", "นนทบุรี", "สมุทรปราการ", "อยุธยา", "ลพบุรี", "ร้อยเอ็ด",
];

const PLACE_NAMES = [
  "บ้านใหม่", "หนองบัว", "โนนสูง", "ดอนตูม", "หนองแวง", "ท่าช้าง", "โพธิ์ทอง",
  "นาดี", "บ่อทอง", "หนองโพธิ์", "ห้วยทราย", "โคกสูง", "วังน้ำเย็น", "ทุ่งใหญ่",
  "หนองหญ้า", "สามแยก", "คลองสาม", "บางน้อย", "ดงเย็น", "นาคำ",
];

const BUSINESS_WORDS = [
  "สยามเทรดดิ้ง", "รุ่งเรืองการค้า", "พาณิชย์ทวีทรัพย์", "โลจิสติกส์ไทย",
  "อุตสาหกรรมเกษตร", "บัญชีและภาษี", "ก่อสร้างเจริญ", "ออโต้พาร์ท",
  "ฟู้ดโปรดักส์", "เอ็นจิเนียริ่ง", "ดีไซน์สตูดิโอ", "มาร์เก็ตติ้ง",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SimCustomer = {
  id: string;
  type: CustomerType;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  province: string;
  address: string;
  annualCartridges: number;
  /** Cartridge SKUs in the fleet with the share of use. */
  fleet: Array<{ sku: string; share: number }>;
  joinedMonth: number;
  churnedMonth: number | null;
};

export type SimOrderLine = { sku: string; qty: number; unitPrice: number; unitCost: number };

export type SimOrder = {
  id: string;
  customerId: string;
  month: number;
  /** Days since simulation start. */
  orderDay: number;
  deliveryDay: number;
  /** null = still unpaid at the end of the simulation. */
  payDay: number | null;
  dueDay: number | null;
  creditDays: number;
  tier: PriceTier;
  lines: SimOrderLine[];
  qty: number;
  revenueExVat: number;
  landedCost: number;
  /** Free replacement cartridges sent for defects on this order. */
  replacementQty: number;
  replacementCost: number;
};

export type SimMonth = {
  month: number;
  newCustomers: number;
  activeCustomers: number;
  orders: number;
  cartridges: number;
  revenueExVat: number;
  landedCost: number;
  replacementCost: number;
  grossProfit: number;
  variableCost: number;
  fixedCost: number;
  operatingProfit: number;
  cashInIncVat: number;
  receivableIncVat: number;
  /** Net cash flow ex VAT: collections − supplier − replacements − variable − fixed. */
  cashFlow: number;
  /** Cumulative cash after the one-off investment (negative = funding needed). */
  cumulativeCash: number;
};

export type SimResult = {
  startDate: string;
  customers: SimCustomer[];
  orders: SimOrder[];
  months: SimMonth[];
  totals: {
    customers: number;
    customersByType: Record<CustomerType, number>;
    orders: number;
    cartridges: number;
    revenueExVat: number;
    landedCost: number;
    replacementCost: number;
    grossProfit: number;
    grossMargin: number;
    variableCost: number;
    fixedCost: number;
    operatingProfit: number;
    averageOrderExVat: number;
    averagePricePerCartridge: number;
    revenueByType: Record<CustomerType, number>;
    cartridgesBySku: Record<string, number>;
    receivableEndIncVat: number;
    overdueEndIncVat: number;
    dsoDays: number;
    lastMonthRevenue: number;
    planRevenue: number;
    planGap: number;
    /** Active customers needed to reach the plan's month-12 revenue at today's revenue per customer. */
    customersForPlanRunRate: number;
    /** Lowest cumulative cash (after one-off investment) — the funding needed. */
    peakFundingNeed: number;
    /** First month with positive operating profit, null if none. */
    breakEvenMonth: number | null;
  };
};

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

function addDays(startIso: string, days: number): Date {
  return new Date(Date.parse(`${startIso}T03:00:00Z`) + days * DAY_MS);
}

/** Day index of the first day of simulation month m (1-based) — calendar months. */
export function monthStartDay(startIso: string, month: number): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + month - 1, 1));
  return Math.round((d.getTime() - start.getTime()) / DAY_MS);
}

/** Fiscal month index (Oct=0) of a simulation month. */
function fiscalIndex(startIso: string, month: number): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const calMonth = (start.getUTCMonth() + month - 1) % 12; // 0=Jan
  return (calMonth + 3) % 12; // Oct → 0
}

function makeCustomer(
  rng: Rng,
  index: number,
  type: CustomerType,
  joinedMonth: number,
): SimCustomer {
  const profile = CUSTOMER_TYPES[type];
  const province = rng.pick(PROVINCES);
  const place = rng.pick(PLACE_NAMES);
  const names: Record<CustomerType, string> = {
    tambon: `องค์การบริหารส่วนตำบล${place}`,
    school: `โรงเรียนบ้าน${place}`,
    health_center: `โรงพยาบาลส่งเสริมสุขภาพตำบล${place}`,
    hospital: `โรงพยาบาล${place}`,
    provincial_office: rng.pick([`ที่ว่าการอำเภอ${place}`, `สำนักงานเกษตรจังหวัด${province}`, `สำนักงานที่ดินจังหวัด${province} สาขา${place}`]),
    sme: `ห้างหุ้นส่วนจำกัด ${rng.pick(BUSINESS_WORDS)} ${place}`,
    corporate: `บริษัท ${rng.pick(BUSINESS_WORDS)} ${province} จำกัด`,
    dealer: `ร้านไอที ${place} คอมพิวเตอร์`,
  };
  const [lo, hi] = profile.annualCartridges;
  const modelCount = rng.int(profile.models[0], profile.models[1]);
  const skus = [...TONER_CATALOG.map((t) => t.sku)];
  const fleet: Array<{ sku: string; share: number }> = [];
  while (fleet.length < modelCount && skus.length > 0) {
    const sku = rng.weighted(skus, skus.map((s) => SKU_POPULARITY[s] ?? 1));
    skus.splice(skus.indexOf(sku), 1);
    fleet.push({ sku, share: 0.5 + rng.next() });
  }
  const shareTotal = fleet.reduce((s, f) => s + f.share, 0);
  for (const f of fleet) f.share = f.share / shareTotal;

  const n = String(index + 1).padStart(4, "0");
  return {
    id: `SIM-C${n}`,
    type,
    name: `${names[type]} (จำลอง)`,
    contactName: profile.government ? "งานพัสดุ" : "ฝ่ายจัดซื้อ",
    email: `sim-${n}@example.com`,
    phone: `08${rng.int(1, 9)}${String(rng.int(0, 9999999)).padStart(7, "0")}`,
    province,
    address: `${rng.int(1, 199)} หมู่ ${rng.int(1, 12)} ตำบล${place} อำเภอเมือง${province}`,
    annualCartridges: rng.int(lo, hi),
    fleet,
    joinedMonth,
    churnedMonth: null,
  };
}

function tierPrice(item: TonerItem, tier: PriceTier, pricing: TonerPricingConfig): number {
  const p = priceToner(item, pricing);
  return tier === "direct" ? p.direct : tier === "economy" ? p.economy : p.dealer;
}

export function simulateTonerBusiness(options?: {
  seed?: number;
  /** First day of month 1 (YYYY-MM-DD). */
  startDate?: string;
  /** Simulation "today" in days since start; orders after it are not generated. */
  endDay?: number;
  pricing?: TonerPricingConfig;
  /** Scale new customers per month (2 = twice the sales capacity). */
  acquisitionMultiplier?: number;
  /** Override fixed costs per month (e.g. more sales staff). */
  fixedCostPerMonth?: number;
}): SimResult {
  const A = SIM_ASSUMPTIONS;
  const rng = createRng(options?.seed ?? A.seed);
  const pricing = options?.pricing ?? DEFAULT_TONER_PRICING;
  const startDate = options?.startDate ?? "2025-10-01";
  const endDay = options?.endDay ?? monthStartDay(startDate, A.months + 1) - 1;
  const catalogBySku = new Map(TONER_CATALOG.map((t) => [t.sku, t]));

  const types = (Object.keys(CUSTOMER_TYPES) as CustomerType[]).filter(
    (t) => CUSTOMER_TYPES[t].acquisitionWeight > 0,
  );
  const typeWeights = types.map((t) => CUSTOMER_TYPES[t].acquisitionWeight);

  const customers: SimCustomer[] = [];
  const orders: SimOrder[] = [];
  const need = new Map<string, number>(); // accumulated cartridges not yet ordered

  for (let month = 1; month <= A.months; month += 1) {
    const mStart = monthStartDay(startDate, month);
    const mEnd = monthStartDay(startDate, month + 1) - 1;
    if (mStart > endDay) break;

    // Acquire new customers, spread through the month.
    const wins = Math.round((A.newCustomersByMonth[month - 1] ?? 0) * (options?.acquisitionMultiplier ?? 1));
    const joined: SimCustomer[] = [];
    for (let i = 0; i < wins; i += 1) {
      joined.push(makeCustomer(rng, customers.length + joined.length, rng.weighted(types, typeWeights), month));
    }
    if (DEALER_JOIN_MONTHS.includes(month)) {
      joined.push(makeCustomer(rng, customers.length + joined.length, "dealer", month));
    }
    for (const c of joined) {
      // A won customer places a first order right away (that is why they came).
      need.set(c.id, CUSTOMER_TYPES[c.type].minOrderQty);
      customers.push(c);
    }

    const seasonal = A.govSeasonality[fiscalIndex(startDate, month)] ?? 1;

    for (const c of customers) {
      if (c.churnedMonth != null) continue;
      if (c.joinedMonth < month && rng.chance(A.monthlyChurn)) {
        c.churnedMonth = month;
        continue;
      }
      const profile = CUSTOMER_TYPES[c.type];
      const monthsIn = month - c.joinedMonth;
      const share =
        monthsIn >= A.monthsToSteadyShare
          ? A.shareOfWalletSteady
          : A.shareOfWalletStart +
            ((A.shareOfWalletSteady - A.shareOfWalletStart) * monthsIn) / A.monthsToSteadyShare;
      const season = profile.government ? seasonal : 1;
      const partMonth = monthsIn === 0 ? 0.5 : 1; // joined mid-month
      const monthly = (c.annualCartridges / 12) * share * season * partMonth;
      const acc = (need.get(c.id) ?? 0) + monthly * (0.85 + rng.next() * 0.3);
      if (acc < profile.minOrderQty) {
        need.set(c.id, acc);
        continue;
      }
      const qtyTotal = Math.round(acc);
      need.set(c.id, acc - qtyTotal);

      // Split across the fleet.
      const lines: SimOrderLine[] = [];
      let left = qtyTotal;
      c.fleet.forEach((f, i) => {
        const q = i === c.fleet.length - 1 ? left : Math.min(left, Math.round(qtyTotal * f.share));
        left -= q;
        const item = catalogBySku.get(f.sku);
        if (!item || q <= 0) return;
        lines.push({
          sku: f.sku,
          qty: q,
          unitPrice: tierPrice(item, profile.tier, pricing),
          unitCost: priceToner(item, pricing).landedCost,
        });
      });
      if (lines.length === 0) continue;

      const orderDay = rng.int(mStart, mEnd);
      if (orderDay > endDay) continue;
      const deliveryDay = orderDay + rng.int(1, 3);
      const credit = profile.creditDays;
      const dueDay = credit > 0 ? deliveryDay + credit : null;
      const plannedPay =
        credit > 0 ? (dueDay ?? deliveryDay) + rng.int(profile.payDelayDays[0], profile.payDelayDays[1]) : orderDay;
      const qty = lines.reduce((s, l) => s + l.qty, 0);
      let replacementQty = 0;
      for (let k = 0; k < qty; k += 1) if (rng.chance(A.defectRate)) replacementQty += 1;
      const avgCost = lines.reduce((s, l) => s + l.unitCost * l.qty, 0) / qty;

      orders.push({
        id: `SIM-O${String(orders.length + 1).padStart(5, "0")}`,
        customerId: c.id,
        month,
        orderDay,
        deliveryDay,
        dueDay,
        payDay: plannedPay <= endDay ? plannedPay : null,
        creditDays: credit,
        tier: profile.tier,
        lines,
        qty,
        revenueExVat: lines.reduce((s, l) => s + l.unitPrice * l.qty, 0),
        landedCost: lines.reduce((s, l) => s + l.unitCost * l.qty, 0),
        replacementQty,
        replacementCost: Math.round(replacementQty * avgCost),
      });
    }
  }

  const fixed = options?.fixedCostPerMonth ?? A.fixedCostPerMonth;
  return {
    startDate,
    customers,
    orders,
    months: summarizeMonths(startDate, customers, orders, endDay, fixed),
    totals: summarizeTotals(customers, orders, startDate, endDay, fixed),
  };
}

function summarizeMonths(
  startDate: string,
  customers: SimCustomer[],
  orders: SimOrder[],
  endDay: number,
  fixedCost: number,
): SimMonth[] {
  const A = SIM_ASSUMPTIONS;
  const months: SimMonth[] = [];
  let cumulative = -A.oneOffInvestment;
  for (let month = 1; month <= A.months; month += 1) {
    const mStart = monthStartDay(startDate, month);
    const mEnd = Math.min(monthStartDay(startDate, month + 1) - 1, endDay);
    if (mStart > endDay) break;
    const inMonth = orders.filter((o) => o.orderDay >= mStart && o.orderDay <= mEnd);
    const revenue = inMonth.reduce((s, o) => s + o.revenueExVat, 0);
    const cost = inMonth.reduce((s, o) => s + o.landedCost, 0);
    const repl = inMonth.reduce((s, o) => s + o.replacementCost, 0);
    const variable = Math.round(revenue * (A.commissionRate + A.bankFeeRate));
    const gross = revenue - cost - repl;
    const cashIn = orders
      .filter((o) => o.payDay != null && o.payDay >= mStart && o.payDay <= mEnd)
      .reduce((s, o) => s + o.revenueExVat * (1 + A.vatRate), 0);
    const cashInExVat = cashIn / (1 + A.vatRate);
    const cashFlow = Math.round(cashInExVat - cost - repl - variable - fixedCost);
    cumulative += cashFlow;
    const receivable = orders
      .filter((o) => o.orderDay <= mEnd && (o.payDay == null || o.payDay > mEnd))
      .reduce((s, o) => s + o.revenueExVat * (1 + A.vatRate), 0);
    months.push({
      month,
      newCustomers: customers.filter((c) => c.joinedMonth === month).length,
      activeCustomers: customers.filter(
        (c) => c.joinedMonth <= month && (c.churnedMonth == null || c.churnedMonth > month),
      ).length,
      orders: inMonth.length,
      cartridges: inMonth.reduce((s, o) => s + o.qty, 0),
      revenueExVat: Math.round(revenue),
      landedCost: Math.round(cost),
      replacementCost: Math.round(repl),
      grossProfit: Math.round(gross),
      variableCost: variable,
      fixedCost,
      operatingProfit: Math.round(gross - variable - fixedCost),
      cashInIncVat: Math.round(cashIn),
      receivableIncVat: Math.round(receivable),
      cashFlow,
      cumulativeCash: cumulative,
    });
  }
  return months;
}

function summarizeTotals(
  customers: SimCustomer[],
  orders: SimOrder[],
  startDate: string,
  endDay: number,
  fixedCost: number,
): SimResult["totals"] {
  const A = SIM_ASSUMPTIONS;
  const months = summarizeMonths(startDate, customers, orders, endDay, fixedCost);
  const sum = <K extends keyof SimMonth>(k: K) => months.reduce((s, m) => s + (m[k] as number), 0);
  const revenue = sum("revenueExVat");
  const cartridges = sum("cartridges");
  const zeroByType = () =>
    Object.fromEntries(Object.keys(CUSTOMER_TYPES).map((t) => [t, 0])) as Record<CustomerType, number>;
  const customersByType = zeroByType();
  for (const c of customers) customersByType[c.type] += 1;
  const typeOf = new Map(customers.map((c) => [c.id, c.type]));
  const revenueByType = zeroByType();
  const cartridgesBySku: Record<string, number> = {};
  for (const o of orders) {
    const t = typeOf.get(o.customerId);
    if (t) revenueByType[t] += o.revenueExVat;
    for (const l of o.lines) cartridgesBySku[l.sku] = (cartridgesBySku[l.sku] ?? 0) + l.qty;
  }
  const last = months[months.length - 1];
  const receivableEnd = orders
    .filter((o) => o.payDay == null)
    .reduce((s, o) => s + o.revenueExVat * (1 + A.vatRate), 0);
  const overdueEnd = orders
    .filter((o) => o.payDay == null && o.dueDay != null && o.dueDay < endDay)
    .reduce((s, o) => s + o.revenueExVat * (1 + A.vatRate), 0);
  // DSO on the last 3 months of credit sales.
  const last3 = months.slice(-3).reduce((s, m) => s + m.revenueExVat * (1 + A.vatRate), 0);
  const dso = last3 > 0 ? Math.round((receivableEnd / last3) * 91) : 0;
  const activeEnd = last?.activeCustomers ?? 0;
  const lastRevenue = last?.revenueExVat ?? 0;
  const perCustomer = activeEnd > 0 ? lastRevenue / activeEnd : 0;
  const planMonthly = A.planMonth12Revenue;
  const gross = sum("grossProfit");

  return {
    customers: customers.length,
    customersByType,
    orders: orders.length,
    cartridges,
    revenueExVat: revenue,
    landedCost: sum("landedCost"),
    replacementCost: sum("replacementCost"),
    grossProfit: gross,
    grossMargin: revenue > 0 ? gross / revenue : 0,
    variableCost: sum("variableCost"),
    fixedCost: sum("fixedCost"),
    operatingProfit: sum("operatingProfit"),
    averageOrderExVat: orders.length ? Math.round(revenue / orders.length) : 0,
    averagePricePerCartridge: cartridges ? Math.round(revenue / cartridges) : 0,
    revenueByType,
    cartridgesBySku,
    receivableEndIncVat: Math.round(receivableEnd),
    overdueEndIncVat: Math.round(overdueEnd),
    dsoDays: dso,
    lastMonthRevenue: lastRevenue,
    planRevenue: A.planRevenueYear1,
    planGap: revenue - A.planRevenueYear1,
    customersForPlanRunRate: perCustomer > 0 ? Math.ceil(planMonthly / perCustomer) : 0,
    peakFundingNeed: Math.max(0, -Math.min(0, ...months.map((m) => m.cumulativeCash))),
    breakEvenMonth: months.find((m) => m.operatingProfit > 0)?.month ?? null,
  };
}

/** Calendar helpers for the seeder. */
export function simDate(startDate: string, day: number): Date {
  return addDays(startDate, day);
}
