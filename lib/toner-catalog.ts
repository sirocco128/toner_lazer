/**
 * Toner catalog (private-label, supplied by Color Fly with dropship).
 *
 * Pure module — no imports — so it can be used by the Next.js app, the test
 * suite (tsc → CommonJS) and `node --experimental-strip-types` scripts alike.
 *
 * Cost model (business plan §7):
 *   landed cost = round(Advice online price × (1 − supplier discount)) + box cost
 * Price tiers (business plan §6), rounded to 10 THB:
 *   direct  (government / corporate)  gross margin 60%
 *   economy (SME / schools)           gross margin 50%
 *   dealer  (resellers)               gross margin 12%, must stay below the
 *                                      Advice online price for the same cartridge
 */

export type TonerBrand = "HP" | "BROTHER" | "SAMSUNG";

export type TonerItem = {
  /** Our SKU — stable key shared with NEXTERP `products.sku`. */
  sku: string;
  brand: TonerBrand;
  /** OEM cartridge code, e.g. CE285A. */
  oemCode: string;
  /** Short model name customers search for, e.g. 85A. */
  model: string;
  color: "black";
  /** Page yield at 5% A4 coverage; null when the supplier did not state it. */
  yieldPages: number | null;
  compatiblePrinters: string[];
  supplier: "COLORFLY";
  /** Supplier / Advice product code. */
  supplierRef: string;
  /** Advice.co.th list price (THB); null when not shown. */
  adviceNormalPrice: number | null;
  /** Advice.co.th online price (THB) — the base for our supplier discount. */
  adviceOnlinePrice: number;
  sourceUrl: string;
};

export type TonerPricingConfig = {
  /** Supplier discount off the Advice online price (0.20 = 20%). */
  supplierDiscount: number;
  /** Cost of our own brand box per cartridge (THB). */
  boxCostThb: number;
  directMargin: number;
  economyMargin: number;
  dealerMargin: number;
};

export type TonerPricing = {
  supplierPrice: number;
  landedCost: number;
  direct: number;
  economy: number;
  dealer: number;
  /** Landed cost per printed page (THB), null when yield is unknown. */
  costPerPage: number | null;
  /** True when the dealer tier had to be capped below the Advice price. */
  dealerCapped: boolean;
};

export const TONER_PRICE_SOURCE_DATE = "2026-09-26";

export const DEFAULT_TONER_PRICING: TonerPricingConfig = {
  supplierDiscount: 0.2,
  boxCostThb: 10,
  directMargin: 0.6,
  economyMargin: 0.5,
  dealerMargin: 0.12,
};

const ADVICE = "https://www.advice.co.th/product/toner-remanu-and-refill";

