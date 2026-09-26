"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import {
  MOCKUP_BRIEF_EVENT,
  MOCKUP_FINISHES,
  MOCKUP_MAX_FILE_BYTES,
  MOCKUP_VARIANTS,
  MOCKUP_WATERMARK_TEXT,
  applyLogoImageDataAdjustments,
  buildMockupBrief,
  clamp,
  cropOpaqueBounds,
  isMockupImageFile,
  scenePhotoFor,
  usageContextCopy,
  type MockupFinish,
  type MockupSurface,
  type MockupVariantId,
  type MockupVariantPreset,
} from "@/lib/mockup-studio";
import {
  cylinderSampleAt,
  finishBlendMode,
  finishRecolorAlpha,
  materialHint,
  resolvePrintBox,
  sceneProductSlot,
  type PrintBox,
} from "@/lib/mockup-compose";
import {
  EMPTY_RETAIL_ADJUSTMENTS,
  RETAIL_COMMAND_CHIPS,
  applyPrintAdjustments,
  describeRetailAdjustments,
  mergeRetailAdjustments,
  nextFinishId,
  parseRetailCommand,
  type RetailAdjustments,
} from "@/lib/mockup-retail-command";
import { MOCKUP_RETAIL_HEADING, MOCKUP_RETAIL_HINT } from "@/lib/ux-copy";

type ProductMockupStudioProps = {
  productName: string;
  surfaces: MockupSurface[];
};

type GeneratedVariant = {
  id: MockupVariantId;
  label: string;
  summary: string;
  dataUrl: string;
};

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`โหลดรูปไม่สำเร็จ: ${src}`));
    img.src = src;
  });
}

function stampWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opacity: number,
) {
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-28 * Math.PI) / 180);
  const fontSize = clamp(Math.min(width, height) * 0.07, 14, 36);
  ctx.font = `600 ${fontSize}px "Noto Sans Thai", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `rgba(20,53,42,${opacity})`;
  ctx.strokeStyle = `rgba(255,255,255,${opacity * 0.35})`;
  ctx.lineWidth = Math.max(0.8, fontSize * 0.04);
  const mark = MOCKUP_WATERMARK_TEXT;
  const markWidth = ctx.measureText(mark).width;
  const stepY = fontSize * 3.2;
  const stepX = markWidth + fontSize * 2.4;
  for (let row = -3; row <= 3; row += 1) {
    for (let col = -3; col <= 3; col += 1) {
      const ox = col * stepX + (row % 2 === 0 ? 0 : stepX * 0.45);
      const oy = row * stepY;
      ctx.strokeText(mark, ox, oy);
      ctx.fillText(mark, ox, oy);
    }
  }
  ctx.restore();

  ctx.save();
  const label = `ตัวอย่าง ${MOCKUP_WATERMARK_TEXT}`;
  ctx.font = '600 13px "Noto Sans Thai", system-ui, sans-serif';
  const tw = ctx.measureText(label).width;
  const pad = 10;
  const bx = width - tw - pad * 2 - 14;
  const by = height - 36;
  ctx.fillStyle = "rgba(20,53,42,0.55)";
  roundedRectPath(ctx, bx, by, tw + pad * 2, 26, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(247,250,247,0.95)";
  ctx.textBaseline = "middle";
  ctx.fillText(label, bx + pad, by + 13);
  ctx.restore();
}

function prepareLogoCanvas(
  source: HTMLImageElement,
  removeBg: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(64, source.naturalWidth || source.width);
  canvas.height = Math.max(64, source.naturalHeight || source.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const raw = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const adjusted = applyLogoImageDataAdjustments(raw, {
    removeBg,
    brightness: 1,
    contrast: 1,
  });
  const frame = ctx.createImageData(adjusted.width, adjusted.height);
  frame.data.set(adjusted.data);
  ctx.putImageData(frame, 0, 0);
  return canvas;
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const sw =
    source instanceof HTMLImageElement
      ? source.naturalWidth || source.width
      : source instanceof HTMLCanvasElement
        ? source.width
        : 1;
  const sh =
    source instanceof HTMLImageElement
      ? source.naturalHeight || source.height
      : source instanceof HTMLCanvasElement
        ? source.height
        : 1;
  const scale = Math.min(dw / Math.max(sw, 1), dh / Math.max(sh, 1));
  const w = sw * scale;
  const h = sh * scale;
  ctx.drawImage(source, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
}

function makeContainedLogo(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  drawContain(ctx, source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Warp a flat logo onto a front-facing cylinder / barrel. */
function warpLogoToSurface(
  logo: HTMLCanvasElement,
  width: number,
  height: number,
  bend: number,
): HTMLCanvasElement {
  const flat = makeContainedLogo(logo, width, height);
  if (bend < 0.05) return flat;

  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(width));
  out.height = Math.max(1, Math.round(height));
  const ctx = out.getContext("2d");
  if (!ctx) return flat;

  const srcW = flat.width;
  const srcH = flat.height;
  for (let x = 0; x < out.width; x += 1) {
    const destT = out.width <= 1 ? 0.5 : x / (out.width - 1);
    const { srcT, scale } = cylinderSampleAt(destT, bend);
    if (srcT < 0 || srcT > 1) continue;
    const sx = Math.min(srcW - 1, Math.max(0, Math.floor(srcT * (srcW - 1))));
    const stripH = out.height * (0.92 + scale * 0.08);
    const dy = (out.height - stripH) / 2;
    ctx.drawImage(flat, sx, 0, 1, srcH, x, dy, 1, stripH);
  }

  // Soft side shade so ink sits on the curved face
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const shade = ctx.createLinearGradient(0, 0, out.width, 0);
  shade.addColorStop(0, "rgba(0,0,0,0.28)");
  shade.addColorStop(0.35, "rgba(255,255,255,0.08)");
  shade.addColorStop(0.5, "rgba(255,255,255,0.12)");
  shade.addColorStop(0.65, "rgba(255,255,255,0.06)");
  shade.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.restore();

  return out;
}

function printBoxFor(
  surface: MockupSurface,
  printAdjust?: RetailAdjustments,
): PrintBox {
  const box = resolvePrintBox(surface);
  return printAdjust
    ? applyPrintAdjustments(box, printAdjust)
    : box;
}

function drawPrintDecoration(
  ctx: CanvasRenderingContext2D,
  options: {
    logoCanvas: HTMLCanvasElement | null;
    text: string;
    textColor: string;
    finish: MockupFinish;
    print: PrintBox;
    frame: { dx: number; dy: number; dw: number; dh: number };
    opacity: number;
  },
) {
  const { frame, print, finish } = options;
  const boxW = Math.max(8, print.w * frame.dw);
  const boxH = Math.max(8, print.h * frame.dh);
  const cx = frame.dx + print.x * frame.dw + boxW / 2;
  const cy = frame.dy + print.y * frame.dh + boxH / 2;

  let artwork: HTMLCanvasElement | null = null;
  if (options.logoCanvas) {
    artwork = warpLogoToSurface(options.logoCanvas, boxW, boxH, print.bend);
  } else if (options.text.trim()) {
    const textCanvas = document.createElement("canvas");
    textCanvas.width = Math.max(64, Math.round(boxW));
    textCanvas.height = Math.max(32, Math.round(boxH));
    const tctx = textCanvas.getContext("2d");
    if (tctx) {
      tctx.fillStyle = options.textColor;
      const fontSize = Math.max(14, Math.min(boxH * 0.55, boxW * 0.22));
      tctx.font = `700 ${fontSize}px "Noto Sans Thai", system-ui, sans-serif`;
      tctx.textAlign = "center";
      tctx.textBaseline = "middle";
      tctx.fillText(options.text.trim(), textCanvas.width / 2, textCanvas.height / 2);
      artwork = warpLogoToSurface(textCanvas, boxW, boxH, print.bend);
    }
  }
  if (!artwork) return;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((print.rotateDeg * Math.PI) / 180);
  ctx.globalAlpha = options.opacity;
  ctx.globalCompositeOperation = finishBlendMode(finish);
  ctx.drawImage(artwork, -boxW / 2, -boxH / 2, boxW, boxH);

  // Soft contact shadow so decoration reads as sitting on material
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = options.opacity * 0.22;
  const contact = ctx.createLinearGradient(0, -boxH / 2, 0, boxH / 2);
  contact.addColorStop(0, "rgba(0,0,0,0)");
  contact.addColorStop(0.55, "rgba(0,0,0,0.05)");
  contact.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = contact;
  ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
  ctx.restore();
}

function drawProductFrame(
  ctx: CanvasRenderingContext2D,
  product: HTMLImageElement,
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
  finish: MockupFinish,
) {
  const pw = product.naturalWidth || 1;
  const ph = product.naturalHeight || 1;
  const scale = Math.min(frameW / pw, frameH / ph);
  const dw = pw * scale;
  const dh = ph * scale;
  const dx = frameX + (frameW - dw) / 2;
  const dy = frameY + (frameH - dh) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(20, 30, 28, 0.28)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#ffffff";
  roundedRectPath(ctx, dx - 2, dy - 2, dw + 4, dh + 4, 18);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRectPath(ctx, dx, dy, dw, dh, 16);
  ctx.clip();
  ctx.drawImage(product, dx, dy, dw, dh);

  // Recolor body to selected material while keeping photo lighting
  ctx.globalCompositeOperation = "color";
  ctx.globalAlpha = finishRecolorAlpha(finish);
  ctx.fillStyle = finish.body;
  ctx.fillRect(dx, dy, dw, dh);

  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = finish.accent;
  ctx.fillRect(dx, dy, dw, dh);

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // Edge vignette for depth
  const vig = ctx.createRadialGradient(
    dx + dw / 2,
    dy + dh / 2,
    Math.min(dw, dh) * 0.35,
    dx + dw / 2,
    dy + dh / 2,
    Math.max(dw, dh) * 0.72,
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(12,18,16,0.14)");
  ctx.fillStyle = vig;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.restore();

  return { dx, dy, dw, dh };
}

function canvasFromImageData(buffer: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = buffer.width;
  canvas.height = buffer.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const frame = ctx.createImageData(buffer.width, buffer.height);
  frame.data.set(buffer.data);
  ctx.putImageData(frame, 0, 0);
  return canvas;
}

/** Branded product with studio backdrop knocked out — for lifestyle/office scenes. */
async function renderProductCutout(options: {
  surface: MockupSurface;
  finish: MockupFinish;
  logoCanvas: HTMLCanvasElement | null;
  text: string;
  textColor: string;
  logoOpacity: number;
  printAdjust?: RetailAdjustments;
}): Promise<HTMLCanvasElement> {
  const product = await loadImage(options.surface.photo);
  const pw = product.naturalWidth || 1;
  const ph = product.naturalHeight || 1;
  const maxSide = 1000;
  const scale = Math.min(maxSide / pw, maxSide / ph, 1);
  const width = Math.max(1, Math.round(pw * scale));
  const height = Math.max(1, Math.round(ph * scale));

  const base = document.createElement("canvas");
  base.width = width;
  base.height = height;
  const bctx = base.getContext("2d", { willReadFrequently: true });
  if (!bctx) return base;

  bctx.drawImage(product, 0, 0, width, height);
  const raw = bctx.getImageData(0, 0, width, height);
  const cut = applyLogoImageDataAdjustments(raw, {
    removeBg: true,
    threshold: 52,
  });
  const cropped = cropOpaqueBounds(cut, 8);
  const subject = canvasFromImageData(cropped);
  const sctx = subject.getContext("2d");
  if (!sctx) return subject;

  // Recolor material only on remaining opaque pixels
  sctx.save();
  sctx.globalCompositeOperation = "source-atop";
  sctx.globalAlpha = finishRecolorAlpha(options.finish);
  sctx.fillStyle = options.finish.body;
  sctx.fillRect(0, 0, subject.width, subject.height);
  sctx.globalAlpha = 0.12;
  sctx.fillStyle = options.finish.accent;
  sctx.fillRect(0, 0, subject.width, subject.height);
  sctx.restore();

  const print = printBoxFor(options.surface, options.printAdjust);
  const frame = {
    dx: 0,
    dy: 0,
    dw: subject.width,
    dh: subject.height,
  };
  drawPrintDecoration(sctx, {
    logoCanvas: options.logoCanvas,
    text: options.logoCanvas ? "" : options.text,
    textColor: options.textColor,
    finish: options.finish,
    print,
    frame,
    opacity: options.logoOpacity,
  });

  if (options.logoCanvas && options.text.trim()) {
    const textPrint: PrintBox = {
      ...print,
      y: Math.min(0.78, print.y + print.h + 0.03),
      h: Math.min(0.1, print.h * 0.7),
      bend: print.bend * 0.85,
    };
    drawPrintDecoration(sctx, {
      logoCanvas: null,
      text: options.text,
      textColor: options.textColor,
      finish: options.finish,
      print: textPrint,
      frame,
      opacity: options.logoOpacity * 0.95,
    });
  }

  return subject;
}

async function renderBrandedProductCanvas(options: {
  surface: MockupSurface;
  finish: MockupFinish;
  logoCanvas: HTMLCanvasElement | null;
  text: string;
  textColor: string;
  logoOpacity: number;
  width?: number;
  height?: number;
  withCaption?: boolean;
  captionTitle?: string;
  captionBody?: string;
  printAdjust?: RetailAdjustments;
}): Promise<HTMLCanvasElement> {
  const width = options.width ?? 1080;
  const height = options.height ?? 1350;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ไม่สามารถสร้างภาพได้");

  const product = await loadImage(options.surface.photo);

  const bg = ctx.createLinearGradient(0, 0, width * 0.2, height);
  bg.addColorStop(0, "#f7faf8");
  bg.addColorStop(0.45, "#e8f0eb");
  bg.addColorStop(1, "#d2e0d6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.58,
    40,
    width * 0.5,
    height * 0.58,
    width * 0.42,
  );
  glow.addColorStop(0, "rgba(255,255,255,0.55)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const captionH = options.withCaption ? height * 0.18 : height * 0.06;
  const frameX = width * 0.07;
  const frameY = height * 0.05;
  const frameW = width * 0.86;
  const frameH = height - frameY - captionH - height * 0.03;
  const placed = drawProductFrame(
    ctx,
    product,
    frameX,
    frameY,
    frameW,
    frameH,
    options.finish,
  );

  const print = printBoxFor(options.surface, options.printAdjust);
  drawPrintDecoration(ctx, {
    logoCanvas: options.logoCanvas,
    text: options.logoCanvas ? "" : options.text,
    textColor: options.textColor,
    finish: options.finish,
    print,
    frame: placed,
    opacity: options.logoOpacity,
  });

  if (options.logoCanvas && options.text.trim()) {
    const textPrint: PrintBox = {
      ...print,
      y: Math.min(0.78, print.y + print.h + 0.03),
      h: Math.min(0.1, print.h * 0.7),
      bend: print.bend * 0.85,
    };
    drawPrintDecoration(ctx, {
      logoCanvas: null,
      text: options.text,
      textColor: options.textColor,
      finish: options.finish,
      print: textPrint,
      frame: placed,
      opacity: options.logoOpacity * 0.95,
    });
  }

  if (options.withCaption) {
    const hint = materialHint(options.surface.kind);
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.fillRect(0, height - captionH, width, captionH);
    ctx.fillStyle = "#1c1c1c";
    ctx.font = '700 30px "Noto Sans Thai", system-ui, sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(
      options.captionTitle ?? "บนสินค้า",
      width * 0.08,
      height - captionH + 42,
    );
    ctx.fillStyle = "rgba(34,40,44,0.7)";
    ctx.font = '500 20px "Noto Sans Thai", system-ui, sans-serif';
    ctx.fillText(
      options.captionBody ??
        `${options.surface.label} · ${options.finish.label}`,
      width * 0.08,
      height - captionH + 78,
    );
    ctx.fillStyle = "rgba(34,40,44,0.55)";
    ctx.font = '500 17px "Noto Sans Thai", system-ui, sans-serif';
    ctx.fillText(hint, width * 0.08, height - captionH + 110);
  }

  return canvas;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  const sw =
    source instanceof HTMLImageElement
      ? source.naturalWidth || source.width
      : source instanceof HTMLCanvasElement
        ? source.width
        : 1;
  const sh =
    source instanceof HTMLImageElement
      ? source.naturalHeight || source.height
      : source instanceof HTMLCanvasElement
        ? source.height
        : 1;
  const scale = Math.max(width / Math.max(sw, 1), height / Math.max(sh, 1));
  const w = sw * scale;
  const h = sh * scale;
  ctx.drawImage(source, (width - w) / 2, (height - h) / 2, w, h);
}

async function renderSceneComposite(options: {
  variant: MockupVariantPreset;
  surface: MockupSurface;
  productCutout: HTMLCanvasElement;
  sceneUrl: string;
  title: string;
  body: string;
  slotIndex?: number;
}): Promise<GeneratedVariant> {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ไม่สามารถสร้างภาพได้");

  const scene = await loadImage(options.sceneUrl);
  drawCover(ctx, scene, width, height);

  const veil = ctx.createLinearGradient(0, height * 0.4, 0, height);
  veil.addColorStop(0, "rgba(12,20,18,0)");
  veil.addColorStop(0.6, "rgba(12,20,18,0.2)");
  veil.addColorStop(1, "rgba(12,20,18,0.7)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, width, height);

  const slotId =
    options.variant.id === "office" || options.variant.id === "retail"
      ? options.variant.id
      : "lifestyle";
  const slot = sceneProductSlot(
    slotId,
    options.surface.kind,
    options.slotIndex ?? 0,
  );
  const cardX = slot.x * width;
  const cardY = slot.y * height;
  const cardW = slot.w * width;
  const cardH = slot.h * height;

  // Place cutout product (no white card) with soft ground shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.38)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 16;
  drawContain(ctx, options.productCutout, cardX, cardY, cardW, cardH);
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillRect(0, height * 0.78, width, height * 0.22);
  ctx.fillStyle = "#1c1c1c";
  ctx.font = '700 30px "Noto Sans Thai", system-ui, sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(options.variant.label, width * 0.08, height * 0.84);
  ctx.fillStyle = "#2a2a2a";
  ctx.font = '700 24px "Noto Sans Thai", system-ui, sans-serif';
  ctx.fillText(options.title, width * 0.08, height * 0.89);
  ctx.fillStyle = "rgba(34,40,44,0.68)";
  ctx.font = '500 20px "Noto Sans Thai", system-ui, sans-serif';
  ctx.fillText(options.body, width * 0.08, height * 0.94);

  stampWatermark(ctx, width, height, 0.05);

  return {
    id: options.variant.id,
    label: options.variant.label,
    summary: options.variant.summary,
    dataUrl: canvas.toDataURL("image/jpeg", 0.92),
  };
}

async function imageToJpegDataUrl(
  src: string,
  maxSide = 768,
  quality = 0.82,
): Promise<string> {
  const img = await loadImage(src);
  const pw = img.naturalWidth || img.width || 1;
  const ph = img.naturalHeight || img.height || 1;
  const scale = Math.min(1, maxSide / Math.max(pw, ph));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(pw * scale));
  canvas.height = Math.max(1, Math.round(ph * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ไม่สามารถแปลงรูปได้");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function stampWatermarkOnDataUrl(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, img.naturalWidth || img.width);
  canvas.height = Math.max(1, img.naturalHeight || img.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  stampWatermark(ctx, canvas.width, canvas.height, 0.05);
  return canvas.toDataURL("image/jpeg", 0.92);
}

async function tryGenerateWithOpenRouter(options: {
  productName: string;
  surface: MockupSurface;
  finish: MockupFinish;
  logoCanvas: HTMLCanvasElement | null;
  text: string;
  activityIndex: number;
  variantIds?: MockupVariantId[];
  refineInstruction?: string;
  previousDataUrl?: string | null;
}): Promise<{ variants: GeneratedVariant[] } | { error: string }> {
  try {
    const statusRes = await fetch("/api/mockup/generate", { method: "GET" });
    if (!statusRes.ok) return { error: "ตรวจสอบสถานะ AI ไม่สำเร็จ" };
    const status = (await statusRes.json()) as { enabled?: boolean };
    if (!status.enabled) return { error: "ยังใช้โหมดพรีวิวในเครื่อง" };

    const productDataUrl = await imageToJpegDataUrl(options.surface.photo);
    const logoDataUrl = options.logoCanvas
      ? options.logoCanvas.toDataURL("image/png")
      : null;

    const res = await fetch("/api/mockup/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName: options.productName,
        surfaceLabel: options.surface.label,
        surfaceKind: options.surface.kind,
        finishLabel: options.finish.label,
        text: options.text,
        productDataUrl,
        logoDataUrl,
        activityIndex: options.activityIndex,
        variantIds: options.variantIds,
        refineInstruction: options.refineInstruction,
        previousDataUrl: options.previousDataUrl,
      }),
    });
    const payload = (await res.json()) as {
      ok?: boolean;
      variants?: Array<{
        id: MockupVariantId;
        label: string;
        summary: string;
        dataUrl: string;
      }>;
      error?: string;
    };
    if (!res.ok || !payload.ok || !payload.variants?.length) {
      return { error: payload.error || `AI ตอบกลับไม่สำเร็จ (${res.status})` };
    }

    const stamped = await Promise.all(
      payload.variants.map(async (item) => ({
        id: item.id,
        label: item.label,
        summary: item.summary,
        dataUrl: await stampWatermarkOnDataUrl(item.dataUrl),
      })),
    );
    return { variants: stamped };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "เรียก AI ไม่สำเร็จ",
    };
  }
}

async function renderVariantSet(options: {
  surface: MockupSurface;
  finish: MockupFinish;
  logoCanvas: HTMLCanvasElement | null;
  text: string;
  textColor: string;
  activityIndex?: number;
  printAdjust?: RetailAdjustments;
}): Promise<GeneratedVariant[]> {
  const activityIndex = options.activityIndex ?? 0;
  const productVariant = MOCKUP_VARIANTS.find((item) => item.id === "product")!;
  const lifestyleVariant = MOCKUP_VARIANTS.find((item) => item.id === "lifestyle")!;
  const officeVariant = MOCKUP_VARIANTS.find((item) => item.id === "office")!;
  const retailVariant = MOCKUP_VARIANTS.find((item) => item.id === "retail")!;
  const copy = usageContextCopy(options.surface.kind, activityIndex);

  const productCanvas = await renderBrandedProductCanvas({
    surface: options.surface,
    finish: options.finish,
    logoCanvas: options.logoCanvas,
    text: options.text,
    textColor: options.textColor,
    logoOpacity: productVariant.logoOpacity,
    withCaption: true,
    captionTitle: productVariant.label,
    captionBody: `${options.surface.label} · ${options.finish.label}`,
    printAdjust: options.printAdjust,
  });
  stampWatermark(
    productCanvas.getContext("2d")!,
    productCanvas.width,
    productCanvas.height,
    0.05,
  );

  const productShot: GeneratedVariant = {
    id: productVariant.id,
    label: productVariant.label,
    summary: productVariant.summary,
    dataUrl: productCanvas.toDataURL("image/jpeg", 0.92),
  };

  const cutout = await renderProductCutout({
    surface: options.surface,
    finish: options.finish,
    logoCanvas: options.logoCanvas,
    text: options.text,
    textColor: options.textColor,
    logoOpacity: productVariant.logoOpacity,
    printAdjust: options.printAdjust,
  });

  const lifestyleScene = scenePhotoFor(
    "lifestyle",
    options.surface.kind,
    activityIndex,
  );
  const officeScene = scenePhotoFor("office", options.surface.kind, activityIndex);
  const retailScene = scenePhotoFor("retail", options.surface.kind, activityIndex);
  if (!lifestyleScene || !officeScene || !retailScene) {
    throw new Error("ไม่พบภาพฉากประกอบ");
  }

  const lifestyleShot = await renderSceneComposite({
    variant: lifestyleVariant,
    surface: options.surface,
    productCutout: cutout,
    sceneUrl: lifestyleScene,
    title: copy.lifestyleTitle,
    body: copy.lifestyleBody,
    slotIndex: activityIndex,
  });

  const officeShot = await renderSceneComposite({
    variant: officeVariant,
    surface: options.surface,
    productCutout: cutout,
    sceneUrl: officeScene,
    title: copy.officeTitle,
    body: copy.officeBody,
    slotIndex: activityIndex,
  });
  const retailShot = await renderSceneComposite({
    variant: retailVariant,
    surface: options.surface,
    productCutout: cutout,
    sceneUrl: retailScene,
    title: copy.retailTitle,
    body: copy.retailBody,
    slotIndex: activityIndex,
  });

  return [productShot, lifestyleShot, officeShot, retailShot];
}

export function ProductMockupStudio({
  productName,
  surfaces,
}: ProductMockupStudioProps) {
  const fileInputId = useId();
  const textInputId = useId();

  const [surfaceId, setSurfaceId] = useState(surfaces[0]?.id ?? "tumbler");
  const [finishId, setFinishId] = useState(MOCKUP_FINISHES[0]?.id ?? "stainless");
  const [logoName, setLogoName] = useState<string | null>(null);
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#14352A");
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [selectedId, setSelectedId] = useState<MockupVariantId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [lightbox, setLightbox] = useState<GeneratedVariant | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [engine, setEngine] = useState<"openrouter" | "canvas" | null>(null);
  const [activityIndex, setActivityIndex] = useState(0);
  const [retailCommand, setRetailCommand] = useState("");
  const [retailAdjust, setRetailAdjust] = useState<RetailAdjustments>(
    EMPTY_RETAIL_ADJUSTMENTS,
  );
  const retailInputId = useId();

  const surface = surfaces.find((item) => item.id === surfaceId) ?? surfaces[0]!;
  const finish =
    MOCKUP_FINISHES.find((item) => item.id === finishId) ?? MOCKUP_FINISHES[0]!;
  const selected = useMemo(
    () => variants.find((item) => item.id === selectedId) ?? null,
    [selectedId, variants],
  );

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/mockup/generate")
      .then((res) => res.json())
      .then((json: { enabled?: boolean }) => {
        if (!cancelled) setAiEnabled(Boolean(json.enabled));
      })
      .catch(() => {
        if (!cancelled) setAiEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox]);

  const onPickLogo = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MOCKUP_MAX_FILE_BYTES) {
      setError("ไฟล์ใหญ่เกิน 8MB");
      return;
    }
    if (!isMockupImageFile(file)) {
      setError("รองรับเฉพาะ PNG JPG WEBP SVG");
      return;
    }
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    const url = URL.createObjectURL(file);
    setLogoObjectUrl(url);
    setLogoName(file.name);
    setVariants([]);
    setSelectedId(null);
    setConfirmed(false);
    setRetailAdjust(EMPTY_RETAIL_ADJUSTMENTS);
    setError(null);
  }, [logoObjectUrl]);

  const generate = useCallback(async () => {
    if (!logoObjectUrl && !text.trim()) {
      setError("แนบโลโก้หรือพิมพ์ข้อความอย่างน้อยอย่างใดอย่างหนึ่ง");
      return;
    }
    setBusy(true);
    setError(null);
    setConfirmed(false);
    setSelectedId(null);
    setEngine(null);
    setRetailAdjust(EMPTY_RETAIL_ADJUSTMENTS);
    try {
      let logoCanvas: HTMLCanvasElement | null = null;
      if (logoObjectUrl) {
        const logoImg = await loadImage(logoObjectUrl);
        logoCanvas = prepareLogoCanvas(logoImg, removeBg);
      }

      const aiResult = await tryGenerateWithOpenRouter({
        productName,
        surface,
        finish,
        logoCanvas,
        text,
        activityIndex,
      });

      if ("variants" in aiResult && aiResult.variants.length) {
        setVariants(aiResult.variants);
        setSelectedId(aiResult.variants[0]?.id ?? null);
        setEngine("openrouter");
        return;
      }

      const rendered = await renderVariantSet({
        surface,
        finish,
        logoCanvas,
        text,
        textColor,
        activityIndex,
      });
      setVariants(rendered);
      setSelectedId(rendered[0]?.id ?? null);
      setEngine("canvas");
      const aiError = "error" in aiResult ? aiResult.error : null;
      if (aiEnabled) {
        setError(
          aiError
            ? `AI ยังไม่สำเร็จ (${aiError}) — แสดงพรีวิวในเครื่องชั่วคราว`
            : "AI ไม่พร้อมชั่วคราว — ใช้โหมดพรีวิวในเครื่องแทน",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างภาพไม่สำเร็จ");
      setVariants([]);
    } finally {
      setBusy(false);
    }
  }, [
    activityIndex,
    aiEnabled,
    finish,
    logoObjectUrl,
    productName,
    removeBg,
    surface,
    text,
    textColor,
  ]);

  const applyRetail = useCallback(
    async (raw: string) => {
      const parsed = parseRetailCommand(raw, MOCKUP_FINISHES);
      if (!parsed.understood) {
        setError(
          "ยังไม่รู้จักคำสั่งนี้ ลอง เช่น สูงขึ้นไปอีกนิด หรือ เปลี่ยนสีเป็นดำด้าน",
        );
        return;
      }
      if (!logoObjectUrl && !text.trim()) {
        setError("แนบโลโก้หรือพิมพ์ข้อความก่อน แล้วค่อยปรับด้วยช่องรีเทล");
        return;
      }

      const nextFinishKey = parsed.cycleFinish
        ? nextFinishId(finish.id, MOCKUP_FINISHES)
        : parsed.finishId || finish.id;
      const nextFinish =
        MOCKUP_FINISHES.find((item) => item.id === nextFinishKey) ?? finish;
      const nextTextColor = parsed.textColor || textColor;
      const nextAdj = mergeRetailAdjustments(retailAdjust, {
        ...parsed,
        finishId: nextFinishKey,
      });

      setRetailAdjust(nextAdj);
      setFinishId(nextFinish.id);
      if (parsed.textColor) setTextColor(parsed.textColor);
      setRetailCommand("");
      setBusy(true);
      setError(null);
      setConfirmed(false);

      try {
        let logoCanvas: HTMLCanvasElement | null = null;
        if (logoObjectUrl) {
          const logoImg = await loadImage(logoObjectUrl);
          logoCanvas = prepareLogoCanvas(logoImg, removeBg);
        }

        const targetId = selectedId ?? "retail";
        const previous = variants.find((item) => item.id === targetId);

        const rendered = await renderVariantSet({
          surface,
          finish: nextFinish,
          logoCanvas,
          text,
          textColor: nextTextColor,
          activityIndex,
          printAdjust: nextAdj,
        });
        setVariants(rendered);
        setSelectedId(targetId);
        setEngine("canvas");

        if (aiEnabled && previous) {
          const aiResult = await tryGenerateWithOpenRouter({
            productName,
            surface,
            finish: nextFinish,
            logoCanvas,
            text,
            activityIndex,
            variantIds: [targetId],
            refineInstruction: parsed.summary,
            previousDataUrl: previous.dataUrl,
          });
          if ("variants" in aiResult && aiResult.variants[0]) {
            const polished = aiResult.variants[0];
            setVariants((current) =>
              current.map((item) =>
                item.id === polished.id ? polished : item,
              ),
            );
            setEngine("openrouter");
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "ปรับรูปไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
    },
    [
      activityIndex,
      aiEnabled,
      finish,
      logoObjectUrl,
      productName,
      removeBg,
      retailAdjust,
      selectedId,
      surface,
      text,
      textColor,
      variants,
    ],
  );

  const confirmSelection = useCallback(() => {
    if (!selected) {
      setError("เลือกแบบที่ต้องการก่อนยืนยัน");
      return;
    }
    const contexts = usageContextCopy(surface.kind);
    const materialFit =
      selected.id === "office"
        ? contexts.officeBody
        : selected.id === "lifestyle"
          ? contexts.lifestyleBody
          : selected.id === "retail"
            ? contexts.retailBody
            : materialHint(surface.kind);
    const brief = buildMockupBrief({
      productName,
      surfaceLabel: surface.label,
      colorLabel: finish.label,
      variantLabel: selected.label,
      hasLogo: Boolean(logoName),
      text,
      materialFit: [
        materialFit,
        describeRetailAdjustments(retailAdjust),
      ]
        .filter(Boolean)
        .join(" · "),
    });
    window.dispatchEvent(
      new CustomEvent(MOCKUP_BRIEF_EVENT, {
        detail: {
          text: brief,
          variantId: selected.id,
          variantLabel: selected.label,
        },
      }),
    );
    setConfirmed(true);
    document.getElementById("quote")?.scrollIntoView({ behavior: "smooth" });
  }, [finish.label, logoName, productName, retailAdjust, selected, surface.kind, surface.label, text]);

  return (
    <section
      className="rounded-3xl border border-forest/10 bg-paper p-5 sm:p-8"
      aria-labelledby="mockup-heading"
    >
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-brass">
          ออกแบบโลโก้บนสินค้า
        </p>
        <h2 id="mockup-heading" className="mt-2 text-2xl font-bold text-forest">
          ใส่โลโก้บนสินค้า แล้วได้ภาพ 4 มุมมองให้เลือก
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          1) บนสินค้าที่เลือก · 2) บริบทการใช้งานจริง · 3) วางในออฟฟิศ · 4) รีเทล
          — ปรับต่อด้วยคำสั่งในช่องรีเทล มีลายน้ำ {MOCKUP_WATERMARK_TEXT} (ยังไม่ใช่ไฟล์ผลิต)
          {aiEnabled
            ? " · สร้างภาพเนียนขึ้นจากระบบบนเว็บ"
            : " · โหมดพรีวิวในเครื่อง"}
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="space-y-5">
          <fieldset>
            <legend className="text-sm font-semibold text-forest">1. เลือกสินค้าแม่แบบ</legend>
            <div className="mt-2 grid grid-cols-3 gap-2 lg:grid-cols-1">
              {surfaces.map((item) => {
                const active = item.id === surface.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSurfaceId(item.id);
                      setVariants([]);
                      setSelectedId(null);
                      setConfirmed(false);
                      setRetailAdjust(EMPTY_RETAIL_ADJUSTMENTS);
                    }}
                    className={`overflow-hidden rounded-2xl border text-left ${
                      active ? "border-brass ring-2 ring-brass/40" : "border-forest/15"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.photo}
                      alt=""
                      className="aspect-[4/3] max-h-24 w-full object-cover lg:max-h-28"
                    />
                    <span
                      className={`block px-3 py-2 text-sm font-semibold ${
                        active ? "bg-forest text-paper" : "bg-paper text-forest"
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-forest">สีวัสดุ</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {MOCKUP_FINISHES.map((item) => {
                const active = item.id === finish.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => {
                      setFinishId(item.id);
                      setVariants([]);
                      setSelectedId(null);
                      setConfirmed(false);
                    }}
                    className={`h-10 w-10 rounded-full border-2 ${
                      active ? "border-brass" : "border-white shadow"
                    }`}
                    style={{ backgroundColor: item.body }}
                    aria-label={item.label}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink/60">{finish.label}</p>
          </fieldset>

          <div>
            <p className="text-sm font-semibold text-forest">2. โลโก้ลูกค้า</p>
            <label
              htmlFor={fileInputId}
              className="mt-2 flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-forest px-4 text-sm font-semibold text-paper"
            >
              {logoName ? "เปลี่ยนไฟล์โลโก้" : "อัปโหลดโลโก้"}
            </label>
            <input
              id={fileInputId}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="sr-only"
              onChange={onPickLogo}
            />
            {logoName ? (
              <p className="mt-2 truncate text-xs text-ink/65">{logoName}</p>
            ) : null}
            <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-forest">
              <input
                type="checkbox"
                checked={removeBg}
                onChange={(event) => {
                  setRemoveBg(event.target.checked);
                  setVariants([]);
                  setSelectedId(null);
                  setConfirmed(false);
                }}
              />
              ตัดพื้นหลังอัตโนมัติ (พื้นขาว/สีเดียว)
            </label>
          </div>

          <div>
            <label htmlFor={textInputId} className="text-sm font-semibold text-forest">
              หรือข้อความบนสินค้า
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id={textInputId}
                type="text"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setVariants([]);
                  setSelectedId(null);
                  setConfirmed(false);
                }}
                placeholder="เช่น ชื่อบริษัท"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-forest/20 bg-paper px-3 text-ink"
              />
              <input
                type="color"
                value={textColor}
                onChange={(event) => setTextColor(event.target.value)}
                aria-label="สีข้อความ"
                className="h-11 w-11 shrink-0 cursor-pointer rounded-xl border border-forest/20 bg-paper"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-brass px-5 text-sm font-semibold text-forest disabled:opacity-60"
          >
            {busy
              ? aiEnabled
                ? "กำลังสร้างภาพ…"
                : "กำลังสร้าง 4 แบบ…"
              : aiEnabled
                ? "สร้างรูป 4 มุมมอง"
                : "สร้างรูป 4 แบบ"}
          </button>
          {variants.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setActivityIndex((n) => n + 1);
                setConfirmed(false);
                void generate();
              }}
              disabled={busy}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-forest/20 px-5 text-sm font-semibold text-forest disabled:opacity-60"
            >
              สร้างมุมมองใหม่ (ฉาก / ตำแหน่งใช้งาน)
            </button>
          ) : null}
          {engine ? (
            <p className="text-xs text-ink/55">
              โหมดล่าสุด:{" "}
              {engine === "openrouter" ? "ภาพเนียนขึ้น" : "พรีวิวในเครื่อง"}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-semibold text-forest">3. เลือกแบบที่ต้องการยืนยัน</p>
          {variants.length === 0 ? (
            <div className="mt-3 flex min-h-[280px] items-center justify-center rounded-3xl border border-dashed border-forest/20 bg-forest-mist/40 px-6 text-center text-sm text-ink/65">
              กด “สร้างรูป 4 แบบ” เพื่อดูตัวอย่างโลโก้บน {surface.label}
            </div>
          ) : (
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {variants.map((item) => {
                const active = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <div
                      className={`overflow-hidden rounded-2xl border transition ${
                        active
                          ? "border-brass ring-2 ring-brass/50"
                          : "border-forest/15"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setLightbox(item)}
                        className="group relative block w-full"
                        aria-label={`ขยายภาพ ${item.label}`}
                        title="ขยายภาพ"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.dataUrl}
                          alt={item.label}
                          className="aspect-[4/5] max-h-64 w-full bg-forest-mist object-contain sm:max-h-72"
                        />
                        <span className="pointer-events-none absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-paper/95 text-forest shadow-md ring-1 ring-forest/15 transition group-hover:bg-brass group-hover:text-forest">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <circle cx="11" cy="11" r="6.5" />
                            <path d="M16.5 16.5 21 21" />
                          </svg>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(item.id);
                          setConfirmed(false);
                        }}
                        className="w-full bg-paper px-3 py-3 text-left"
                      >
                        <p className="text-sm font-semibold text-forest">{item.label}</p>
                        <p className="mt-1 text-xs text-ink/65">{item.summary}</p>
                        {active ? (
                          <p className="mt-2 text-xs font-semibold text-brass">เลือกแล้ว</p>
                        ) : (
                          <p className="mt-2 text-xs text-ink/50">กดเพื่อเลือกแบบนี้</p>
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {variants.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-forest/10 bg-forest-mist/40 p-4 sm:p-5">
              <label
                htmlFor={retailInputId}
                className="text-sm font-semibold text-forest"
              >
                {MOCKUP_RETAIL_HEADING}
              </label>
              <p className="mt-1 text-xs leading-relaxed text-ink/70">
                {MOCKUP_RETAIL_HINT}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {RETAIL_COMMAND_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={busy}
                    onClick={() => void applyRetail(chip)}
                    className="inline-flex min-h-9 items-center rounded-full border border-forest/20 bg-paper px-3 text-xs font-semibold text-forest disabled:opacity-60"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void applyRetail(retailCommand);
                }}
              >
                <input
                  id={retailInputId}
                  type="text"
                  value={retailCommand}
                  onChange={(event) => setRetailCommand(event.target.value)}
                  placeholder="เช่น สูงขึ้นไปอีกนิด"
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-forest/20 bg-paper px-3 text-ink"
                />
                <button
                  type="submit"
                  disabled={busy || !retailCommand.trim()}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-5 text-sm font-semibold text-paper disabled:opacity-50"
                >
                  ปรับรูป
                </button>
              </form>
              {describeRetailAdjustments(retailAdjust) ? (
                <p className="mt-2 text-xs text-ink/60">
                  ปรับแล้ว: {describeRetailAdjustments(retailAdjust)}
                </p>
              ) : (
                <p className="mt-2 text-xs text-ink/55">
                  ปรับกับแบบที่เลือกอยู่ — ถ้ายังไม่เลือก จะใช้ช่องรีเทล
                </p>
              )}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {selected ? (
              <button
                type="button"
                onClick={confirmSelection}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-5 text-sm font-semibold text-paper"
              >
                ยืนยันแบบนี้ไปใบเสนอราคา
              </button>
            ) : (
              <a
                href="#quote"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-5 text-sm font-semibold text-forest"
              >
                ยังไม่ต้องสร้างรูป — เลื่อนไปขอราคาได้
              </a>
            )}
            {confirmed && selected ? (
              <p className="self-center text-sm text-forest">
                ยืนยันแล้ว: {selected.label} — เลื่อนไปกรอกฟอร์มด้านล่างได้
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.label}
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl bg-paper p-3 shadow-2xl sm:p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3 px-1">
              <div>
                <p className="text-lg font-semibold text-forest">{lightbox.label}</p>
                <p className="text-sm text-ink/65">{lightbox.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-forest/20 text-sm font-semibold text-forest"
              >
                ปิด
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.dataUrl}
              alt={lightbox.label}
              className="mx-auto max-h-[75vh] w-auto max-w-full rounded-2xl object-contain"
            />
            <div className="mt-4 flex flex-wrap gap-3 px-1 pb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedId(lightbox.id);
                  setConfirmed(false);
                  setLightbox(null);
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-5 text-sm font-semibold text-forest"
              >
                เลือกแบบนี้
              </button>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-5 text-sm font-semibold text-forest"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
