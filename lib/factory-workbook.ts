/**
 * Parse factory gift-set workbooks (xlsx ZIP / CSV) into product rows.
 * Same packing notation as the old SmartGift calculator:
 *   "20 sets/ctn, 47.5*45.5*51cm, 17kgs"
 * EXW cells may be a live formula `32/6.5` (RMB / factory USD rate).
 *
 * The "code" column is the factory item identity (nt0001, TSQ01-2),
 * not the commercial SKU A00001 / B00001 / C00003 / D00001.
 *
 * Images in the xlsx are skipped — only sheet text is read.
 * Old .xls (OLE) is not supported; save as .xlsx or .csv first.
 */

import { isCommercialProductId } from "@/lib/sku-master-ids";

export const COMMERCIAL_SKU_IMPORT_WARNING =
  "นี่คือรหัสขาย A/B/C/D ของเรา ไม่ใช่รหัสโรงงาน — ใส่รหัสโรงงาน เช่น nt0001 หรือ TSQ01-2";

export const PACK_RE =
  /(\d+)\s*(?:sets?|pcs?)\s*\/\s*ctn\s*[,，]\s*([\d.]+)\s*\*\s*([\d.]+)\s*\*\s*([\d.]+)\s*cm(?:\s*[,，]\s*([\d.]+)\s*kgs?)?/i;
export const ITEM_RE = /^([A-Z]{2,4}[\w-]*\d[\w-]*)/;
export const RMB_RE = /^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/;
const DESC_LABEL = /^(function|details?|product|name|feature|description)\b/i;
const MAX_PRODUCTS = 2000;

export type FactoryWorkbookProduct = {
  code: string;
  name: string;
  rmb: number | null;
  usd: number | null;
  upc: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  cartonKg: number | null;
  dimsAreCarton: boolean;
  row: number;
};

export type FactoryWorkbookResult = {
  products: FactoryWorkbookProduct[];
  warnings: string[];
};

type SheetCell = { v: string; f: string | null };
type SheetRow = { r: number; cells: Record<number, SheetCell> };

function isNum(s: string): boolean {
  return s !== "" && Number.isFinite(Number(s));
}

function xmlText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function colIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref);
  if (!letters) return 0;
  let n = 0;
  for (const ch of letters[0]!.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}="([^"]*)"`, "i").exec(tag);
  return m ? m[1]! : null;
}

function u16(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8);
}

function u32(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset]! |
      (buf[offset + 1]! << 8) |
      (buf[offset + 2]! << 16) |
      (buf[offset + 3]! << 24)) >>>
    0
  );
}

function isOleCompound(buf: Uint8Array): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0
  );
}

