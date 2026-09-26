import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLocalBusinessJsonLd } from "../lib/seo";
import type { SiteConfig } from "../lib/site";

function baseSite(
  localBusiness: SiteConfig["localBusiness"],
): SiteConfig {
  return {
    url: "https://example.test",
    name: "Test Brand",
    legalName: "Test Brand Co., Ltd.",
    description: "Test description",
    phoneDisplay: "02-000-0000",
    phoneHref: "tel:+6620000000",
    email: "sales@example.test",
    lineId: "@test",
    lineUrl: "https://line.me/R/ti/p/@test",
    allowIndexing: false,
    taxId: "",
    localBusiness,
  };
}

describe("local-business (§31 required)", () => {
  it("returns null when LocalBusiness is disabled", () => {
    const jsonLd = buildLocalBusinessJsonLd(
      baseSite({
        enabled: false,
        type: "ProfessionalService",
        streetAddress: "1 Test Road",
        locality: "Bangkok",
        region: "Bangkok",
        postalCode: "10110",
        countryCode: "TH",
        latitude: null,
        longitude: null,
        openingHours: "Mo-Sa 08:30-17:30",
      }),
    );
    assert.equal(jsonLd, null);
  });

  it("returns null when enabled but required address fields are missing", () => {
    const missingStreet = buildLocalBusinessJsonLd(
      baseSite({
        enabled: true,
        type: "LocalBusiness",
        streetAddress: "",
        locality: "Bangkok",
        region: "Bangkok",
        postalCode: "10110",
        countryCode: "TH",
        latitude: null,
        longitude: null,
        openingHours: "Mo-Sa 08:30-17:30",
      }),
    );
    assert.equal(missingStreet, null);

    const missingLocality = buildLocalBusinessJsonLd(
      baseSite({
        enabled: true,
        type: "LocalBusiness",
        streetAddress: "1 Test Road",
        locality: "",
        region: "Bangkok",
        postalCode: "10110",
        countryCode: "TH",
        latitude: null,
        longitude: null,
        openingHours: "Mo-Sa 08:30-17:30",
      }),
    );
    assert.equal(missingLocality, null);

    const missingPostal = buildLocalBusinessJsonLd(
      baseSite({
        enabled: true,
        type: "LocalBusiness",
        streetAddress: "1 Test Road",
        locality: "Bangkok",
        region: "Bangkok",
        postalCode: "",
        countryCode: "TH",
        latitude: null,
        longitude: null,
        openingHours: "Mo-Sa 08:30-17:30",
      }),
    );
    assert.equal(missingPostal, null);
  });

  it("emits LocalBusiness JSON-LD when enabled with required address", () => {
    const jsonLd = buildLocalBusinessJsonLd(
      baseSite({
        enabled: true,
        type: "ProfessionalService",
        streetAddress: "1 Test Road",
        locality: "Bangkok",
        region: "Bangkok",
        postalCode: "10110",
        countryCode: "TH",
        latitude: 13.75,
        longitude: 100.5,
        openingHours: "Mo-Sa 08:30-17:30",
      }),
    );
    assert.ok(jsonLd);
    assert.equal(jsonLd!["@type"], "ProfessionalService");
    const address = jsonLd!.address as Record<string, string>;
    assert.equal(address.streetAddress, "1 Test Road");
    assert.equal(address.addressLocality, "Bangkok");
    assert.equal(address.postalCode, "10110");
    assert.equal(address.addressCountry, "TH");
  });
});
