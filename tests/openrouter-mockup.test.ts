import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMockupAiPrompt } from "../lib/mockup-ai-prompts";
import {
  extractImageDataUrl,
  toHttpHeaderValue,
} from "../lib/openrouter-mockup";

describe("mockup AI prompts", () => {
  it("asks for photoreal printed logo on product shot", () => {
    const prompt = buildMockupAiPrompt({
      variantId: "product",
      surfaceLabel: "กระบอกน้ำ",
      surfaceKind: "cylinder",
      finishLabel: "เขียวป่า",
      productName: "เซ็ตกระบอกน้ำ",
      hasLogo: true,
    });
    assert.match(prompt, /screen-printed|UV-printed|curvature/i);
    assert.match(prompt, /กระบอกน้ำ/);
    assert.match(prompt, /1688|offer IDs|CNY/i);
  });

  it("describes lifestyle and office contexts", () => {
    const lifestyle = buildMockupAiPrompt({
      variantId: "lifestyle",
      surfaceLabel: "สมุดโน้ต",
      surfaceKind: "cover",
      finishLabel: "ดำด้าน",
      productName: "เซ็ต",
      hasLogo: false,
      text: "ACME",
      activityHint: "ประชุม",
    });
    assert.match(lifestyle, /lifestyle|real use/i);
    assert.match(lifestyle, /ACME/);

    const office = buildMockupAiPrompt({
      variantId: "office",
      surfaceLabel: "ปากกา",
      surfaceKind: "pen",
      finishLabel: "กรมท่า",
      productName: "เซ็ต",
      hasLogo: true,
      placementHint: "โต๊ะทำงาน",
    });
    assert.match(office, /office|workplace/i);

    const retail = buildMockupAiPrompt({
      variantId: "retail",
      surfaceLabel: "กระบอกน้ำ",
      surfaceKind: "cylinder",
      finishLabel: "ดำด้าน",
      productName: "เซ็ต",
      hasLogo: true,
      refineInstruction: "สูงขึ้นไปอีกนิด",
    });
    assert.match(retail, /retail|shelf/i);
    assert.match(retail, /สูงขึ้นไปอีกนิด/);
  });
});

describe("openrouter header sanitization", () => {
  it("keeps ASCII site names", () => {
    assert.equal(toHttpHeaderValue("Terabis"), "Terabis");
  });

  it("replaces Thai site names so fetch headers stay ByteString-safe", () => {
    assert.equal(toHttpHeaderValue("เทราบิส"), "Smart Gift");
    assert.equal(toHttpHeaderValue("เทราบิส", "GiftPro"), "GiftPro");
  });
});

describe("openrouter response parsing", () => {
  it("extracts b64_json image payload", () => {
    const url = extractImageDataUrl({
      data: [{ b64_json: "abc123" }],
    });
    assert.equal(url, "data:image/jpeg;base64,abc123");
  });

  it("extracts nested image_url data URLs", () => {
    const url = extractImageDataUrl({
      images: [
        {
          image_url: {
            url: "data:image/png;base64,xyz",
          },
        },
      ],
    });
    assert.equal(url, "data:image/png;base64,xyz");
  });
});
