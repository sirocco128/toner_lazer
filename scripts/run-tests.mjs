#!/usr/bin/env node
/**
 * Compile tests with tsc -p tsconfig.test.json, run with node --test, cleanup.
 * Resolves `@/*` path aliases used by lib/ after CommonJS emit.
 */
import { spawnSync } from "node:child_process";
import { rmSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = join(ROOT, ".tmp", "tests");

/**
 * @param {string} command
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [env]
 */
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    env,
    // Node under "C:\Program Files" breaks when shell concatenates unquoted paths.
    shell: process.platform === "win32" && command.toLowerCase().endsWith(".cmd"),
  });
  return result.status ?? 1;
}

/**
 * @param {string} dir
 * @param {string[]} acc
 */
function collectTestFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectTestFiles(full, acc);
    } else if (name.endsWith(".test.js")) {
      acc.push(full);
    }
  }
  return acc;
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(join(ROOT, ".tmp"), { recursive: true });

const tscBin = join(ROOT, "node_modules", "typescript", "bin", "tsc");
let status;
if (existsSync(tscBin)) {
  status = run(process.execPath, [tscBin, "-p", "tsconfig.test.json"]);
} else {
  status = run("tsc", ["-p", "tsconfig.test.json"]);
}

if (status !== 0) {
  console.error("Test compilation failed.");
  rmSync(OUT_DIR, { recursive: true, force: true });
  process.exit(status);
}

const preloadPath = join(ROOT, ".tmp", "test-alias-preload.cjs");
writeFileSync(
  preloadPath,
  `
const path = require("node:path");
const Module = require("node:module");
const root = ${JSON.stringify(OUT_DIR)};
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === "string" && request.startsWith("@/")) {
    request = path.join(root, request.slice(2));
  }
  return original.call(this, request, parent, isMain, options);
};
`,
  "utf8",
);

let testFiles = collectTestFiles(join(OUT_DIR, "tests"));
if (testFiles.length === 0) {
  testFiles = collectTestFiles(OUT_DIR);
}
if (testFiles.length === 0) {
  console.error("No compiled test files found in .tmp/tests");
  rmSync(join(ROOT, ".tmp"), { recursive: true, force: true });
  process.exit(1);
}

const testStatus = run(
  process.execPath,
  ["--require", preloadPath, "--test", ...testFiles],
  { ...process.env, PROJECT_ROOT: ROOT },
);

rmSync(join(ROOT, ".tmp"), { recursive: true, force: true });
process.exit(testStatus);
