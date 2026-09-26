/**
 * Client-side product mockup: 3 style previews → customer picks one.
 * Preview only — files stay in the browser; Smart Gift watermark always applied.
 */

export const MOCKUP_BRIEF_EVENT = "giftpro:mockup-brief";

/** Preview watermark stamped on customer logos and the mockup canvas. */
export const MOCKUP_WATERMARK_TEXT = "Smart Gift";

export type MockupBriefEventDetail = {
  text: string;
  variantId?: string;
  variantLabel?: string;
};

export type MockupSurfaceId = "tumbler" | "notebook" | "pen" | "product";

export type MockupSurfaceKind = "cylinder" | "cover" | "pen";

export type CustomDesignPreset = "tumbler_set" | "product_photo";

export type MockupSurface = {
  id: MockupSurfaceId;
  label: string;
  kind: MockupSurfaceKind;
  hint: string;
  /** Real product photo used as the template base. */
  photo: string;
  /** Optional logo boxes per style (fractions of the product frame). */
  logoZones?: Partial<
    Record<MockupVariantId, { x: number; y: number; w: number; h: number }>
  >;
};

export type MockupFinish = {
  id: string;
  label: string;
  body: string;
  accent: string;
};

/** Generated layout styles the customer can pick. */
export type MockupVariantId = "product" | "lifestyle" | "office" | "retail";

export type MockupVariantPreset = {
  id: MockupVariantId;
  label: string;
  summary: string;
  /** Fallback logo box as fractions of the product frame. */
  logo: { x: number; y: number; w: number; h: number };
  textAlign: "center" | "bottom";
  logoOpacity: number;
};

/** Single print zone per surface (used by all scene variants). */
const TUMBLER_PRINT = { x: 0.38, y: 0.44, w: 0.24, h: 0.14 };
const NOTEBOOK_PRINT = { x: 0.22, y: 0.4, w: 0.34, h: 0.24 };
const PEN_PRINT = { x: 0.28, y: 0.42, w: 0.4, h: 0.12 };

const TUMBLER_LOGO_ZONES: NonNullable<MockupSurface["logoZones"]> = {
  product: TUMBLER_PRINT,
  lifestyle: TUMBLER_PRINT,
  office: TUMBLER_PRINT,
  retail: TUMBLER_PRINT,
};

const NOTEBOOK_LOGO_ZONES: NonNullable<MockupSurface["logoZones"]> = {
  product: NOTEBOOK_PRINT,
  lifestyle: NOTEBOOK_PRINT,
  office: NOTEBOOK_PRINT,
  retail: NOTEBOOK_PRINT,
};

const PEN_LOGO_ZONES: NonNullable<MockupSurface["logoZones"]> = {
  product: PEN_PRINT,
  lifestyle: PEN_PRINT,
  office: PEN_PRINT,
  retail: PEN_PRINT,
};

/** Default paths aligned with tumbler-notebook-pen-set catalog assets. */
export const TUMBLER_SET_DEFAULT_PHOTOS = {
  tumbler: "/images/product-tumbler.jpg",
  notebook: "/images/product-tumbler-set.jpg",
  pen: "/images/product-tumbler-set-2.jpg",
} as const;

export function buildTumblerSetSurfaces(images: string[] = []): MockupSurface[] {
  const tumbler =
    images[0]?.trim() || TUMBLER_SET_DEFAULT_PHOTOS.tumbler;
  const notebook =
    images[1]?.trim() || images[0]?.trim() || TUMBLER_SET_DEFAULT_PHOTOS.notebook;
  const pen =
    images[2]?.trim() ||
    images[1]?.trim() ||
    images[0]?.trim() ||
    TUMBLER_SET_DEFAULT_PHOTOS.pen;

  return [
    {
      id: "tumbler",
      label: "กระบอกน้ำ",
      kind: "cylinder",
      hint: "พื้นที่สกรีนกลางลำตัว — โค้งตามกระบอก",
      photo: tumbler,
      logoZones: TUMBLER_LOGO_ZONES,
    },
    {
      id: "notebook",
      label: "สมุดโน้ต",
      kind: "cover",
      hint: "พื้นที่พิมพ์บนปก — ขนาดงานจริงโดยประมาณ",
      photo: notebook,
      logoZones: NOTEBOOK_LOGO_ZONES,
    },
    {
      id: "pen",
      label: "ปากกา",
      kind: "pen",
      hint: "แถบพิมพ์บนลำกล้อง — ตามแนวปากกา",
      photo: pen,
      logoZones: PEN_LOGO_ZONES,
    },
  ];
}

