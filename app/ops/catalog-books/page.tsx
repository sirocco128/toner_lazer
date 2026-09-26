import { OpsCatalogBookStudio } from "@/components/OpsCatalogBookStudio";
import { OTHER_CATALOG_GROUP_SLUG } from "@/lib/catalog-book";
import { fallbackOtherGroup, listCatalogAlbums, listInboxAlbumFiles } from "@/lib/catalog-album-repository";
import { requireOpsPage } from "@/lib/ops-auth";
import { site } from "@/lib/site";
import { getCategories, getProducts } from "@/lib/strapi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsCatalogBooksPage() {
  await requireOpsPage("catalog.write");
  const [products, categories, albums, inbox] = await Promise.all([
    getProducts(),
    getCategories(),
    Promise.resolve(listCatalogAlbums()),
    Promise.resolve(listInboxAlbumFiles()),
  ]);

  const hints = fallbackOtherGroup(
    categories.map((category) => ({ slug: category.slug, name: category.name })),
  );
  const groups = hints.map((hint) => ({
    ...hint,
    productCount:
      hint.slug === OTHER_CATALOG_GROUP_SLUG
        ? products.filter((product) => !categories.some((category) => category.slug === product.categorySlug)).length
        : products.filter((product) => product.categorySlug === hint.slug).length,
    files: inbox
      .filter((file) => file.groupSlug === hint.slug)
      .map((file) => ({
        fileId: file.fileId,
        originalName: file.originalName,
        fileKind: file.fileKind,
        byteSize: file.byteSize,
      })),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">สร้างสมุดแคตตาล็อก</h1>
      <p className="mt-2 max-w-3xl text-sm text-ink/70">
        ทำอัลบั้มเองแบบแผนโปร — ไม่มีโฆษณา ไม่พึ่ง API FlipHTML5 จัดไฟล์ตามกลุ่มเดียวกับเว็บ
        แล้วออกเป็นสมุดพลิกพร้อมลิงก์ส่งลูกค้า
      </p>
      <div className="mt-6">
        <OpsCatalogBookStudio groups={groups} albums={albums} siteOrigin={site.url} />
      </div>
    </div>
  );
}
