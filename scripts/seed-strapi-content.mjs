#!/usr/bin/env node
/**
 * Seed complete demo catalog into local Strapi (categories, products, FAQs,
 * portfolios, articles) with media upload + publish.
 *
 *   node scripts/seed-strapi-content.mjs
 *
 * Reads CMS_ADMIN_EMAIL / CMS_ADMIN_PASSWORD from env or .env.cms.local
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASE = (process.env.STRAPI_URL || "http://127.0.0.1:1337").replace(/\/$/, "");
const IMAGES = join(ROOT, "public/images");

function loadCmsEnv() {
  const path = join(ROOT, ".env.cms.local");
  if (!existsSync(path)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const cmsEnv = loadCmsEnv();
const EMAIL = process.env.CMS_ADMIN_EMAIL || cmsEnv.CMS_ADMIN_EMAIL || "";
const PASSWORD = process.env.CMS_ADMIN_PASSWORD || cmsEnv.CMS_ADMIN_PASSWORD || "";

if (!EMAIL || !PASSWORD) {
  console.error("Missing CMS_ADMIN_EMAIL / CMS_ADMIN_PASSWORD");
  process.exit(1);
}

function seo(metaTitle, metaDescription, canonicalURL) {
  let meta = metaDescription.trim();
  while (meta.length < 120) meta += " สำหรับองค์กร";
  if (meta.length > 160) meta = meta.slice(0, 160);
  if (metaTitle.length > 60) {
    throw new Error(`SEO title too long: ${metaTitle}`);
  }
  return {
    metaTitle,
    metaDescription: meta,
    canonicalURL,
    metaRobots: "index, follow",
  };
}

/** Extra catalog beyond lib/data.ts so every category has products. */
const CATEGORIES = [
  {
    name: "Gift Set เพื่อสิ่งแวดล้อม",
    slug: "eco-giftset",
    description:
      "ชุดของขวัญองค์กรจากวัสดุรีไซเคิลและวัสดุธรรมชาติ เช่น สมุดรีไซเคิล หลอดไม้ไผ่ และถุงผ้า เหมาะกับงาน ESG และแคมเปญรักษ์โลก",
    hero: "category-eco.jpg",
    seo: seo(
      "Gift Set เพื่อสิ่งแวดล้อม",
      "สั่งผลิต Gift Set รักษ์โลกจากวัสดุรีไซเคิล วัสดุธรรมชาติ สมุดรีไซเคิล หลอดไม้ไผ่ และถุงผ้า สำหรับองค์กรที่เน้น ESG อย่างยั่งยืน",
      "/giftset/eco-giftset",
    ),
  },
  {
    name: "ชุดของขวัญทริปบริษัท ทีมบิลดิ้ง",
    slug: "team-building-set",
    description:
      "เซ็ตของที่ระลึกสำหรับทริปบริษัทและงานทีมบิลดิ้ง ประกอบด้วยเสื้อ หมวก กระเป๋า กระบอกน้ำ และของใช้ตามธีมงาน",
    hero: "category-team.jpg",
    seo: seo(
      "Gift Set ทริปบริษัท ทีมบิลดิ้ง",
      "ออกแบบชุดของขวัญทริปบริษัทและทีมบิลดิ้ง สกรีนโลโก้ เสื้อ หมวก กระเป๋า กระบอกน้ำ ตามธีมงานองค์กรของคุณได้ตามงบประมาณที่ตั้งไว้",
      "/giftset/team-building-set",
    ),
  },
  {
    name: "ชุดแก้วสแตนเลสเก็บอุณหภูมิ",
    slug: "tumbler-set",
    description:
      "เซ็ตกระบอกน้ำหรือแก้วสแตนเลสคู่กับสมุด ปากกา และกล่องจั่วปัง เหมาะเป็นของขวัญองค์กรที่ใช้ได้จริงทุกวัน",
    hero: "category-tumbler.jpg",
    seo: seo(
      "ชุดแก้วสแตนเลสเก็บอุณหภูมิ",
      "รับผลิตชุดแก้วสแตนเลสเก็บอุณหภูมิ พร้อมสมุด ปากกา และกล่องจั่วปัง สกรีนโลโก้องค์กร ขั้นต่ำเริ่มต้นได้ตามที่ต้องการ",
      "/giftset/tumbler-set",
    ),
  },
  {
    name: "Gift Set อุปกรณ์ไอที",
    slug: "it-set",
    description:
      "ชุดของขวัญองค์กรด้านเทคโนโลยี เช่น Powerbank สายชาร์จ และอุปกรณ์พกพา สำหรับพนักงานใหม่หรือคู่ค้า",
    hero: "category-it.jpg",
    seo: seo(
      "Gift Set อุปกรณ์ไอที",
      "สั่งทำ Gift Set อุปกรณ์ไอที Powerbank สายชาร์จ และแกเจ็ตพกพา พร้อมสกรีนโลโก้สำหรับองค์กรและงานอีเวนต์อย่างมืออาชีพ",
      "/giftset/it-set",
    ),
  },
];