export const TUMBLER_SET_SURFACES: MockupSurface[] = buildTumblerSetSurfaces();

export const MOCKUP_FINISHES: MockupFinish[] = [
  { id: "stainless", label: "สแตนเลส", body: "#c5cdd4", accent: "#8e98a3" },
  { id: "black", label: "ดำด้าน", body: "#2c3036", accent: "#1a1d22" },
  { id: "white", label: "ขาวงาช้าง", body: "#f3efe6", accent: "#d9d3c6" },
  { id: "forest", label: "เขียวป่า", body: "#1e4a3a", accent: "#14352a" },
  { id: "navy", label: "กรมท่า", body: "#1c2d4d", accent: "#121c33" },
  { id: "brass", label: "ทองเหลือง", body: "#b08a3e", accent: "#8a6a2c" },
];

export const MOCKUP_VARIANTS: MockupVariantPreset[] = [
  {
    id: "product",
    label: "1. บนสินค้า",
    summary: "รูปสินค้าที่เลือก พร้อมโลโก้หรือข้อความ",
    logo: TUMBLER_PRINT,
    textAlign: "bottom",
    logoOpacity: 0.96,
  },
  {
    id: "lifestyle",
    label: "2. ใช้จริง",
    summary: "วางในบริบทการใช้งานจริงว่าเหมาะกับอะไร",
    logo: TUMBLER_PRINT,
    textAlign: "bottom",
    logoOpacity: 0.96,
  },
  {
    id: "office",
    label: "3. ในออฟฟิศ",
    summary: "วางในตำแหน่งใช้งานในสำนักงาน",
    logo: TUMBLER_PRINT,
    textAlign: "bottom",
    logoOpacity: 0.96,
  },
  {
    id: "retail",
    label: "4. รีเทล",
    summary: "วางบนชั้นร้านค้า แล้วปรับด้วยคำสั่งต่อได้",
    logo: TUMBLER_PRINT,
    textAlign: "bottom",
    logoOpacity: 0.96,
  },
];

/** Scene backdrops for lifestyle / office / retail composites (cycled on regen). */
export const MOCKUP_SCENE_PHOTOS = {
  lifestyle: {
    cylinder: [
      "/images/mockup-scene-lifestyle-tumbler.jpg",
      "/images/mockup-scene-lifestyle-tumbler-2.jpg",
      "/images/portfolio-welcome.jpg",
    ],
    cover: [
      "/images/mockup-scene-lifestyle-notebook.jpg",
      "/images/mockup-scene-lifestyle-notebook-2.jpg",
      "/images/article-guide.jpg",
    ],
    pen: [
      "/images/mockup-scene-lifestyle-pen.jpg",
      "/images/mockup-scene-lifestyle-notebook.jpg",
      "/images/article-cover.jpg",
    ],
  },
  office: {
    cylinder: [
      "/images/mockup-scene-office.jpg",
      "/images/mockup-scene-office-2.jpg",
      "/images/mockup-scene-office-3.jpg",
    ],
    cover: [
      "/images/mockup-scene-office.jpg",
      "/images/mockup-scene-office-2.jpg",
      "/images/mockup-scene-office-3.jpg",
    ],
    pen: [
      "/images/mockup-scene-office.jpg",
      "/images/mockup-scene-office-2.jpg",
      "/images/mockup-scene-office-3.jpg",
    ],
  },
  retail: {
    cylinder: [
      "/images/hero-giftset.jpg",
      "/images/mockup-scene-office-3.jpg",
      "/images/portfolio-welcome.jpg",
    ],
    cover: [
      "/images/hero-giftset.jpg",
      "/images/mockup-scene-office-2.jpg",
      "/images/article-guide.jpg",
    ],
    pen: [
      "/images/hero-giftset.jpg",
      "/images/mockup-scene-office.jpg",
      "/images/article-cover.jpg",
    ],
  },
} as const;

