import {
  deleteSkuFileAction,
  ingestSkuCoverAction,
  setSkuFileCoverAction,
  uploadSkuFileAction,
} from "@/app/actions/ops-products";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { SkuThumb } from "@/components/SkuThumb";
import { skuStorageLabel } from "@/lib/sku-files";
import type { SkuFile } from "@/lib/sku-master-types";

const KIND_LABEL: Record<SkuFile["fileKind"], string> = {
  photo: "รูป",
  document: "เอกสาร",
  other: "ไฟล์",
};

export function SkuFilePanel({
  productId,
  oriProductId,
  files,
  remoteImageUrl,
}: {
  productId?: string | null;
  oriProductId?: number | null;
  files: SkuFile[];
  remoteImageUrl?: string | null;
}) {
  const storage = skuStorageLabel();
  const canIngest =
    Boolean(productId && remoteImageUrl && /^https?:\/\//i.test(remoteImageUrl));

  return (
    <section id="files" className="scroll-mt-8 rounded-xl border border-forest/15 bg-paper p-5">
      <h2 className="font-semibold text-forest">รูปและไฟล์ ({storage})</h2>
      <p className="mt-1 text-sm text-ink/70">
        รูปเข้าบัคเก็ตสาธารณะ เอกสาร/Excel เข้าบัคเก็ตส่วนตัว — ไม่เก็บแค่ลิงก์ภายนอก
      </p>

      <div className="mt-4">
        <OpsCycleForm action={uploadSkuFileAction} submitLabel="อัปโหลดเข้า MinIO" encType="multipart/form-data">
          {productId ? <input type="hidden" name="productId" value={productId} /> : null}
          {oriProductId ? <input type="hidden" name="oriProductId" value={oriProductId} /> : null}
          <label className="block text-sm">
            <span className="font-medium">เลือกไฟล์</span>
            <input
              name="file"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.xls,.xlsx,.csv,.zip,.doc,.docx"
              className="mt-1 w-full text-sm"
            />
          </label>
          {productId ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="setCover" value="1" defaultChecked />
              ตั้งเป็นรูปปกถ้ารูปภาพ
            </label>
          ) : null}
        </OpsCycleForm>
      </div>

      {canIngest ? (
        <div className="mt-4 border-t border-forest/10 pt-4">
          <OpsCycleForm action={ingestSkuCoverAction} submitLabel="ดึงรูปแคตตาล็อกเข้า MinIO">
            <input type="hidden" name="productId" value={productId || ""} />
            <input type="hidden" name="imageUrl" value={remoteImageUrl || ""} />
            <p className="text-xs text-ink/55 break-all">{remoteImageUrl}</p>
          </OpsCycleForm>
        </div>
      ) : null}

      {files.length === 0 ? (
        <p className="mt-4 text-sm text-ink/55">ยังไม่มีไฟล์ในคลังวัตถุ</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-forest/10 px-3 py-2 text-sm"
            >
              {file.fileKind === "photo" ? (
                <SkuThumb src={file.servePath} alt={file.originalName} className="h-10 w-10" />
              ) : null}
              <a
                href={file.servePath}
                className="min-w-0 flex-1 truncate text-forest underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {file.originalName}
              </a>
              <span className="text-xs text-ink/50">
                {KIND_LABEL[file.fileKind]}
                {file.isCover ? " · ปก" : ""}
                {` · ${Math.max(1, Math.round(file.byteSize / 1024))} KB`}
              </span>
              {file.fileKind === "photo" && productId && !file.isCover ? (
                <OpsCycleForm action={setSkuFileCoverAction} submitLabel="ตั้งปก">
                  <input type="hidden" name="fileId" value={file.id} />
                  <input type="hidden" name="productId" value={productId} />
                  {oriProductId ? (
                    <input type="hidden" name="oriProductId" value={oriProductId} />
                  ) : null}
                </OpsCycleForm>
              ) : null}
              <OpsCycleForm action={deleteSkuFileAction} submitLabel="ลบ">
                <input type="hidden" name="fileId" value={file.id} />
                {productId ? <input type="hidden" name="productId" value={productId} /> : null}
                {oriProductId ? <input type="hidden" name="oriProductId" value={oriProductId} /> : null}
              </OpsCycleForm>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
