import { NextResponse } from "next/server";
import { createCustomer, getCustomerByEmail } from "@/lib/customer-repository";
import {
  buildLineTextWebhookPayload,
  createLineLinkToken,
  isLineOaEnabled,
  listLineLabContacts,
  listLineLabTokens,
  lineOaLabStatus,
  processLineWebhook,
  signLineBody,
} from "@/lib/line-oa";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireOpsActor("customers.write");
  if (!actor) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    status: lineOaLabStatus(),
    contacts: listLineLabContacts(),
    tokens: listLineLabTokens(),
  });
}

export async function POST(request: Request) {
  const actor = await requireOpsActor("customers.write");
  if (!actor) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: {
    action?: string;
    contactId?: number;
    text?: string;
    lineUserId?: string;
    displayName?: string;
    invalidSignature?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action || "").trim();

  if (action === "seed") {
    const existing = getCustomerByEmail("line-lab@local.test");
    const customer =
      existing ||
      createCustomer({
        company: "ลูกค้าทดลองไลน์",
        email: "line-lab@local.test",
        contactName: "ผู้ทดสอบไลน์",
        phone: "0800000000",
        lineId: "@linelab",
        source: "line",
      });
    writeOpsAudit({
      actor,
      action: "line.lab.seed",
      status: "ok",
      resourceType: "customer",
      resourceId: String(customer.id),
    });
    return NextResponse.json({
      ok: true,
      customerId: customer.id,
      contacts: listLineLabContacts(),
      tokens: listLineLabTokens(),
    });
  }

  if (action === "token") {
    const contactId = Number(body.contactId);
    if (!Number.isFinite(contactId) || contactId <= 0) {
      return NextResponse.json({ ok: false, error: "ไม่พบผู้ติดต่อ" }, { status: 400 });
    }
    const token = createLineLinkToken(contactId);
    writeOpsAudit({
      actor,
      action: "line.lab.token",
      status: "ok",
      resourceType: "contact",
      resourceId: String(contactId),
    });
    return NextResponse.json({
      ok: true,
      token,
      contacts: listLineLabContacts(),
      tokens: listLineLabTokens(),
    });
  }

  if (action === "simulate") {
    if (!isLineOaEnabled()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "ยังไม่เปิด webhook — ตั้ง LINE_OA_TEST_MODE=true หรือ LINE_OA_ENABLED=true",
        },
        { status: 400 },
      );
    }
    const text = String(body.text || "").trim();
    const lineUserId = String(body.lineUserId || "Ulab-user-001").trim();
    const displayName = String(body.displayName || "").trim() || undefined;
    if (!text) {
      return NextResponse.json({ ok: false, error: "พิมพ์ข้อความก่อนส่ง" }, { status: 400 });
    }
    const payload = buildLineTextWebhookPayload({ text, lineUserId, displayName });
    const rawBody = JSON.stringify(payload);
    const signature = body.invalidSignature
      ? "invalid-signature"
      : signLineBody(rawBody);
    const result = processLineWebhook(rawBody, signature);
    writeOpsAudit({
      actor,
      action: "line.lab.simulate",
      status: result.body.ok ? "ok" : "denied",
      resourceType: "line_webhook",
      detail: {
        httpStatus: result.httpStatus,
        bound: result.body.bound,
        processed: result.body.processed,
      },
    });
    return NextResponse.json({
      ok: true,
      httpStatus: result.httpStatus,
      webhook: result.body,
      request: {
        path: "/api/line/webhook",
        method: "POST",
        headers: { "x-line-signature": signature },
        body: payload,
      },
      contacts: listLineLabContacts(),
      tokens: listLineLabTokens(),
    });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
