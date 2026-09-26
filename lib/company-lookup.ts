/**
 * Lookup a Thai juristic person by 13-digit tax ID or company name.
 * Tax ID: local CRM → Revenue Department VAT XML → MOC/DBD.
 * Name: Revenue Department VAT JSON (empty TIN) → unique companies.
 * Branch details load later, after the buyer picks a company.
 */

import { isValidThaiTaxId, normalizeThaiTaxId } from "@/lib/th-billing";
import { matchThaiAddressParts } from "@/lib/thai-address";

export type CompanyLookupSource = "crm" | "rd_vat" | "dbd_moc" | "dbd_openapi";

const RD_VAT_URL = "https://rdws.rd.go.th/serviceRD3/vatserviceRD3.asmx";
const RD_VAT_NS = "https://rdws.rd.go.th/serviceRD3/vatserviceRD3";
const RD_VAT_JSON_URL = "https://rdws.rd.go.th/jsonRD/vatserviceRD3.asmx";
const RD_VAT_JSON_NS = "https://rdws.rd.go.th/JserviceRD3/vatserviceRD3";
const RD_NAME_MATCH_CAP = 15;
const RD_NAME_MIN_LEN = 2;
const RD_JSON_ROW_SCAN_CAP = 400;

export type CompanyBranch = {
  code: string;
  label: string;
  streetAddress?: string | null;
  address?: string | null;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  zip?: string | null;
};

export type CompanyRecord = {
  taxId: string;
  name: string;
  nameEn?: string | null;
  status?: string | null;
  address?: string | null;
  streetAddress?: string | null;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  zip?: string | null;
  source: CompanyLookupSource;
  branchCode?: string;
  branches?: CompanyBranch[];
};

export type CompanyLookupOk = {
  ok: true;
  matches?: CompanyRecord[];
  needsPick?: boolean;
} & CompanyRecord;

export type CompanyLookupFail = {
  ok: false;
  code: "invalid" | "not_found" | "upstream";
  error: string;
};

export type CompanyLookupResult = CompanyLookupOk | CompanyLookupFail;

type FetchLike = typeof fetch;

type MocJuristic = {
  juristicID?: string;
  juristicNameTH?: string;
  juristicNameEN?: string;
  juristicStatus?: string;
  addressDetail?: {
    houseNumber?: string;
    moo?: string;
    soi?: string;
    street?: string;
    subDistrict?: string;
    district?: string;
    province?: string;
  };
};

function joinAddress(parts: Array<string | null | undefined>): string | null {
  const cleaned = parts
    .map((part) => String(part || "").trim())
    .filter((part) => part && part !== "-");
  return cleaned.length ? cleaned.join(" ") : null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeCompanyNameQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 80);
}

function companyNameQueryVariants(raw: string): string[] {
  const collapsed = normalizeCompanyNameQuery(raw);
  const nospace = collapsed.replace(/\s+/g, "");
  const stripped = collapsed
    .replace(/^บริษัท\s+/u, "")
    .replace(/\s+จำกัด(?:\s*\(มหาชน\))?$/u, "")
    .trim();
  return [...new Set([collapsed, nospace, stripped].filter((item) => item.length >= RD_NAME_MIN_LEN))];
}

function decodeXmlText(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function soapFieldValues(xml: string, tag: string): string[] {
  const block = xml.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"),
  );
  const inner = block?.[1];
  if (!inner) return [];
  const anyTypes = [
    ...inner.matchAll(/<anyType\b[^>]*>([\s\S]*?)<\/anyType>/gi),
  ];
  const values = anyTypes.length
    ? anyTypes.map((match) => decodeXmlText((match[1] ?? "").replace(/<[^>]+>/g, "")))
    : [decodeXmlText(inner.replace(/<[^>]+>/g, ""))];
  return values.map((value) => (value === "-" ? "" : value));
}

function soapField(xml: string, tag: string): string {
  return soapFieldValues(xml, tag)[0] || "";
}