const PRODUCTS = [
  {
    name: "เซ็ตกระบอกน้ำสแตนเลส + สมุด + ปากกา",
    slug: "tumbler-notebook-pen-set",
    description:
      "<p>ชุดของขวัญองค์กรประกอบด้วยกระบอกน้ำสแตนเลสเก็บอุณหภูมิ สมุดโน้ต และปากกา ในกล่องจั่วปังพรีเมียม พร้อมสกรีนหรือพิมพ์โลโก้ตามแบรนด์</p>",
    material: "สแตนเลส 304 / หนัง PU / กระดาษจั่วปัง",
    minOrder: 30,
    priceRange: "350–590 บาท/ชุด",
    priceMin: 350,
    priceMax: 590,
    images: [
      "product-tumbler.jpg",
      "product-tumbler-set.jpg",
      "product-tumbler-set-2.jpg",
    ],
    categorySlug: "tumbler-set",
    enableCustomDesign: true,
    customDesignPreset: "tumbler_set",
    seo: seo(
      "เซ็ตกระบอกน้ำ สมุด ปากกา",
      "เซ็ตกระบอกน้ำสแตนเลสพร้อมสมุดและปากกา สกรีนโลโก้องค์กร ขั้นต่ำ 30 ชุด ราคาโดยประมาณ 350–590 บาท ขอใบเสนอราคาได้ฟรีทันที",
      "/products/tumbler-notebook-pen-set",
    ),
  },
  {
    name: "เซ็ตรักษ์โลก ถุงผ้า + หลอดไม้ไผ่ + สมุดรีไซเคิล",
    slug: "eco-tote-bamboo-set",
    description:
      "<p>Gift Set เพื่อสิ่งแวดล้อม ประกอบถุงผ้าดิบ หลอดไม้ไผ่ และสมุดกระดาษรีไซเคิล เหมาะกับแคมเปญ ESG และของแจกงานองค์กร</p>",
    material: "ผ้าดิบ / ไม้ไผ่ / กระดาษรีไซเคิล",
    minOrder: 50,
    priceRange: "180–320 บาท/ชุด",
    priceMin: 180,
    priceMax: 320,
    images: ["product-eco.jpg", "product-eco-set.jpg"],
    categorySlug: "eco-giftset",
    seo: seo(
      "เซ็ตรักษ์โลก ถุงผ้า หลอดไม้ไผ่",
      "เซ็ตของขวัญรักษ์โลก ถุงผ้า หลอดไม้ไผ่ สมุดรีไซเคิล สั่งผลิตขั้นต่ำ 50 ชุด ราคาโดยประมาณ 180–320 บาท ขอใบเสนอราคาฟรี",
      "/products/eco-tote-bamboo-set",
    ),
  },
  {
    name: "เซ็ตไอที Powerbank + สายชาร์จ 3-in-1",
    slug: "it-powerbank-set",
    description:
      "<p>ชุดของขวัญไอทีสำหรับองค์กร ประกอบ Powerbank และสายชาร์จ 3-in-1 ในบรรจุภัณฑ์พรีเมียม พร้อมเลเซอร์หรือสกรีนโลโก้</p>",
    material: "ABS / อะลูมิเนียม",
    minOrder: 50,
    priceRange: "420–690 บาท/ชุด",
    priceMin: 420,
    priceMax: 690,
    images: ["product-it.jpg", "product-it-set.jpg"],
    categorySlug: "it-set",
    seo: seo(
      "เซ็ตไอที Powerbank สายชาร์จ",
      "เซ็ตของขวัญไอที Powerbank พร้อมสายชาร์จ 3-in-1 สกรีนโลโก้ ขั้นต่ำ 50 ชุด ราคาโดยประมาณ 420–690 บาท ขอใบเสนอราคาได้ฟรี",
      "/products/it-powerbank-set",
    ),
  },
  {
    name: "เซ็ตทีมบิลดิ้ง เสื้อ + หมวก + กระบอกน้ำ",
    slug: "team-tee-cap-bottle-set",
    description:
      "<p>ชุดของที่ระลึกทริปบริษัทและทีมบิลดิ้ง ประกอบเสื้อคอกลม หมวก และกระบอกน้ำ พร้อมสกรีนโลโก้และธีมงานตามที่ออกแบบ</p>",
    material: "ผ้าคอตตอน / โพลีเอสเตอร์ / พลาสติก Tritan",
    minOrder: 50,
    priceRange: "280–480 บาท/ชุด",
    priceMin: 280,
    priceMax: 480,
    images: ["product-placeholder.jpg", "hero-giftset.jpg"],
    categorySlug: "team-building-set",
    seo: seo(
      "เซ็ตทีมบิลดิ้ง เสื้อ หมวก",
      "เซ็ตของขวัญทริปบริษัท เสื้อ หมวก กระบอกน้ำ สกรีนโลโก้ ขั้นต่ำ 50 ชุด ราคาโดยประมาณ 280–480 บาท ขอใบเสนอราคาได้ฟรีทันที",
      "/products/team-tee-cap-bottle-set",
    ),
  },
  {
    name: "เซ็ต Welcome Kit สำนักงาน",
    slug: "office-welcome-kit-set",
    description:
      "<p>Welcome Kit สำหรับพนักงานใหม่ ประกอบสมุด ปากกา กระบอกน้ำ และซองเอกสาร ในกล่องพรีเมียมพร้อมโลโก้องค์กร</p>",
    material: "กระดาษจั่วปัง / สแตนเลส / ผ้า",
    minOrder: 30,
    priceRange: "390–650 บาท/ชุด",
    priceMin: 390,
    priceMax: 650,
    images: ["product-tumbler-set-2.jpg", "product-placeholder.jpg"],
    categorySlug: "tumbler-set",
    seo: seo(
      "Welcome Kit สำนักงานองค์กร",
      "Welcome Kit พนักงานใหม่ สมุด ปากกา กระบอกน้ำ กล่องพรีเมียม สกรีนโลโก้ ขั้นต่ำ 30 ชุด ราคาโดยประมาณ 390–650 บาท",
      "/products/office-welcome-kit-set",
    ),
  },
];

