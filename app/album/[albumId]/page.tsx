import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogFlipbook } from "@/components/CatalogFlipbook";
import { PriceDisclaimer } from "@/components/PriceDisclaimer";
import { albumPublicPath, parseAlbumId } from "@/lib/catalog-album";
import { getCatalogAlbum, getCatalogAlbumBook } from "@/lib/catalog-album-repository";
import { FLIP_CATALOG_NAV } from "@/lib/ux-copy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = { params: Promise<{ albumId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { albumId: raw } = await params;
  const albumId = parseAlbumId(raw);
  const album = albumId ? getCatalogAlbum(albumId) : null;
  if (!album || album.status !== "published") {
    return { title: "สมุดแคตตาล็อก", robots: { index: false, follow: false } };
  }
  return {
    title: album.title,
    description: album.subtitle || undefined,
    robots: { index: false, follow: false },
    alternates: { canonical: albumPublicPath(album.albumId) },
  };
}

export default async function PublicCatalogAlbumPage({ params }: PageProps) {
  const { albumId: raw } = await params;
  const albumId = parseAlbumId(raw);
  if (!albumId) notFound();
  const album = getCatalogAlbum(albumId);
  const book = getCatalogAlbumBook(albumId);
  if (!album || !book || album.status !== "published") notFound();

  return (
    <div className="bg-premium-mesh">
      <div className="mx-auto max-w-content px-page py-6 sm:py-8">
        <Breadcrumbs
          items={[
            { href: "/catalog", label: FLIP_CATALOG_NAV },
            { label: album.title },
          ]}
        />
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-forest sm:text-3xl dark:text-paper">
            {album.title}
          </h1>
          {album.subtitle ? (
            <p className="mt-2 text-sm leading-relaxed text-ink/65 dark:text-paper/70">
              {album.subtitle}
            </p>
          ) : null}
        </div>
        <CatalogFlipbook pages={book.pages} />
        <PriceDisclaimer className="mt-8" />
      </div>
    </div>
  );
}