export function scenePhotoFor(
  variantId: MockupVariantId,
  kind: MockupSurfaceKind,
  sceneIndex = 0,
): string | null {
  if (
    variantId !== "lifestyle" &&
    variantId !== "office" &&
    variantId !== "retail"
  ) {
    return null;
  }
  const list = MOCKUP_SCENE_PHOTOS[variantId][kind];
  if (!list.length) return null;
  const idx = ((sceneIndex % list.length) + list.length) % list.length;
  return list[idx]!;
}

export function sceneCountFor(
  variantId: "lifestyle" | "office" | "retail",
  kind: MockupSurfaceKind,
): number {
  return MOCKUP_SCENE_PHOTOS[variantId][kind].length;
}

export function usageContextCopy(
  kind: MockupSurfaceKind,
  activityIndex = 0,
): {
  lifestyleTitle: string;
  lifestyleBody: string;
  officeTitle: string;
  officeBody: string;
  retailTitle: string;
  retailBody: string;
} {
  const tumblerActivities = [
    {
      lifestyleTitle: "เหมาะกับพกใช้ประจำวัน",
      lifestyleBody: "ประชุม · เดินทาง · ออกกำลังกาย · ของแจกลูกค้า",
    },
    {
      lifestyleTitle: "เหมาะกับงานอีเวนต์และต้อนรับ",
      lifestyleBody: "เปิดตัวสินค้า · บูธอีเวนต์ · ของที่ระลึกแขก VIP",
    },
    {
      lifestyleTitle: "เหมาะกับทีมเซลส์และภาคสนาม",
      lifestyleBody: "เยี่ยมลูกค้า · รถบริษัท · ของแจกพนักงาน",
    },
  ];
  const notebookActivities = [
    {
      lifestyleTitle: "เหมาะกับจดโน้ตและเวิร์กช็อป",
      lifestyleBody: "ประชุม · อบรม · สมุดของขวัญองค์กร",
    },
    {
      lifestyleTitle: "เหมาะกับงานวางแผนและ brainstorm",
      lifestyleBody: "workshop · รีทรีตทีม · สมุดแจกผู้บริหาร",
    },
    {
      lifestyleTitle: "เหมาะกับของขวัญต้อนรับแขก",
      lifestyleBody: "onboarding พนักงานใหม่ · ของแจกวิทยากร",
    },
  ];
  const penActivities = [
    {
      lifestyleTitle: "เหมาะกับงานเขียนและเซ็นเอกสาร",
      lifestyleBody: "ลงนาม · จดบันทึก · ของแจกอีเวนต์",
    },
    {
      lifestyleTitle: "เหมาะกับชุดต้อนรับและเซ็นสัญญา",
      lifestyleBody: "ห้องประชุม · พิธีลงนาม · ของแจกลูกค้าสำคัญ",
    },
    {
      lifestyleTitle: "เหมาะกับแจกในงานสัมมนา",
      lifestyleBody: "สัมมนา · เปิดหลักสูตร · ของที่ระลึกวิทยากร",
    },
  ];

  const officeVariants = [
    {
      officeTitle: "วางบนโต๊ะทำงาน / มุมพักดื่มน้ำ",
      officeBody: "เห็นโลโก้ชัดตอนใช้งานในออฟฟิศทุกวัน",
    },
    {
      officeTitle: "วางในห้องประชุม / โต๊ะรับแขก",
      officeBody: "โชว์แบรนด์ตอนประชุมและต้อนรับลูกค้า",
    },
    {
      officeTitle: "วางที่เคาน์เตอร์ต้อนรับ / ชั้นโชว์",
      officeBody: "จุดแรกที่แขกเห็นเมื่อเข้าสำนักงาน",
    },
  ];
  const retailVariants = [
    {
      retailTitle: "วางบนชั้นร้านค้า / จุดขาย",
      retailBody: "โชว์โลโก้ตอนจัดเรียงหน้าร้านหรือชุดของขวัญ",
    },
    {
      retailTitle: "วางที่เคาน์เตอร์ของที่ระลึก",
      retailBody: "เหมาะกับจุดรับของ บูธ และชุดพร้อมแจก",
    },
    {
      retailTitle: "จัดชุดขายพร้อมแพ็กเกจ",
      retailBody: "เห็นแบรนด์ชัดตอนหยิบจากชั้นไปใส่กล่อง",
    },
  ];

  const activities =
    kind === "cylinder"
      ? tumblerActivities
      : kind === "pen"
        ? penActivities
        : notebookActivities;
  const activity =
    activities[((activityIndex % activities.length) + activities.length) % activities.length]!;
  const office =
    officeVariants[
      ((activityIndex % officeVariants.length) + officeVariants.length) %
        officeVariants.length
    ]!;
  const retail =
    retailVariants[
      ((activityIndex % retailVariants.length) + retailVariants.length) %
        retailVariants.length
    ]!;

  return { ...activity, ...office, ...retail };
}

