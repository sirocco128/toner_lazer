import { NextResponse } from "next/server";
import { customersToCsv } from "@/lib/customer-csv";
import {
  listCustomers,
} from "@/lib/customer-repository";
import type { CustomerSource, CustomerStatus, CustomerType } from "@/lib/customer-types";
import {
  CUSTOMER_SOURCES,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
} from "@/lib/customer-types";
import { requireOpsActor } from "@/lib/ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await requireOpsActor("customers.read");
  if (!actor) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const statusRaw = url.searchParams.get("status") || "all";
  const typeRaw = url.searchParams.get("type") || "all";
  const sourceRaw = url.searchParams.get("source") || "all";
  const tax = url.searchParams.get("tax") || "all";
  const orders = url.searchParams.get("orders") || "all";

  const rows = listCustomers({
    q: url.searchParams.get("q") || "",
    status:
      statusRaw === "all" || (CUSTOMER_STATUSES as readonly string[]).includes(statusRaw)
        ? (statusRaw as CustomerStatus | "all")
        : "all",
    customerType:
      typeRaw === "all" || (CUSTOMER_TYPES as readonly string[]).includes(typeRaw)
        ? (typeRaw as CustomerType | "all")
        : "all",
    source:
      sourceRaw === "all" || (CUSTOMER_SOURCES as readonly string[]).includes(sourceRaw)
        ? (sourceRaw as CustomerSource | "all")
        : "all",
    tag: url.searchParams.get("tag") || "",
    taxReady: tax === "ready" || tax === "missing" ? tax : "all",
    province: url.searchParams.get("province") || "",
    hasOrders: orders === "yes" || orders === "no" ? orders : "all",
    limit: 500,
  });

  const csv = customersToCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="customers.csv"',
    },
  });
}
