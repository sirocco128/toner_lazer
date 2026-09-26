import { NextResponse } from "next/server";
import { clearSopGuideSessionCookie } from "@/lib/sop-guide-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearSopGuideSessionCookie();
  return NextResponse.json({ ok: true });
}
