import { NextResponse } from "next/server";
import { lookupCompany, type CompanyRecord } from "@/lib/company-lookup";
import { getCustomerByTaxId, listCustomers } from "@/lib/customer-repository";
import { allowPublicLookup } from "@/lib/public-api-limit";
import { normalizeThaiTaxId } from "@/lib/th-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function customerToRecord(
  customer: NonNullable<ReturnType<typeof getCustomerByTaxId>>,
  taxId: string,
): CompanyRecord {
  return {
    taxId: customer.taxId || taxId,
    name: customer.company,
    address: customer.billingAddress,
    province: customer.defaultShipProvince,
    source: "crm",
    branches: [
      {
        code: "0",
        label: customer.billingBranch || "สำนักงานใหญ่",
        address: customer.billingAddress,
        province: customer.defaultShipProvince,
      },
    ],
  };
}

function localFromQuery(query: string): {
  localRecord: CompanyRecord | null;
  localRecords: CompanyRecord[];
} {
  const localRecords: CompanyRecord[] = [];
  let localRecord: CompanyRecord | null = null;
  try {
    const digits = query.replace(/\D/g, "");
    const normalized = normalizeThaiTaxId(digits);
    const byTax = normalized ? getCustomerByTaxId(normalized) : null;
    if (byTax) {
      localRecord = customerToRecord(byTax, normalized || "");
      localRecords.push(localRecord);
    }
    if (query.replace(/\D/g, "").length !== 13 && query.trim().length >= 2) {
      for (const customer of listCustomers({ q: query.trim(), limit: 8 })) {
        if (!customer.company) continue;
        const taxId = customer.taxId || "";
        if (localRecords.some((item) => item.taxId && taxId && item.taxId === taxId)) {
          continue;
        }
        localRecords.push(
          customerToRecord(customer, taxId),
        );
      }
    }
  } catch {
    return { localRecord, localRecords };
  }
  return { localRecord, localRecords };
}

export async function GET(request: Request) {
  if (!allowPublicLookup(request, "company-lookup")) {
    return NextResponse.json(
      { ok: false, error: "ค้นหาบ่อยเกินไป ลองใหม่ในอีกสักครู่" },
      { status: 429 },
    );
  }

  const url = new URL(request.url);
  const query = (
    url.searchParams.get("q") ||
    url.searchParams.get("taxId") ||
    url.searchParams.get("name") ||
    ""
  ).trim();

  const { localRecord, localRecords } = localFromQuery(query);
  try {
    const result = await lookupCompany(query, { localRecord, localRecords });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      ok: false,
      code: "upstream",
      error: "ค้นหาจากกรมสรรพากรไม่สำเร็จในตอนนี้ ลองเลขผู้เสียภาษี 13 หลักได้",
    });
  }
}