const FAQS = [
  {
    question: "สั่งผลิต Gift Set ขั้นต่ำกี่ชุด",
    answer:
      "ขั้นต่ำขึ้นกับประเภทสินค้า โดยทั่วไปเริ่มต้นประมาณ 30–50 ชุด สามารถแจ้งจำนวนที่ต้องการในแบบฟอร์มขอใบเสนอราคาเพื่อให้ทีมขายประเมินให้ตรงงบประมาณ",
    order: 1,
  },
  {
    question: "ใช้เวลาผลิตนานเท่าไหร่",
    answer:
      "ระยะเวลาผลิตโดยประมาณ 7–21 วันทำการ หลังยืนยันแบบและมัดจำ ขึ้นกับจำนวน เทคนิคตกแต่ง และช่วงเทศกาล แนะนำให้เผื่อเวลาจัดส่งล่วงหน้า",
    order: 2,
  },
  {
    question: "ขอดูตัวอย่างสินค้าก่อนสั่งได้ไหม",
    answer:
      "ได้ โดยสามารถขอตัวอย่างหรือ Mockup ตามรายการที่สนใจ ทีมงานจะแนะนำตัวเลือกวัสดุ เทคนิคสกรีน และบรรจุภัณฑ์ให้เหมาะสมกับงบและภาพลักษณ์แบรนด์",
    order: 3,
  },
  {
    question: "ออกใบกำกับภาษีได้หรือไม่",
    answer:
      "ออกใบกำกับภาษีได้ตามข้อมูลนิติบุคคลที่แจ้งไว้ กรุณาระบุรายละเอียดบริษัทในแบบฟอร์มหรือแจ้งฝ่ายขายเมื่อยืนยันออเดอร์",
    order: 4,
  },
  {
    question: "มีค่าขนส่งหรือไม่",
    answer:
      "ค่าขนส่งคิดตามจุดส่ง น้ำหนัก และจำนวนกล่อง ทีมขายจะระบุในใบเสนอราคาหลังทราบที่อยู่จัดส่งและจำนวนที่แน่นอน",
    order: 5,
  },
  {
    question: "สามารถออกแบบกล่องตามแบรนด์ได้ไหม",
    answer:
      "ได้ ทั้งสีพิมพ์ วัสดุบุภายใน และข้อความบนกล่อง แนะนำส่งไฟล์โลโก้ความละเอียดสูง (AI/PDF/PNG) พร้อมคู่มือแบรนด์ถ้ามี",
    order: 6,
  },
];

