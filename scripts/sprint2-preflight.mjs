#!/usr/bin/env node
/**
 * Sprint 2 preflight — validate intake completeness before migration/cutover.
 *
 *   node scripts/sprint2-preflight.mjs
 *   node scripts/sprint2-preflight.mjs --strict
 *   node scripts/sprint2-preflight.mjs --intake path/to/intake.json
 */
import { spawnSync } from "node:child_process";
import {
  DEFAULT_INTAKE_PATH,
  TEMPLATE_PATH,
  loadIntake,
  asFieldSection,
  fieldValue,
  fieldReady,
  missingFields,
  ROOT,
} from "./sprint2-intake-lib.mjs";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const intakeArgIdx = args.indexOf("--intake");
const intakePath =
  intakeArgIdx >= 0 ? args[intakeArgIdx + 1] : DEFAULT_INTAKE_PATH;

const BUSINESS_REQUIRED = [
  "brandName",
  "legalName",
  "phoneDisplay",
  "phoneHref",
  "email",
  "lineId",
  "lineUrl",
  "siteDescription",
];

const TECH_STAGING = ["siteUrl", "strapiUrl", "strapiApiToken", "revalidateSecret", "ipHashSecret"];

function main() {
  console.log("sprint2:preflight — intake readiness check");
  console.log(`  intake: ${intakePath}`);
  console.log(`  strict: ${strict ? "yes (APPROVED only + check:demo)" : "no"}`);
  console.log("");

  let intake;
  try {
    intake = loadIntake(intakePath);
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error));
    console.log("");
    console.log(`Template: ${TEMPLATE_PATH}`);
    process.exit(strict ? 1 : 0);
  }

  const business = asFieldSection(intake.data.business);
  const technical = asFieldSection(intake.data.technical);
  const gates = asFieldSection(intake.data.gates);
  const content = asFieldSection(intake.data.content);

  const opts = { requireApproved: strict };
  const businessMissing = missingFields(business, BUSINESS_REQUIRED, opts);
  const techMissing = missingFields(technical, TECH_STAGING, opts);

  console.log("Business fields:");
  if (businessMissing.length === 0) {
    console.log("  ✓ ready");
  } else {
    console.log(`  ✗ missing/not approved: ${businessMissing.join(", ")}`);
  }

  console.log("Technical (staging minimum):");
  if (techMissing.length === 0) {
    console.log("  ✓ ready");
  } else {
    console.log(`  ✗ missing/not approved: ${techMissing.join(", ")}`);
  }

  console.log("Content gates:");
  for (const key of [
    "productCatalogReady",
    "portfolioPermissionReady",
    "faqApproved",
    "legalPagesApproved",
  ]) {
    const ready = fieldReady(content[key], opts);
    console.log(`  ${ready ? "✓" : "○"} ${key} (${content[key]?.status ?? "PENDING"})`);
  }

  console.log("Approval flags:");
  const allowIndexing = fieldValue(gates.allowIndexing) === true;
  const legalOk = fieldValue(gates.legalContentApproved) === true;
  const assetsOk = fieldValue(gates.realAssetsApproved) === true;
  console.log(`  LEGAL_CONTENT_APPROVED: ${legalOk}`);
  console.log(`  REAL_ASSETS_APPROVED: ${assetsOk}`);
  console.log(`  NEXT_PUBLIC_ALLOW_INDEXING: ${allowIndexing}`);

  if (allowIndexing && (!legalOk || !assetsOk)) {
    console.log("");
    console.log(
      "  ✗ allowIndexing=true requires legalContentApproved AND realAssetsApproved",
    );
  }

  const demo = spawnSync("node", ["scripts/check-demo-placeholders.mjs"], {
    cwd: ROOT,
    env: { ...process.env, STRICT_NO_DEMO: strict ? "1" : "0" },
    encoding: "utf8",
  });
  if (demo.stdout) process.stdout.write(demo.stdout);
  if (demo.stderr) process.stderr.write(demo.stderr);

  const intakeBlockers =
    businessMissing.length > 0 ||
    techMissing.length > 0 ||
    (allowIndexing && (!legalOk || !assetsOk));

  const exitCode =
    strict && (intakeBlockers || demo.status !== 0) ? 1 : 0;

  console.log("");
  if (exitCode === 0) {
    console.log(
      strict
        ? "Preflight passed — ready for Sprint 2 cutover steps."
        : "Preflight report complete (non-strict). Use --strict before production cutover.",
    );
  } else {
    console.error("Preflight failed — resolve blockers before cutover.");
  }

  process.exit(exitCode);
}

main();
