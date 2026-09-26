import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  actorPassesAudience,
  listManualDocsForActor,
  findManualDoc,
} from "../lib/ops-manual-catalog";
import {
  loadManualDocument,
  buildManualToc,
  resolveManualFilePath,
} from "../lib/ops-manual-loader";
import {
  manualMarkdownToHtml,
  slugifyManualHeading,
} from "../lib/ops-manual-md";
import type { OpsActor } from "../lib/ops-roles";

const sales: OpsActor = {
  email: "sales@example.com",
  name: "เซลล์",
  role: "sales",
};

const viewer: OpsActor = {
  email: "view@example.com",
  name: "ดูอย่างเดียว",
  role: "viewer",
};

const admin: OpsActor = {
  email: "admin@example.com",
  name: "ผู้ดูแล",
  role: "admin",
};

describe("ops manual catalog", () => {
  it("hides platform-admin docs from sales", () => {
    const toc = listManualDocsForActor(sales);
    assert.equal(toc.some((d) => d.id === "staging-deploy"), false);
    assert.equal(toc.some((d) => d.id === "user-manual"), true);
    assert.equal(toc.some((d) => d.id === "ops-console"), true);
  });

  it("shows admin deploy docs only to platform admin", () => {
    assert.equal(
      actorPassesAudience(admin, { platformAdminOnly: true }),
      true,
    );
    assert.equal(
      actorPassesAudience(sales, { platformAdminOnly: true }),
      false,
    );
    assert.equal(
      listManualDocsForActor(admin).some((d) => d.id === "nas-portainer"),
      true,
    );
  });

  it("requires finance permission for reports chapter gate", () => {
    assert.equal(
      actorPassesAudience(viewer, {
        anyPermission: ["reports.read", "finance.read"],
      }),
      true,
    );
    assert.equal(
      actorPassesAudience(sales, {
        anyPermission: ["factory.read"],
      }),
      false,
    );
  });
});

describe("ops manual markdown", () => {
  it("renders tables and headings", () => {
    const html = manualMarkdownToHtml(
      [
        "# หัวข้อหลัก",
        "",
        "| A | B |",
        "|---|---|",
        "| 1 | 2 |",
        "",
        "- ข้อหนึ่ง",
        "- ข้อสอง",
      ].join("\n"),
    );
    assert.match(html, /<h1 id=/);
    assert.match(html, /<table/);
    assert.match(html, /<th>A<\/th>/);
    assert.match(html, /<ul>/);
    assert.match(html, /ข้อหนึ่ง/);
  });

  it("renders mermaid fences as diagram hosts", () => {
    const html = manualMarkdownToHtml(
      ["## ER", "", "```mermaid", "erDiagram", "  A ||--o{ B : has", "```"].join(
        "\n",
      ),
    );
    assert.match(html, /ops-mermaid/);
    assert.match(html, /ops-mermaid-source/);
    assert.match(html, /ops-mermaid-viewport/);
    assert.match(html, /ops-mermaid-zoom-in/);
    assert.match(html, /erDiagram/);
    assert.doesNotMatch(html, /<pre class="overflow-x-auto rounded-lg bg-forest\/95/);
  });

  it("slugifies Thai headings", () => {
    const slug = slugifyManualHeading("6. รายงานและงบ");
    assert.ok(slug.startsWith("6-"));
  });
});

describe("ops manual loader", () => {
  it("resolves real docs on disk", () => {
    assert.ok(resolveManualFilePath("manual/00-INDEX.md"));
    assert.equal(resolveManualFilePath("../secret.md"), null);
    assert.equal(resolveManualFilePath("manual/nope.md"), null);
  });

  it("loads user manual for sales", () => {
    const loaded = loadManualDocument("user-manual", sales);
    assert.equal("error" in loaded, false);
    if ("error" in loaded) return;
    assert.equal(loaded.id, "user-manual");
    assert.ok(loaded.sections.length >= 3);
    assert.ok(loaded.html.includes("<h"));
  });

  it("rejects staging deploy for viewer", () => {
    const loaded = loadManualDocument("staging-deploy", viewer);
    assert.equal("error" in loaded, true);
    if (!("error" in loaded)) return;
    assert.equal(loaded.status, 403);
  });

  it("builds toc from catalog", () => {
    const toc = buildManualToc(admin);
    assert.ok(toc.length >= 10);
    assert.ok(findManualDoc("function-matrix"));
  });
});