const PORTFOLIOS = [
  {
    title: "Welcome Kit พนักงานใหม่",
    slug: "employee-welcome-kit",
    client: "บริษัทตัวอย่าง A",
    industry: "เทคโนโลยี",
    summary:
      "ออกแบบและผลิต Welcome Kit สำหรับพนักงานใหม่ ประกอบสมุด กระบอกน้ำ และของใช้สำนักงานในกล่องจั่วปังพร้อมโลโก้บริษัท",
    image: "portfolio-welcome.jpg",
    services: ["ออกแบบเซ็ต", "สกรีนโลโก้", "แพ็กแยกรายบุคคล"],
    quantity: 500,
    completedAt: "2025-11-15",
    featured: true,
  },
  {
    title: "ของขวัญปีใหม่สำหรับคู่ค้า",
    slug: "new-year-partner-gift",
    client: "บริษัทตัวอย่าง B",
    industry: "การเงิน",
    summary:
      "เซ็ตของขวัญปีใหม่สำหรับคู่ค้าองค์กร เน้นภาพลักษณ์พรีเมียม บรรจุภัณฑ์แข็งแรง และข้อความแบรนด์สุภาพ",
    image: "portfolio-newyear.jpg",
    services: ["คัดสรรวัสดุ", "พิมพ์ UV", "จัดส่งตามจุด"],
    quantity: 1200,
    completedAt: "2025-12-20",
    featured: true,
  },
  {
    title: "ESG Event Kit",
    slug: "esg-event-kit",
    client: "องค์กรตัวอย่าง C",
    industry: "พลังงาน",
    summary:
      "ชุดของแจกงาน ESG จากวัสดุรักษ์โลก ถุงผ้า หลอดไม้ไผ่ และสมุดรีไซเคิล พร้อมข้อความแคมเปญองค์กร",
    image: "portfolio-esg.jpg",
    services: ["เซ็ตรักษ์โลก", "สกรีนโลโก้", "แพ็กงานอีเวนต์"],
    quantity: 800,
    completedAt: "2026-03-01",
    featured: false,
  },
];

const ARTICLES = [
  {
    title: "คู่มือเลือกสินค้าพรีเมียมให้องค์กร",
    slug: "premium-products-guide",
    excerpt:
      "หลักการเลือก Gift Set และสินค้าพรีเมียมให้เหมาะกับภาพลักษณ์องค์กร งบประมาณ และกลุ่มผู้รับ",
    body: `<h2>ทำไมองค์กรต้องเลือก Gift Set อย่างมีหลักการ</h2>
<p>ของขวัญองค์กรไม่ใช่เพียงของแจก แต่สะท้อนภาพลักษณ์แบรนด์ ความใส่ใจต่อพนักงาน และความสัมพันธ์กับคู่ค้า</p>
<h3>กำหนดวัตถุประสงค์ให้ชัด</h3>
<p>เริ่มจากคำถามว่าของชุดนี้ใช้ต้อนรับพนักงานใหม่ มอบคู่ค้าปีใหม่ หรือแจกในงานสัมมนา เพื่อเลือกวัสดุและบรรจุภัณฑ์ให้เหมาะ</p>
<blockquote>เลือกของที่ใช้ได้จริง ดูแลรักษาง่าย และสอดคล้องกับค่านิยมองค์กร</blockquote>
<ul><li>กำหนดงบต่อชุดและจำนวนขั้นต่ำ</li><li>เลือกรูปแบบการตกแต่งโลโก้ที่เหมาะสม</li><li>เผื่อเวลาผลิตและจัดส่งล่วงหน้า</li></ul>
<h3>สรุป</h3>
<p>เมื่อมีวัตถุประสงค์ งบ และกำหนดส่งชัดเจน การขอใบเสนอราคาจะรวดเร็วและตรงความต้องการมากขึ้น</p>`,
    cover: "article-guide.jpg",
    author: "ทีมงาน Smart Gift",
    seo: seo(
      "คู่มือเลือกสินค้าพรีเมียมองค์กร",
      "หลักการเลือก Gift Set และสินค้าพรีเมียมให้องค์กร ครอบคลุมงบประมาณ วัสดุ การสกรีนโลโก้ และระยะเวลาผลิต เพื่อผลลัพธ์ที่เหมาะสม",
      "/blog/premium-products-guide",
    ),
  },
  {
    title: "วางแผนของขวัญปีใหม่สำหรับองค์กร",
    slug: "corporate-new-year-gift-plan",
    excerpt:
      "ไทม์ไลน์ งบประมาณ และเช็คลิสต์สำหรับเตรียมของขวัญปีใหม่ให้คู่ค้าและพนักงานอย่างมืออาชีพ",
    body: `<h2>เริ่มก่อนเทศกาลอย่างน้อย 6–8 สัปดาห์</h2>
<p>ช่วงปลายปีโรงงานและขนส่งมักหนาแน่น การล็อกสเปคและจำนวนเร็วช่วยลดความเสี่ยงเลื่อนส่ง</p>
<h3>เช็คลิสต์สั้น ๆ</h3>
<ul><li>รายชื่อผู้รับและที่อยู่จัดส่ง</li><li>งบต่อชุดรวมค่าแพ็กและขนส่ง</li><li>ไฟล์โลโก้และข้อความอวยพร</li></ul>
<p>ส่งโจทย์ผ่านแบบฟอร์มขอใบเสนอราคาได้ทันที ทีมขายจะช่วยคัดเซ็ตให้ตรงงบ</p>`,
    cover: "article-cover.jpg",
    author: "ทีมงาน Smart Gift",
    seo: seo(
      "วางแผนของขวัญปีใหม่องค์กร",
      "คู่มือวางแผนของขวัญปีใหม่สำหรับองค์กร ไทม์ไลน์ งบประมาณ และเช็คลิสต์ เพื่อสั่งผลิต Gift Set ได้ทันเทศกาลอย่างมืออาชีพ",
      "/blog/corporate-new-year-gift-plan",
    ),
  },
];

