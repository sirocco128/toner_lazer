/**
 * Client-side mockup package: master artwork for quote + factory prep copy.
 */

import type { MockupVariantId } from "@/lib/mockup-studio";

export const MOCKUP_PACKAGE_STORAGE_KEY = "giftpro:mockup-package:v1";

export type MockupPackageRole = "customer_master" | "factory_prep";

export type MockupPackageFile = {
  role: MockupPackageRole;
  label: string;
  /** JPEG/PNG data URL from canvas export. */
  dataUrl: string;
  variantId: MockupVariantId;
  variantLabel: string;
};

export type MockupPackage = {
  version: 1;
  createdAt: string;
  productName: string;
  surfaceLabel: string;
  colorLabel: string;
  brief: string;
  files: MockupPackageFile[];
};

export function isJpegOrPngDataUrl(value: string): boolean {
  return /^data:image\/(jpeg|jpg|png);base64,[A-Za-z0-9+/=]+$/i.test(
    value.trim(),
  );
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const b64 = dataUrl.slice(comma + 1);
  return Math.floor((b64.length * 3) / 4);
}

/** Soft cap so quote upload stays reasonable (~1.5MB each). */
export const MOCKUP_PACKAGE_MAX_FILE_BYTES = 1_500_000;

export function buildMockupPackage(input: {
  productName: string;
  surfaceLabel: string;
  colorLabel: string;
  brief: string;
  selected: {
    id: MockupVariantId;
    label: string;
    dataUrl: string;
  };
  /** Optional product-only shot kept for factory print reference. */
  productShot?: {
    id: MockupVariantId;
    label: string;
    dataUrl: string;
  } | null;
}): MockupPackage {
  const files: MockupPackageFile[] = [
    {
      role: "customer_master",
      label: "ไฟล์ต้นแบบส่งลูกค้า (พร้อมใบเสนอราคา)",
      dataUrl: input.selected.dataUrl,
      variantId: input.selected.id,
      variantLabel: input.selected.label,
    },
  ];

  const factorySource = input.productShot?.dataUrl
    ? input.productShot
    : input.selected;

  files.push({
    role: "factory_prep",
    label: "ไฟล์เตรียมส่งโรงงาน (ต้นฉบับงานสกรีน)",
    dataUrl: factorySource.dataUrl,
    variantId: factorySource.id,
    variantLabel: factorySource.label,
  });

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    productName: input.productName,
    surfaceLabel: input.surfaceLabel,
    colorLabel: input.colorLabel,
    brief: input.brief,
    files,
  };
}

export function saveMockupPackage(pkg: MockupPackage): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(MOCKUP_PACKAGE_STORAGE_KEY, JSON.stringify(pkg));
}

export function loadMockupPackage(): MockupPackage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(MOCKUP_PACKAGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockupPackage;
    if (parsed?.version !== 1 || !Array.isArray(parsed.files)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearMockupPackage(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(MOCKUP_PACKAGE_STORAGE_KEY);
}

export function customerMasterFromPackage(
  pkg: MockupPackage | null,
): MockupPackageFile | null {
  return pkg?.files.find((f) => f.role === "customer_master") ?? null;
}
