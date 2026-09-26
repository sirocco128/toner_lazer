import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd());

describe("sprint2 preflight (scaffold)", () => {
  it("exits 0 in report mode when intake file is missing", () => {
    const result = spawnSync(
      "node",
      ["scripts/sprint2-preflight.mjs", "--intake", "/tmp/nonexistent-intake.json"],
      { cwd: ROOT, encoding: "utf8" },
    );
    assert.equal(result.status, 0);
    assert.match(result.stdout, /sprint2:preflight/);
    assert.match(result.stdout, /Template:/);
  });

  it("template JSON parses", () => {
    const raw = readFileSync(
      join(ROOT, "intake/sprint2-intake.template.json"),
      "utf8",
    );
    const data = JSON.parse(raw) as {
      business?: { brandName?: unknown };
      gates?: { allowIndexing?: { value?: boolean } };
    };
    assert.ok(data.business?.brandName);
    assert.equal(data.gates?.allowIndexing?.value, false);
  });
});