function isZip(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

type ZipEntry = { method: number; compSize: number; localOffset: number };

function readZipDirectory(buf: Uint8Array): Map<string, ZipEntry> {
  const tailLen = Math.min(buf.length, 66_000);
  const tailStart = buf.length - tailLen;
  let eocd = -1;
  for (let i = buf.length - 22; i >= tailStart; i -= 1) {
    if (
      buf[i] === 0x50 &&
      buf[i + 1] === 0x4b &&
      buf[i + 2] === 0x05 &&
      buf[i + 3] === 0x06
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("ไฟล์นี้ไม่ใช่ .xlsx ที่อ่านได้ (หา ZIP directory ไม่เจอ)");
  }
  const count = u16(buf, eocd + 10);
  const dirSize = u32(buf, eocd + 12);
  const dirOffset = u32(buf, eocd + 16);
  if (dirOffset + dirSize > buf.length) {
    throw new Error("โครงสร้าง ZIP ในไฟล์ Excel เสียหาย");
  }
  const dir = buf.subarray(dirOffset, dirOffset + dirSize);
  const entries = new Map<string, ZipEntry>();
  const dec = new TextDecoder();
  let p = 0;
  for (let n = 0; n < count && p + 46 <= dir.length; n += 1) {
    if (u32(dir, p) !== 0x02014b50) break;
    const method = u16(dir, p + 10);
    const compSize = u32(dir, p + 20);
    const nameLen = u16(dir, p + 28);
    const extraLen = u16(dir, p + 30);
    const commentLen = u16(dir, p + 32);
    const localOffset = u32(dir, p + 42);
    const name = dec.decode(dir.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "function") {
    throw new Error("เบราว์เซอร์นี้ไม่รองรับการแตกไฟล์ .xlsx");
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const stream = new Blob([copy.buffer])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function readZipEntry(
  buf: Uint8Array,
  entry: ZipEntry,
): Promise<Uint8Array> {
  const head = entry.localOffset;
  if (u32(buf, head) !== 0x04034b50) {
    throw new Error("ZIP local header เสียหาย");
  }
  const start = head + 30 + u16(buf, head + 26) + u16(buf, head + 28);
  const blob = buf.subarray(start, start + entry.compSize);
  if (entry.method === 0) return blob;
  if (entry.method !== 8) {
    throw new Error(`ZIP ใช้การบีบอัดแบบที่ไม่รองรับ (method ${entry.method})`);
  }
  return inflateRaw(blob);
}

async function readZipText(
  buf: Uint8Array,
  entries: Map<string, ZipEntry>,
  name: string,
): Promise<string | null> {
  const entry = entries.get(name);
  if (!entry) return null;
  const bytes = await readZipEntry(buf, entry);
  return new TextDecoder().decode(bytes);
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let si: RegExpExecArray | null;
  while ((si = siRe.exec(xml))) {
    const parts: string[] = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
    let t: RegExpExecArray | null;
    while ((t = tRe.exec(si[1]!))) parts.push(xmlText(t[1]!));
    out.push(parts.join(""));
  }
  return out;
}

function parseSheet(xml: string, shared: string[]): SheetRow[] {
  const out: SheetRow[] = [];
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml))) {
    const r = Number(attr(rowMatch[1]!, "r") || "0");
    const cells: Record<number, SheetCell> = {};
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[2]!))) {
      const meta = cellMatch[1]!;
      const body = cellMatch[2]!;
      const ref = attr(meta, "r");
      if (!ref) continue;
      const t = attr(meta, "t");
      const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(body);
      const fMatch = /<f\b[^>]*>([\s\S]*?)<\/f>/i.exec(body);
      let val: string | null = null;
      if (t === "s" && vMatch) {
        val = shared[Number(vMatch[1])] ?? "";
      } else if (t === "inlineStr") {
        const texts = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map(
          (m) => xmlText(m[1]!),
        );
        val = texts.join("");
      } else if (vMatch) {
        val = xmlText(vMatch[1]!);
      }
      if (val == null) continue;
      val = String(val).replace(/\s+/g, " ").trim();
      if (!val) continue;
      cells[colIndex(ref)] = {
        v: val,
        f: fMatch ? xmlText(fMatch[1]!) : null,
      };
    }
    if (Object.keys(cells).length) out.push({ r, cells });
  }
  return out;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i]!;
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === "\t") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (c !== "\r") cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

function num(value: string): number | null {
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function headerIndex(head: string[], ...keys: string[]): number {
  return head.findIndex((h) => keys.some((k) => h.includes(k)));
}

function productsFromCsvGrid(rows: string[][]): FactoryWorkbookProduct[] {
  if (!rows.length) throw new Error("ไฟล์ CSV ว่าง");
  const head = rows[0]!.map((h) => h.toLowerCase().trim());
  const c = {
    code: headerIndex(head, "item", "รหัส", "sku", "code"),
    name: headerIndex(head, "product", "detail", "ชื่อ", "รายละเอียด", "name"),
    rmb: headerIndex(head, "rmb", "exw", "ต้นทุน", "cny", "factory"),
    upc: headerIndex(head, "per carton", "per ctn", "ต่อกล่อง", "/ctn", "upc"),
    l: headerIndex(head, "length", "ยาว", "กว้าง"),
    w: headerIndex(head, "width", "กว้าง", "ลึก"),
    h: headerIndex(head, "height", "สูง"),
    kg: headerIndex(head, "weight", "น้ำหนัก", "kgs", "kg"),
  };
  if (c.code < 0) {
    throw new Error(
      "ไม่พบคอลัมน์รหัสสินค้า — ต้องมีหัวตารางที่มีคำว่า Item / SKU / รหัส",
    );
  }
  const kgHeader = c.kg >= 0 ? head[c.kg]! : "";
  const cartonWeight =
    /carton|ctn|กล่อง/.test(kgHeader) ||
    (c.upc >= 0 && !/ชิ้น|ชุด|unit|\/set/.test(kgHeader));

  const products: FactoryWorkbookProduct[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i]!;
    const get = (idx: number) => (idx >= 0 ? (r[idx] ?? "").trim() : "");
    const code = get(c.code);
    if (!code) continue;
    const L = num(get(c.l));
    const W = num(get(c.w));
    const H = num(get(c.h));
    const upc = num(get(c.upc));
    const kg = num(get(c.kg));
    products.push({
      code,
      name: get(c.name),
      rmb: num(get(c.rmb)),
      usd: null,
      upc,
      lengthCm: L,
      widthCm: W,
      heightCm: H,
      cartonKg: kg,
      dimsAreCarton: Boolean(upc && upc > 1) || cartonWeight,
      row: i + 1,
    });
  }
  return products;
}

