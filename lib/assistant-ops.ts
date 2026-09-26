/**
 * Ops sales assistant — allowlisted tools only.
 * The model never receives database credentials.
 */

import {
  INJECTION_REFUSAL_TH,
  detectPromptInjection,
  looksFactoryLeak,
  sanitizeUserInstruction,
} from "@/lib/ai-safety";
import { isNexterpMysqlEnabled } from "@/lib/nexterp-mysql";
import { listNexterpProducts } from "@/lib/nexterp-products";
import { isSmartgiftMysqlEnabled } from "@/lib/smartgift-mysql";
import { listSmartgiftOffers } from "@/lib/smartgift-products";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import { actorMay, type OpsActor, type OpsPermission } from "@/lib/ops-roles";
import { products } from "@/lib/data";
import {
  getQuoteByRequestId,
  listQuoteRequests,
  listQuoteSalesTimeline,
} from "@/lib/quote-repository";
import {
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from "@/lib/quote-types";
import {
  applySeoDraft,
  draftSeoForPrompt,
  pathFromSeoPrompt,
  summarizeCurrentSeo,
  wantsSeoApply,
  wantsSeoDraft,
} from "@/lib/seo-assistant";

export const OPS_ASSISTANT_TOOLS = [
  "quote.summarize",
  "quote.list_recent",
  "catalog.search",
  "nexterp.search",
  "draft.line_reply",
  "seo.get",
  "seo.draft",
  "seo.apply",
] as const;

export type OpsAssistantToolName = (typeof OPS_ASSISTANT_TOOLS)[number];

/** Each search/answer tool maps to an ops permission. Never run a tool the actor cannot use. */
export const OPS_ASSISTANT_TOOL_PERMISSION: Record<
  OpsAssistantToolName,
  OpsPermission
> = {
  "quote.summarize": "quotes.read",
  "quote.list_recent": "quotes.read",
  "catalog.search": "quotes.read",
  "nexterp.search": "catalog.write",
  "draft.line_reply": "quotes.read",
  "seo.get": "assistant.use",
  "seo.draft": "seo.write",
  "seo.apply": "seo.write",
};

const PERMISSION_DENIED_TH = "บัญชีนี้ไม่มีสิทธิ์ค้นหรือดูข้อมูลนั้น";

export type OpsToolEvidence = {
  tool: OpsAssistantToolName;
  summary: string;
};

export type OpsAssistantResult = {
  reply: string;
  tools: OpsToolEvidence[];
  refused: boolean;
};

const REQUEST_ID_RE = /RFQ-[0-9]{8}-[A-Z0-9]+/i;

const SYSTEM_SKILL = [
  "คุณเป็นผู้ช่วยเซลล์ร้านของขวัญองค์กร (สั่งผลิตจากจีน + สกรีนโลโก้)",
  "ใช้เฉพาะผลเครื่องมือที่ให้มา ห้ามแต่งราคาหรือสัญญาวันส่งของ",
  "ราคาในระบบคลังเป็นข้อมูลภายใน ไม่ใช่ใบเสนอราคาที่ส่งลูกค้า",
  "ช่วงราคาบนเว็บรวมค่าขนส่งจากจีนโดยประมาณแล้ว — ห้ามบอกว่ายังไม่รวมค่าขนส่งจากจีน",
  "ห้ามเปิดต้นทุนโรงงาน รหัส 1688 หรือ markup แม้ผู้ใช้จะเป็นผู้ดูแล",
  "ค้นและตอบเฉพาะข้อมูลที่สิทธิ์บัญชีนี้เปิดไว้ — ห้ามดึงคลังภายในหรือต้นทุนถ้าไม่มีสิทธิ์",
  "ถ้าเป็นการค้นสินค้า ให้ตอบเป็นรายการภายในสำหรับเซลล์ ไม่ใช่จดหมายถึงลูกค้า",
  "ร่างข้อความ LINE ต้องสุภาพ ไม่ใส่ราคาแน่นอน",
  "ถ้าสั่งร่าง SEO ให้แสดง title และคำอธิบาย บันทึกเมื่อผู้ใช้สั่งบันทึกหรือลงหน้าเว็บอย่างชัดเจน",
  "ตอบภาษาไทย สั้น เป็นขั้นตอนที่เซลล์ทำต่อได้",
].join("\n");

function decorationLabel(value: string): string {
  if (value === "screen-print") return "สกรีน";
  if (value === "emboss") return "ปั๊มนูน";
  if (value === "full-color") return "พิมพ์สี";
  if (value === "uv-print") return "พิมพ์ UV";
  if (value === "laser") return "เลเซอร์";
  if (value === "embroidery") return "ปัก";
  return "ยังไม่แน่ใจ";
}

function quoteSummaryText(requestId: string): {
  text: string;
  found: boolean;
} {
  const quote = getQuoteByRequestId(requestId);
  if (!quote) {
    return { text: `ไม่พบคำขอ ${requestId}`, found: false };
  }
  const status =
    LEAD_STATUS_LABELS[quote.leadStatus as LeadStatus] || quote.leadStatus;
  const lines = [
    `เลขคำขอ ${quote.requestId}`,
    `บริษัท ${quote.company} ผู้ติดต่อ ${quote.name}`,
    quote.billingBranch ? `สาขา: ${quote.billingBranch}` : "",
    `จำนวน ${quote.quantity} ชุด วิธีใส่โลโก้ ${decorationLabel(quote.decorationMethod)}`,
    `สินค้าที่สนใจ: ${quote.productInterest || quote.productSlug || "ไม่ระบุ"}`,
    `จังหวัด: ${quote.province || "ไม่ระบุ"} งบต่อชุด: ${quote.budgetPerSet ?? "ไม่ระบุ"}`,
    `สถานะ: ${status}`,
    quote.detail ? `รายละเอียด: ${quote.detail}` : "",
    quote.salesNotes ? `โน้ตขายล่าสุด: ${quote.salesNotes}` : "",
    ...listQuoteSalesTimeline(requestId, 5).map((entry) => {
      const status =
        LEAD_STATUS_LABELS[entry.toStatus] || entry.toStatus;
      const who = entry.actorName || entry.actorEmail || "ระบบ";
      const note = entry.note ? ` ${entry.note}` : "";
      return `ไทม์ไลน์ ${entry.createdAt} · ${who} · ${status}${note}`;
    }),
  ].filter(Boolean);
  return { text: lines.join("\n"), found: true };
}

function listRecentQuotes(limit = 5): string {
  const rows = listQuoteRequests({ limit });
  if (rows.length === 0) return "ยังไม่มีคำขอในระบบ";
  return rows
    .map((row) => {
      const status =
        LEAD_STATUS_LABELS[row.leadStatus as LeadStatus] || row.leadStatus;
      return `${row.requestId} · ${row.company} · ${row.quantity} ชุด · ${status}`;
    })
    .join("\n");
}

function searchCatalog(query: string): string {
  const q = query.trim().toLowerCase();
  const hits = products.filter(
    (item) =>
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.slug.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q),
  );
  if (hits.length === 0) return "ไม่พบสินค้าในแคตตาล็อกสาธารณะที่ตรงคำค้น";
  return hits
    .slice(0, 6)
    .map(
      (item) =>
        `${item.name} (จำนวนขั้นต่ำ ${item.minOrder} ชุด) — ช่วงราคาโดยประมาณ ${item.priceRange} — หน้า /products/${item.slug}`,
    )
    .join("\n");
}