async function adminLogin() {
  const r = await fetch(`${BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`login failed: ${JSON.stringify(j)}`);
  return j.data.token || j.data.accessToken;
}

async function ensureFullToken(adminToken) {
  const name = `seed-full-${Date.now()}`;
  const r = await fetch(`${BASE}/admin/api-tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description: "Temporary full-access for content seed",
      type: "full-access",
      lifespan: null,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`api token: ${JSON.stringify(j)}`);
  return j.data.accessKey;
}

/** @param {string} token */
async function uploadFile(token, filename) {
  const abs = join(IMAGES, filename);
  if (!existsSync(abs)) throw new Error(`missing image ${abs}`);
  const buf = readFileSync(abs);
  const form = new FormData();
  form.append(
    "files",
    new Blob([buf], { type: "image/svg+xml" }),
    basename(filename),
  );
  const r = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`upload ${filename}: ${JSON.stringify(j)}`);
  const file = Array.isArray(j) ? j[0] : j;
  return file.id;
}

/** @param {string} token @param {string} path @param {Record<string, unknown>} data */
async function createPublished(token, path, data) {
  const r = await fetch(`${BASE}/api/${path}?status=published`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`create ${path}: ${JSON.stringify(j)}`);
  return j.data;
}

/** @param {string} token @param {string} path */
async function listAll(token, path) {
  const q = new URLSearchParams({
    "pagination[pageSize]": "100",
    status: "published",
  });
  const r = await fetch(`${BASE}/api/${path}?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`list ${path}: ${JSON.stringify(j)}`);
  return Array.isArray(j.data) ? j.data : [];
}

/** @param {string} token @param {string} path @param {string} documentId */
async function publishDoc(token, path, documentId) {
  const r = await fetch(`${BASE}/api/${path}/${documentId}/actions/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!r.ok) {
    const t = await r.text();
    // already published is fine
    if (!/already|published/i.test(t)) {
      console.warn(`publish warn ${path}/${documentId}: ${t.slice(0, 180)}`);
    }
  }
}

async function upsertBySlug(token, path, slugField, slug, data) {
  const existing = await listAll(token, path);
  const found = existing.find((row) => {
    const attrs = row.attributes || row;
    return attrs[slugField] === slug;
  });
  if (found) {
    const documentId = found.documentId || found.id;
    const r = await fetch(`${BASE}/api/${path}/${documentId}?status=published`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`update ${path}/${slug}: ${JSON.stringify(j)}`);
    await publishDoc(token, path, documentId);
    return j.data;
  }
  const created = await createPublished(token, path, data);
  const documentId = created.documentId || created.id;
  await publishDoc(token, path, documentId);
  return created;
}