function soapValueAt(values: string[], index: number): string {
  return values[index] || "";
}

export function formatVatBranchLabel(
  code: string | number | null | undefined,
  branchName?: string | null,
): string {
  const digits = String(code ?? "").replace(/\D/g, "");
  const n = digits.length ? Number.parseInt(digits, 10) : 0;
  const base =
    !Number.isFinite(n) || n <= 0
      ? "สำนักงานใหญ่"
      : `สาขาที่ ${n} (${String(n).padStart(5, "0")})`;
  const extra = String(branchName || "").trim();
  if (
    extra &&
    extra !== base &&
    extra !== "สำนักงานใหญ่" &&
    !extra.includes("สำนักงานใหญ่")
  ) {
    return `${base} · ${extra}`;
  }
  return base;
}

export function toCompanyBranch(record: CompanyRecord): CompanyBranch {
  return {
    code: record.branchCode || "0",
    label: formatVatBranchLabel(record.branchCode),
    streetAddress: record.streetAddress ?? null,
    address: record.address ?? null,
    province: record.province ?? null,
    district: record.district ?? null,
    subdistrict: record.subdistrict ?? null,
    zip: record.zip ?? null,
  };
}

function recordFingerprint(record: Pick<CompanyRecord, "streetAddress" | "province" | "zip">): string {
  return [record.streetAddress, record.province, record.zip]
    .map((part) => String(part || "").trim())
    .join("|");
}

function isHqEcho(
  extra: CompanyRecord,
  hq: CompanyRecord,
  requestedCode: number,
): boolean {
  if (requestedCode <= 0) return false;
  return recordFingerprint(extra) === recordFingerprint(hq);
}

type RdVatSoapFields = {
  vtitleName: string[];
  vBranchTitleName: string[];
  vName: string[];
  vBranchName: string[];
  vProvince: string[];
  vAmphur: string[];
  vThambol: string[];
  vMooNumber: string[];
  vSoiName: string[];
  vStreetName: string[];
  vHouseNumber: string[];
  vPostCode: string[];
  vBusinessFirstDate: string[];
  vBranchNumber: string[];
  vbranchNumber: string[];
};