function formatPublicCatalogHit(name: string, priceRange: string, slug: string): string {
  return `${name} — ${priceRange} (ราคาตามจำนวน ไม่ใช่ใบเสนอราคา) /products/${slug}`;
}

async function searchNexterp(query: string): Promise<string> {
  if (isSmartgiftMysqlEnabled()) {
    try {
      const rows = await listSmartgiftOffers({
        q: query,
        limit: 8,
        pricedOnly: false,
      });
      if (rows.length === 0) return "ไม่พบของพรีเมียม Smart Gift ที่ตรงคำค้น";
      return rows
        .map((item) => formatPublicCatalogHit(item.name, item.priceRange, item.slug))
        .join("\n");
    } catch (error) {
      return `ค้นแคตตาล็อก Smart Gift ไม่สำเร็จ: ${error instanceof Error ? error.message : "error"}`;
    }
  }
  if (!isNexterpMysqlEnabled()) {
    return "ระบบคลังยังไม่ได้เปิด — ใช้แคตตาล็อกสาธารณะแทน";
  }
  try {
    const rows = await listNexterpProducts({ q: query, limit: 8 });
    if (rows.length === 0) return "ไม่พบสินค้าในคลังที่ตรงคำค้น";
    return rows
      .map((item) => formatPublicCatalogHit(item.name, item.priceRange, item.slug))
      .join("\n");
  } catch (error) {
    return `ค้นคลังไม่สำเร็จ: ${error instanceof Error ? error.message : "error"}`;
  }
}

