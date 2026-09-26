import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOpsNavLinks,
  filterOpsNavGroups,
  groupHasActiveLink,
  groupOpsNavLinks,
  isOpsNavActive,
  parseCollapsedGroupIds,
  parseOpsNavRailOpen,
  withActiveGroupExpanded,
} from "../lib/ops-nav";
import { OPS_PERMISSIONS, PERMISSION_GROUPS } from "../lib/ops-roles";

describe("ops nav", () => {
  it("parses desktop rail open/collapsed preference", () => {
    assert.equal(parseOpsNavRailOpen(null), true);
    assert.equal(parseOpsNavRailOpen("open"), true);
    assert.equal(parseOpsNavRailOpen("1"), true);
    assert.equal(parseOpsNavRailOpen("collapsed"), false);
    assert.equal(parseOpsNavRailOpen("0"), false);
    assert.equal(parseOpsNavRailOpen("false"), false);
  });

  it("keeps overview exact so nested ops pages are not all marked active", () => {
    assert.equal(isOpsNavActive("/ops", "/ops"), true);
    assert.equal(isOpsNavActive("/ops/quotes", "/ops"), false);
    assert.equal(isOpsNavActive("/ops/quotes/RFQ-1", "/ops/quotes"), true);
    assert.equal(isOpsNavActive("/ops/pricing/import", "/ops/pricing"), false);
    assert.equal(isOpsNavActive("/ops/pricing/import", "/ops/pricing/import"), true);
    assert.equal(isOpsNavActive("/ops/price-sheet", "/ops/price-sheet"), true);
    assert.equal(isOpsNavActive("/ops/price-sheet", "/ops/pricing"), false);
  });

  it("groups links by work stage instead of dumping extras into more", () => {
    const admin = buildOpsNavLinks({
      email: "admin",
      name: "ผู้ดูแล",
      role: "admin",
    });
    assert.equal(admin.some((link) => link.href === "/ops" && link.group === "today"), true);
    assert.equal(admin.some((link) => link.href === "/ops/board" && link.group === "today"), true);
    assert.equal(admin.find((link) => link.href === "/ops/board")?.label, "บอร์ดงาน");
    assert.equal(isOpsNavActive("/ops/board", "/ops/board"), true);
    assert.equal(isOpsNavActive("/ops", "/ops/board"), false);
    assert.equal(admin.some((link) => link.href === "/ops/users" && link.group === "system"), true);
    assert.equal(admin.some((link) => link.href === "/ops/knowledge-sync" && link.group === "system"), true);
    assert.equal(admin.find((link) => link.href === "/ops/knowledge-sync")?.label, "อัปเดตคลัง Smart Gift");
    assert.equal(admin.some((link) => link.href === "/ops/manual" && link.group === "system"), true);
    assert.equal(admin.find((link) => link.href === "/ops/manual")?.label, "คู่มือการทำงาน");
    assert.equal(admin.some((link) => link.href === "/ops/holds" && link.group === "cycle"), true);
    assert.equal(admin.find((link) => link.href === "/ops/holds")?.label, "พักเอกสาร");
    const strapi = admin.find((link) => link.label === "เข้า Strapi");
    assert.equal(strapi?.external, true);
    assert.equal(strapi?.group, "catalog");
    assert.match(strapi?.href ?? "", /\/admin$/);
    assert.equal(admin.find((link) => link.href === "/ops/products")?.label, "สินค้า A/B/C/D");
    assert.equal(admin.find((link) => link.href === "/ops/catalog-books")?.label, "สร้างสมุด");
    assert.equal(admin.find((link) => link.href === "/ops/orders")?.label, "ออเดอร์");
    assert.equal(admin.find((link) => link.href === "/ops/pricing")?.label, "คิดทีละชุด");
    assert.equal(admin.find((link) => link.href === "/ops/pricing")?.group, "catalog");
    assert.equal(admin.find((link) => link.href === "/ops/price-sheet")?.label, "ชีตราคา 3 แท็บ");
    assert.equal(admin.find((link) => link.href === "/ops/price-sheet")?.group, "catalog");
    assert.equal(admin.find((link) => link.href === "/ops/pricing/import")?.label, "อัปเดตจาก Excel");
    assert.equal(admin.find((link) => link.href === "/ops/pricing/import")?.group, "catalog");
    assert.equal(admin.find((link) => link.href === "/ops/reports")?.label, "รายงาน");
    assert.equal(admin.find((link) => link.href === "/ops/reports")?.group, "finance");
    assert.equal(isOpsNavActive("/ops/reports", "/ops/reports"), true);
    assert.equal(isOpsNavActive("/ops/reports/export", "/ops/reports"), true);
    assert.equal(isOpsNavActive("/ops/quotes", "/ops/reports"), false);
    assert.equal(admin.find((link) => link.href === "/ops/approvals")?.group, "cycle");
    assert.equal(admin.find((link) => link.href === "/ops/cycle")?.group, "cycle");
    assert.equal(admin.find((link) => link.href === "/ops/inbound")?.label, "รับสินค้าเข้า");
    assert.equal(admin.find((link) => link.href === "/ops/inbound")?.group, "cycle");
    assert.equal(admin.find((link) => link.href === "/ops/pay-factory")?.label, "จ่ายโรงงาน");
    assert.equal(admin.find((link) => link.href === "/ops/pay-factory")?.group, "cycle");
    assert.equal(admin.find((link) => link.href === "/ops/receipts")?.label, "ใบรับเงิน");
    assert.equal(admin.find((link) => link.href === "/ops/receipts")?.group, "cycle");
    assert.equal(admin.some((link) => link.href === "/ops/blog" && link.group === "content"), true);
    assert.equal(admin.find((link) => link.href === "/ops/blog")?.label, "บทความ");
    const viewer = buildOpsNavLinks({
      email: "view@local",
      name: "ดู",
      role: "viewer",
    });
    assert.equal(viewer.some((link) => link.href === "/ops/users"), false);
    assert.equal(viewer.some((link) => link.href === "/ops/knowledge-sync"), false);
    assert.equal(viewer.some((link) => link.href === "/ops/blog"), false);
    assert.equal(viewer.some((link) => link.href === "/ops/quotes"), true);
    assert.equal(viewer.some((link) => link.href === "/ops/inquiries"), true);
    assert.equal(viewer.some((link) => link.href === "/ops/schedule"), true);
    assert.equal(viewer.some((link) => link.href === "/ops/pricing"), true);
    assert.equal(viewer.some((link) => link.href === "/ops/pricing/import"), true);
    assert.equal(viewer.some((link) => link.href === "/ops/inbound"), false);
    assert.equal(viewer.some((link) => link.href === "/ops/pay-factory"), false);
    assert.equal(viewer.some((link) => link.href === "/ops/receipts"), false);
    assert.equal(viewer.some((link) => link.href === "/ops/holds"), false);
    assert.equal(viewer.some((link) => link.label === "เข้า Strapi"), false);
    assert.equal(viewer.some((link) => link.href === "/ops/catalog-books"), false);
    assert.equal(viewer.some((link) => link.href === "/ops/reports"), true);
    const accountant = buildOpsNavLinks({
      email: "acc@local",
      name: "บัญชี",
      role: "accountant",
    });
    assert.equal(accountant.some((link) => link.href === "/ops/finance"), true);
    assert.equal(accountant.some((link) => link.href === "/ops/reports"), true);
    assert.equal(accountant.some((link) => link.href === "/ops/factory-po"), true);
    assert.equal(accountant.some((link) => link.href === "/ops/factories"), true);
    assert.equal(accountant.some((link) => link.href === "/ops/inbound"), false);
    assert.equal(accountant.some((link) => link.href === "/ops/pay-factory"), true);
    assert.equal(accountant.some((link) => link.href === "/ops/receipts"), true);
    assert.equal(accountant.some((link) => link.href === "/ops/holds"), true);
    assert.equal(accountant.some((link) => link.href === "/ops/schedule"), true);
    assert.equal(admin.find((link) => link.href === "/ops/factories")?.label, "ทะเบียนโรงงาน");
    assert.equal(admin.find((link) => link.href === "/ops/schedule")?.label, "นัดหมาย");
    assert.equal(accountant.some((link) => link.href === "/ops/users"), false);
    assert.equal(accountant.some((link) => link.label === "เข้า Strapi"), false);
    const sales = buildOpsNavLinks({
      email: "sales@local",
      name: "เซลล์",
      role: "sales",
    });
    assert.equal(sales.some((link) => link.label === "เข้า Strapi" && link.external), true);
    assert.equal(sales.some((link) => link.href === "/ops/blog"), true);
    assert.equal(sales.some((link) => link.href === "/ops/pricing"), true);
    assert.equal(sales.some((link) => link.href === "/ops/pricing/import"), true);
    assert.equal(sales.some((link) => link.href === "/ops/reports"), true);
    assert.equal(sales.some((link) => link.href === "/ops/schedule"), true);
    assert.equal(sales.some((link) => link.href === "/ops/finance"), false);
    assert.equal(sales.some((link) => link.href === "/ops/inbound"), false);
    assert.equal(sales.some((link) => link.href === "/ops/pay-factory"), false);
    assert.equal(sales.some((link) => link.href === "/ops/receipts"), true);
    assert.equal(isOpsNavActive("/ops/schedule/new", "/ops/schedule"), true);
    const salesNoReports = buildOpsNavLinks({
      email: "sales@local",
      name: "เซลล์",
      role: "sales",
      extraDenies: ["reports.read"],
    });
    assert.equal(salesNoReports.some((link) => link.href === "/ops/reports"), false);
    assert.equal(sales.some((link) => link.href === "/ops/factories"), false);
    assert.equal(isOpsNavActive("/ops", "http://localhost:1337/admin"), false);
    const grouped = groupOpsNavLinks(admin);
    assert.deepEqual(
      grouped.map((group) => group.id),
      ["today", "sales", "catalog", "cycle", "finance", "content", "system"],
    );
    assert.equal(grouped.find((group) => group.id === "sales")?.links[0]?.href, "/ops/quotes");
    const filtered = filterOpsNavGroups(grouped, "โรงงาน");
    assert.deepEqual(
      filtered.flatMap((group) => group.links.map((link) => link.label)),
      ["รูปโรงงาน", "ใบสั่งโรงงาน", "ทะเบียนโรงงาน", "จ่ายโรงงาน"],
    );
    assert.equal(filterOpsNavGroups(grouped, "zzzz").length, 0);
  });

  it("parses collapsed group ids and keeps the current stage open", () => {
    assert.deepEqual(parseCollapsedGroupIds(["sales", "nope", "catalog"]), ["sales", "catalog"]);
    assert.deepEqual(parseCollapsedGroupIds('["cycle","today"]'), ["today", "cycle"]);
    assert.deepEqual(parseCollapsedGroupIds("not-json"), []);
    const admin = buildOpsNavLinks({
      email: "admin",
      name: "ผู้ดูแล",
      role: "admin",
    });
    const grouped = groupOpsNavLinks(admin);
    const sales = grouped.find((group) => group.id === "sales");
    assert.equal(groupHasActiveLink(sales!, "/ops/quotes"), true);
    assert.equal(groupHasActiveLink(sales!, "/ops/pricing"), false);
    assert.deepEqual(
      withActiveGroupExpanded(["sales", "catalog"], grouped, "/ops/quotes"),
      ["catalog"],
    );
  });
});

describe("permission groups", () => {
  it("covers every ops permission exactly once", () => {
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.items);
    assert.deepEqual([...grouped].sort(), [...OPS_PERMISSIONS].sort());
  });
});
