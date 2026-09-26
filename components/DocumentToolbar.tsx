"use client";

import Link from "next/link";
import { useState } from "react";
import {
  a4ShouldFitOnePage,
  a4SinglePageSize,
  a4SliceRanges,
  A4_WIDTH_MM,
  pdfDownloadName,
} from "@/lib/document-pdf";

function prepareCloneForPdf(clonedDoc: Document) {
  const cloned = clonedDoc.getElementById("document-sheet");
  if (!(cloned instanceof HTMLElement)) return;
  cloned.style.boxShadow = "none";
  cloned.style.minHeight = "0";
  cloned.style.height = "auto";
  cloned.style.overflow = "hidden";
}

export function DocumentToolbar({
  backHref,
  backLabel,
  fileName,
  emphasizePrint = false,
}: {
  backHref: string;
  backLabel: string;
  fileName: string;
  /** Larger primary print button (packing slips) */
  emphasizePrint?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function savePdf() {
    const sheet = document.getElementById("document-sheet");
    if (!(sheet instanceof HTMLElement)) {
      setError("ไม่พบเอกสารสำหรับบันทึก PDF");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(sheet, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        onclone: prepareCloneForPdf,
      });
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      if (a4ShouldFitOnePage(canvas.width, canvas.height)) {
        const size = a4SinglePageSize(canvas.width, canvas.height);
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, size.widthMm, size.heightMm);
      } else {
        const slices = a4SliceRanges(canvas.width, canvas.height);
        slices.forEach((slice, index) => {
          if (index > 0) pdf.addPage();
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = slice.height;
          const ctx = pageCanvas.getContext("2d");
          if (!ctx) throw new Error("canvas");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            slice.y,
            canvas.width,
            slice.height,
            0,
            0,
            canvas.width,
            slice.height,
          );
          const imgH = (slice.height * A4_WIDTH_MM) / canvas.width;
          pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 0, 0, A4_WIDTH_MM, imgH);
        });
      }
      pdf.save(pdfDownloadName(fileName));
      if (backHref.startsWith("/ops")) {
        try {
          const blob = pdf.output("blob");
          const form = new FormData();
          form.append("file", blob, pdfDownloadName(fileName));
          form.append("fileName", pdfDownloadName(fileName));
          await fetch("/api/ops/documents", { method: "POST", body: form });
        } catch {
          // Download already succeeded; archive is best-effort for ops.
        }
      }
    } catch {
      setError("สร้างไฟล์ PDF ไม่สำเร็จ — กดพิมพ์ แล้วเลือกบันทึกเป็น PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref} className="text-sm text-forest underline-offset-2 hover:underline">
          {backLabel}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className={
            emphasizePrint
              ? "min-h-12 rounded-lg bg-forest px-5 py-3 text-base font-semibold text-paper shadow-sm hover:opacity-95"
              : "rounded bg-forest px-3 py-1.5 text-sm text-paper"
          }
        >
          {emphasizePrint ? "พิมพ์ใบปะหน้า" : "พิมพ์"}
        </button>
        <button
          type="button"
          onClick={() => void savePdf()}
          disabled={busy}
          className={
            emphasizePrint
              ? "min-h-12 rounded-lg border border-forest/30 bg-white px-4 py-3 text-sm font-medium text-forest disabled:opacity-60"
              : "rounded border border-forest/30 bg-white px-3 py-1.5 text-sm text-forest disabled:opacity-60"
          }
        >
          {busy ? "กำลังสร้าง PDF…" : "บันทึก PDF"}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink/60">
        พรีวิวขนาดกระดาษ A4 — กดบันทึก PDF เพื่อดาวน์โหลดไฟล์ หรือพิมพ์แล้วเลือกเครื่องพิมพ์เป็น PDF
        {backHref.startsWith("/ops")
          ? " สำเนาเอกสารสำคัญจะถูกเก็บในคลังไฟล์"
          : ""}
      </p>
      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