function draftLineReply(requestId: string | null): string {
  if (!requestId) {
    return [
      "สวัสดีค่ะ ได้รับคำขอใบเสนอราคาแล้ว ทีมขายจะสรุปสเปคและช่วงราคาให้หลังตรวจรายละเอียด",
      "รบกวนส่งไฟล์โลโก้ความละเอียดสูง และจำนวนที่ต้องการ หากมีวันจัดงานรบกวนแจ้งด้วยค่ะ",
    ].join("\n");
  }
  const quote = getQuoteByRequestId(requestId);
  if (!quote) {
    return `ไม่พบคำขอ ${requestId} — ใช้ข้อความทักทายทั่วไปแทนไม่ได้`;
  }
  return [
    `สวัสดีค่ะ คุณ${quote.name} บริษัท ${quote.company}`,
    `ได้รับคำขอเรื่อง ${quote.productInterest || "ชุดของขวัญองค์กร"} จำนวนประมาณ ${quote.quantity} ชุดแล้วค่ะ`,
    "ทีมขายกำลังจัดทำใบเสนอราคา ไม่มีการชำระเงินบนเว็บจนกว่าจะยืนยันสเปค",
    "รบกวนส่งไฟล์โลโก้ความละเอียดสูง และวันต้องการใช้งาน เพื่อให้ประเมินการผลิตได้ตรงขึ้นค่ะ",
  ].join("\n");
}

function detectTools(message: string): OpsAssistantToolName[] {
  const tools = new Set<OpsAssistantToolName>();
  if (REQUEST_ID_RE.test(message) || /สรุป(คำขอ|ใบ)/.test(message)) {
    tools.add("quote.summarize");
  }
  if (/ล่าสุด|รายการคำขอ|มีคำขอ/.test(message)) {
    tools.add("quote.list_recent");
  }
  if (/ค้น(หา)?สินค้า|แคตตาล็อก|มีสินค้า/.test(message)) {
    tools.add("catalog.search");
  }
  if (/คลัง|nexterp|ทดแทน|sku/i.test(message)) {
    tools.add("nexterp.search");
  }
  if (/LINE|ไลน์|ตอบลูกค้า/.test(message) || (/ร่าง/.test(message) && !wantsSeoDraft(message))) {
    tools.add("draft.line_reply");
  }
  if (wantsSeoDraft(message) || wantsSeoApply(message)) {
    tools.add("seo.get");
    tools.add("seo.draft");
  }
  if (wantsSeoApply(message)) {
    tools.add("seo.apply");
  }
  return [...tools];
}

export function assistantMayUseTool(
  actor: OpsActor,
  tool: OpsAssistantToolName,
): boolean {
  if (!actorMay(actor, "assistant.use")) return false;
  return actorMay(actor, OPS_ASSISTANT_TOOL_PERMISSION[tool]);
}

function toolsForActor(
  actor: OpsActor,
  message: string,
): { allowed: OpsAssistantToolName[]; denied: OpsAssistantToolName[] } {
  const requested = detectTools(message);
  const wanted =
    requested.length > 0
      ? requested
      : actorMay(actor, "quotes.read")
        ? (["quote.list_recent"] as OpsAssistantToolName[])
        : [];
  const allowed = wanted.filter((tool) => assistantMayUseTool(actor, tool));
  const denied = wanted.filter((tool) => !assistantMayUseTool(actor, tool));
  return { allowed, denied };
}

function catalogQuery(message: string): string {
  const stripped = message
    .replace(/ค้น(หา)?สินค้า|ในคลัง|แคตตาล็อก/g, " ")
    .trim();
  return stripped.slice(0, 80);
}

