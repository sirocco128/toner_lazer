import { NextResponse } from "next/server";
import {
  FACTORY_LEAK_REFUSAL_TH,
  INJECTION_REFUSAL_TH,
  sanitizeUserInstruction,
} from "@/lib/ai-safety";
import {
  generateMockupVariantWithOpenRouter,
  getOpenRouterMockupConfig,
} from "@/lib/openrouter-mockup";
import type { MockupSurfaceKind, MockupVariantId } from "@/lib/mockup-studio";
import { MOCKUP_VARIANTS, usageContextCopy } from "@/lib/mockup-studio";

export const runtime = "nodejs";
export const maxDuration = 120;

type GenerateBody = {
  productName?: string;
  surfaceLabel?: string;
  surfaceKind?: MockupSurfaceKind;
  finishLabel?: string;
  text?: string;
  productDataUrl?: string;
  logoDataUrl?: string | null;
  activityIndex?: number;
  variantIds?: MockupVariantId[];
  refineInstruction?: string;
  previousDataUrl?: string | null;
};

function isDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

export async function GET() {
  const config = getOpenRouterMockupConfig();
  return NextResponse.json({
    enabled: config.enabled,
    model: config.enabled ? config.model : null,
  });
}

export async function POST(request: Request) {
  const config = getOpenRouterMockupConfig();
  if (!config.enabled) {
    return NextResponse.json(
      {
        ok: false,
        error: "ยังไม่ได้ตั้งค่า OpenRouter — ใช้โหมด canvas แทน",
        fallback: "canvas",
      },
      { status: 503 },
    );
  }

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const userBits = [
    body.productName,
    body.surfaceLabel,
    body.finishLabel,
    body.text,
    body.refineInstruction,
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n");
  const userCheck = sanitizeUserInstruction(userBits, 2_000);
  if (!userCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          userCheck.reason === "injection"
            ? INJECTION_REFUSAL_TH
            : FACTORY_LEAK_REFUSAL_TH,
        fallback: "canvas",
      },
      { status: 400 },
    );
  }

  if (!isDataUrl(body.productDataUrl)) {
    return NextResponse.json(
      { ok: false, error: "ต้องการรูปสินค้า (data URL)" },
      { status: 400 },
    );
  }

  const hasLogo = isDataUrl(body.logoDataUrl);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!hasLogo && !text) {
    return NextResponse.json(
      { ok: false, error: "ต้องมีโลโก้หรือข้อความอย่างน้อยอย่างใดอย่างหนึ่ง" },
      { status: 400 },
    );
  }

  const surfaceKind = body.surfaceKind || "cylinder";
  const activityIndex = Number(body.activityIndex) || 0;
  const copy = usageContextCopy(surfaceKind, activityIndex);
  const refineRaw =
    typeof body.refineInstruction === "string"
      ? body.refineInstruction.trim()
      : "";
  const refineCheck = sanitizeUserInstruction(refineRaw, 400);
  if (!refineCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          refineCheck.reason === "injection"
            ? INJECTION_REFUSAL_TH
            : FACTORY_LEAK_REFUSAL_TH,
        fallback: "canvas",
      },
      { status: 400 },
    );
  }
  const refineInstruction = refineCheck.text;
  const previousDataUrl = isDataUrl(body.previousDataUrl)
    ? body.previousDataUrl
    : null;
  const variantIds =
    Array.isArray(body.variantIds) && body.variantIds.length > 0
      ? body.variantIds
      : (MOCKUP_VARIANTS.map((item) => item.id) as MockupVariantId[]);

  try {
    const results = [];
    for (const variantId of variantIds) {
      const activityHint =
        variantId === "lifestyle" ? copy.lifestyleBody : undefined;
      const placementHint =
        variantId === "office" ? copy.officeBody : undefined;
      const retailHint =
        variantId === "retail" ? copy.retailBody : undefined;
      const item = await generateMockupVariantWithOpenRouter({
        variantId,
        surfaceLabel: body.surfaceLabel || "สินค้า",
        surfaceKind,
        finishLabel: body.finishLabel || "มาตรฐาน",
        productName: body.productName || "Gift Set",
        text,
        hasLogo,
        productDataUrl: body.productDataUrl!,
        logoDataUrl: hasLogo ? body.logoDataUrl : null,
        previousDataUrl,
        activityHint,
        placementHint,
        retailHint,
        refineInstruction,
      });
      results.push(item);
    }

    return NextResponse.json({
      ok: true,
      engine: "openrouter",
      model: config.model,
      variants: results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "สร้างภาพด้วย AI ไม่สำเร็จ";
    return NextResponse.json(
      { ok: false, error: message, fallback: "canvas" },
      { status: 502 },
    );
  }
}
