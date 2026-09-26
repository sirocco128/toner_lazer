/** A4 portrait used by on-screen preview and PDF export. */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
/** Scale slightly instead of spilling a few millimetres onto a blank second page. */
export const A4_FIT_SLACK_MM = 18;

export function a4PageHeightPx(canvasWidthPx: number): number {
  const width = Math.max(1, Math.floor(canvasWidthPx));
  return Math.max(1, Math.round((width * A4_HEIGHT_MM) / A4_WIDTH_MM));
}

export function canvasHeightMm(canvasWidthPx: number, canvasHeightPx: number): number {
  return (Math.max(1, canvasHeightPx) * A4_WIDTH_MM) / Math.max(1, canvasWidthPx);
}

export function a4ShouldFitOnePage(
  canvasWidthPx: number,
  canvasHeightPx: number,
): boolean {
  return canvasHeightMm(canvasWidthPx, canvasHeightPx) <= A4_HEIGHT_MM + A4_FIT_SLACK_MM;
}

export function a4SinglePageSize(
  canvasWidthPx: number,
  canvasHeightPx: number,
): { widthMm: number; heightMm: number } {
  const heightMm = canvasHeightMm(canvasWidthPx, canvasHeightPx);
  if (heightMm <= A4_HEIGHT_MM) {
    return { widthMm: A4_WIDTH_MM, heightMm };
  }
  const scale = A4_HEIGHT_MM / heightMm;
  return { widthMm: A4_WIDTH_MM * scale, heightMm: A4_HEIGHT_MM };
}

export function a4SliceRanges(
  canvasWidthPx: number,
  canvasHeightPx: number,
): { y: number; height: number }[] {
  const height = Math.max(1, Math.floor(canvasHeightPx));
  const pageH = a4PageHeightPx(canvasWidthPx);
  const ranges: { y: number; height: number }[] = [];
  let y = 0;
  while (y < height) {
    ranges.push({ y, height: Math.min(pageH, height - y) });
    y += pageH;
  }
  const last = ranges[ranges.length - 1];
  if (ranges.length > 1 && last && last.height < pageH * 0.04) {
    ranges.pop();
  }
  return ranges;
}

export function pdfDownloadName(id: string): string {
  const safe = id.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${safe || "document"}.pdf`;
}
