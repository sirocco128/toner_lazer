import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogFlipbook } from "@/components/CatalogFlipbook";
import { getCatalogAlbum, getCatalogAlbumBook } from "@/lib/catalog-album-repository";
import { parseAlbumId } from "@/lib/catalog-album";
import { requireOpsPage } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = { params: Promise<{ albumId: string }> };

export default async function OpsCatalogAlbumPreviewPage({ params }: PageProps) {
  await requireOpsPage("catalog.write");
  const { albumId: raw } = await params;
  const albumId = parseAlbumId(raw);
  if (!albumId) notFound();
  const album = getCatalogAlbum(albumId);
  const book = getCatalogAlbumBook(albumId);
  if (!album || !book) notFound();

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/catalog-books" className="text-forest underline-offset-2 hover:underline">
          ← โต๊ะสร้างสมุด
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">{album.title}</h1>
      <p className="mt-1 text-sm text-ink/70">
        {album.pageCount} หน้า · {album.status === "published" ? "เผยแพร่แล้ว" : "เก็บในคลัง"}
      </p>
      <CatalogFlipbook pages={book.pages} />
    </div>
  );
}
