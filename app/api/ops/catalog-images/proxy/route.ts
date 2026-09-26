import { NextResponse } from "next/server";
import { extractOfferImages } from "@/lib/alibaba/images";
import { requireOpsSession } from "@/lib/ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_MS = 12_000;
const MAX_BYTES = 4_000_000;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function GET(request: Request) {
  if (!(await requireOpsSession())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get("url") || "";
  const allowed = extractOfferImages(raw).at(0);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "url not allowed" }, { status: 400 });
  }

  try {
    const response = await fetch(allowed, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": BROWSER_UA,
        Referer: "https://detail.1688.com/",
      },
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: "fetch failed" }, { status: 502 });
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength < 32 || bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "bad image" }, { status: 502 });
    }
    const type = (response.headers.get("content-type") || "image/jpeg").split(";")[0]!.trim();
    const contentType = type.startsWith("image/") ? type : "image/jpeg";
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "fetch failed" }, { status: 502 });
  }
}
