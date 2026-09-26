import type { DecorationMethod } from "@/lib/quote-types";

export type LogoDecorationOption = {
  value: Exclude<DecorationMethod, "not-sure">;
  label: string;
  hint: string;
};

export const LOGO_DECORATION_OPTIONS: LogoDecorationOption[] = [
  {
    value: "screen-print",
    label: "สกรีน",
    hint: "พิมพ์โลโก้บนผิวเรียบ เช่น ถุงผ้า กล่อง กระบอกน้ำ",
  },
  {
    value: "emboss",
    label: "ปั๊มนูน",
    hint: "นูนโลโก้บนหนัง ปกสมุด หรือกล่อง",
  },
  {
    value: "laser",
    label: "เลเซอร์",
    hint: "แกะโลโก้บนโลหะหรืออะลูมิเนียม ไม่หลุดลอกง่าย",
  },
  {
    value: "full-color",
    label: "พิมพ์สี",
    hint: "ลายสีเต็มบนผิวที่รับงานพิมพ์ได้",
  },
  {
    value: "uv-print",
    label: "พิมพ์ UV",
    hint: "ลายคมชัด สีเต็ม เหมาะผิวแข็งและของพรีเมียม",
  },
  {
    value: "embroidery",
    label: "ปัก",
    hint: "ปักโลโก้บนผ้า ถุงผ้า หรือเสื้อในเซ็ต",
  },
];

const ALL_LOGO_METHODS = LOGO_DECORATION_OPTIONS.map((item) => item.value);

const METHODS_BY_SLUG: Record<string, LogoDecorationOption["value"][]> = {
  "tumbler-notebook-pen-set": ["screen-print", "uv-print", "laser", "emboss"],
  "eco-tote-bamboo-set": ["screen-print", "embroidery", "uv-print", "full-color"],
  "it-powerbank-set": ["laser", "uv-print", "screen-print", "full-color"],
};

export function decorationValuesForProduct(
  slug: string,
): LogoDecorationOption["value"][] {
  return METHODS_BY_SLUG[slug] ?? ALL_LOGO_METHODS;
}

export function decorationOptionsForProduct(slug: string): LogoDecorationOption[] {
  const allowed = new Set(decorationValuesForProduct(slug));
  return LOGO_DECORATION_OPTIONS.filter((item) => allowed.has(item.value));
}