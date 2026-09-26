#!/usr/bin/env node
/**
 * Download royalty-free Unsplash stock photos for local demo / try-fill content.
 * These are NOT licensed production brand assets — keep REAL_ASSETS_APPROVED=false.
 *
 * Usage: node scripts/fetch-stock-images.mjs
 */
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "public", "images");

/** @type {{ file: string; url: string; credit: string }[]} */
const IMAGES = [
  {
    file: "hero-giftset.jpg",
    url: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1600&q=80",
    credit: "Unsplash — gift box (photo-1549465220)",
  },
  {
    file: "category-eco.jpg",
    url: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — eco / nature (photo-1542601906990)",
  },
  {
    file: "category-team.jpg",
    url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — team collaboration (photo-1522071820081)",
  },
  {
    file: "category-tumbler.jpg",
    url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — water bottle (photo-1602143407151)",
  },
  {
    file: "category-it.jpg",
    url: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — tech desk (photo-1519389950473)",
  },
  {
    file: "product-tumbler.jpg",
    url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — tumbler / bottle (photo-1602143407151)",
  },
  {
    file: "product-tumbler-set.jpg",
    url: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=1400&q=85",
    credit: "Unsplash — notebook / stationery (photo-1531346878377)",
  },
  {
    file: "product-tumbler-set-2.jpg",
    url: "https://images.unsplash.com/photo-1585336261022-680e295ce3fe?auto=format&fit=crop&w=1400&q=85",
    credit: "Unsplash — ballpoint pen (photo-1585336261022)",
  },
  {
    file: "mockup-tumbler.jpg",
    url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1400&q=85",
    credit: "Unsplash — tumbler mockup base (photo-1602143407151)",
  },
  {
    file: "mockup-notebook.jpg",
    url: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=1400&q=85",
    credit: "Unsplash — notebook mockup base (photo-1531346878377)",
  },
  {
    file: "mockup-pen.jpg",
    url: "https://images.unsplash.com/photo-1585336261022-680e295ce3fe?auto=format&fit=crop&w=1400&q=85",
    credit: "Unsplash — pen mockup base (photo-1585336261022)",
  },
  {
    file: "product-eco.jpg",
    url: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — eco / leaves (photo-1542601906990)",
  },
  {
    file: "product-eco-set.jpg",
    url: "https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — plants / eco (photo-1610348725531)",
  },
  {
    file: "product-it.jpg",
    url: "https://images.unsplash.com/photo-1621768216002-5ac171876625?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — charging cable (photo-1621768216002)",
  },
  {
    file: "product-it-set.jpg",
    url: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — product still life (photo-1572635196237)",
  },
  {
    file: "product-placeholder.jpg",
    url: "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — wrapped gifts (photo-1513201099705)",
  },
  {
    file: "portfolio-welcome.jpg",
    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — office welcome (photo-1497366216548)",
  },
  {
    file: "portfolio-newyear.jpg",
    url: "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — gift boxes (photo-1513201099705)",
  },
  {
    file: "portfolio-esg.jpg",
    url: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — green / ESG (photo-1542601906990)",
  },
  {
    file: "article-guide.jpg",
    url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — planning desk (photo-1454165804606)",
  },
  {
    file: "article-cover.jpg",
    url: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — retail / brand (photo-1556742049)",
  },
  {
    file: "og-default.jpg",
    url: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1200&q=80",
    credit: "Unsplash — gift box OG (photo-1549465220)",
  },
];

mkdirSync(OUT, { recursive: true });

async function download(item) {
  const dest = join(OUT, item.file);
  if (existsSync(dest) && process.argv.includes("--force") === false) {
    const { size } = await import("node:fs").then((fs) => fs.statSync(dest));
    if (size > 10_000) {
      console.log(`skip  ${item.file}`);
      return;
    }
  }
  process.stdout.write(`get   ${item.file}… `);
  const res = await fetch(item.url, {
    headers: { "User-Agent": "premium-giftset-web-stock-fetch/1.0" },
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} for ${item.file}`);
  }
  await pipeline(res.body, createWriteStream(dest));
  console.log("ok");
}

const credits = [
  "# Stock image credits (demo only)",
  "",
  "Downloaded via `npm run images:stock` from Unsplash.",
  "Use only for local try-fill — replace with licensed brand assets before production.",
  "Do **not** set `REAL_ASSETS_APPROVED=true` while these files are in use.",
  "",
  ...IMAGES.map((i) => `- \`${i.file}\` — ${i.credit}`),
  "",
].join("\n");

writeFileSync(join(OUT, "STOCK-CREDITS.md"), credits);

for (const item of IMAGES) {
  await download(item);
}

console.log(`Done. ${IMAGES.length} files → ${OUT}`);
console.log("Credits: public/images/STOCK-CREDITS.md");
