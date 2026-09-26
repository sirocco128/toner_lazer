"use client";

/*
 * UI/UX Design Brief — DesignLint v1.2
 * ──────────────────────────────────────────────
 * User:        sales/ops assembling a catalog between quotes — rushed, wants a share link
 * Tension:     Dense BUT calm (every group visible, no modal wizard)
 * Archetype:   existing Terabis ops console — Keep forest/paper, Discard generic upload widgets, Add physical group bins
 * Aesthetic:   Utilitarian editorial — because staff already live in this console
 * Type:        site ops stack (no new display font)
 * Palette:     forest-mist / paper / forest / brass / ink
 * Spatial:     two-pane press-table: bins left, published books right
 * Motion:      snappy 150ms on bin hover/drop
 * Signature:   each catalog group is a drop bin, like sorting a press kit
 * UX:          Bulk Import-First + Direct Manipulation; contextual errors; progressive (learn by dropping)
 * Voice:       terse Thai ops. CTA=สร้างสมุดนี้ Empty=ถังนี้ยังว่าง Error=ไฟล์นี้รับไม่ได้
 * Departure:   creation surface is the group bins themselves, not a form + Submit
 */

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  archiveCatalogAlbumAction,
  createAlbumsFromCatalogAction,
  createAlbumsFromFilesAction,
  deleteInboxAlbumFileAction,
  type CatalogAlbumCreateResult,
} from "@/app/actions/ops-catalog-albums";
import type { CatalogAlbumFileRecord, CatalogAlbumRecord } from "@/lib/catalog-album-repository";
import { albumPublicPath, inferGroupSlug, type AlbumGroupHint } from "@/lib/catalog-album";
import { OTHER_CATALOG_GROUP_SLUG } from "@/lib/catalog-book";
import { cn } from "@/lib/utils";

export type StudioGroup = AlbumGroupHint & {
  productCount: number;
  files: Array<Pick<CatalogAlbumFileRecord, "fileId" | "originalName" | "fileKind" | "byteSize">>;
};

type StudioProps = {
  groups: StudioGroup[];
  albums: CatalogAlbumRecord[];
  siteOrigin: string;
};

const createInitial: CatalogAlbumCreateResult | null = null;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function relativePathOf(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return relative && relative.trim() ? relative : file.name;
}