function uniqueBranches(branches: CompanyBranch[]): CompanyBranch[] {
  const seen = new Set<string>();
  const out: CompanyBranch[] = [];
  for (const branch of branches) {
    const key = `${branch.code}|${branch.label}|${branch.streetAddress || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(branch);
  }
  return out.sort(
    (a, b) =>
      Number.parseInt(a.code.replace(/\D/g, "") || "0", 10) -
      Number.parseInt(b.code.replace(/\D/g, "") || "0", 10),
  );
}

function buildRdVatRecord(
  fields: RdVatSoapFields,
  index: number,
  taxId: string,
  fallbackCode: string,
): CompanyRecord | null {
  const title =
    soapValueAt(fields.vtitleName, index) ||
    soapValueAt(fields.vBranchTitleName, index);
  const name =
    soapValueAt(fields.vName, index) || soapValueAt(fields.vBranchName, index);
  if (!name) return null;
  const province = soapValueAt(fields.vProvince, index);
  const district = soapValueAt(fields.vAmphur, index);
  const subdistrict = soapValueAt(fields.vThambol, index);
  const moo = soapValueAt(fields.vMooNumber, index);
  const soi = soapValueAt(fields.vSoiName, index);
  const street = soapValueAt(fields.vStreetName, index);
  const house = soapValueAt(fields.vHouseNumber, index);
  const postCode = soapValueAt(fields.vPostCode, index);
  const rawCode =
    soapValueAt(fields.vBranchNumber, index) ||
    soapValueAt(fields.vbranchNumber, index) ||
    fallbackCode;
  const streetLine = joinAddress([
    house,
    moo ? `หมู่ ${moo}` : "",
    soi ? `ซอย${soi}` : "",
    street ? `ถ.${street}` : "",
  ]);
  const matched = matchThaiAddressParts({ province, district, subdistrict });
  return {
    taxId,
    name: [title, name].filter(Boolean).join(" "),
    nameEn: null,
    status: soapValueAt(fields.vBusinessFirstDate, index)
      ? "จดทะเบียนภาษีมูลค่าเพิ่ม"
      : null,
    streetAddress: streetLine,
    address: joinAddress([
      streetLine,
      subdistrict,
      district,
      province,
      postCode,
    ]),
    province: matched.province || province || null,
    district: matched.district || district || null,
    subdistrict: matched.subdistrict || subdistrict || null,
    zip: postCode || matched.zip || null,
    source: "rd_vat",
    branchCode: String(rawCode).replace(/\D/g, "") || fallbackCode,
    branches: undefined,
  };
}

export function parseRdVatSoapRecords(
  xml: string,
  taxId: string,
  fallbackCode = "0",
): CompanyRecord[] {
  if (soapField(xml, "vmsgerr")) return [];
  const fields = {
    vtitleName: soapFieldValues(xml, "vtitleName"),
    vBranchTitleName: soapFieldValues(xml, "vBranchTitleName"),
    vName: soapFieldValues(xml, "vName"),
    vBranchName: soapFieldValues(xml, "vBranchName"),
    vProvince: soapFieldValues(xml, "vProvince"),
    vAmphur: soapFieldValues(xml, "vAmphur"),
    vThambol: soapFieldValues(xml, "vThambol"),
    vMooNumber: soapFieldValues(xml, "vMooNumber"),
    vSoiName: soapFieldValues(xml, "vSoiName"),
    vStreetName: soapFieldValues(xml, "vStreetName"),
    vHouseNumber: soapFieldValues(xml, "vHouseNumber"),
    vPostCode: soapFieldValues(xml, "vPostCode"),
    vBusinessFirstDate: soapFieldValues(xml, "vBusinessFirstDate"),
    vBranchNumber: soapFieldValues(xml, "vBranchNumber"),
    vbranchNumber: soapFieldValues(xml, "vbranchNumber"),
  };
  const count = Math.max(
    fields.vName.length,
    fields.vBranchName.length,
    fields.vProvince.length,
    fields.vBranchNumber.length,
    0,
  );
  if (!count) return [];
  const records: CompanyRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const code =
      count === 1
        ? fallbackCode
        : String(soapValueAt(fields.vBranchNumber, index) || index);
    const record = buildRdVatRecord(fields, index, taxId, code);
    if (record) records.push(record);
  }
  return records;
}

export function parseRdVatSoap(xml: string, taxId: string): CompanyRecord | null {
  return parseRdVatSoapRecords(xml, taxId, "0")[0] ?? null;
}

function jsonStringList(payload: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value) && value.length) {
      return value.slice(0, RD_JSON_ROW_SCAN_CAP).map((item) =>
        item == null || item === "-" ? "" : String(item).trim(),
      );
    }
    if (typeof value === "string" && value && value !== "-") {
      return [value.trim()];
    }
    if (value && typeof value === "object") {
      const values = Object.values(value as Record<string, unknown>)
        .slice(0, RD_JSON_ROW_SCAN_CAP)
        .map((item) => (item == null || item === "-" ? "" : String(item).trim()));
      if (values.some(Boolean)) return values;
    }
  }
  return [];
}

function extractServiceResultJson(xml: string): Record<string, unknown> | null {
  const match = xml.match(/<ServiceResult\b[^>]*>([\s\S]*?)<\/ServiceResult>/i);
  if (!match?.[1]) return null;
  const raw = decodeXmlText(match[1]);
  if (!raw || raw === "null") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseRdVatJsonRecords(payload: Record<string, unknown>): CompanyRecord[] {
  const nids = jsonStringList(payload, ["vNID", "NID"]);
  const titles = jsonStringList(payload, ["vtitleName", "TitleName"]);
  const names = jsonStringList(payload, ["vName", "Name"]);
  const branchNames = jsonStringList(payload, ["vBranchName", "BranchName"]);
  const branchTitles = jsonStringList(payload, ["vBranchTitleName", "BranchTitleName"]);
  const provinces = jsonStringList(payload, ["vProvince", "Province"]);
  const districts = jsonStringList(payload, ["vAmphur", "Amphur"]);
  const subdistricts = jsonStringList(payload, ["vThambol", "Thambol"]);
  const moos = jsonStringList(payload, ["vMooNumber", "MooNumber"]);
  const sois = jsonStringList(payload, ["vSoiName", "SoiName"]);
  const streets = jsonStringList(payload, ["vStreetName", "StreetName"]);
  const houses = jsonStringList(payload, ["vHouseNumber", "HouseNumber"]);
  const postCodes = jsonStringList(payload, ["vPostCode", "PostCode"]);
  const branchNumbers = jsonStringList(payload, ["vBranchNumber", "BranchNumber"]);
  const count = Math.max(nids.length, names.length, branchNames.length, 0);
  if (!count) return [];
  const records: CompanyRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const title = titles[index] || branchTitles[index] || "";
    const name = names[index] || branchNames[index] || "";
    if (!name) continue;
    const taxId = nids[index] || "";
    const province = provinces[index] || "";
    const district = districts[index] || "";
    const subdistrict = subdistricts[index] || "";
    const streetLine = joinAddress([
      houses[index],
      moos[index] ? `หมู่ ${moos[index]}` : "",
      sois[index] ? `ซอย${sois[index]}` : "",
      streets[index] ? `ถ.${streets[index]}` : "",
    ]);
    const matched = matchThaiAddressParts({ province, district, subdistrict });
    records.push({
      taxId,
      name: [title, name].filter(Boolean).join(" "),
      nameEn: null,
      status: null,
      streetAddress: streetLine,
      address: joinAddress([
        streetLine,
        subdistrict,
        district,
        province,
        postCodes[index],
      ]),
      province: matched.province || province || null,
      district: matched.district || district || null,
      subdistrict: matched.subdistrict || subdistrict || null,
      zip: postCodes[index] || matched.zip || null,
      source: "rd_vat",
      branchCode: String(branchNumbers[index] || "0").replace(/\D/g, "") || "0",
    });
  }
  return records;
}

export function uniqueCompaniesByTaxId(
  records: CompanyRecord[],
  cap = RD_NAME_MATCH_CAP,
): CompanyRecord[] {
  const byTax = new Map<string, CompanyRecord>();
  for (const record of records) {
    const taxId = normalizeThaiTaxId(record.taxId) || record.taxId;
    if (!taxId) continue;
    const existing = byTax.get(taxId);
    const isHq = (record.branchCode || "0") === "0";
    if (!existing) {
      if (byTax.size >= cap) continue;
      byTax.set(taxId, { ...record, taxId, branches: undefined });
      continue;
    }
    if (isHq && existing.branchCode !== "0") {
      byTax.set(taxId, { ...record, taxId, branches: undefined });
    }
  }
  return [...byTax.values()];
}

async function fetchJson(
  url: string,
  init: RequestInit,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function fromMoc(payload: MocJuristic, taxId: string): CompanyRecord | null {
  const name = String(payload.juristicNameTH || "").trim();
  if (!name) return null;
  const detail = payload.addressDetail;
  const matched = matchThaiAddressParts({
    province: detail?.province,
    district: detail?.district,
    subdistrict: detail?.subDistrict,
  });
  const streetLine = joinAddress([
    detail?.houseNumber,
    detail?.moo ? `หมู่ ${detail.moo}` : "",
    detail?.soi ? `ซอย${detail.soi}` : "",
    detail?.street ? `ถ.${detail.street}` : "",
  ]);
  return {
    taxId,
    name,
    nameEn: payload.juristicNameEN || null,
    status: payload.juristicStatus || null,
    streetAddress: streetLine,
    address: joinAddress([
      streetLine,
      detail?.subDistrict,
      detail?.district,
      detail?.province,
    ]),
    province: matched.province || detail?.province || null,
    district: matched.district || detail?.district || null,
    subdistrict: matched.subdistrict || detail?.subDistrict || null,
    zip: matched.zip || null,
    source: "dbd_moc",
  };
}

const RD_EXTRA_BRANCH_START = 1;
const RD_EXTRA_BRANCH_MAX = 12;

function rdVatSoapBody(taxId: string, branchNumber: number): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:vat="${RD_VAT_NS}">
  <soap:Header/>
  <soap:Body>
    <vat:Service>
      <vat:username>anonymous</vat:username>
      <vat:password>anonymous</vat:password>
      <vat:TIN>${taxId}</vat:TIN>
      <vat:Name></vat:Name>
      <vat:ProvinceCode>0</vat:ProvinceCode>
      <vat:BranchNumber>${branchNumber}</vat:BranchNumber>
      <vat:AmphurCode>0</vat:AmphurCode>
    </vat:Service>
  </soap:Body>
</soap:Envelope>`;
}

async function fetchRdVatXml(
  taxId: string,
  branchNumber: number,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(RD_VAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/soap+xml; charset=utf-8",
        SOAPAction: `${RD_VAT_NS}/Service`,
      },
      body: rdVatSoapBody(taxId, branchNumber),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function lookupRdVatBranch(
  taxId: string,
  branchNumber: number,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<CompanyRecord | null> {
  const xml = await fetchRdVatXml(taxId, branchNumber, fetchImpl, timeoutMs);
  if (!xml) return null;
  return parseRdVatSoapRecords(xml, taxId, String(branchNumber))[0] ?? null;
}

async function attachRdVatBranches(
  hqRecords: CompanyRecord[],
  taxId: string,
  fetchImpl: FetchLike,
): Promise<CompanyRecord | null> {
  if (!hqRecords.length) return null;
  const hq = hqRecords[0];
  if (!hq) return null;
  const records = [...hqRecords];
  if (hqRecords.length <= 1) {
    try {
      const firstExtra = await lookupRdVatBranch(
        taxId,
        RD_EXTRA_BRANCH_START,
        fetchImpl,
        2_000,
      );
      if (firstExtra && !isHqEcho(firstExtra, hq, RD_EXTRA_BRANCH_START)) {
        records.push(firstExtra);
        const more = await Promise.all(
          Array.from(
            { length: RD_EXTRA_BRANCH_MAX - RD_EXTRA_BRANCH_START },
            (_, index) => RD_EXTRA_BRANCH_START + 1 + index,
          ).map((branchNumber) =>
            lookupRdVatBranch(taxId, branchNumber, fetchImpl, 2_000)
              .then((record) =>
                record && !isHqEcho(record, hq, branchNumber) ? record : null,
              )
              .catch(() => null),
          ),
        );
        for (const record of more) {
          if (record) records.push(record);
        }
      }
    } catch {
      // Branch probing is best-effort; HQ name is still usable.
    }
  }
  const branches = uniqueBranches(records.map(toCompanyBranch));
  return { ...hq, branches };
}

function rdVatJsonSoapBody(tin: string, name: string, branchNumber: number): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:vat="${RD_VAT_JSON_NS}">
  <soap:Header/>
  <soap:Body>
    <vat:Service>
      <vat:username>anonymous</vat:username>
      <vat:password>anonymous</vat:password>
      <vat:TIN>${escapeXml(tin)}</vat:TIN>
      <vat:Name>${escapeXml(name)}</vat:Name>
      <vat:ProvinceCode>0</vat:ProvinceCode>
      <vat:BranchNumber>${branchNumber}</vat:BranchNumber>
      <vat:AmphurCode>0</vat:AmphurCode>
    </vat:Service>
  </soap:Body>
</soap:Envelope>`;
}

async function fetchRdVatJsonXml(
  tin: string,
  name: string,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(RD_VAT_JSON_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/soap+xml; charset=utf-8",
        SOAPAction: `${RD_VAT_JSON_NS}/Service`,
      },
      body: rdVatJsonSoapBody(tin, name, 0),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupRdVatByName(
  rawName: string,
  fetchImpl: FetchLike,
): Promise<CompanyRecord[]> {
  const queries = companyNameQueryVariants(rawName);
  for (const name of queries) {
    const xml = await fetchRdVatJsonXml("", name, fetchImpl, 8_000);
    if (!xml) continue;
    const payload = extractServiceResultJson(xml);
    if (!payload) continue;
    const matches = uniqueCompaniesByTaxId(parseRdVatJsonRecords(payload));
    if (matches.length) return matches;
  }
  return [];
}

async function lookupRdVat(
  taxId: string,
  fetchImpl: FetchLike,
): Promise<CompanyRecord | null> {
  const xml = await fetchRdVatXml(taxId, 0, fetchImpl, 4_000);
  if (!xml) return null;
  const records = parseRdVatSoapRecords(xml, taxId, "0");
  return attachRdVatBranches(records, taxId, fetchImpl);
}

async function lookupMoc(
  taxId: string,
  fetchImpl: FetchLike,
): Promise<CompanyRecord | null> {
  const url = `https://dataapi.moc.go.th/juristic?juristic_id=${encodeURIComponent(taxId)}`;
  const payload = (await fetchJson(
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "terabis-quote-form",
      },
    },
        fetchImpl,
        6_000,
      )) as MocJuristic;
  return fromMoc(payload, taxId);
}

