import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OPS_LIST_PAGE_SIZE,
  opsPageHref,
  opsPageWindow,
  parseOpsPage,
} from "../lib/ops-pagination";

describe("ops list pagination", () => {
  it("parses page query and clamps invalid values", () => {
    assert.equal(parseOpsPage(undefined), 1);
    assert.equal(parseOpsPage("3"), 3);
    assert.equal(parseOpsPage(["2"]), 2);
    assert.equal(parseOpsPage("0"), 1);
    assert.equal(parseOpsPage("nope"), 1);
  });

  it("windows a 120-row list into 50-row pages", () => {
    const page1 = opsPageWindow(120, 1);
    assert.equal(page1.pageSize, OPS_LIST_PAGE_SIZE);
    assert.equal(page1.offset, 0);
    assert.equal(page1.totalPages, 3);
    assert.equal(page1.from, 1);
    assert.equal(page1.to, 50);

    const page3 = opsPageWindow(120, 3);
    assert.equal(page3.offset, 100);
    assert.equal(page3.from, 101);
    assert.equal(page3.to, 120);

    const overflow = opsPageWindow(120, 99);
    assert.equal(overflow.page, 3);
  });

  it("builds hrefs that drop all-filters and hide page 1", () => {
    assert.equal(
      opsPageHref("/ops/quotes", { q: "เทรา", status: "all" }, 1),
      "/ops/quotes?q=%E0%B9%80%E0%B8%97%E0%B8%A3%E0%B8%B2",
    );
    assert.equal(
      opsPageHref("/ops/quotes", { q: "เทรา", status: "new" }, 2),
      "/ops/quotes?q=%E0%B9%80%E0%B8%97%E0%B8%A3%E0%B8%B2&status=new&page=2",
    );
  });
});
