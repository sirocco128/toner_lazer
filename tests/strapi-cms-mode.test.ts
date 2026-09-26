import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isStrapiReadConfigured,
  shouldFetchStrapiEditorial,
} from "../lib/strapi-mode";

const KEYS = [
  "CMS_MODE",
  "STRAPI_API_TOKEN",
  "STRAPI_PUBLIC_READ",
  "SMARTGIFT_MYSQL_ENABLED",
  "NEXTERP_MYSQL_ENABLED",
] as const;

function withEnv(
  values: Partial<Record<(typeof KEYS)[number], string | undefined>>,
  run: () => void,
) {
  const previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of KEYS) {
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const key of KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("Strapi editorial gating (mysql catalog)", () => {
  it("is unconfigured when token and public-read are off", () => {
    withEnv(
      { STRAPI_API_TOKEN: "", STRAPI_PUBLIC_READ: "false" },
      () => {
        assert.equal(isStrapiReadConfigured(), false);
      },
    );
  });

  it("accepts a token or STRAPI_PUBLIC_READ=true", () => {
    withEnv({ STRAPI_API_TOKEN: "tok", STRAPI_PUBLIC_READ: "false" }, () => {
      assert.equal(isStrapiReadConfigured(), true);
    });
    withEnv({ STRAPI_API_TOKEN: "", STRAPI_PUBLIC_READ: "true" }, () => {
      assert.equal(isStrapiReadConfigured(), true);
    });
  });

  it("does not hit Strapi in mysql mode without credentials", () => {
    withEnv(
      {
        CMS_MODE: "mysql",
        STRAPI_API_TOKEN: "",
        STRAPI_PUBLIC_READ: "false",
        SMARTGIFT_MYSQL_ENABLED: "true",
      },
      () => {
        assert.equal(shouldFetchStrapiEditorial(), false);
      },
    );
  });

  it("hits Strapi in mysql mode when a token is set", () => {
    withEnv(
      {
        CMS_MODE: "mysql",
        STRAPI_API_TOKEN: "tok",
        STRAPI_PUBLIC_READ: "false",
      },
      () => {
        assert.equal(shouldFetchStrapiEditorial(), true);
      },
    );
  });

  it("always fetches editorial when CMS_MODE=strapi", () => {
    withEnv(
      {
        CMS_MODE: "strapi",
        STRAPI_API_TOKEN: "",
        STRAPI_PUBLIC_READ: "false",
      },
      () => {
        assert.equal(shouldFetchStrapiEditorial(), true);
      },
    );
  });
});