export const MOCKUP_MAX_FILE_BYTES = 8 * 1024 * 1024;

export const MOCKUP_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

export function getSurfacesForProduct(slug: string): MockupSurface[] | null {
  if (slug === "tumbler-notebook-pen-set") {
    return buildTumblerSetSurfaces([
      TUMBLER_SET_DEFAULT_PHOTOS.tumbler,
      TUMBLER_SET_DEFAULT_PHOTOS.notebook,
      TUMBLER_SET_DEFAULT_PHOTOS.pen,
    ]);
  }
  return null;
}

/**
 * Resolve mockup surfaces from CMS flags on a product.
 * - enableCustomDesign must be true
 * - tumbler_set → กระบอกน้ำ / สมุด / ปากกา จากรูปสินค้า (images[0..2])
 * - product_photo → ใช้รูปสินค้าหลักเป็นแม่แบบเดียว
 */
export function resolveMockupSurfaces(product: {
  name: string;
  slug: string;
  images: string[];
  enableCustomDesign?: boolean;
  customDesignPreset?: CustomDesignPreset;
}): MockupSurface[] | null {
  if (!product.enableCustomDesign) {
    return getSurfacesForProduct(product.slug);
  }

  const preset = product.customDesignPreset || "product_photo";
  if (preset === "tumbler_set") {
    return buildTumblerSetSurfaces(product.images);
  }

  const photo =
    product.images[0]?.trim() || "/images/product-placeholder.jpg";
  return [
    {
      id: "product",
      label: product.name,
      kind: "cover",
      hint: "วางโลโก้บนรูปสินค้านี้",
      photo,
      logoZones: NOTEBOOK_LOGO_ZONES,
    },
  ];
}

export function resolveLogoBox(
  surface: MockupSurface,
  variant: MockupVariantPreset,
): { x: number; y: number; w: number; h: number } {
  return surface.logoZones?.[variant.id] ?? variant.logo;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isMockupImageFile(file: Pick<File, "type" | "name">): boolean {
  if (MOCKUP_IMAGE_TYPES.has(file.type)) return true;
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
}

export function normalizeBrightness(value: number | undefined): number {
  return clamp(value ?? 1, 0.5, 1.5);
}

export function normalizeContrast(value: number | undefined): number {
  return clamp(value ?? 1, 0.5, 1.5);
}

export type LogoImageBuffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function sampleCornerAverage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { r: number; g: number; b: number } {
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ] as const;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const [x, y] of points) {
    const sx = clamp(x, 0, width - 1);
    const sy = clamp(y, 0, height - 1);
    const i = (sy * width + sx) * 4;
    r += data[i] ?? 0;
    g += data[i + 1] ?? 0;
    b += data[i + 2] ?? 0;
    n += 1;
  }
  return { r: r / n, g: g / n, b: b / n };
}

/**
 * Client-side logo cleanup: optional background knock-out + brightness/contrast.
 * Uses corner sampling (not generative AI).
 */
export function applyLogoImageDataAdjustments(
  imageData: LogoImageBuffer,
  options: {
    removeBg?: boolean;
    brightness?: number;
    contrast?: number;
    /** Color distance threshold for background knock-out (default 42). */
    threshold?: number;
  } = {},
): LogoImageBuffer {
  const brightness = normalizeBrightness(options.brightness);
  const contrast = normalizeContrast(options.contrast);
  const data = new Uint8ClampedArray(imageData.data);
  const { width, height } = imageData;
  const bg = sampleCornerAverage(data, width, height);
  const removeBg = Boolean(options.removeBg);
  const threshold = clamp(options.threshold ?? 42, 8, 120);
  const soft = Math.max(16, Math.round(threshold * 0.65));

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] ?? 0;
    let g = data[i + 1] ?? 0;
    let b = data[i + 2] ?? 0;
    let a = data[i + 3] ?? 0;

    if (removeBg && a > 0) {
      const dist = colorDistance(r, g, b, bg.r, bg.g, bg.b);
      if (dist < threshold) {
        a = 0;
      } else if (dist < threshold + soft) {
        a = Math.round(a * ((dist - threshold) / soft));
      }
    }

    if (a > 0 && (brightness !== 1 || contrast !== 1)) {
      const apply = (channel: number) => {
        let value = channel / 255;
        value = (value - 0.5) * contrast + 0.5;
        value *= brightness;
        return clamp(Math.round(value * 255), 0, 255);
      };
      r = apply(r);
      g = apply(g);
      b = apply(b);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }

  return { data, width, height };
}