export const TONER_CATALOG: readonly TonerItem[] = [
  {
    sku: "TL-HP-CE285A",
    brand: "HP",
    oemCode: "CE285A",
    model: "85A",
    color: "black",
    yieldPages: 1600,
    compatiblePrinters: [
      "LaserJet Pro P1100",
      "LaserJet Pro P1102",
      "LaserJet Pro P1102w",
      "LaserJet Pro M1130",
      "LaserJet Pro M1132 MFP",
      "LaserJet Pro M1210",
      "LaserJet Pro M1212nf MFP",
      "LaserJet Pro M1214nfh",
      "LaserJet Pro M1217nfw",
    ],
    supplier: "COLORFLY",
    supplierRef: "A0080490",
    adviceNormalPrice: 275,
    adviceOnlinePrice: 230,
    sourceUrl: `${ADVICE}/hp-color-fly-wise-/toner-re-hp-85a-ce285a-color-fly`,
  },
  {
    sku: "TL-HP-CF217A",
    brand: "HP",
    oemCode: "CF217A",
    model: "17A",
    color: "black",
    yieldPages: 1600,
    compatiblePrinters: ["LaserJet Pro M102", "LaserJet Pro MFP M130"],
    supplier: "COLORFLY",
    supplierRef: "A0109086",
    adviceNormalPrice: 275,
    adviceOnlinePrice: 230,
    sourceUrl: `${ADVICE}/hp-color-fly-wise-/toner-re-hp-17a-cf217a-color-fly`,
  },
  {
    sku: "TL-HP-CF283A",
    brand: "HP",
    oemCode: "CF283A",
    model: "83A",
    color: "black",
    yieldPages: 1500,
    compatiblePrinters: [
      "LaserJet Pro M201d",
      "LaserJet Pro M201dw",
      "LaserJet Pro M201n",
      "LaserJet Pro MFP M125a",
      "LaserJet Pro MFP M125nw",
      "LaserJet Pro MFP M127fn",
      "LaserJet Pro MFP M127fw",
      "LaserJet Pro MFP M225dn",
      "LaserJet Pro MFP M225dw",
    ],
    supplier: "COLORFLY",
    supplierRef: "A0080489",
    adviceNormalPrice: 275,
    adviceOnlinePrice: 230,
    sourceUrl: `${ADVICE}/hp-color-fly-wise-/toner-re-hp-83a-cf283a-color-fly`,
  },
  {
    sku: "TL-HP-CF279A",
    brand: "HP",
    oemCode: "CF279A",
    model: "79A",
    color: "black",
    yieldPages: 1000,
    compatiblePrinters: [
      "LaserJet Pro M12a",
      "LaserJet Pro M12w",
      "LaserJet Pro MFP M26a",
      "LaserJet Pro MFP M26nw",
    ],
    supplier: "COLORFLY",
    supplierRef: "A0098814",
    adviceNormalPrice: 275,
    adviceOnlinePrice: 230,
    sourceUrl: `${ADVICE}/hp-color-fly-wise-/toner-re-hp-79a-cf279a-color-fly`,
  },
  {
    sku: "TL-HP-W1107A",
    brand: "HP",
    oemCode: "W1107A",
    model: "107A",
    color: "black",
    yieldPages: 1000,
    compatiblePrinters: [
      "Laser 107a",
      "Laser 107w",
      "Laser MFP 135a",
      "Laser MFP 135w",
      "Laser MFP 137fnw",
    ],
    supplier: "COLORFLY",
    supplierRef: "A0135985",
    adviceNormalPrice: 320,
    adviceOnlinePrice: 280,
    sourceUrl: `${ADVICE}/hp-color-fly-wise-/toner-re-hp-107a-w1107a-color-fly`,
  },
  {
    sku: "TL-HP-CF226A",
    brand: "HP",
    oemCode: "CF226A",
    model: "26A",
    color: "black",
    yieldPages: null,
    compatiblePrinters: [
      "LaserJet Pro M402dn",
      "LaserJet Pro M402dw",
      "LaserJet Pro M402n",
      "LaserJet Pro MFP M426dw",
      "LaserJet Pro MFP M426fdn",
    ],
    supplier: "COLORFLY",
    supplierRef: "A0168407",
    adviceNormalPrice: 350,
    adviceOnlinePrice: 310,
    sourceUrl: `${ADVICE}/hp-color-fly-wise-/toner-re-hp-26a-cf226a-color-fly`,
  },
  {
    sku: "TL-BR-TN1000",
    brand: "BROTHER",
    oemCode: "TN-1000",
    model: "TN-1000",
    color: "black",
    yieldPages: 1000,
    compatiblePrinters: [
      "HL-1110",
      "HL-1111",
      "HL-1201",
      "HL-1210W",
      "HL-1211W",
      "DCP-1510",
      "DCP-1511",
      "DCP-1610W",
      "DCP-1612W",
      "MFC-1810",
      "MFC-1811",
      "MFC-1815",
      "MFC-1910W",
      "MFC-1911NW",
    ],
    supplier: "COLORFLY",
    supplierRef: "A0168408",
    adviceNormalPrice: 210,
    adviceOnlinePrice: 175,
    sourceUrl: `${ADVICE}/brother-color-fly-/toner-re-brother-tn-1000-color-fly`,
  },
  {
    sku: "TL-BR-TN2380",
    brand: "BROTHER",
    oemCode: "TN-2380",
    model: "TN-2360/2380",
    color: "black",
    yieldPages: 2600,
    compatiblePrinters: [
      "HL-L2320D",
      "HL-L2360DN",
      "HL-L2365DW",
      "DCP-L2520D",
      "DCP-L2540DW",
      "MFC-L2700D",
      "MFC-L2700DW",
      "MFC-L2740DW",
    ],
    supplier: "COLORFLY",
    supplierRef: "A0084955",
    adviceNormalPrice: 265,
    adviceOnlinePrice: 230,
    sourceUrl: `${ADVICE}/brother-remenu-/toner-re-brother-tn-2360-2380-color-fly`,
  },
  {
    sku: "TL-BR-TN240BK",
    brand: "BROTHER",
    oemCode: "TN-240BK",
    model: "TN-240 BK",
    color: "black",
    yieldPages: 2200,
    compatiblePrinters: [
      "HL-3040CN",
      "HL-3045CN",
      "HL-3070CW",
      "HL-3075CW",
      "DCP-9010CN",
      "MFC-9120CN",
      "MFC-9125CN",
      "MFC-9320CW",
      "MFC-9325CW",
    ],
    supplier: "COLORFLY",
    supplierRef: "A0106108",
    adviceNormalPrice: 385,
    adviceOnlinePrice: 330,
    sourceUrl: `${ADVICE}/brother-color-fly-/toner-re-brother-tn-240-bk-color-fly`,
  },
  {
    sku: "TL-BR-TN3350",
    brand: "BROTHER",
    oemCode: "TN-3350",
    model: "TN-3350",
    color: "black",
    yieldPages: 8000,
    compatiblePrinters: [
      "HL-5440D",
      "HL-5450DN",
      "HL-5470DW",
      "HL-6180DW",
      "DCP-8110D",
      "DCP-8110DN",
      "DCP-8155DN",
      "MFC-8510DN",
      "MFC-8910DW",
      "MFC-8950DW",
    ],
    supplier: "COLORFLY",
    supplierRef: "A0095122",
    adviceNormalPrice: null,
    adviceOnlinePrice: 395,
    sourceUrl: `${ADVICE}/brother-color-fly-wise-/toner-re-brother-tn-3350-color-fly`,
  },
  {
    sku: "TL-SS-D111S",
    brand: "SAMSUNG",
    oemCode: "MLT-D111S",
    model: "D111S",
    color: "black",
    yieldPages: 1000,
    compatiblePrinters: [
      "Xpress M2020",
      "Xpress M2020W",
      "Xpress M2021",
      "Xpress M2021W",
      "Xpress M2022",
      "Xpress M2022W",
      "Xpress M2070",
      "Xpress M2070W",
      "Xpress M2070F",
      "Xpress M2070FW",
      "Xpress M2071",
      "Xpress M2071W",
      "Xpress M2071FH",
    ],
    supplier: "COLORFLY",
    supplierRef: "A0093162",
    adviceNormalPrice: 330,
    adviceOnlinePrice: 270,
    sourceUrl: `${ADVICE}/samsung-color-fly-wise-/toner-re-samsung-mlt-d111s-color-fly`,
  },
];

