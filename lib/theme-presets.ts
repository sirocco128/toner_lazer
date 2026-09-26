/**
 * Storefront visual themes via CSS variables on <html data-theme="…">.
 * Tailwind forest/brass/ink/paper read these variables so buttons, badges,
 * and layout follow the selected palette.
 */

export const THEME_STORAGE_KEY = "smartgift:theme";

export const THEME_IDS = ["forest", "navy", "festive", "teal"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME_ID: ThemeId = "forest";

export type ThemePreset = {
  id: ThemeId;
  option: "default" | "A" | "B" | "C";
  label: string;
  hint: string;
  swatchPrimary: string;
  swatchAccent: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "forest",
    option: "default",
    label: "Smart Gift",
    hint: "พื้นอ่อน ตัวอักษรเข้ม ปุ่มส้ม ตามแบบแคตตาล็อก",
    swatchPrimary: "#1c1c1c",
    swatchAccent: "#e65312",
  },
  {
    id: "navy",
    option: "A",
    label: "Corporate Navy",
    hint: "Smart Navy สำหรับงานองค์กร",
    swatchPrimary: "#0b1f3a",
    swatchAccent: "#c59b27",
  },
  {
    id: "festive",
    option: "B",
    label: "Warm Festive",
    hint: "เทศกาลและของขวัญปีใหม่",
    swatchPrimary: "#8b0000",
    swatchAccent: "#d4af37",
  },
  {
    id: "teal",
    option: "C",
    label: "Modern Teal",
    hint: "โทนร่วมสมัยสำหรับไลฟ์สไตล์",
    swatchPrimary: "#005f73",
    swatchAccent: "#0a9396",
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId);
}

export function parseThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME_ID;
}

export function applyThemeToDocument(theme: ThemeId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === DEFAULT_THEME_ID) {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

/** Inline boot script — keep in sync with THEME_STORAGE_KEY and THEME_IDS. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var allowed=${JSON.stringify(THEME_IDS)};var t=localStorage.getItem(k);if(t&&allowed.indexOf(t)>=0&&t!==${JSON.stringify(DEFAULT_THEME_ID)}){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
