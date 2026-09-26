import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTRIBUTION_STORAGE_KEY,
  captureFirstPartyAttribution,
  formatCampaignSourceLabel,
  hasBlockedTrackingParam,
  mergeFirstTouch,
  parseCampaignAttribution,
  parseStoredAttribution,
  sanitizeExternalReferrer,
} from "../lib/attribution.js";

describe("parseCampaignAttribution", () => {
  it("keeps first-party UTM fields and the landing pathname only", () => {
    const parsed = parseCampaignAttribution({
      href: "https://gift.example/premium-giftset?utm_source=google&utm_medium=cpc&utm_campaign=q3&utm_term=tumbler&utm_content=hero&gclid=ABC123",
      referrer: "https://www.google.com/search?q=giftset",
      pageOrigin: "https://gift.example",
    });
    assert.equal(parsed.landingPath, "/premium-giftset");
    assert.equal(parsed.utmSource, "google");
    assert.equal(parsed.utmMedium, "cpc");
    assert.equal(parsed.utmCampaign, "q3");
    assert.equal(parsed.utmTerm, "tumbler");
    assert.equal(parsed.utmContent, "hero");
    assert.equal(parsed.referrer, "https://www.google.com/search");
    assert.equal(parsed.landingPath.includes("gclid"), false);
  });

  it("does not persist third-party ad click ids in any field", () => {
    const parsed = parseCampaignAttribution({
      href: "https://gift.example/?gclid=CLICKID_SECRET_XYZ&fbclid=FBCLICK_SECRET_XYZ&utm_source=facebook",
      referrer: "https://www.facebook.com/",
      pageOrigin: "https://gift.example",
    });
    const blob = JSON.stringify(parsed);
    assert.equal(blob.includes("CLICKID_SECRET_XYZ"), false);
    assert.equal(blob.includes("FBCLICK_SECRET_XYZ"), false);
    assert.equal(parsed.utmSource, "facebook");
    assert.equal(hasBlockedTrackingParam("https://gift.example/?gclid=x"), true);
  });

  it("skips ops and sop consoles", () => {
    const parsed = parseCampaignAttribution({
      href: "https://gift.example/ops/quotes?utm_source=staff",
      referrer: "https://mail.google.com/",
      pageOrigin: "https://gift.example",
    });
    assert.equal(parsed.landingPath, "");
    assert.equal(parsed.utmSource, "");
    assert.equal(parsed.referrer, "");
  });
});

describe("sanitizeExternalReferrer", () => {
  it("drops same-origin referrers and non-http URLs", () => {
    assert.equal(
      sanitizeExternalReferrer(
        "https://gift.example/products",
        "https://gift.example",
      ),
      "",
    );
    assert.equal(
      sanitizeExternalReferrer("javascript:alert(1)", "https://gift.example"),
      "",
    );
    assert.equal(sanitizeExternalReferrer("", "https://gift.example"), "");
  });
});

describe("mergeFirstTouch", () => {
  it("keeps the first landing and fills empty UTM later in the session", () => {
    const first = parseCampaignAttribution({
      href: "https://gift.example/",
      referrer: "https://l.facebook.com/",
      pageOrigin: "https://gift.example",
    });
    const later = parseCampaignAttribution({
      href: "https://gift.example/contact?utm_source=line",
      referrer: "https://gift.example/",
      pageOrigin: "https://gift.example",
    });
    const merged = mergeFirstTouch(first, later);
    assert.equal(merged.landingPath, "/");
    assert.equal(merged.referrer, "https://l.facebook.com/");
    assert.equal(merged.utmSource, "line");
  });

  it("does not overwrite an existing UTM with a later campaign", () => {
    const first = parseCampaignAttribution({
      href: "https://gift.example/?utm_source=google",
      pageOrigin: "https://gift.example",
    });
    const later = parseCampaignAttribution({
      href: "https://gift.example/contact?utm_source=line",
      pageOrigin: "https://gift.example",
    });
    const merged = mergeFirstTouch(first, later);
    assert.equal(merged.utmSource, "google");
    assert.equal(merged.landingPath, "/");
  });
});

describe("captureFirstPartyAttribution", () => {
  it("writes first-touch values to the provided session store", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };

    captureFirstPartyAttribution(
      {
        href: "https://gift.example/catalog?utm_source=google",
        referrer: "https://www.google.com/",
        pageOrigin: "https://gift.example",
      },
      storage,
    );
    captureFirstPartyAttribution(
      {
        href: "https://gift.example/contact?utm_source=ignored",
        referrer: "https://gift.example/catalog",
        pageOrigin: "https://gift.example",
      },
      storage,
    );

    const stored = parseStoredAttribution(map.get(ATTRIBUTION_STORAGE_KEY) ?? null);
    assert.ok(stored);
    assert.equal(stored.landingPath, "/catalog");
    assert.equal(stored.utmSource, "google");
    assert.equal(stored.referrer, "https://www.google.com/");
  });
});

describe("formatCampaignSourceLabel", () => {
  it("labels smg-ui briefs as SmartGift web", () => {
    assert.equal(
      formatCampaignSourceLabel({ utmSource: "smg-ui" }),
      "Smart Gift",
    );
    assert.equal(
      formatCampaignSourceLabel({
        utmSource: "smg-ui",
        utmMedium: "brief",
      }),
      "Smart Gift · brief",
    );
    assert.equal(
      formatCampaignSourceLabel({ detail: "[smg-ui brief]\nqty=10" }),
      "Smart Gift",
    );
  });

  it("joins source medium campaign or falls back to referrer then landing", () => {
    assert.equal(
      formatCampaignSourceLabel({
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "q3",
      }),
      "google · cpc · q3",
    );
    assert.equal(
      formatCampaignSourceLabel({
        referrer: "https://www.google.com/search",
        landingPath: "/contact",
      }),
      "google.com",
    );
    assert.equal(
      formatCampaignSourceLabel({
        referrer: "http://localhost:3000/contact",
        landingPath: "/premium-giftset",
      }),
      "/premium-giftset",
    );
    assert.equal(
      formatCampaignSourceLabel({ landingPath: "/premium-giftset" }),
      "/premium-giftset",
    );
    assert.equal(formatCampaignSourceLabel({}), "ตรงเว็บ");
  });
});
