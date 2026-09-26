/**
 * Thai province / district / subdistrict search.
 * Dataset decoded from earthchie/jquery.Thailand.js (MIT).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isBangkokProvince, normalizeThaiPlaceName } from "@/lib/thai-address-format";

export type ThaiAddressRow = {
  province: string;
  district: string;
  subdistrict: string;
  zip: string;
};

export {
  composeOrderShipTo,
  formatShipToLabel,
  formatThaiMailingAddress,
  isBangkokProvince,
  normalizeThaiPlaceName,
  parseThaiMailingAddress,
  quoteShipToParts,
  thaiDistrictLabel,
  thaiSubdistrictLabel,
} from "@/lib/thai-address-format";
export type { ThaiMailingParts } from "@/lib/thai-address-format";

type TambonNode = { n: string; z: string };
type DistrictNode = { n: string; tambons: TambonNode[] };
type ProvinceNode = { n: string; districts: DistrictNode[] };
type AddressBook = { source?: string; provinces: ProvinceNode[] };

let book: AddressBook | null = null;
let flat: ThaiAddressRow[] | null = null;

function loadBook(): AddressBook {
  if (book) return book;
  const path = join(process.cwd(), "data/thai-address.json");
  book = JSON.parse(readFileSync(path, "utf8")) as AddressBook;
  return book;
}

export function listThaiAddressRows(): ThaiAddressRow[] {
  if (flat) return flat;
  const loaded = loadBook();
  const rows: ThaiAddressRow[] = [];
  for (const province of loaded.provinces) {
    for (const district of province.districts) {
      for (const tambon of district.tambons) {
        rows.push({
          province: province.n,
          district: district.n,
          subdistrict: tambon.n,
          zip: tambon.z,
        });
      }
    }
  }
  flat = rows;
  return rows;
}

function includesQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  return haystack.includes(query);
}

export function listThaiProvinces(query = ""): string[] {
  const q = normalizeThaiPlaceName(query).toLowerCase().replace(/\./g, "");
  const names = loadBook().provinces.map((p) => p.n);
  if (!q) return names;
  if (isBangkokProvince(q) && names.includes("กรุงเทพมหานคร")) {
    return ["กรุงเทพมหานคร"];
  }
  return names.filter((name) => name.toLowerCase().includes(q));
}

export function listThaiDistricts(province: string, query = ""): string[] {
  const p = normalizeThaiPlaceName(province);
  const q = normalizeThaiPlaceName(query).toLowerCase();
  const node = loadBook().provinces.find((item) => item.n === p);
  const names = (node?.districts ?? []).map((d) => d.n);
  if (!q) return names;
  return names.filter((name) => name.toLowerCase().includes(q));
}

export function listThaiSubdistricts(
  province: string,
  district: string,
  query = "",
): Array<{ name: string; zip: string }> {
  const p = normalizeThaiPlaceName(province);
  const d = normalizeThaiPlaceName(district);
  const q = normalizeThaiPlaceName(query).toLowerCase();
  const provinceNode = loadBook().provinces.find((item) => item.n === p);
  const districtNode = provinceNode?.districts.find((item) => item.n === d);
  const rows = (districtNode?.tambons ?? []).map((t) => ({
    name: t.n,
    zip: t.z,
  }));
  if (!q) return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(q));
}

export function searchThaiAddress(query: string, limit = 12): ThaiAddressRow[] {
  const q = normalizeThaiPlaceName(query).toLowerCase();
  if (q.length < 1) return [];
  const matches: ThaiAddressRow[] = [];
  for (const row of listThaiAddressRows()) {
    const blob = `${row.subdistrict} ${row.district} ${row.province} ${row.zip}`;
    if (!includesQuery(blob.toLowerCase(), q)) continue;
    matches.push(row);
    if (matches.length >= limit) break;
  }
  return matches;
}

export function matchThaiAddressParts(input: {
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
}): Partial<ThaiAddressRow> {
  const province = normalizeThaiPlaceName(input.province || "");
  const district = normalizeThaiPlaceName(input.district || "");
  const subdistrict = normalizeThaiPlaceName(input.subdistrict || "");
  const rows = listThaiAddressRows();
  const hit =
    rows.find(
      (row) =>
        (!province || row.province === province) &&
        (!district || row.district === district) &&
        (!subdistrict || row.subdistrict === subdistrict),
    ) ||
    rows.find(
      (row) =>
        (!province || row.province.includes(province) || province.includes(row.province)) &&
        (!district || row.district.includes(district) || district.includes(row.district)) &&
        (!subdistrict ||
          row.subdistrict.includes(subdistrict) ||
          subdistrict.includes(row.subdistrict)),
    );
  if (!hit) {
    return {
      ...(province ? { province } : {}),
      ...(district ? { district } : {}),
      ...(subdistrict ? { subdistrict } : {}),
    };
  }
  return hit;
}
