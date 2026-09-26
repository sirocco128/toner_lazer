#!/usr/bin/env node
/**
 * Copy Strapi local uploads (cms/public/uploads) into MinIO and rewrite
 * files.url / files.provider in Postgres so the catalog reads from MinIO.
 *
 *   docker compose up -d postgres minio minio-init
 *   npm run cms:media:minio
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const UPLOADS = join(ROOT, "cms/public/uploads");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(join(ROOT, ".env.local"));
loadEnvFile(join(ROOT, "cms/.env"));

const endpoint = (process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000").replace(
  /\/+$/,
  "",
);
const accessKey = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || "terabis";
const secretKey =
  process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || "terabisMinioDev1";
const bucket = process.env.MINIO_BUCKET_PUBLIC || "terabis-public";
const rootPath = (process.env.MINIO_CMS_ROOT || "cms").replace(/^\/+|\/+$/g, "");
const publicBase = (
  process.env.MINIO_PUBLIC_BASE_URL || `${endpoint}/${bucket}`
).replace(/\/+$/, "");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout || "";
}

function listUploadFiles() {
  if (!existsSync(UPLOADS)) return [];
  return readdirSync(UPLOADS).filter((name) => name !== ".gitkeep" && !name.startsWith("."));
}

function rewriteLocalUploadUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return raw;
  if (raw.includes(`${bucket}/`)) return raw;
  const name = raw.replace(/^.*\/uploads\//, "").replace(/^\//, "");
  if (!name || name === raw) return raw;
  return `${publicBase}/${rootPath}/${name}`;
}

function rewriteFormats(formats) {
  if (!formats || typeof formats !== "object") return formats;
  const next = JSON.parse(JSON.stringify(formats));
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.url === "string") {
      node.url = rewriteLocalUploadUrl(node.url);
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(next);
  return next;
}

async function main() {
  const files = listUploadFiles();
  if (files.length === 0) {
    console.log("No files in cms/public/uploads — nothing to copy.");
  } else {
    console.log(`Copying ${files.length} files to MinIO ${bucket}/${rootPath}/ …`);
    run("docker", [
      "run",
      "--rm",
      "-v",
      `${UPLOADS}:/data:ro`,
      "--network",
      "web_chaina_default",
      "--entrypoint",
      "/bin/sh",
      "minio/mc:latest",
      "-c",
      `mc alias set local http://minio:9000 "${accessKey}" "${secretKey}" >/dev/null && mc mb -p local/${bucket} || true && mc anonymous set download local/${bucket} || true && mc mirror --overwrite /data local/${bucket}/${rootPath}`,
    ]);
    console.log("MinIO mirror complete.");
  }

  const sql = `SELECT id, url, provider, formats FROM files ORDER BY id;`;
  const jsonOut = spawnSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "giftset",
      "-d",
      "giftset",
      "-t",
      "-A",
      "-F",
      "\t",
      "-c",
      sql,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (jsonOut.status !== 0) {
    console.warn("Postgres files table not updated (is giftset-postgres up?).");
    console.warn((jsonOut.stderr || jsonOut.stdout || "").trim());
    console.log(`Public base: ${publicBase}/${rootPath}/`);
    return;
  }

  const rows = (jsonOut.stdout || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length === 0) {
    console.log("No Strapi files rows — upload from admin after restarting Strapi.");
    return;
  }

  let updated = 0;
  for (const line of rows) {
    const [id, url, provider, formatsRaw] = line.split("\t");
    if (!id) continue;
    let formats = null;
    if (formatsRaw && formatsRaw !== "\\N" && formatsRaw !== "") {
      try {
        formats = JSON.parse(formatsRaw);
      } catch {
        formats = null;
      }
    }
    const nextUrl = rewriteLocalUploadUrl(url);
    const nextFormats = rewriteFormats(formats);
    const nextProvider = "aws-s3";
    const formatsSql =
      nextFormats == null
        ? "NULL"
        : `'${JSON.stringify(nextFormats).replace(/'/g, "''")}'::jsonb`;
    const escapedUrl = nextUrl.replace(/'/g, "''");
    const update = `UPDATE files SET url = '${escapedUrl}', provider = '${nextProvider}', formats = ${formatsSql} WHERE id = ${Number(id)};`;
    if (nextUrl === url && provider === nextProvider) continue;
    run("docker", [
      "compose",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "giftset",
      "-d",
      "giftset",
      "-c",
      update,
    ]);
    updated += 1;
    console.log(`  files.id=${id} ${provider || "local"} → aws-s3`);
  }
  console.log(`Updated ${updated} Strapi media rows.`);
  console.log("Restart Strapi (npm run develop in ./cms) so new uploads go to MinIO.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
