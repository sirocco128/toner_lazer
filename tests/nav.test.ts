import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isMoreNavActive, isNavActive, moreNavLinks, quoteShortcutHref, UTILITY_NAV_LINKS, withOptionalBasketLink } from "../lib/nav";

describe("nav helpers (UX)", () => {
  it("marks nested product paths as active for /products", () => {
    assert.equal(isNavActive("/products", "/products"), true);
    assert.equal(isNavActive("/products/eco-tote-bamboo-set", "/products"), true);
    assert.equal(isNavActive("/blog", "/products"), false);
  });

  it("only treats / as active for home", () => {
    assert.equal(isNavActive("/", "/"), true);
    assert.equal(isNavActive("/products", "/"), false);
  });

  it("keeps four buyer destinations in the primary nav", () => {
    const links = withOptionalBasketLink(false);
    assert.equal(links.length, 4);
    assert.equal(links[0]?.href, "/toner");
    assert.match(links[0]?.label || "", /รุ่นเครื่อง/);
    assert.equal(
      links.find((l) => l.href === "/about")?.label,
      "เกี่ยวกับเรา",
    );
    assert.equal(links.some((l) => l.href === "/premium-giftset"), false);
    assert.equal(links.some((l) => l.href === "/ideas"), false);
    assert.match(
      links.find((l) => l.href === "/products")?.hint || "",
      /ขอราคา/,
    );
  });

  it("parks claims and contact under more nav, no gift pages", () => {
    const more = moreNavLinks();
    assert.equal(more.find((l) => l.href === "/issues")?.label, "แจ้งปัญหา / เคลมสินค้า");
    assert.equal(more.some((l) => l.href === "/ideas" || l.href === "/catalog"), false);
    assert.equal(isMoreNavActive("/issues"), true);
    assert.equal(isMoreNavActive("/products"), false);
  });

  it("appends quote basket link when P2 tools enabled", () => {
    const off = withOptionalBasketLink(false);
    const on = withOptionalBasketLink(true);
    assert.equal(off.some((l) => l.href === "/quote-basket"), false);
    assert.equal(on.some((l) => l.href === "/quote-basket"), true);
  });

  it("keeps the quote shortcut href stable for a given flag", () => {
    assert.equal(quoteShortcutHref(false), "/contact");
    assert.equal(quoteShortcutHref(true), "/quote-basket");
  });

  it("keeps returning-buyer hub on the top bar without a staff door", () => {
    assert.equal(UTILITY_NAV_LINKS.length, 1);
    assert.equal(UTILITY_NAV_LINKS[0]?.href, "/account");
    assert.equal(UTILITY_NAV_LINKS[0]?.label, "ลูกค้าที่สั่งแล้ว");
    assert.equal(
      UTILITY_NAV_LINKS.some((l) => l.href === "/ops" || l.href === "/ops/login"),
      false,
    );
    assert.equal(
      withOptionalBasketLink(false).some((l) => l.href === "/ops"),
      false,
    );
    assert.equal(
      moreNavLinks().some((l) => l.href === "/account"),
      false,
    );
  });
});