import { parseAndMapSmartgiftBrief } from "@/lib/public-brief";
import { publicOptionsResponse } from "@/lib/public-cors";
import {
  publicError,
  publicJson,
  requirePublicBriefRate,
} from "@/lib/public-http";
import { submitQuotePayload } from "@/lib/quote-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BRIEF_METHODS = "POST, OPTIONS";

export async function OPTIONS(request: Request) {
  return publicOptionsResponse(request, BRIEF_METHODS);
}

export async function POST(request: Request) {
  const limited = requirePublicBriefRate(request);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return publicError(
      request,
      400,
      "validation",
      { fieldErrors: { body: ["Invalid JSON"] } },
      BRIEF_METHODS,
    );
  }

  const mapped = parseAndMapSmartgiftBrief(body);
  if (!mapped.ok) {
    return publicError(
      request,
      400,
      "validation",
      {
        fieldErrors: mapped.fieldErrors,
        formError: mapped.formError,
      },
      BRIEF_METHODS,
    );
  }

  const result = await submitQuotePayload(mapped.data, {
    headers: request.headers,
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    return publicError(
      request,
      400,
      "validation",
      {
        fieldErrors: result.fieldErrors,
        formError: result.formError || result.error || "ส่งคำขอไม่สำเร็จ",
      },
      BRIEF_METHODS,
    );
  }

  return publicJson(
    request,
    {
      ok: true,
      requestId: result.requestId,
      opsPath: `/ops/quotes/${result.requestId}`,
      messageTh:
        "ส่งคำขอแล้ว ทีมขายจะติดต่อกลับเร็ว ๆ นี้ กรุณาเก็บเลขคำขอไว้ digติดตาม",
      nextSteps: [
        "รอการติดต่อจากทีมขาย (โทร / อีเมล / LINE)",
        "เตรียมโลโก้และจำนวนชุดโดยประมาณ",
        "สอบถามเพิ่มได้ที่ช่องทางติดต่อบนเว็บ",
      ],
      neutral: result.neutral === true ? true : undefined,
    },
    200,
    BRIEF_METHODS,
  );
}
