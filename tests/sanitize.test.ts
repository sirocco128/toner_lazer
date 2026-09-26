import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanText, parseSafeArticleBlocks } from "../lib/sanitize";

describe("sanitize (§31.3)", () => {
  it("removes control characters and normalizes whitespace", () => {
    const cleaned = cleanText("  hello\u0000\u0007  world\n\n  ");
    assert.equal(cleaned, "hello world");
  });

  it("strips executable markup while keeping supported semantic blocks", () => {
    const html = `
      <!-- comment -->
      <script>alert(1)</script>
      <style>.x{}</style>
      <iframe src="https://evil.example"></iframe>
      <h2>หัวข้อหลัก</h2>
      <p>ย่อหน้าปลอดภัย</p>
      <blockquote>คำคม</blockquote>
      <ul><li>รายการหนึ่ง</li></ul>
      <svg onload="alert(1)"></svg>
    `;
    const blocks = parseSafeArticleBlocks(html);
    const types = blocks.map((b) => b.type);
    assert.ok(types.includes("heading2"));
    assert.ok(types.includes("paragraph"));
    assert.ok(types.includes("blockquote"));
    assert.ok(types.includes("listItem"));
    const joined = blocks.map((b) => b.text).join(" ");
    assert.equal(/script|iframe|onload|alert/i.test(joined), false);
  });
});