export const TONER_BRAND_LABEL: Record<TonerBrand, string> = {
  HP: "HP",
  BROTHER: "Brother",
  SAMSUNG: "Samsung",
};

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

function ceilTo10(value: number): number {
  return Math.ceil(Math.round(value * 100) / 100 / 10) * 10;
}

function roundTo10(value: number): number {
  return Math.round(value / 10) * 10;
}

function readRatio(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n < 1 ? n : fallback;
}

function readAmount(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Pricing config from env (TONER_SUPPLIER_DISCOUNT, TONER_BOX_COST_THB, …). */
export function tonerPricingConfigFromEnv(
  env: Record<string, string | undefined>,
): TonerPricingConfig {
  const d = DEFAULT_TONER_PRICING;
  return {
    supplierDiscount: readRatio(env.TONER_SUPPLIER_DISCOUNT, d.supplierDiscount),
    boxCostThb: readAmount(env.TONER_BOX_COST_THB, d.boxCostThb),
    directMargin: readRatio(env.TONER_DIRECT_MARGIN, d.directMargin),
    economyMargin: readRatio(env.TONER_ECONOMY_MARGIN, d.economyMargin),
    dealerMargin: readRatio(env.TONER_DEALER_MARGIN, d.dealerMargin),
  };
}

export function priceToner(
  item: TonerItem,
  config: TonerPricingConfig = DEFAULT_TONER_PRICING,
): TonerPricing {
  const supplierPrice = Math.round(
    item.adviceOnlinePrice * (1 - config.supplierDiscount),
  );
  const landedCost = supplierPrice + config.boxCostThb;
  const direct = ceilTo10(landedCost / (1 - config.directMargin));
  const economy = ceilTo10(landedCost / (1 - config.economyMargin));

  let dealer = roundTo10(landedCost / (1 - config.dealerMargin));
  let dealerCapped = false;
  if (dealer >= item.adviceOnlinePrice) {
    dealer = Math.floor((item.adviceOnlinePrice - 1) / 10) * 10;
    dealerCapped = true;
  }

  const costPerPage =
    item.yieldPages && item.yieldPages > 0
      ? Math.round((landedCost / item.yieldPages) * 100) / 100
      : null;

  return { supplierPrice, landedCost, direct, economy, dealer, costPerPage, dealerCapped };
}

export function grossMargin(price: number, cost: number): number {
  if (price <= 0) return 0;
  return (price - cost) / price;
}

// ---------------------------------------------------------------------------
// Printer → cartridge lookup
// ---------------------------------------------------------------------------

const NOISE_WORDS = [
  "HEWLETTPACKARD",
  "SAMSUNG",
  "BROTHER",
  "LASERJET",
  "XPRESS",
  "LASER",
  "PRO",
  "MFP",
  "HP",
];

/** Uppercase, strip spaces/punctuation and brand/series words. */
export function normalizeModel(raw: string): string {
  let s = raw.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  for (const word of NOISE_WORDS) {
    s = s.replace(new RegExp(`\\b${word}\\b`, "g"), " ");
  }
  return s.replace(/\s+/g, "");
}

/**
 * Find cartridges by printer model ("HP M1132", "DCP-L2540DW"),
 * cartridge model ("85A", "TN-2380") or OEM code ("CE285A").
 */
export function findToner(
  query: string,
  catalog: readonly TonerItem[] = TONER_CATALOG,
): TonerItem[] {
  const q = normalizeModel(query);
  if (q.length < 2) return [];

  const exact: TonerItem[] = [];
  const partial: TonerItem[] = [];
  for (const item of catalog) {
    const codes = [item.oemCode, item.model, item.sku].map(normalizeModel);
    const printers = item.compatiblePrinters.map(normalizeModel);
    if (codes.includes(q) || printers.includes(q)) {
      exact.push(item);
    } else if (
      q.length >= 4 &&
      [...codes, ...printers].some((p) => p.startsWith(q) || q.startsWith(p))
    ) {
      partial.push(item);
    }
  }
  return exact.length > 0 ? exact : partial;
}

// ---------------------------------------------------------------------------
// NEXTERP rows + sync plan
// ---------------------------------------------------------------------------

export type NexterpTonerCategory = {
  code: string;
  name_th: string;
  name_en: string;
};

export type NexterpTonerProduct = {
  sku: string;
  name: string;
  description: string;
  category_code: string;
  category_raw: string;
  uom: string;
  sell_price: number;
  is_active: number;
};

export function tonerCategoryCode(brand: TonerBrand): string {
  return `TONER_${brand}`;
}

export function buildNexterpTonerCategories(
  catalog: readonly TonerItem[] = TONER_CATALOG,
): NexterpTonerCategory[] {
  const brands = [...new Set(catalog.map((item) => item.brand))];
  return brands.map((brand) => ({
    code: tonerCategoryCode(brand),
    name_th: `หมึกเลเซอร์เทียบเท่า สำหรับ ${TONER_BRAND_LABEL[brand]}`,
    name_en: `Compatible laser toner for ${TONER_BRAND_LABEL[brand]}`,
  }));
}

export function tonerProductName(item: TonerItem): string {
  const brand = TONER_BRAND_LABEL[item.brand];
  const code =
    normalizeModel(item.oemCode) === normalizeModel(item.model) ? "" : ` (${item.oemCode})`;
  return `ตลับหมึกเลเซอร์เทียบเท่า ${item.model}${code} สำหรับ ${brand}`;
}

export function tonerProductDescription(item: TonerItem): string {
  const brand = TONER_BRAND_LABEL[item.brand];
  const yieldText = item.yieldPages
    ? `พิมพ์ได้ประมาณ ${item.yieldPages.toLocaleString("en-US")} แผ่น (5% บน A4)`
    : "จำนวนแผ่นตามผลทดสอบของรุ่น";
  return [
    `ใช้กับเครื่อง ${brand} ${item.compatiblePrinters.join(", ")}`,
    yieldText,
    "สีดำ · รับประกันคุณภาพ เปลี่ยนตลับฟรีหากพิมพ์ไม่ผ่าน · ออกใบกำกับภาษีได้",
  ].join(" | ");
}

export function buildNexterpTonerProducts(
  catalog: readonly TonerItem[] = TONER_CATALOG,
  config: TonerPricingConfig = DEFAULT_TONER_PRICING,
): NexterpTonerProduct[] {
  return catalog.map((item) => ({
    sku: item.sku,
    name: tonerProductName(item),
    description: tonerProductDescription(item),
    category_code: tonerCategoryCode(item.brand),
    category_raw: "TONER",
    uom: "ตลับ",
    sell_price: priceToner(item, config).direct,
    is_active: 1,
  }));
}

export type ExistingNexterpCategory = { id: number; code: string };

export type ExistingNexterpProduct = {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category_id: number | null;
  category_raw: string | null;
  uom: string | null;
  sell_price: number | string | null;
  is_active: number;
};

export type NexterpProductChange = {
  id: number;
  sku: string;
  fields: Partial<Omit<NexterpTonerProduct, "sku" | "category_code">> & {
    category_code?: string;
  };
};

export type NexterpSyncPlan = {
  categoryInserts: NexterpTonerCategory[];
  productInserts: NexterpTonerProduct[];
  productUpdates: NexterpProductChange[];
  unchanged: string[];
};

function sameNumber(a: number | string | null, b: number): boolean {
  if (a == null || a === "") return false;
  return Math.abs(Number(a) - b) < 0.005;
}

/**
 * Diff our toner rows against what NEXTERP already has.
 * Matching is by `sku` (products) and `code` (categories). Products whose
 * category does not exist yet get `category_code` so the executor can resolve
 * the id after inserting the category.
 */
export function buildNexterpSyncPlan(input: {
  categories: NexterpTonerCategory[];
  products: NexterpTonerProduct[];
  existingCategories: ExistingNexterpCategory[];
  existingProducts: ExistingNexterpProduct[];
}): NexterpSyncPlan {
  const catIdByCode = new Map(
    input.existingCategories.map((c) => [c.code.toUpperCase(), c.id]),
  );
  const productBySku = new Map(
    input.existingProducts.map((p) => [p.sku.trim().toUpperCase(), p]),
  );

  const categoryInserts = input.categories.filter(
    (c) => !catIdByCode.has(c.code.toUpperCase()),
  );

  const productInserts: NexterpTonerProduct[] = [];
  const productUpdates: NexterpProductChange[] = [];
  const unchanged: string[] = [];

  for (const row of input.products) {
    const existing = productBySku.get(row.sku.toUpperCase());
    if (!existing) {
      productInserts.push(row);
      continue;
    }
    const fields: NexterpProductChange["fields"] = {};
    if (existing.name !== row.name) fields.name = row.name;
    if ((existing.description ?? "") !== row.description) {
      fields.description = row.description;
    }
    if ((existing.category_raw ?? "") !== row.category_raw) {
      fields.category_raw = row.category_raw;
    }
    if ((existing.uom ?? "") !== row.uom) fields.uom = row.uom;
    if (!sameNumber(existing.sell_price, row.sell_price)) {
      fields.sell_price = row.sell_price;
    }
    if (Number(existing.is_active) !== row.is_active) {
      fields.is_active = row.is_active;
    }
    const wantedCatId = catIdByCode.get(row.category_code.toUpperCase());
    if (wantedCatId == null || existing.category_id !== wantedCatId) {
      fields.category_code = row.category_code;
    }
    if (Object.keys(fields).length === 0) {
      unchanged.push(row.sku);
    } else {
      productUpdates.push({ id: existing.id, sku: row.sku, fields });
    }
  }

  return { categoryInserts, productInserts, productUpdates, unchanged };
}

/** Columns this sync writes; used for the NOT NULL preflight check. */
export const NEXTERP_WRITTEN_COLUMNS = {
  categories: ["code", "name_th", "name_en"],
  products: [
    "sku",
    "name",
    "description",
    "category_id",
    "category_raw",
    "uom",
    "sell_price",
    "is_active",
  ],
} as const;

export type ColumnInfo = {
  name: string;
  nullable: boolean;
  hasDefault: boolean;
  autoIncrement: boolean;
};

/**
 * Return columns that NEXTERP requires on INSERT but this sync does not fill
 * (NOT NULL, no default, not auto-increment). Empty = safe to insert.
 */
export function missingRequiredColumns(
  columns: ColumnInfo[],
  written: readonly string[],
): string[] {
  const writtenSet = new Set(written.map((c) => c.toLowerCase()));
  return columns
    .filter(
      (c) =>
        !c.nullable &&
        !c.hasDefault &&
        !c.autoIncrement &&
        !writtenSet.has(c.name.toLowerCase()),
    )
    .map((c) => c.name);
}