async function lookupDbdOpenApi(
  taxId: string,
  fetchImpl: FetchLike,
): Promise<CompanyRecord | null> {
  const key = (process.env.DBD_OPENAPI_KEY || "").trim();
  if (!key) return null;
  const base = (
    process.env.DBD_OPENAPI_URL || "https://openapi.dbd.go.th"
  ).replace(/\/+$/, "");
  const payload = (await fetchJson(
    `${base}/v1/juristic/${encodeURIComponent(taxId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Consumer-Key": key,
      },
    },
        fetchImpl,
        6_000,
      )) as Record<string, unknown>;
  const data =
    payload && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : payload;
  const name = String(
    data?.juristicNameTH || data?.nameTh || data?.name || "",
  ).trim();
  if (!name) return null;
  return {
    taxId,
    name,
    nameEn: String(data?.juristicNameEN || data?.nameEn || "") || null,
    status: String(data?.juristicStatus || data?.status || "") || null,
    address: String(data?.address || "") || null,
    source: "dbd_openapi",
  };
}

function withDefaultBranches(record: CompanyRecord): CompanyRecord {
  if (record.branches?.length) {
    return { ...record, branches: uniqueBranches(record.branches) };
  }
  return {
    ...record,
    branches: uniqueBranches([
      toCompanyBranch({ ...record, branchCode: record.branchCode || "0" }),
    ]),
  };
}

export async function lookupCompanyByTaxId(
  raw: string,
  options?: {
    fetchImpl?: FetchLike;
    localRecord?: CompanyRecord | null;
    /** Wait this long for Revenue Department before accepting MOC (default 1.2s). */
    preferRdMs?: number;
  },
): Promise<CompanyLookupResult> {
  const taxId = normalizeThaiTaxId(raw);
  if (!taxId || !isValidThaiTaxId(taxId)) {
    return {
      ok: false,
      code: "invalid",
      error: "เลขทะเบียนนิติบุคคลต้องเป็นตัวเลข 13 หลักที่ถูกต้อง",
    };
  }

  if (options?.localRecord?.name) {
    const crmBranches = uniqueBranches(
      options.localRecord.branches?.length
        ? options.localRecord.branches
        : [
            {
              code: "0",
              label: "สำนักงานใหญ่",
              streetAddress: options.localRecord.streetAddress ?? null,
              address: options.localRecord.address ?? null,
              province: options.localRecord.province ?? null,
              district: options.localRecord.district ?? null,
              subdistrict: options.localRecord.subdistrict ?? null,
              zip: options.localRecord.zip ?? null,
            },
          ],
    );
    return {
      ok: true,
      ...options.localRecord,
      taxId,
      source: "crm",
      branches: crmBranches,
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const errors: string[] = [];
  const preferRdMs = Math.max(0, options?.preferRdMs ?? 1_200);

  const rdTask = lookupRdVat(taxId, fetchImpl).catch((error) => {
    errors.push(error instanceof Error ? error.message : "rd");
    return null;
  });
  const mocTask = lookupMoc(taxId, fetchImpl).catch((error) => {
    errors.push(error instanceof Error ? error.message : "moc");
    return null;
  });

  let waitTimer: ReturnType<typeof setTimeout> | undefined;
  const rdQuick = await Promise.race([
    rdTask,
    new Promise<null>((resolve) => {
      waitTimer = setTimeout(() => resolve(null), preferRdMs);
    }),
  ]);
  if (waitTimer) clearTimeout(waitTimer);
  if (rdQuick) return { ok: true, ...withDefaultBranches(rdQuick) };

  const moc = await mocTask;
  if (moc) return { ok: true, ...withDefaultBranches(moc) };

  const rd = await rdTask;
  if (rd) return { ok: true, ...withDefaultBranches(rd) };

  try {
    const dbd = await lookupDbdOpenApi(taxId, fetchImpl);
    if (dbd) return { ok: true, ...withDefaultBranches(dbd) };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "dbd");
  }

  if (errors.length) {
    return {
      ok: false,
      code: "upstream",
      error:
        "ค้นหาจากกรมสรรพากรและกรมพัฒนาธุรกิจการค้าไม่สำเร็จในตอนนี้ กรอกชื่อบริษัทเองได้",
    };
  }

  return {
    ok: false,
    code: "not_found",
    error: "ไม่พบบริษัทจากเลขทะเบียนนี้ กรอกชื่อบริษัทเองได้",
  };
}

export async function lookupCompany(
  raw: string,
  options?: {
    fetchImpl?: FetchLike;
    localRecord?: CompanyRecord | null;
    localRecords?: CompanyRecord[];
    preferRdMs?: number;
  },
): Promise<CompanyLookupResult> {
  const trimmed = normalizeCompanyNameQuery(raw);
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 13) {
    return lookupCompanyByTaxId(digits, options);
  }
  if (trimmed.length < RD_NAME_MIN_LEN) {
    return {
      ok: false,
      code: "invalid",
      error: "พิมพ์ชื่อบริษัทอย่างน้อย 2 ตัวอักษร หรือเลขผู้เสียภาษี 13 หลัก",
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const errors: string[] = [];
  let rdMatches: CompanyRecord[] = [];
  try {
    rdMatches = await lookupRdVatByName(trimmed, fetchImpl);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "rd-name");
  }

  const crmMatches = (options?.localRecords || []).filter((item) => item.name);
  const merged = uniqueCompaniesByTaxId([...rdMatches, ...crmMatches]);
  if (!merged.length) {
    if (errors.length) {
      return {
        ok: false,
        code: "upstream",
        error: "ค้นหาจากกรมสรรพากรไม่สำเร็จในตอนนี้ ลองเลขผู้เสียภาษี 13 หลักได้",
      };
    }
    return {
      ok: false,
      code: "not_found",
      error:
        "ไม่พบบริษัทจากชื่อนี้ ลองเลขผู้เสียภาษี 13 หลัก หรือพิมพ์ชื่อให้ใกล้เคียงกว่านี้",
    };
  }

  if (merged.length === 1) {
    return { ok: true, ...withDefaultBranches(merged[0]!) };
  }

  const first = merged[0]!;
  return {
    ok: true,
    ...withDefaultBranches(first),
    matches: merged.map((item) => withDefaultBranches(item)),
    needsPick: true,
  };
}