/** Crop transparent margins; returns original if fully empty. */
export function cropOpaqueBounds(
  imageData: LogoImageBuffer,
  padding = 4,
): LogoImageBuffer {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = data[(y * width + x) * 4 + 3] ?? 0;
      if (a < 8) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return imageData;

  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width - 1, maxX + padding);
  const bottom = Math.min(height - 1, maxY + padding);
  const nextW = right - left + 1;
  const nextH = bottom - top + 1;
  const next = new Uint8ClampedArray(nextW * nextH * 4);
  for (let y = 0; y < nextH; y += 1) {
    for (let x = 0; x < nextW; x += 1) {
      const si = ((top + y) * width + (left + x)) * 4;
      const di = (y * nextW + x) * 4;
      next[di] = data[si] ?? 0;
      next[di + 1] = data[si + 1] ?? 0;
      next[di + 2] = data[si + 2] ?? 0;
      next[di + 3] = data[si + 3] ?? 0;
    }
  }
  return { data: next, width: nextW, height: nextH };
}

export function buildMockupBrief(input: {
  productName: string;
  surfaceLabel: string;
  colorLabel: string;
  variantLabel: string;
  hasLogo: boolean;
  text?: string;
  materialFit?: string;
}): string {
  const lines = [
    "ยืนยันแบบ mockup จากหน้าเว็บ (ยังไม่ใช่แบบผลิต)",
    `สินค้า: ${input.productName}`,
    `วัสดุแม่แบบ: ${input.surfaceLabel}`,
    `สีวัสดุ: ${input.colorLabel}`,
    `แบบที่เลือก: ${input.variantLabel}`,
    input.hasLogo ? "มีไฟล์โลโก้แนบในพรีวิว" : "ไม่มีไฟล์โลโก้",
  ];
  if (input.materialFit?.trim()) {
    lines.push(`การวางบนวัสดุ: ${input.materialFit.trim()}`);
  }
  if (input.text?.trim()) {
    lines.push(`ข้อความบนสินค้า: ${input.text.trim()}`);
  }
  lines.push(
    `พรีวิวมีลายน้ำ ${MOCKUP_WATERMARK_TEXT} — ยังไม่ใช่ไฟล์ผลิต`,
    "ตำแหน่งและขนาดประมาณพื้นที่สกรีนจริง ทีมขายจะตรวจไฟล์ก่อนผลิต",
    "กรุณาส่งไฟล์โลโก้ความละเอียดสูงให้ทีมขายทางอีเมลหรือ LINE",
  );
  return lines.join("\n").slice(0, 1800);
}

/** @deprecated geometry helpers kept for older tests — prefer MOCKUP_VARIANTS */
export function wrapUnit(value: number): number {
  return ((value % 1) + 1) % 1;
}

export function autoFitOverlayPlacement(
  kind: MockupSurfaceKind,
  aspect = 1.35,
): { u: number; v: number; w: number; h: number } {
  const logo =
    kind === "cover"
      ? NOTEBOOK_PRINT
      : kind === "pen"
        ? PEN_PRINT
        : TUMBLER_PRINT;
  const w = logo.w;
  const h = clamp(w / Math.max(aspect, 0.35), 0.12, 0.4);
  return { u: logo.x, v: logo.y, w, h };
}

export function overlayProcessKey(input: {
  id: string;
  removeBg?: boolean;
  brightness?: number;
  contrast?: number;
}): string {
  return [
    input.id,
    input.removeBg ? "1" : "0",
    normalizeBrightness(input.brightness).toFixed(2),
    normalizeContrast(input.contrast).toFixed(2),
  ].join("|");
}
