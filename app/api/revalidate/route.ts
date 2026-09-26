import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  mapRevalidateTargets,
  REVALIDATE_MODELS,
} from "@/lib/revalidate-targets";
import {
  isUtf8PayloadTooLarge,
  verifyBearerToken,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const payloadSchema = z.object({
  event: z.string().min(1),
  model: z.enum(REVALIDATE_MODELS),
  entry: z
    .object({
      slug: z.string().optional(),
      category: z.string().optional(),
    })
    .optional(),
});

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET || "";
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (!verifyBearerToken(auth, secret)) {
    return unauthorized();
  }

  const raw = await request.text();
  if (isUtf8PayloadTooLarge(raw)) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { model, entry } = parsed.data;
  const targets = mapRevalidateTargets(model, entry);
  const revalidated: { paths: string[]; tags: string[] } = {
    paths: [],
    tags: [],
  };

  for (const p of targets.paths) {
    revalidatePath(p);
    revalidated.paths.push(p);
  }
  for (const t of targets.tags) {
    revalidateTag(t);
    revalidated.tags.push(t);
  }

  return NextResponse.json({
    revalidated: true,
    ...revalidated,
    now: Date.now(),
  });
}
