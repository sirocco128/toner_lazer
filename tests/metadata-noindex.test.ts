import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { metadataFromSeo, buildRootMetadata } from "../lib/seo";
import { resetSiteConfigCache } from "../lib/site";

const PREV_ALLOW = process.env.NEXT_PUBLIC_ALLOW_INDEXING;

afterEach(() => {
  if (PREV_ALLOW === undefined) {
    delete process.env.NEXT_PUBLIC_ALLOW_INDEXING;
  } else {
    process.env.NEXT_PUBLIC_ALLOW_INDEXING = PREV_ALLOW;
  }
  resetSiteConfigCache();
});

describe("metadata-noindex (§31 required)", () => {
  it("forces noindex when allowIndexing=false even if page seo.noIndex is false", () => {
    process.env.NEXT_PUBLIC_ALLOW_INDEXING = "false";
    resetSiteConfigCache();

    const meta = metadataFromSeo({
      seoTitle: "Product",
      metaDescription: "Desc",
      canonicalPath: "/products/demo",
      noIndex: false,
    });

    assert.deepEqual(meta.robots, { index: false, follow: false });
  });

  it("allows index when allowIndexing=true and page does not request noIndex", () => {
    process.env.NEXT_PUBLIC_ALLOW_INDEXING = "true";
    resetSiteConfigCache();

    const meta = metadataFromSeo({
      seoTitle: "Product",
      metaDescription: "Desc",
      canonicalPath: "/products/demo",
      noIndex: false,
    });

    assert.deepEqual(meta.robots, { index: true, follow: true });
  });

  it("keeps noindex when allowIndexing=true but page seo.noIndex is true", () => {
    process.env.NEXT_PUBLIC_ALLOW_INDEXING = "true";
    resetSiteConfigCache();

    const meta = metadataFromSeo({
      seoTitle: "Draft",
      metaDescription: "Desc",
      canonicalPath: "/blog/draft",
      noIndex: true,
    });

    assert.deepEqual(meta.robots, { index: false, follow: false });
  });

  it("root metadata respects global allowIndexing=false", () => {
    process.env.NEXT_PUBLIC_ALLOW_INDEXING = "false";
    resetSiteConfigCache();

    const root = buildRootMetadata();
    assert.deepEqual(root.robots, { index: false, follow: false });
  });
});