async function main() {
  console.log(`seed-strapi-content → ${BASE}`);
  const adminToken = await adminLogin();
  const token = await ensureFullToken(adminToken);

  /** @type {Record<string, number>} */
  const media = {};
  const needed = new Set([
    ...CATEGORIES.map((c) => c.hero),
    ...PRODUCTS.flatMap((p) => p.images),
    ...PORTFOLIOS.map((p) => p.image),
    ...ARTICLES.map((a) => a.cover),
  ]);
  for (const file of needed) {
    process.stdout.write(`  upload ${file}… `);
    media[file] = await uploadFile(token, file);
    console.log(`id=${media[file]}`);
  }

  /** @type {Record<string, string>} */
  const categoryIds = {};
  for (const cat of CATEGORIES) {
    const data = {
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      heroImage: media[cat.hero],
      seo: {
        ...cat.seo,
        metaImage: media[cat.hero],
        openGraph: {
          ogTitle: cat.seo.metaTitle,
          ogDescription: cat.seo.metaDescription.slice(0, 200),
          ogImage: media[cat.hero],
          ogType: "website",
        },
      },
    };
    const row = await upsertBySlug(token, "gift-set-categories", "slug", cat.slug, data);
    categoryIds[cat.slug] = row.documentId || String(row.id);
    console.log(`  category ${cat.slug} → ${categoryIds[cat.slug]}`);
  }

  for (const product of PRODUCTS) {
    const data = {
      name: product.name,
      slug: product.slug,
      description: product.description,
      material: product.material,
      minOrder: product.minOrder,
      priceRange: product.priceRange,
      priceMin: product.priceMin,
      priceMax: product.priceMax,
      currency: "THB",
      images: product.images.map((f) => media[f]),
      category: categoryIds[product.categorySlug],
      enableCustomDesign: Boolean(product.enableCustomDesign),
      customDesignPreset: product.customDesignPreset || "product_photo",
      seo: {
        ...product.seo,
        metaImage: media[product.images[0]],
        openGraph: {
          ogTitle: product.seo.metaTitle,
          ogDescription: product.seo.metaDescription.slice(0, 200),
          ogImage: media[product.images[0]],
          ogType: "website",
        },
      },
    };
    const row = await upsertBySlug(token, "products", "slug", product.slug, data);
    console.log(`  product ${product.slug} → ${row.documentId || row.id}`);
  }

  // FAQs have no slug — clear + recreate for idempotent seed
  const existingFaqs = await listAll(token, "faqs");
  for (const faq of existingFaqs) {
    const id = faq.documentId || faq.id;
    await fetch(`${BASE}/api/faqs/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  for (const faq of FAQS) {
    const row = await createPublished(token, "faqs", faq);
    await publishDoc(token, "faqs", row.documentId || row.id);
    console.log(`  faq ${faq.order}: ${faq.question.slice(0, 40)}`);
  }

  for (const item of PORTFOLIOS) {
    const data = {
      title: item.title,
      slug: item.slug,
      client: item.client,
      industry: item.industry,
      summary: item.summary,
      image: media[item.image],
      services: item.services,
      quantity: item.quantity,
      completedAt: item.completedAt,
      featured: item.featured,
    };
    const row = await upsertBySlug(token, "portfolios", "slug", item.slug, data);
    console.log(`  portfolio ${item.slug} → ${row.documentId || row.id}`);
  }

  for (const article of ARTICLES) {
    const data = {
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      body: article.body,
      cover: media[article.cover],
      author: article.author,
      seo: {
        ...article.seo,
        metaImage: media[article.cover],
        openGraph: {
          ogTitle: article.seo.metaTitle,
          ogDescription: article.seo.metaDescription.slice(0, 200),
          ogImage: media[article.cover],
          ogType: "article",
        },
      },
    };
    const row = await upsertBySlug(token, "articles", "slug", article.slug, data);
    console.log(`  article ${article.slug} → ${row.documentId || row.id}`);
  }

  const counts = {};
  for (const path of [
    "gift-set-categories",
    "products",
    "faqs",
    "portfolios",
    "articles",
  ]) {
    counts[path] = (await listAll(token, path)).length;
  }
  console.log("\nPublished counts:", counts);
  console.log("Done. Refresh http://localhost:3000 (CMS_MODE=strapi).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
