/**
 * CSV import/export for ops customers.
 * Accepts FlowAccount contact book headers (Thai) and a simple internal header set.
 */

import type {
  CreateCustomerParams,
  CustomerRecord,
  CustomerSource,
  CustomerType,
} from "@/lib/customer-types";
import { isCustomerSource, isCustomerType } from "@/lib/customer-types";
import { normalizeThaiTaxId } from "@/lib/th-billing";

export type ParsedCustomerCsvRow = {
  company: string;
  email: string;
  phone: string | null;
  contactName: string | null;
  taxId: string | null;
  billingAddress: string | null;
  billingBranch: string;
  customerType: CustomerType;
  source: CustomerSource;
  lineId: string | null;
  notes: string | null;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((cell) => cell.trim());
}

function normalizeHeader(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/^\uFEFF/, "").toLowerCase();
}

const HEADER_ALIASES: Record<string, keyof ParsedCustomerCsvRow | "skip"> = {
  company: "company",
  บริษัท: "company",
  ชื่อลูกค้า: "company",
  "ชื่อธุรกิจ/ชื่อบุคคล": "company",
  ชื่อธุรกิจชื่อบุคคล: "company",
  email: "email",
  อีเมล: "email",
  phone: "phone",
  โทร: "phone",
  เบอร์มือถือ: "phone",
  เบอร์สำนักงาน: "phone",
  contactname: "contactName",
  ชื่อผู้ติดต่อ: "contactName",
  taxid: "taxId",
  เลขผู้เสียภาษี: "taxId",
  address: "billingAddress",
  ที่อยู่: "billingAddress",
  billingaddress: "billingAddress",
  branch: "billingBranch",
  สาขา: "billingBranch",
  สำนักงานสาขา: "billingBranch",
  "สำนักงาน/สาขา": "billingBranch",
  "สำนักงานใหญ่/สาขา": "billingBranch",
  type: "customerType",
  ประเภทผู้ติดต่อ: "customerType",
  source: "source",
  ที่มา: "source",
  line: "lineId",
  lineid: "lineId",
  ไลน์: "lineId",
  รหัสผู้ติดต่อ: "lineId",
  notes: "notes",
  หมายเหตุ: "notes",
};

function mapType(raw: string): CustomerType {
  const v = raw.trim();
  if (isCustomerType(v)) return v;
  if (/ราชการ|government/i.test(v)) return "government";
  if (/ศึกษา|school|education/i.test(v)) return "education";
  if (/agency|เอเจน/i.test(v)) return "agency";
  if (/บุคคล|individual/i.test(v)) return "individual";
  return "company";
}

function extractLineId(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const match = /line\s*[:：]\s*(.+)/i.exec(text);
  if (match) return match[1]!.trim();
  if (text.startsWith("@")) return text;
  return text.length <= 40 ? text : null;
}

export function parseCustomerCsv(text: string): {
  rows: ParsedCustomerCsvRow[];
  errors: string[];
} {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const errors: string[] = [];
  if (lines.length < 2) return { rows: [], errors: ["ไฟล์ว่าง หรือไม่มีแถวข้อมูล"] };

  let headerIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 8); i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const joined = cells.map(normalizeHeader).join(" ");
    if (
      joined.includes("อีเมล") ||
      joined.includes("email") ||
      joined.includes("ชื่อธุรกิจ") ||
      joined.includes("ชื่อลูกค้า") ||
      joined.includes("company")
    ) {
      headerIndex = i;
      break;
    }
  }

  const headers = splitCsvLine(lines[headerIndex]!).map(normalizeHeader);
  const mapped = headers.map((h) => HEADER_ALIASES[h] || HEADER_ALIASES[h.replace(/\s/g, "")] || null);
  const rows: ParsedCustomerCsvRow[] = [];

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const rec: Partial<ParsedCustomerCsvRow> = {};
    let address2 = "";
    headers.forEach((_, idx) => {
      const key = mapped[idx];
      const value = cells[idx] || "";
      if (!key || key === "skip") return;
      if (key === "customerType") rec.customerType = mapType(value);
      else if (key === "source") rec.source = isCustomerSource(value) ? value : "import";
      else if (key === "lineId") rec.lineId = extractLineId(value);
      else if (key === "billingAddress") {
        rec.billingAddress = [rec.billingAddress, value].filter(Boolean).join(" ");
      } else {
        (rec as Record<string, unknown>)[key] = value;
      }
    });
    const headerRaw = splitCsvLine(lines[headerIndex]!);
    headerRaw.forEach((h, idx) => {
      const n = normalizeHeader(h);
      if (n === "ที่อยู่2" || n === "ที่อยู่3" || n === "รหัสไปรษณีย์") {
        address2 = [address2, cells[idx]].filter(Boolean).join(" ");
      }
    });
    if (address2) {
      rec.billingAddress = [rec.billingAddress, address2].filter(Boolean).join(" ").trim();
    }

    const company = String(rec.company || "").trim();
    if (!company || company === "-") {
      errors.push(`แถว ${i + 1}: ไม่มีชื่อบริษัท`);
      continue;
    }
    let email = String(rec.email || "").trim().toLowerCase();
    if (!email) {
      email = `import.${i}.${Date.now()}@no-email.local`;
    }
    rows.push({
      company,
      email,
      phone: rec.phone?.trim() || null,
      contactName: rec.contactName?.trim() || null,
      taxId: normalizeThaiTaxId(rec.taxId),
      billingAddress: rec.billingAddress?.trim() || null,
      billingBranch: rec.billingBranch?.trim() || "สำนักงานใหญ่",
      customerType: rec.customerType || "company",
      source: rec.source || "import",
      lineId: rec.lineId ?? null,
      notes: rec.notes?.trim() || null,
    });
  }

  return { rows, errors };
}

export function toCreateCustomerParams(
  row: ParsedCustomerCsvRow,
): CreateCustomerParams {
  return {
    company: row.company,
    email: row.email,
    phone: row.phone,
    contactName: row.contactName,
    taxId: row.taxId,
    billingName: row.company,
    billingAddress: row.billingAddress,
    billingBranch: row.billingBranch,
    customerType: row.customerType,
    source: row.source,
    lineId: row.lineId,
    notes: row.notes,
  };
}

export function customersToCsv(rows: CustomerRecord[]): string {
  const header = [
    "company",
    "email",
    "phone",
    "contactName",
    "lineId",
    "taxId",
    "billingAddress",
    "billingBranch",
    "customerType",
    "source",
    "tags",
    "status",
    "quoteCount",
    "orderCount",
  ];
  const escape = (value: string | number | null | undefined) => {
    const s = value == null ? "" : String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    header.join(","),
    ...rows.map((c) =>
      [
        c.company,
        c.email,
        c.phone,
        c.contactName,
        c.lineId,
        c.taxId,
        c.billingAddress,
        c.billingBranch,
        c.customerType,
        c.source,
        c.tags.join("|"),
        c.status,
        c.quoteCount,
        c.orderCount,
      ]
        .map(escape)
        .join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}
