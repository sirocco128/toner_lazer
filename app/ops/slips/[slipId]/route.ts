import { NextResponse } from "next/server";
import { isOpsAuthConfigured, requireOpsActor } from "@/lib/ops-auth";
import { recordObjectAccess } from "@/lib/object-access";
import { getPaymentSlip, readSlipFile } from "@/lib/payment-slips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ slipId: string }>;

export async function GET(
  request: Request,
  { params }: { params: Params },
) {
  const actor = isOpsAuthConfigured()
    ? await requireOpsActor("documents.restricted")
    : null;
  if (!actor) {
    recordObjectAccess({
      action: "object.deny",
      status: "denied",
      kind: "slips",
      request,
      errorMessage: "unauthorized",
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slipId } = await params;
  const slip = getPaymentSlip(slipId);
  if (!slip) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const bytes = await readSlipFile(slip.filePath);
  if (!bytes) return NextResponse.json({ error: "missing_file" }, { status: 404 });
  recordObjectAccess({
    actor,
    action: "object.download",
    status: "ok",
    kind: "slips",
    key: `slips/${slip.filePath.replace(/\\/g, "/").split("/").pop() || slip.filePath}`,
    resourceId: slip.slipId,
    purpose: "view_payment_slip",
    request,
  });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": slip.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
