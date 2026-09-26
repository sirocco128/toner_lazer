#!/usr/bin/env node
/**
 * Seed four factual article drafts (travel / it / ai / earth) into sg_article.
 * Status is always draft. Skips rows that already exist with status != draft.
 *
 * Usage: node scripts/load-env.mjs node scripts/seed-factual-article-drafts.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

/** @type {import('mysql2').ConnectionOptions} */
const dbConfig = {
  host: process.env.SMARTGIFT_MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.SMARTGIFT_MYSQL_PORT || 3307),
  user: process.env.SMARTGIFT_MYSQL_USER || "biz",
  password: process.env.SMARTGIFT_MYSQL_PASSWORD || "biz_secret",
  database: process.env.SMARTGIFT_MYSQL_DATABASE || "smartgift",
  charset: "utf8mb4",
};

const ARTICLES = [
  {
    slug: "khao-yai-unesco-world-heritage",
    title: "เขาใหญ่ในฐานะมรดกโลก: สิ่งที่นักท่องเที่ยวควรรู้",
    excerpt:
      "อุทยานแห่งชาติเขาใหญ่เป็นส่วนหนึ่งของดงพญาเย็น–เขาใหญ่ ซึ่งยูเนสโกขึ้นทะเบียนเป็นมรดกโลกทางธรรมชาติ",
    cover_url: "/images/articles/travel-khao-yai.jpg",
    seo_title: "เขาใหญ่มรดกโลกยูเนสโก รู้ก่อนไป",
    meta_description:
      "สรุปข้อเท็จจริงเรื่องดงพญาเย็น–เขาใหญ่ มรดกโลกทางธรรมชาติของยูเนสโก พร้อมแหล่งอ้างอิงและเครดิตรูปจริง",
    keywords: "เขาใหญ่, มรดกโลก, ท่องเที่ยวธรรมชาติ, UNESCO",
    brief: "[travel] seed factual draft — Khao Yai UNESCO",
    body: `<h2>ดงพญาเย็น–เขาใหญ่คืออะไร</h2>
<p>ดงพญาเย็น–เขาใหญ่ (Dong Phayayen–Khao Yai Forest Complex) เป็นกลุ่มพื้นที่อนุรักษ์ในภาคตะวันออกของไทย ที่องค์การยูเนสโก (UNESCO) ขึ้นทะเบียนเป็นมรดกโลกทางธรรมชาติ ครอบคลุมอุทยานแห่งชาติหลายแห่ง รวมถึงเขาใหญ่</p>
<h3>ทำไมถึงสำคัญต่อการท่องเที่ยว</h3>
<p>พื้นที่นี้เป็นผืนป่าต่อเนื่องขนาดใหญ่ในภูมิภาค มีระบบนิเวศป่าชื้นและสัตว์ป่าที่นักท่องเที่ยวจำนวนมากเดินทางมาชม เช่น เส้นทางเดินป่า จุดชมวิว และแหล่งศึกษาธรรมชาติ โดยยังอยู่ในกรอบการจัดการของหน่วยงานอุทยานแห่งชาติ</p>
<blockquote>การท่องเที่ยวในพื้นที่มรดกโลกควรเคารพกฎอุทยานและไม่รบกวนสัตว์ป่า</blockquote>
<li>ตรวจสอบกฎและเส้นทางเปิดใช้จากหน่วยงานอุทยานก่อนเดินทาง</li>
<li>ไม่ให้อาหารสัตว์ป่า และไม่ทิ้งขยะในพื้นที่</li>
<li>อ่านข้อมูลมรดกโลกจากยูเนสโกเพื่อเข้าใจคุณค่าของพื้นที่</li>
<h2>แหล่งอ้างอิง</h2>
<li>UNESCO World Heritage Centre — Dong Phayayen-Khao Yai Forest Complex https://whc.unesco.org/en/list/590/</li>
<li>กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช — ข้อมูลอุทยานแห่งชาติเขาใหญ่</li>
<li>รูปปก: Wild Asian elephants at Khao Yai NP — Mammalwatcher (CC0)</li>
<li>หน้าไฟล์ภาพ: https://commons.wikimedia.org/wiki/File:Wild_Asian_elephants_at_Khao_Yai_NP.JPG</li>
<li>ใบอนุญาต: CC0</li>`,
  },
  {
    slug: "what-is-https-tls",
    title: "HTTPS คืออะไร และทำไมเว็บสมัยใหม่ต้องเข้ารหัส",
    excerpt:
      "HTTPS ใช้ TLS เข้ารหัสการสื่อสารระหว่างเบราว์เซอร์กับเซิร์ฟเวอร์ ลดการดักฟังและปลอมแปลงข้อมูลระหว่างทาง",
    cover_url: "/images/articles/it-https-servers.jpg",
    seo_title: "HTTPS และ TLS คืออะไร",
    meta_description:
      "อธิบาย HTTPS และ TLS จากเอกสารมาตรฐานที่อ้างอิงได้ พร้อมลิงก์ MDN และ IETF RFC 8446",
    keywords: "HTTPS, TLS, ความปลอดภัยเว็บ, การเข้ารหัส",
    brief: "[it] seed factual draft — HTTPS/TLS",
    body: `<h2>HTTPS ทำงานอย่างไรโดยสรุป</h2>
<p>HTTPS คือการส่งข้อมูลเว็บผ่าน HTTP ที่ห่อด้วยชั้นความปลอดภัย TLS ทำให้ข้อมูลระหว่างเบราว์เซอร์กับเซิร์ฟเวอร์ถูกเข้ารหัสและตรวจสอบความถูกต้องของเซิร์ฟเวอร์ผ่านใบรับรองดิจิทัล</p>
<h3>TLS 1.3 ในเอกสารมาตรฐาน</h3>
<p>โปรโตคอล TLS รุ่น 1.3 ถูกกำหนดใน IETF RFC 8446 ซึ่งปรับปรุงการจับมือเข้ารหัสให้กระชับขึ้น และตัดอัลกอริทึมเก่าที่ไม่ปลอดภัยออกจากชุดที่แนะนำ</p>
<blockquote>กุญแจรูปแม่กุญในแถบที่อยู่ของเบราว์เซอร์สมัยใหม่มักหมายถึงการเชื่อมต่อที่เข้ารหัสด้วย HTTPS</blockquote>
<li>ใช้เว็บที่ขึ้นต้นด้วย https:// เมื่อกรอกรหัสผ่านหรือข้อมูลส่วนตัว</li>
<li>ใบรับรองที่หมดอายุหรือไม่ตรงโดเมนเป็นสัญญาณเตือนที่ควรหยุดใช้งาน</li>
<li>อ่านคำอธิบาย HTTPS จาก MDN เพื่อเข้าใจศัพท์เทคนิคเพิ่มเติม</li>
<h2>แหล่งอ้างอิง</h2>
<li>MDN Web Docs — HTTPS https://developer.mozilla.org/en-US/docs/Glossary/HTTPS</li>
<li>IETF — RFC 8446 The Transport Layer Security (TLS) Protocol Version 1.3 https://www.rfc-editor.org/rfc/rfc8446</li>
<li>รูปปก: Servers in a Rack — Abigor (CC BY-SA 3.0)</li>
<li>หน้าไฟล์ภาพ: https://commons.wikimedia.org/wiki/File:Servers_in_a_Rack.jpg</li>
<li>ใบอนุญาต: CC BY-SA 3.0</li>`,
  },
  {
    slug: "oecd-ai-principles-overview",
    title: "หลักการ AI ของ OECD ที่องค์กรอ้างอิงได้",
    excerpt:
      "OECD AI Principles เป็นแนวทางระหว่างประเทศเรื่อง AI ที่น่าเชื่อถือ ครอบคลุมสิทธิมนุษยชน ความโปร่งใส และความรับผิดชอบ",
    cover_url: "/images/articles/ai-neural.jpg",
    seo_title: "OECD AI Principles สรุปสั้น",
    meta_description:
      "สรุปหลักการปัญญาประดิษฐ์ของ OECD ที่หน่วยงานและองค์กรใช้อ้างอิง พร้อมลิงก์ต้นทาง",
    keywords: "OECD AI, จริยธรรมเอไอ, AI principles",
    brief: "[ai] seed factual draft — OECD AI Principles",
    body: `<h2>OECD AI Principles คืออะไร</h2>
<p>องค์การเพื่อความร่วมมือทางเศรษฐกิจและการพัฒนา (OECD) เผยแพร่ข้อเสนอแนะเรื่องปัญญาประดิษฐ์ ซึ่งมักเรียกว่า OECD AI Principles เพื่อเป็นกรอบร่วมสำหรับ AI ที่น่าเชื่อถือและเคารพสิทธิมนุษยชน</p>
<h3>ประเด็นหลักที่มักถูกอ้างถึง</h3>
<p>หลักการครอบคลุมการส่งเสริมการเติบโตที่ครอบคลุม คุณค่าที่มนุษย์เป็นศูนย์กลาง ความโปร่งใสและความรับผิดชอบ การจัดการความเสี่ยงด้านความปลอดภัย รวมถึงความร่วมมือระหว่างประเทศในการกำกับดูแล AI</p>
<blockquote>เอกสารของ OECD เป็นแนวทางนโยบาย ไม่ใช่กฎหมายในตัวเอง แต่หลายประเทศและองค์กรใช้อ้างอิงเมื่อออกแบบนโยบาย AI</blockquote>
<li>อ่านต้นฉบับบนเว็บ OECD AI Principles ก่อนสรุปต่อสาธารณะ</li>
<li>แยกแยะระหว่างหลักการนโยบายกับกฎระเบียบบังคับใช้ในแต่ละประเทศ</li>
<li>อัปเดตข้อมูลจากหน้าอย่างเป็นทางการ เพราะเอกสารอาจมีการทบทวน</li>
<h2>แหล่งอ้างอิง</h2>
<li>OECD — AI Principles https://oecd.ai/en/ai-principles</li>
<li>OECD Legal Instruments — Recommendation of the Council on Artificial Intelligence</li>
<li>รูปปก: Artificial Intelligence & AI & Machine Learning — via vpnsrus.com (CC BY 2.0)</li>
<li>หน้าไฟล์ภาพ: https://commons.wikimedia.org/wiki/File:Artificial_Intelligence_%26_AI_%26_Machine_Learning_-_30212411048.jpg</li>
<li>ใบอนุญาต: CC BY 2.0</li>`,
  },
  {
    slug: "why-biodiversity-matters-ipbes",
    title: "ทำไมความหลากหลายทางชีวภาพสำคัญต่อโลกที่อยู่อาศัยได้",
    excerpt:
      "รายงานระดับโลกชี้ว่าความหลากหลายทางชีวภาพกำลังลดลงจากกิจกรรมมนุษย์ ส่งผลต่ออาหาร น้ำ และภูมิอากาศ",
    cover_url: "/images/articles/earth-biodiversity.jpg",
    seo_title: "ความหลากหลายทางชีวภาพ สำคัญอย่างไร",
    meta_description:
      "สรุปความสำคัญของความหลากหลายทางชีวภาพจากรายงาน IPBES และข้อมูล UNEP พร้อมแหล่งอ้างอิง",
    keywords: "ความหลากหลายทางชีวภาพ, IPBES, UNEP, อนุรักษ์โลก",
    brief: "[earth] seed factual draft — biodiversity IPBES",
    body: `<h2>ความหลากหลายทางชีวภาพคืออะไร</h2>
<p>ความหลากหลายทางชีวภาพหมายถึงความหลากหลายของสิ่งมีชีวิต ระบบนิเวศ และพันธุกรรมบนโลก เป็นฐานของบริการระบบนิเวศ เช่น อาหาร น้ำสะอาด การผสมเกสรพืช และเสถียรภาพของภูมิอากาศในระดับท้องถิ่นถึงโลก</p>
<h3>สิ่งที่รายงานระดับโลกชี้ไว้</h3>
<p>รายงาน Global Assessment ของ IPBES สรุปว่าธรรมชาติกำลังเสื่อมโทรมในอัตราที่ไม่เคยมีมาก่อนในประวัติศาสตร์มนุษย์ โดยปัจจัยสำคัญมาจากการใช้ที่ดินและทะเล การใช้ทรัพยากรโดยตรง การเปลี่ยนแปลงภูมิอากาศ มลพิษ และการรุกรานของชนิดพันธุ์ต่างถิ่น</p>
<blockquote>การอนุรักษ์ความหลากหลายทางชีวภาพไม่ใช่เรื่องของสัตว์ป่าอย่างเดียว แต่เกี่ยวกับความมั่นคงทางอาหารและสุขภาพของชุมชนด้วย</blockquote>
<li>อ่านบทสรุปสำหรับผู้กำหนดนโยบายของ IPBES เพื่อดูข้อค้นพบหลัก</li>
<li>ติดตามข้อมูลเพิ่มเติมจาก UNEP ในหัวข้อ biodiversity</li>
<li>แยกแยะระหว่างข้อเท็จจริงจากรายงานกับความเห็นส่วนบุคคลเมื่อแชร์ต่อ</li>
<h2>แหล่งอ้างอิง</h2>
<li>IPBES — Global Assessment Report on Biodiversity and Ecosystem Services https://www.ipbes.net/global-assessment</li>
<li>UNEP — Biodiversity https://www.unep.org/topics/nature-action/biodiversity</li>
<li>รูปปก: The Blue Marble (Earth from Apollo 17) — NASA/Apollo 17 crew (Public domain)</li>
<li>หน้าไฟล์ภาพ: https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg</li>
<li>ใบอนุญาต: Public domain</li>`,
  },
];

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sg_article (
        id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
        slug             VARCHAR(160) NOT NULL,
        title            VARCHAR(200) NOT NULL,
        excerpt          VARCHAR(280) NOT NULL,
        body             MEDIUMTEXT NOT NULL,
        cover_url        VARCHAR(512) NULL,
        author           VARCHAR(120) NOT NULL DEFAULT 'ทีมคอนเทนต์',
        status           ENUM('draft','review','live','archived') NOT NULL DEFAULT 'draft',
        source           ENUM('human','ai') NOT NULL DEFAULT 'human',
        brief            VARCHAR(800) NULL,
        seo_title        VARCHAR(60) NULL,
        meta_description VARCHAR(160) NULL,
        keywords         VARCHAR(240) NULL,
        submitted_by     VARCHAR(160) NULL,
        reviewed_by      VARCHAR(160) NULL,
        published_at     DATETIME NULL,
        created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_sg_article_slug (slug),
        KEY idx_sg_article_status (status, published_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    for (const article of ARTICLES) {
      const [rows] = await conn.query(
        "SELECT id, status FROM sg_article WHERE slug = ? LIMIT 1",
        [article.slug],
      );
      const existing = Array.isArray(rows) ? rows[0] : null;
      if (existing && existing.status !== "draft") {
        console.log(`skip ${article.slug} (status=${existing.status})`);
        continue;
      }

      if (existing) {
        await conn.query(
          `UPDATE sg_article SET
             title = ?, excerpt = ?, body = ?, cover_url = ?, author = ?,
             status = 'draft', source = 'ai', brief = ?,
             seo_title = ?, meta_description = ?, keywords = ?,
             published_at = NULL
           WHERE id = ?`,
          [
            article.title,
            article.excerpt,
            article.body,
            article.cover_url,
            "ทีมคอนเทนต์",
            article.brief,
            article.seo_title,
            article.meta_description,
            article.keywords,
            existing.id,
          ],
        );
        console.log(`updated draft ${article.slug} (#${existing.id})`);
      } else {
        const [result] = await conn.query(
          `INSERT INTO sg_article (
             slug, title, excerpt, body, cover_url, author, status, source, brief,
             seo_title, meta_description, keywords
           ) VALUES (?, ?, ?, ?, ?, ?, 'draft', 'ai', ?, ?, ?, ?)`,
          [
            article.slug,
            article.title,
            article.excerpt,
            article.body,
            article.cover_url,
            "ทีมคอนเทนต์",
            article.brief,
            article.seo_title,
            article.meta_description,
            article.keywords,
          ],
        );
        console.log(`inserted draft ${article.slug} (#${result.insertId})`);
      }
    }
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
