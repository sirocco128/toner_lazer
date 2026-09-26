import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  albumFileServePath,
  albumPublicPath,
  allowedGroupSlug,
  buildCatalogBookFromFiles,
  firstFolderName,
  inferGroupSlug,
  parseAlbumFileId,
  parseAlbumId,
  parseCatalogBookSnapshot,
  type AlbumFileInput,
} from "../lib/catalog-album";
import { OTHER_CATALOG_GROUP_SLUG } from "../lib/catalog-book";

const GROUPS = [
  { slug: "tumbler-set", name: "เซ็ตสำนักงาน" },
  { slug: "eco-giftset", name: "เซ็ตรักษ์โลก" },
  { slug: "it-set", name: "สายไอที" },
];

describe("catalog album grouping", () => {
  it("reads the first folder as the group token", () => {
    assert.equal(firstFolderName("tumbler-set/cover.jpg"), "tumbler-set");
    assert.equal(firstFolderName("eco-giftset\\inner\\a.png"), "eco-giftset");
    assert.equal(firstFolderName("just-a-file.jpg"), null);
  });

  it("maps folder names onto fixed catalog groups", () => {
    assert.equal(inferGroupSlug("tumbler-set/01.jpg", GROUPS), "tumbler-set");
    assert.equal(inferGroupSlug("เซ็ตรักษ์โลก/bag.jpg", GROUPS), "eco-giftset");
    assert.equal(inferGroupSlug("it-set/spec.pdf", GROUPS), "it-set");
    assert.equal(inferGroupSlug("unknown-folder/x.jpg", GROUPS), OTHER_CATALOG_GROUP_SLUG);
    assert.equal(inferGroupSlug("x.jpg", GROUPS), OTHER_CATALOG_GROUP_SLUG);
  });

  it("rejects unknown explicit slugs into other", () => {
    assert.equal(allowedGroupSlug("it-set", GROUPS), "it-set");
    assert.equal(allowedGroupSlug("not-real", GROUPS), OTHER_CATALOG_GROUP_SLUG);
  });

  it("builds one book with section pages per group", () => {
    const files: AlbumFileInput[] = [
      {
        fileId: "CAF-AAAAAAAAAAAA",
        groupSlug: "tumbler-set",
        originalName: "cover.jpg",
        fileKind: "photo",
        servePath: albumFileServePath("CAF-AAAAAAAAAAAA"),
      },
      {
        fileId: "CAF-BBBBBBBBBBBB",
        groupSlug: "eco-giftset",
        originalName: "spec.pdf",
        fileKind: "pdf",
        servePath: albumFileServePath("CAF-BBBBBBBBBBBB"),
      },
    ];
    const book = buildCatalogBookFromFiles({
      files,
      groups: GROUPS,
      title: "อัลบั้มทดสอบ",
      subtitle: "จัดกลุ่มแล้ว",
      closingTitle: "จบ",
      closingBody: "ปิด",
    });
    assert.equal(book.pages[0]?.kind, "cover");
    assert.equal(book.pages.at(-1)?.kind, "closing");
    assert.equal(book.pages.filter((page) => page.kind === "section").length, 2);
    const photo = book.pages.find((page) => page.kind === "file" && page.fileKind === "photo");
    const pdf = book.pages.find((page) => page.kind === "file" && page.fileKind === "pdf");
    assert.ok(photo && photo.kind === "file" && photo.image?.startsWith("/api/catalog-album-files/"));
    assert.ok(pdf && pdf.kind === "file" && pdf.href?.startsWith("/api/catalog-album-files/"));
  });

  it("skips extra section pages for a single group album", () => {
    const book = buildCatalogBookFromFiles({
      files: [
        {
          fileId: "CAF-CCCCCCCCCCCC",
          groupSlug: "it-set",
          originalName: "powerbank.jpg",
          fileKind: "photo",
          servePath: "/api/catalog-album-files/CAF-CCCCCCCCCCCC",
        },
      ],
      groups: GROUPS,
      filterSlug: "it-set",
      title: "สายไอที",
      subtitle: "กลุ่มเดียว",
      closingTitle: "จบ",
      closingBody: "ปิด",
    });
    assert.equal(book.filterSlug, "it-set");
    assert.equal(book.pages.filter((page) => page.kind === "section").length, 0);
    assert.equal(book.pages.filter((page) => page.kind === "file").length, 1);
  });

  it("parses a snapshot and rejects junk", () => {
    const book = buildCatalogBookFromFiles({
      files: [
        {
          fileId: "CAF-DDDDDDDDDDDD",
          groupSlug: "tumbler-set",
          originalName: "a.jpg",
          fileKind: "photo",
          servePath: "/api/catalog-album-files/CAF-DDDDDDDDDDDD",
        },
      ],
      groups: GROUPS,
      title: "สมุด",
      subtitle: "ทดสอบ",
      closingTitle: "จบ",
      closingBody: "ปิด",
    });
    const parsed = parseCatalogBookSnapshot(JSON.stringify(book));
    assert.ok(parsed);
    assert.equal(parsed!.pages.length, book.pages.length);
    assert.equal(parseCatalogBookSnapshot("{nope"), null);
    assert.equal(parseCatalogBookSnapshot({ pages: [] }), null);
  });

  it("validates public album ids", () => {
    assert.equal(parseAlbumId("cab-abcdef123456"), "CAB-ABCDEF123456");
    assert.equal(parseAlbumId("nope"), null);
    assert.equal(parseAlbumFileId("CAF-ABCDEF123456")?.startsWith("CAF-"), true);
    assert.equal(albumPublicPath("CAB-ABCDEF123456"), "/album/CAB-ABCDEF123456");
  });
});