function looksLikeHeaderRow(row: SheetRow): boolean {
  const text = Object.values(row.cells)
    .map((cell) => cell.v.toLowerCase())
    .join(" ");
  return (
    /sku|item|รหัส|code/.test(text) &&
    /rmb|exw|cny|ต้นทุน|cost|factory/.test(text)
  );
}

function sheetToCsvGrid(rows: SheetRow[]): string[][] {
  let maxCol = 0;
  for (const row of rows) {
    for (const key of Object.keys(row.cells)) {
      maxCol = Math.max(maxCol, Number(key));
    }
  }
  return rows.map((row) => {
    const line: string[] = [];
    for (let i = 0; i <= maxCol; i += 1) {
      line.push(row.cells[i]?.v ?? "");
    }
    return line;
  });
}

export function buildFactoryProductsFromSheetRows(
  rows: SheetRow[],
): FactoryWorkbookProduct[] {
  if (rows[0] && looksLikeHeaderRow(rows[0])) {
    return productsFromCsvGrid(sheetToCsvGrid(rows));
  }

  const products: Array<
    FactoryWorkbookProduct & { nameParts: string[]; endRow: number }
  > = [];
  let cur: (typeof products)[number] | null = null;

  for (const { r, cells } of rows) {
    const idx = Object.keys(cells)
      .map(Number)
      .sort((a, b) => a - b);
    const first = cells[0]?.v || "";
    const priceKey = idx.find((i) => i >= 3 && isNum(cells[i]!.v));
    const code = first ? ITEM_RE.exec(first) : null;

    if (code && priceKey !== undefined) {
      const pc = cells[priceKey]!;
      const m = pc.f ? RMB_RE.exec(pc.f) : null;
      const heads = idx
        .filter((i) => i > 0 && i < priceKey && !isNum(cells[i]!.v))
        .map((i) => cells[i]!.v);
      cur = {
        code: code[1]!,
        name: heads.length === 1 ? heads[0]! : "",
        nameParts: heads,
        rmb: m ? Number(m[1]) : Number(pc.v),
        usd: Number.isFinite(Number(pc.v)) ? Number(pc.v) : null,
        upc: null,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
        cartonKg: null,
        dimsAreCarton: true,
        row: r,
        endRow: r,
      };
      if (!Number.isFinite(cur.rmb as number)) cur.rmb = null;
      products.push(cur);
    }
    if (!cur) continue;
    cur.endRow = r;

    if (!cur.name && idx.length >= 2) {
      const label = cells[idx[0]!]?.v || "";
      const value = cells[idx[1]!]?.v || "";
      if (DESC_LABEL.test(label) && value.length > 8 && !isNum(value)) {
        cur.name = value;
      }
    }
    if (!cur.upc) {
      const packed = PACK_RE.exec(idx.map((i) => cells[i]!.v).join(" | "));
      if (packed) {
        cur.upc = Number(packed[1]);
        cur.lengthCm = Number(packed[2]);
        cur.widthCm = Number(packed[3]);
        cur.heightCm = Number(packed[4]);
        if (packed[5]) cur.cartonKg = Number(packed[5]);
        cur.dimsAreCarton = true;
      }
    }
  }

  return products.map((p) => {
    const name = p.name || p.nameParts.join(" · ");
    return {
      code: p.code,
      name,
      rmb: p.rmb,
      usd: p.usd,
      upc: p.upc,
      lengthCm: p.lengthCm,
      widthCm: p.widthCm,
      heightCm: p.heightCm,
      cartonKg: p.cartonKg,
      dimsAreCarton: p.dimsAreCarton,
      row: p.row,
    };
  });
}

