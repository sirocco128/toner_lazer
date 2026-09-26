import { NextResponse } from "next/server";
import { isLineOaEnabled, isLineOaTestMode, processLineWebhook } from "@/lib/line-oa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    enabled: isLineOaEnabled(),
    testMode: isLineOaTestMode(),
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");
  const result = processLineWebhook(rawBody, signature);
  return NextResponse.json(result.body, { status: result.httpStatus });
}
