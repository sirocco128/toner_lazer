import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bangkokTodayYmd,
  bangkokYmdPlusDays,
  minNeededDateYmd,
  NEEDED_DATE_MIN_LEAD_DAYS,
  quoteSchema,
} from "../lib/quote-schema";

function bangkokYesterdayYmd(): string {
  return bangkokYmdPlusDays(-1);
}

const basePayload = {
  name: "สมชาย ใจดี",
  company: "บริษัท ตัวอย่าง จำกัด",
  email: "somchai@acme.co.th",
  phone: "02-123-4567",
  quantity: 100,
  consent: true,
  decorationMethod: "uv-print" as const,
  website: "",
  startedAt: Date.now() - 5_000,
};

describe("date-boundary Asia/Bangkok (§31 required)", () => {
  it("rejects neededDate equal to today in Asia/Bangkok", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      neededDate: bangkokTodayYmd(),
    });
    assert.equal(parsed.success, false);
    if (parsed.success) return;
    assert.ok(
      parsed.error.issues.some((issue) => issue.path[0] === "neededDate"),
    );
  });

  it("rejects neededDate nine days from today", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      neededDate: bangkokYmdPlusDays(NEEDED_DATE_MIN_LEAD_DAYS - 1),
    });
    assert.equal(parsed.success, false);
    if (parsed.success) return;
    assert.ok(
      parsed.error.issues.some((issue) => issue.path[0] === "neededDate"),
    );
  });

  it("accepts neededDate of today plus 10 days in Asia/Bangkok", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      neededDate: minNeededDateYmd(),
    });
    assert.equal(parsed.success, true);
  });

  it("rejects neededDate earlier than today in Asia/Bangkok", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      neededDate: bangkokYesterdayYmd(),
    });
    assert.equal(parsed.success, false);
    if (parsed.success) return;
    assert.ok(
      parsed.error.issues.some((issue) => issue.path[0] === "neededDate"),
    );
  });

  it("rejects an impossible calendar date", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      neededDate: "2026-02-31",
    });
    assert.equal(parsed.success, false);
    if (parsed.success) return;
    assert.ok(
      parsed.error.issues.some((issue) => issue.path[0] === "neededDate"),
    );
  });
});
