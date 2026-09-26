import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getStrapiAdminUrl, getStrapiApiUrl } from "../lib/strapi-url";

describe("getStrapiAdminUrl", () => {
  const keys = ["STRAPI_ADMIN_URL", "STRAPI_URL"] as const;

  function withEnv(values: Partial<Record<(typeof keys)[number], string | undefined>>, run: () => void) {
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    try {
      for (const key of keys) {
        const value = values[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      run();
    } finally {
      for (const key of keys) {
        const value = previous[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }

  it("defaults to localhost Strapi admin", () => {
    withEnv({ STRAPI_ADMIN_URL: undefined, STRAPI_URL: undefined }, () => {
      assert.equal(getStrapiAdminUrl(), "http://localhost:1337/admin");
    });
  });

  it("uses IPv4 loopback for server-side Strapi fetch", () => {
    withEnv({ STRAPI_ADMIN_URL: undefined, STRAPI_URL: "http://localhost:1337" }, () => {
      assert.equal(getStrapiApiUrl(), "http://127.0.0.1:1337");
    });
  });

  it("uses STRAPI_ADMIN_URL when set", () => {
    withEnv(
      { STRAPI_ADMIN_URL: "https://cms.example.com/admin", STRAPI_URL: "http://cms:1337" },
      () => {
        assert.equal(getStrapiAdminUrl(), "https://cms.example.com/admin");
      },
    );
  });

  it("appends /admin to STRAPI_ADMIN_URL if missing", () => {
    withEnv({ STRAPI_ADMIN_URL: "https://cms.example.com/", STRAPI_URL: undefined }, () => {
      assert.equal(getStrapiAdminUrl(), "https://cms.example.com/admin");
    });
  });

  it("rewrites Docker-internal STRAPI_URL so the browser can open it", () => {
    withEnv(
      { STRAPI_ADMIN_URL: undefined, STRAPI_URL: "http://host.docker.internal:1337" },
      () => {
        assert.equal(getStrapiAdminUrl(), "http://localhost:1337/admin");
      },
    );
  });
});