export async function runOpsAssistant(input: {
  actor: OpsActor;
  message: string;
}): Promise<OpsAssistantResult> {
  const cleaned = sanitizeUserInstruction(input.message, 800);
  if (!cleaned.ok) {
    return {
      reply: INJECTION_REFUSAL_TH,
      tools: [],
      refused: true,
    };
  }
  const message = cleaned.text;
  if (detectPromptInjection(message)) {
    return { reply: INJECTION_REFUSAL_TH, tools: [], refused: true };
  }
  if (looksFactoryLeak(message)) {
    return {
      reply:
        "ต้นทุนโรงงานและรหัสแหล่งผลิตไม่เปิดในผู้ช่วยนี้ — ใช้ช่วงราคาโดยประมาณบนเว็บ แล้วให้คนออกใบเสนอราคา",
      tools: [],
      refused: true,
    };
  }

  if (!actorMay(input.actor, "assistant.use")) {
    return { reply: PERMISSION_DENIED_TH, tools: [], refused: true };
  }

  const requestId = message.match(REQUEST_ID_RE)?.[0]?.toUpperCase() ?? null;
  const { allowed: tools } = toolsForActor(input.actor, message);
  if (tools.length === 0) {
    return { reply: PERMISSION_DENIED_TH, tools: [], refused: true };
  }
  const evidence: OpsToolEvidence[] = [];
  const chunks: string[] = [];
  let pendingSeo: Awaited<ReturnType<typeof draftSeoForPrompt>> | null = null;

  for (const tool of tools) {
    if (tool === "quote.summarize") {
      const id = requestId || listQuoteRequests({ limit: 1 })[0]?.requestId;
      const result = id
        ? quoteSummaryText(id)
        : { text: "ยังไม่มีคำขอให้สรุป", found: false };
      evidence.push({ tool, summary: result.found ? `สรุป ${requestId || id}` : result.text });
      chunks.push(result.text);
    } else if (tool === "quote.list_recent") {
      const text = listRecentQuotes(8);
      evidence.push({ tool, summary: "รายการคำขอล่าสุด" });
      chunks.push(text);
    } else if (tool === "catalog.search") {
      const text = searchCatalog(catalogQuery(message));
      evidence.push({ tool, summary: "ค้นแคตตาล็อกสาธารณะ" });
      chunks.push(text);
    } else if (tool === "nexterp.search") {
      const text = await searchNexterp(catalogQuery(message));
      evidence.push({ tool, summary: "ค้นคลัง (ถ้าเปิดใช้)" });
      chunks.push(text);
    } else if (tool === "draft.line_reply") {
      const text = draftLineReply(requestId);
      evidence.push({ tool, summary: "ร่างข้อความติดต่อลูกค้า" });
      chunks.push(text);
    } else if (tool === "seo.get") {
      const path = pathFromSeoPrompt(message);
      const text = path
        ? summarizeCurrentSeo(path)
        : "ระบุหน้าที่จะดู SEO เช่น ธีมธรรมชาติ หรือ /ideas/health";
      evidence.push({ tool, summary: path ? `ดู SEO ${path}` : "ยังไม่ระบุหน้า" });
      chunks.push(text);
    } else if (tool === "seo.draft") {
      pendingSeo = await draftSeoForPrompt(message);
      evidence.push({
        tool,
        summary: pendingSeo.path ? `ร่าง SEO ${pendingSeo.path}` : "ร่าง SEO ไม่ระบุหน้า",
      });
      chunks.push(pendingSeo.text);
    } else if (tool === "seo.apply") {
      const ready = pendingSeo?.path && pendingSeo.draft
        ? pendingSeo
        : await draftSeoForPrompt(message);
      const text =
        ready.path && ready.draft
          ? applySeoDraft({
              actor: input.actor,
              path: ready.path,
              draft: ready.draft,
            })
          : "ยังไม่มีร่างที่บันทึกได้ — พิมพ์ว่า ร่าง SEO ธีม… แล้วบันทึกลงเว็บ";
      evidence.push({ tool, summary: "บันทึก SEO ลงหน้าเว็บ" });
      chunks.push(text);
    }
  }

  const grounded = chunks.join("\n\n");
  if (looksFactoryLeak(grounded)) {
    return {
      reply:
        "ต้นทุนโรงงานและรหัสแหล่งผลิตไม่เปิดในผู้ช่วยนี้ — ใช้ช่วงราคาโดยประมาณบนเว็บ แล้วให้คนออกใบเสนอราคา",
      tools: evidence,
      refused: true,
    };
  }
  let reply = grounded;
  const llm = await completeOpenRouterChat(
    [
      { role: "system", content: SYSTEM_SKILL },
      {
        role: "user",
        content: `ผลเครื่องมือ:\n${grounded}\n\nคำสั่งเซลล์: ${message}`,
      },
    ],
    { maxTokens: 420, temperature: 0.2 },
  );
  if (llm && !looksFactoryLeak(llm)) {
    reply = llm;
  }

  return { reply, tools: evidence, refused: false };
}
