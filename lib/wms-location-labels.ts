/** Thai-first labels for warehouse locations (codes stay secondary). */

import {
  DEFAULT_LOCATION_CODE,
  QC_LOCATION_CODE,
  XDOCK_LOCATION_CODE,
} from "@/lib/wms-types";

const LABELS: Record<string, string> = {
  [DEFAULT_LOCATION_CODE]: "ชั้นวางหลัก",
  [QC_LOCATION_CODE]: "กักกัน QC",
  [XDOCK_LOCATION_CODE]: "จุดแพ็ก",
};

export function locationLabelTh(code: string | null | undefined): string {
  const c = (code || "").trim();
  if (!c) return "—";
  return LABELS[c] || c;
}

export function locationDisplay(
  code: string | null | undefined,
  name?: string | null,
): string {
  const c = (code || "").trim();
  if (!c) return "—";
  const th = LABELS[c];
  if (th) return `${th} · ${c}`;
  if (name) return `${name} · ${c}`;
  return c;
}
