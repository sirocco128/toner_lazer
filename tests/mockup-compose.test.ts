import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cylinderSampleAt,
  resolvePrintBox,
  sceneProductSlot,
} from "../lib/mockup-compose";
import {
  scenePhotoFor,
  usageContextCopy,
  type MockupSurface,
} from "../lib/mockup-studio";

const tumbler: MockupSurface = {
  id: "tumbler",
  label: "กระบอกน้ำ",
  kind: "cylinder",
  hint: "test",
  photo: "/images/product-tumbler.jpg",
  logoZones: {
    product: { x: 0.38, y: 0.44, w: 0.24, h: 0.14 },
  },
};

describe("mockup-compose print + scenes", () => {
  it("keeps tumbler print within the front face", () => {
    const box = resolvePrintBox(tumbler);
    assert.ok(box.w <= 0.34);
    assert.ok(box.bend > 0.4);
    assert.equal(box.rotateDeg, 0);
  });

  it("maps cylinder samples inside 0..1 near center", () => {
    const mid = cylinderSampleAt(0.5, 0.6);
    assert.ok(Math.abs(mid.srcT - 0.5) < 0.02);
    assert.ok(mid.scale > 0.9);
  });

  it("returns lifestyle and office scene photos", () => {
    assert.match(scenePhotoFor("lifestyle", "cylinder") ?? "", /lifestyle-tumbler/);
    assert.match(scenePhotoFor("office", "cover") ?? "", /office/);
    assert.match(scenePhotoFor("retail", "cylinder") ?? "", /hero-giftset|office|portfolio/);
    assert.equal(scenePhotoFor("product", "pen"), null);
  });

  it("places product cards on scene slots", () => {
    const lifestyle = sceneProductSlot("lifestyle", "cylinder");
    const office = sceneProductSlot("office", "pen");
    const retail = sceneProductSlot("retail", "cylinder");
    assert.ok(lifestyle.x + lifestyle.w <= 1.01);
    assert.ok(office.y + office.h <= 1.01);
    assert.ok(retail.y + retail.h <= 1.01);
  });

  it("provides Thai usage copy for office context", () => {
    const copy = usageContextCopy("cover");
    assert.match(copy.officeTitle, /ออฟฟิศ|โต๊ะ|ประชุม/);
    assert.match(copy.lifestyleBody, /ประชุม|อบรม|ของขวัญ/);
  });
});
