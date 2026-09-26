import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { pingDb } from "@/lib/database";
import { pingClamd } from "@/lib/object-scan";
import {
  isMinioConfigured,
  pingMinio,
  pingMinioReplica,
} from "@/lib/object-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function manualDocsStatus(): "ok" | "missing" {
  const sample = resolve(process.cwd(), "docs", "manual", "02-USER-MANUAL.md");
  return existsSync(sample) ? "ok" : "missing";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const storage = process.env.LEAD_STORAGE_MODE || "sqlite";
  const timestamp = new Date().toISOString();
  const manualDocs = manualDocsStatus();

  if (!deep) {
    return NextResponse.json(
      {
        status: "ok",
        service: "premium-giftset-web",
        storage,
        database: "not-checked",
        manualDocs,
        timestamp,
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const ok = pingDb();
    if (!ok) {
      throw new Error("database ping failed");
    }
    let objects: "minio" | "local" | "minio-error" = "local";
    if (isMinioConfigured()) {
      objects = (await pingMinio()) ? "minio" : "minio-error";
    }
    const replica = await pingMinioReplica();
    const clamavHost = (process.env.CLAMD_HOST || "").trim();
    const clamav = clamavHost
      ? (await pingClamd())
        ? "ok"
        : "error"
      : "unset";
    return NextResponse.json(
      {
        status: "ok",
        service: "premium-giftset-web",
        storage,
        database: "ok",
        objects,
        replica,
        clamav,
        manualDocs,
        cwd: process.cwd(),
        timestamp,
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        service: "premium-giftset-web",
        storage,
        database: "error",
        timestamp,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