export function OpsCatalogBookStudio({ groups, albums, siteOrigin }: StudioProps) {
  const router = useRouter();
  const folderRef = useRef<HTMLInputElement>(null);
  const [layout, setLayout] = useState<"merged" | "by_group">("by_group");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string[]>(() =>
    groups.filter((group) => group.productCount > 0 || group.files.length > 0).map((group) => group.slug),
  );
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [note, setNote] = useState("วางไฟล์ลงถังกลุ่ม หรือเลือกโฟลเดอร์ที่ตั้งชื่อตามหมวดบนเว็บ");
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [hoverSlug, setHoverSlug] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [catalogState, catalogAction, catalogPending] = useActionState(
    createAlbumsFromCatalogAction,
    createInitial,
  );
  const [filesState, filesAction, filesPending] = useActionState(
    createAlbumsFromFilesAction,
    createInitial,
  );

  const hints: AlbumGroupHint[] = useMemo(
    () => groups.map((group) => ({ slug: group.slug, name: group.name })),
    [groups],
  );
  const inboxCount = groups.reduce((sum, group) => sum + group.files.length, 0);
  const pending = catalogPending || filesPending || Boolean(busySlug);
  const result = filesState?.ok ? filesState : catalogState;

  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
    folderRef.current?.setAttribute("directory", "");
  }, []);

  function toggleSlug(slug: string) {
    setSelected((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
    );
  }

  async function uploadList(fileList: File[], explicitGroup?: string) {
    const files = [...fileList].filter((file) => !file.name.startsWith("."));
    if (!files.length) return;
    setError("");
    setBusySlug(explicitGroup || "folder");
    let saved = 0;
    let lastError = "";
    const landed = new Set<string>();
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      const relative = relativePathOf(file);
      form.append("relativePath", relative);
      if (explicitGroup) form.append("groupSlug", explicitGroup);
      const res = await fetch("/api/ops/catalog-albums/files", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        file?: { groupSlug?: string };
      } | null;
      if (!json?.ok) {
        lastError = json?.error || "อัปโหลดไม่สำเร็จ";
        continue;
      }
      if (json.file?.groupSlug) landed.add(json.file.groupSlug);
      saved += 1;
    }
    setBusySlug(null);
    if (landed.size) {
      setSelected((current) => [...new Set([...current, ...landed])]);
    }
    if (saved === 0) {
      setError(lastError || "ไม่มีไฟล์ที่รับได้");
      return;
    }
    const inferred = explicitGroup
      ? groups.find((group) => group.slug === explicitGroup)?.name
      : inferGroupSlug(files[0] && "webkitRelativePath" in files[0] ? String(files[0].webkitRelativePath) : "", hints);
    setNote(
      lastError
        ? `เก็บได้ ${saved} ไฟล์ — ${lastError}`
        : `เก็บแล้ว ${saved} ไฟล์${inferred ? ` ในกลุ่ม ${inferred}` : ""}`,
    );
    startTransition(() => router.refresh());
  }

  function onBinDrop(event: React.DragEvent, slug: string) {
    event.preventDefault();
    setHoverSlug(null);
    const dropped = [...event.dataTransfer.files];
    void uploadList(dropped, slug);
  }

  async function copyLink(albumId: string) {
    const url = `${siteOrigin.replace(/\/$/, "")}${albumPublicPath(albumId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(albumId);
    } catch {
      setError("คัดลอกลิงก์ไม่สำเร็จ — คัดจากแถบที่อยู่หลังเปิดสมุด");
    }
  }

  return (
    <div className="catalog-press-table">
      <div className="rounded-xl border border-forest/15 bg-paper p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-[12rem] flex-1 text-sm">
            <span className="font-medium text-forest">ชื่อสมุด (ไม่บังคับ)</span>
            <input
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="เช่น แคตตาล็อก Q3 ลูกค้าธนาคาร"
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <fieldset className="text-sm">
            <legend className="font-medium text-forest">รูปแบบเล่ม</legend>
            <div className="mt-2 flex gap-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="layout"
                  checked={layout === "by_group"}
                  onChange={() => setLayout("by_group")}
                />
                หนึ่งเล่มต่อกลุ่ม
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="layout"
                  checked={layout === "merged"}
                  onChange={() => setLayout("merged")}
                />
                รวมทุกกลุ่มเป็นเล่มเดียว
              </label>
            </div>
          </fieldset>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <form action={catalogAction}>
            <input type="hidden" name="layout" value={layout} />
            <input type="hidden" name="title" value={title} />
            <input type="hidden" name="groupSlugs" value={selected.join(",")} />
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-forest px-4 py-2 text-sm text-paper disabled:opacity-60"
            >
              {catalogPending ? "กำลังเข้าเล่ม…" : "สร้างจากสินค้าในระบบ"}
            </button>
          </form>
          <form action={filesAction}>
            <input type="hidden" name="layout" value={layout} />
            <input type="hidden" name="title" value={title} />
            <input type="hidden" name="groupSlugs" value={selected.join(",")} />
            <button
              type="submit"
              disabled={pending || inboxCount === 0}
              className="rounded border border-forest/30 bg-forest-mist/50 px-4 py-2 text-sm text-forest disabled:opacity-60"
            >
              {filesPending ? "กำลังเข้าเล่ม…" : `สร้างจากไฟล์ในถัง (${inboxCount})`}
            </button>
          </form>
          <button
            type="button"
            className="rounded border border-dashed border-brass/60 px-4 py-2 text-sm text-forest"
            onClick={() => folderRef.current?.click()}
            disabled={pending}
          >
            เลือกโฟลเดอร์ที่จัดกลุ่มแล้ว
          </button>
          <input
            ref={folderRef}
            type="file"
            className="hidden"
            multiple
            onChange={(event) => {
              const list = event.target.files;
              if (list?.length) void uploadList([...list]);
              event.target.value = "";
            }}
          />
        </div>

        {error ? (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {catalogState?.error ? (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {catalogState.error}
          </p>
        ) : null}
        {filesState?.error ? (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {filesState.error}
          </p>
        ) : null}
        {result?.ok && result.albumIds?.length ? (
          <p className="mt-3 rounded-lg border border-forest/20 bg-forest-mist/50 px-3 py-2 text-sm text-forest">
            เข้าเล่มแล้ว {result.albumIds.length} สมุด — ลิงก์อยู่คอลัมน์ขวา
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink/65">{note}</p>
        )}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <section>
          <h2 className="text-lg font-semibold text-forest">ถังตามกลุ่มที่ fix ไว้</h2>
          <p className="mt-1 text-sm text-ink/65">
            ติ๊กกลุ่มที่จะเข้าเล่ม แล้ววางรูปหรือ PDF ลงถังนั้น — โฟลเดอร์ชื่อ slug หมวดจะเข้ากลุ่มให้อัตโนมัติ
          </p>
          <ul className="mt-4 space-y-3">
            {groups.map((group) => {
              const on = selected.includes(group.slug);
              const dropping = hoverSlug === group.slug;
              return (
                <li
                  key={group.slug}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setHoverSlug(group.slug);
                  }}
                  onDragLeave={() => setHoverSlug((current) => (current === group.slug ? null : current))}
                  onDrop={(event) => onBinDrop(event, group.slug)}
                  className={cn(
                    "rounded-xl border bg-paper p-4 transition-[border-color,box-shadow] duration-150",
                    dropping
                      ? "border-brass shadow-[inset_4px_0_0_0_theme(colors.amber.600)]"
                      : "border-forest/15",
                    !on && "opacity-70",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={on}
                        onChange={() => toggleSlug(group.slug)}
                      />
                      <span>
                        <span className="font-semibold text-forest">{group.name}</span>
                        <span className="mt-0.5 block font-mono text-xs text-ink/50">{group.slug}</span>
                      </span>
                    </label>
                    <p className="text-sm text-ink/60">
                      {group.productCount} สินค้า · {group.files.length} ไฟล์ในถัง
                    </p>
                  </div>
                  {group.files.length === 0 ? (
                    <p className="mt-3 border border-dashed border-forest/20 px-3 py-4 text-sm text-ink/50">
                      {busySlug === group.slug
                        ? "กำลังเก็บไฟล์…"
                        : group.slug === OTHER_CATALOG_GROUP_SLUG
                          ? "ถังนี้สำหรับไฟล์ที่โฟลเดอร์ไม่ตรงหมวด — วางได้เลย"
                          : "ถังนี้ยังว่าง — วางรูปหรือ PDF ที่นี่"}
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-forest/10 text-sm">
                      {group.files.map((file) => (
                        <li key={file.fileId} className="flex items-center justify-between gap-3 py-2">
                          <span className="min-w-0 truncate">
                            {file.originalName}
                            <span className="ml-2 text-ink/45">
                              {file.fileKind === "pdf" ? "PDF" : "รูป"} · {formatBytes(file.byteSize)}
                            </span>
                          </span>
                          <form action={deleteInboxAlbumFileAction}>
                            <input type="hidden" name="fileId" value={file.fileId} />
                            <button type="submit" className="text-xs text-ink/55 underline-offset-2 hover:underline">
                              เอาออก
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <aside>
          <h2 className="text-lg font-semibold text-forest">สมุดที่สร้างแล้ว</h2>
          <p className="mt-1 text-sm text-ink/65">ลิงก์สาธารณะใช้ส่งลูกค้าได้เลย ไม่มีโฆษณา FlipHTML5</p>
          {albums.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-forest/20 px-4 py-8 text-sm text-ink/55">
              ยังไม่มีสมุดจากเครื่องมือนี้ — กดสร้างจากสินค้าในระบบเพื่อทดลองเล่มแรก
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {albums.map((album) => {
                const live = album.status === "published";
                const href = live ? albumPublicPath(album.albumId) : `/ops/catalog-books/${album.albumId}`;
                return (
                  <li key={album.albumId} className="rounded-xl border border-forest/15 bg-paper p-4">
                    <p className="font-semibold text-forest">{album.title}</p>
                    <p className="mt-1 text-xs text-ink/55">
                      {album.pageCount} หน้า · {album.source === "files" ? "จากไฟล์" : "จากสินค้า"} ·{" "}
                      {album.layout === "by_group" ? "แยกกลุ่ม" : "เล่มรวม"}
                      {live ? "" : " · เก็บแล้ว"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      <Link href={href} className="text-forest underline-offset-2 hover:underline">
                        เปิดสมุด
                      </Link>
                      {live ? (
                        <button
                          type="button"
                          className="text-forest underline-offset-2 hover:underline"
                          onClick={() => void copyLink(album.albumId)}
                        >
                          {copiedId === album.albumId ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
                        </button>
                      ) : null}
                      {live ? (
                        <form action={archiveCatalogAlbumAction}>
                          <input type="hidden" name="albumId" value={album.albumId} />
                          <button type="submit" className="text-ink/55 underline-offset-2 hover:underline">
                            เก็บเข้าคลัง
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
