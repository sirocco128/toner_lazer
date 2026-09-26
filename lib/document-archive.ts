/**
 * Archive generated PDFs (quotes, receipts, PO) into object storage.
 */

import { pdfDownloadName } from "@/lib/document-pdf";
import { putObject, type StoredObject } from "@/lib/object-storage";

export const DOCUMENT_MAX_BYTES = 12_000_000;

export function isPdfBuffer(bytes: Buffer): boolean {
  return bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

export async function archivePdfDocument(input: {
  fileName: string;
  bytes: Buffer;
}): Promise<StoredObject> {
  if (!isPdfBuffer(input.bytes)) {
    throw new Error("not_pdf");
  }
  if (input.bytes.length > DOCUMENT_MAX_BYTES) {
    throw new Error("too_large");
  }
  const day = new Date().toISOString().slice(0, 10);
  const name = pdfDownloadName(input.fileName);
  return putObject({
    kind: "documents",
    fileName: `${day}/${name}`,
    bytes: input.bytes,
    contentType: "application/pdf",
  });
}
