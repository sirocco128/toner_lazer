#!/usr/bin/env node
/**
 * Shared helpers for Sprint 2 intake JSON (runbook §50).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..");
export const DEFAULT_INTAKE_PATH = resolve(ROOT, "intake/sprint2-intake.json");
export const TEMPLATE_PATH = resolve(ROOT, "intake/sprint2-intake.template.json");

const APPROVED_STATUSES = new Set(["APPROVED", "RECEIVED"]);

/** @typedef {{ value?: unknown; owner?: string; status?: string }} IntakeField */

/**
 * @param {string} path
 */
export function loadIntake(path = DEFAULT_INTAKE_PATH) {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(
      `Intake file not found: ${abs}\nCopy intake/sprint2-intake.template.json → intake/sprint2-intake.json`,
    );
  }
  const raw = readFileSync(abs, "utf8");
  /** @type {Record<string, unknown>} */
  const data = JSON.parse(raw);
  return { path: abs, data };
}

/**
 * @param {unknown} section
 * @returns {Record<string, IntakeField>}
 */
export function asFieldSection(section) {
  if (!section || typeof section !== "object") return {};
  return /** @type {Record<string, IntakeField>} */ (section);
}

/**
 * @param {IntakeField | undefined}
 */
export function fieldValue(field) {
  if (!field || field.value === undefined || field.value === null) return "";
  if (typeof field.value === "boolean") return field.value;
  return String(field.value).trim();
}

/**
 * @param {IntakeField | undefined}
 */
export function fieldReady(field, { requireApproved = false } = {}) {
  const value = fieldValue(field);
  const status = String(field?.status ?? "PENDING").toUpperCase();
  if (typeof field?.value === "boolean") {
    if (requireApproved && status !== "APPROVED") return false;
    if (!requireApproved && !APPROVED_STATUSES.has(status)) return false;
    return true;
  }
  if (!value) return false;
  if (requireApproved) return status === "APPROVED";
  return APPROVED_STATUSES.has(status);
}

/**
 * @param {Record<string, IntakeField>} section
 * @param {string[]} keys
 */
export function missingFields(section, keys, opts = {}) {
  /** @type {string[]} */
  const missing = [];
  for (const key of keys) {
    if (!fieldReady(section[key], opts)) {
      missing.push(key);
    }
  }
  return missing;
}