export function commercialSkuCodesIn(products: FactoryWorkbookProduct[]): string[] {
  return products
    .map((product) => product.code)
    .filter((code) => isCommercialProductId(code));
}

function withCodeWarnings(
  products: FactoryWorkbookProduct[],
  extra: string[] = [],
): FactoryWorkbookResult {
  const warnings = [...extra];
  const commercial = commercialSkuCodesIn(products);
  if (commercial.length) {
    warnings.push(
      `${commercial.length} แถวใช้รหัสขาย ${commercial.slice(0, 3).join(", ")}${
        commercial.length > 3 ? "…" : ""
      } — ไฟล์นี้ต้องเป็นรหัสโรงงาน ไม่ใช่ A00001 / B00001 / C00003`,
    );
  }
  return { products, warnings };
}

export function parseFactoryCsv(text: string): FactoryWorkbookResult {
  const products = productsFromCsvGrid(parseCsv(text)).slice(0, MAX_PRODUCTS);
  return withCodeWarnings(products);
}

export async function parseFactoryWorkbook(
  buf: Uint8Array,
  fileName = "",
): Promise<FactoryWorkbookResult> {
  const lower = fileName.toLowerCase();
  const warnings: string[] = [];

  if (isOleCompound(buf) || lower.endsWith(".xls")) {
    throw new Error(
      "ไฟล์ .xls แบบเก่าอ่านไม่ได้ — บันทึกเป็น .xlsx หรือ .csv แล้วอัปโหลดใหม่",
    );
  }

  if (lower.endsWith(".csv") || !isZip(buf)) {
    const text = new TextDecoder().decode(buf);
    if (text.includes(",") || text.includes("\t")) {
      return parseFactoryCsv(text);
    }
    if (!isZip(buf)) {
      throw new Error("รองรับเฉพาะ .xlsx / .xlsm / .csv");
    }
  }

  const entries = readZipDirectory(buf);
  const sheetName =
    [...entries.keys()].find((n) => /^xl\/worksheets\/sheet1\.xml$/i.test(n)) ||
    [...entries.keys()].find((n) => /^xl\/worksheets\/.*\.xml$/i.test(n));
  if (!sheetName) throw new Error("ไม่พบ worksheet ในไฟล์");

  const shared = parseSharedStrings(
    await readZipText(buf, entries, "xl/sharedStrings.xml"),
  );
  const xml = await readZipText(buf, entries, sheetName);
  if (!xml) throw new Error("อ่านชีตสินค้าไม่ได้");
  const products = buildFactoryProductsFromSheetRows(
    parseSheet(xml, shared),
  ).slice(0, MAX_PRODUCTS);
  if (products.length === 0) {
    warnings.push(
      "อ่านไฟล์ได้แต่ไม่พบแถวสินค้า — ตรวจว่ารหัสโรงงานอยู่คอลัมน์แรก และมีราคา RMB",
    );
  }
  return withCodeWarnings(products, warnings);
}

export function factoryUnitDims(product: FactoryWorkbookProduct): {
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
} {
  const upc =
    product.upc && product.upc > 1 && Number.isFinite(product.upc)
      ? product.upc
      : 1;
  const out: {
    weightKg?: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
  } = {};
  if (product.cartonKg && product.cartonKg > 0) {
    out.weightKg = product.cartonKg / upc;
  }
  if (
    product.lengthCm &&
    product.widthCm &&
    product.heightCm &&
    product.lengthCm > 0 &&
    product.widthCm > 0 &&
    product.heightCm > 0
  ) {
    out.lengthCm = product.lengthCm;
    out.widthCm = product.widthCm;
    out.heightCm =
      product.dimsAreCarton && upc > 1
        ? product.heightCm / upc
        : product.heightCm;
  }
  return out;
}
