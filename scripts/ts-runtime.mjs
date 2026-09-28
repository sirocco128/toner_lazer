/**
 * Compile lib/ with tsconfig.test.json (CommonJS into .tmp/tests) and make
 * `@/…` imports resolvable, so plain Node scripts can call the TS services.
 * Same approach as scripts/seed-finance-cycles.mjs.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

export function loadCompiledLib() {
  const tsc = spawnSync(
    process.execPath,
    [resolve(ROOT, "node_modules/typescript/lib/tsc.js"), "-p", "tsconfig.test.json", "--pretty", "false"],
    { cwd: ROOT, stdio: "inherit" },
  );
  if (tsc.status !== 0) process.exit(tsc.status ?? 1);
  const preloadPath = resolve(ROOT, ".tmp/test-alias-preload.cjs");
  writeFileSync(
    preloadPath,
    `
const path = require("node:path");
const Module = require("node:module");
const root = ${JSON.stringify(resolve(ROOT, ".tmp/tests"))};
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
  require(preloadPath);
  return (name) => require(resolve(ROOT, ".tmp/tests/lib", `${name}.js`));
}
