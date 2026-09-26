import { NextResponse } from "next/server";
import { allowPublicLookup } from "@/lib/public-api-limit";
import {
  listThaiDistricts,
  listThaiProvinces,
  listThaiSubdistricts,
  searchThaiAddress,
} from "@/lib/thai-address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!allowPublicLookup(request, "thai-address")) {
    return NextResponse.json(
      { ok: false, error: "ค้นหาบ่อยเกินไป ลองใหม่ในอีกสักครู่" },
      { status: 429 },
    );
  }

  const url = new URL(request.url);
  const level = (url.searchParams.get("level") || "search").trim();
  const q = url.searchParams.get("q") || "";
  const province = url.searchParams.get("province") || "";
  const district = url.searchParams.get("district") || "";

  if (level === "province") {
    return NextResponse.json({
      ok: true,
      items: listThaiProvinces(q).slice(0, 80).map((name) => ({ label: name, value: name })),
    });
  }
  if (level === "district") {
    return NextResponse.json({
      ok: true,
      items: listThaiDistricts(province, q)
        .slice(0, 80)
        .map((name) => ({ label: name, value: name })),
    });
  }
  if (level === "subdistrict") {
    return NextResponse.json({
      ok: true,
      items: listThaiSubdistricts(province, district, q)
        .slice(0, 80)
        .map((row) => ({
          label: row.zip ? `${row.name} (${row.zip})` : row.name,
          value: row.name,
          zip: row.zip,
        })),
    });
  }

  const rows = searchThaiAddress(q, 12);
  return NextResponse.json({
    ok: true,
    items: rows.map((row) => ({
      label: `${row.subdistrict} · ${row.district} · ${row.province}`,
      value: row.subdistrict,
      province: row.province,
      district: row.district,
      subdistrict: row.subdistrict,
      zip: row.zip,
    })),
  });
}
