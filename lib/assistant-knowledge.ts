/**
 * Public knowledge snippets for the buyer assistant.
 * No factory CNY, 1688 IDs, or firm quotes.
 */

import type { Faq } from "@/lib/data";
import { LOGO_DECORATION_OPTIONS } from "@/lib/product-decoration";
import {
  CHINA_AFTER_ORDER_INTRO,
  CHINA_AFTER_ORDER_STEPS,
  HOW_IT_WORKS,
  PRICE_DISCLAIMER_FULL,
  RFQ_NO_PAYMENT,
} from "@/lib/ux-copy";

export type KnowledgeSnippet = {
  id: string;
  title: string;
  body: string;
  keywords: string[];
};

function faqI18nBoost(faq: Faq): string {
  const t = `${faq.question} ${faq.answer}`;
  const extra: string[] = [];
  if (/ขั้นต่ำ|จำนวน/.test(t)) extra.push("minimum quantity 最少 起订 ຂັ້ນຕ່ຳ အနည်းဆုံး");
  if (/โลโก้|สกรีน/.test(t)) extra.push("logo screen print 丝印 ໂລໂກ້ လိုဂို");
  if (/ราคา|ใบเสนอ/.test(t)) extra.push("price quote 报价 ລາຄາ ဈေး");
  if (/ขั้นตอน|สั่งผลิต/.test(t)) extra.push("how to order process 下单 ຂັ້ນຕອນ မှာယူ");
  return extra.join(" ");
}

export function knowledgeFromFaqs(faqs: Faq[]): KnowledgeSnippet[] {
  return faqs.map((faq, index) => ({
    id: `faq-${index + 1}`,
    title: faq.question,
    body: faq.answer,
    keywords: tokenize(`${faq.question} ${faq.answer} ${faqI18nBoost(faq)}`),
  }));
}

export function builtInKnowledge(): KnowledgeSnippet[] {
  const decoration = LOGO_DECORATION_OPTIONS.map(
    (item) => `${item.label}: ${item.hint}`,
  ).join(" ");

  return [
    {
      id: "process",
      title: "ขั้นตอนสั่งผลิต",
      body: HOW_IT_WORKS.map((step) => `${step.title} — ${step.body}`).join(" "),
      keywords: tokenize(
        "ขั้นตอน สั่ง ผลิต ขอใบเสนอราคา โลโก้ จีน เลือกสินค้า อนุมัติแบบ how to order process production 下单 流程 ຂັ້ນຕອນ မှာယူ",
      ),
    },
    {
      id: "moq",
      title: "จำนวนขั้นต่ำ",
      body: "สินค้าเป็นงานสั่งผลิตจำนวนมากสำหรับองค์กร ไม่ใช่ขายปลีกทีละชิ้น ต้องถึงจำนวนขั้นต่ำตามที่ระบุบนหน้าสินค้านั้น ๆ",
      keywords: tokenize(
        "ขั้นต่ำ จำนวน ชุด minimum quantity 最少 起订 ຈຳນວນຂັ້ນຕ່ຳ အနည်းဆုံး",
      ),
    },
    {
      id: "china",
      title: "หลังยืนยันออเดอร์",
      body: `${CHINA_AFTER_ORDER_INTRO} ${CHINA_AFTER_ORDER_STEPS.map((step) => `${step.title} ${step.body}`).join(" ")}`,
      keywords: tokenize(
        "จีน โรงงาน ผลิต ขนส่ง ไทย จัดส่ง อนุมัติแบบ ไม่พร้อมส่ง ready stock shipping 现货 ພ້ອມສົ່ງ",
      ),
    },
    {
      id: "price",
      title: "ราคาบนเว็บ",
      body: PRICE_DISCLAIMER_FULL,
      keywords: tokenize(
        "ราคา ประมาณ ใบเสนอราคา ขนส่ง จีน เท่าไหร่ กี่บาท price quote estimate 报价 价格 ລາຄາ ဈေး",
      ),
    },
    {
      id: "form",
      title: "แบบฟอร์มขอใบเสนอราคา",
      body: RFQ_NO_PAYMENT,
      keywords: tokenize(
        "แบบฟอร์ม ชำระเงิน สั่งซื้อ มัดจำ ติดต่อ quote form contact 询价 ແບບຟອມ",
      ),
    },
    {
      id: "billing",
      title: "มัดจำ ใบกำกับภาษี และพร้อมเพย์",
      body: "หลังอนุมัติใบเสนอราคา ชำระมัดจำหรือเต็มจำนวนผ่านพร้อมเพย์ ยอดรวมภาษีมูลค่าเพิ่ม 7% ใบเสร็จมัดจำยังไม่ใช่ใบกำกับภาษี ใบกำกับภาษีออกเมื่อสินค้าเข้าคลังหรือส่งมอบและชำระครบ ในนามบริษัท เทราบิส จำกัด",
      keywords: tokenize(
        "มัดจำ ชำระเงิน พร้อมเพย์ ใบกำกับภาษี ใบเสร็จ VAT ภาษี ออเดอร์ ติดตาม deposit invoice 定金 发票 ມັດຈຳ အပ်ငွေ",
      ),
    },
    {
      id: "logo",
      title: "วิธีใส่โลโก้",
      body: `สินค้าสั่งผลิตตามออเดอร์ ใส่โลโก้ได้ด้วย ${decoration} หากยังไม่แน่ใจ เลือกให้ทีมขายแนะนำในแบบฟอร์ม`,
      keywords: tokenize(
        "โลโก้ สกรีน ปัก เลเซอร์ ยูวี พิมพ์ ตกแต่ง logo screen print uv laser embroidery 丝印 ໂລໂກ້ လိုဂို",
      ),
    },
    {
      id: "themes",
      title: "ไอเดียชุดของขวัญตามธีม",
      body: "เลือกธีมธรรมชาติ วัฒนธรรม ท่องเที่ยว หรือสุขภาพ แล้วสกรีนโลโก้ได้ ทุกชุดสั่งผลิตตามออเดอร์จากจีน ไม่ใช่ของพร้อมส่ง ดูรายละเอียดที่หน้าไอเดียชุดของขวัญ",
      keywords: tokenize(
        "ธรรมชาติ วัฒนธรรม ท่องเที่ยว สุขภาพ ธีม ของขวัญองค์กร ไอเดีย gift corporate 礼品 ຂອງຂວັນ လက်ဆောင်",
      ),
    },
  ];
}

export function tokenize(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

export function scoreSnippet(query: string, snippet: KnowledgeSnippet): number {
  const tokens = new Set(tokenize(query));
  if (tokens.size === 0) return 0;
  let hits = 0;
  for (const token of tokens) {
    if (snippet.keywords.some((kw) => kw.includes(token) || token.includes(kw))) {
      hits += 1;
    }
    if (snippet.title.toLowerCase().includes(token) || snippet.body.toLowerCase().includes(token)) {
      hits += 1;
    }
  }
  return hits;
}

export function retrieveKnowledge(
  query: string,
  extra: KnowledgeSnippet[],
  limit = 4,
): KnowledgeSnippet[] {
  const pool = [...builtInKnowledge(), ...extra];
  return pool
    .map((snippet) => ({ snippet, score: scoreSnippet(query, snippet) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.snippet);
}
