/**
 * Prompt-injection, secret redaction, and overreach checks for AI surfaces.
 * Policy outranks the user prompt — same idea as the internal Hermes stack,
 * scoped to this store (mockup + buyer chat + ops assistant).
 */

const INJECTION_PATTERNS = [
  /ignore (all |any )?(previous|prior|above) (instructions|prompts)/i,
  /you are (now )?(an? )?(admin|administrator|root|sales manager)/i,
  /disclose (the )?(system prompt|secret|password|api key)/i,
  /disable (rbac|policy|audit|overreach)/i,
  /show (me )?(the )?(system|hidden) prompt/i,
  /แสดง(system prompt|พรอมต์ระบบ|รหัสลับ|api key)/i,
  /ลืมคำสั่งก่อนหน้า|เพิกเฉยคำสั่งก่อนหน้า/i,
];

const FACTORY_LEAK_PATTERNS = [
  /\b1688\b/i,
  /\boffer[_-]?id\b/i,
  /factory\s*cny/i,
  /factory\s*(cost|price)/i,
  /ex-?factory/i,
  /alibaba/i,
  /ต้นทุนโรงงาน/,
  /ราคาโรงงาน/,
  /ราคาทุน/,
  /出厂价/,
  /工厂成本/,
  /ຕົ້ນທຶນໂຮງງານ/,
  /ລາຄາໂຮງງານ/,
  /စက်ရုံစျေး/,
  /\bmarkup\b/i,
  /\bSOF\b/,
  /alicdn/i,
];

const FIRM_QUOTE_PATTERNS = [
  /ราคาสุดท้าย/,
  /ราคาแน่นอน/,
  /ยืนยันราคา/,
  /ใบเสนอราคาคือ/,
  /คิดเป็น\s*\d+/,
  /ชำระ(มัดจำ|เงิน)ได้เลย/,
  /พร้อมส่งวันนี้/,
  /final\s*price/i,
  /exact\s*price/i,
  /firm\s*(quote|price)/i,
  /pay\s+now/i,
  /ready\s+(stock|to\s*ship)\s+today/i,
  /最终价/,
  /现货今天/,
  /ລາຄາສຸດທ້າຍ/,
  /နောက်ဆုံးစျေး/,
];

export const INJECTION_REFUSAL_TH =
  "ไม่สามารถทำตามคำสั่งนี้ได้ — ใช้เครื่องมือตามที่ระบบกำหนดเท่านั้น";

export const FACTORY_LEAK_REFUSAL_TH =
  "ข้อมูลต้นทุนโรงงานและรหัสแหล่งผลิตเป็นข้อมูลภายใน ทีมขายจะยืนยันราคาหลังได้รับรายละเอียดจากแบบฟอร์ม";

export const FIRM_QUOTE_REFUSAL_TH =
  "ราคาบนเว็บเป็นช่วงโดยประมาณ ไม่ใช่ใบเสนอราคา กรุณาใช้แบบฟอร์มขอใบเสนอราคา หรือแชท LINE เพื่อให้ทีมขายยืนยัน";

export const PUBLIC_SCOPE_REFUSAL_TH =
  "ผู้ช่วยนี้ตอบได้เฉพาะข้อมูลสั่งผลิตของพรีเมียม Smart Gift บนเว็บนี้ เช่น จำนวนขั้นต่ำ วิธีใส่โลโก้ และขั้นตอนสั่ง ไม่ตอบเรื่องอื่น";

const PUBLIC_SCOPE_PATTERNS = [
  /\bhp-bat\b/i,
  /\bhp-plug\b/i,
  /homepower/i,
  /บ้านเพาเวอร์/,
  /ถ่านไฟฉาย/,
  /alkaline/i,
  /\bDO\s*\d{8,}/i,
  /where\s+is\s+(my\s+)?(parcel|shipment|package)/i,
  /\bSLA\b/,
  /\btisi\b/i,
  /มอก\.?\s*(2217|5)/,
  /ปลั๊ก\s*philips/i,
  /nexterp/i,
  /物流/,
  /运单/,
  /อากาศ|ฝนตก|พยากรณ์|weather/i,
  /นายก|ข่าววันนี้|ผลบอล|หุ้น/,
];

export function looksPublicScopeOverreach(text: string): boolean {
  return PUBLIC_SCOPE_PATTERNS.some((re) => re.test(String(text || "")));
}

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(String(text || "")));
}

export function looksFactoryLeak(text: string): boolean {
  return FACTORY_LEAK_PATTERNS.some((re) => re.test(String(text || "")));
}

export function looksFirmQuote(text: string): boolean {
  return FIRM_QUOTE_PATTERNS.some((re) => re.test(String(text || "")));
}

export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/(password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[redacted]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]");
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/password|secret|token|private.?key|api[_-]?key|ssh/i.test(key)) {
        out[key] = "[redacted]";
      } else {
        out[key] = redactSecrets(nested);
      }
    }
    return out;
  }
  return value;
}

export function sanitizeUserInstruction(
  text: string,
  maxLength = 500,
): { ok: true; text: string } | { ok: false; reason: "injection" | "factory" } {
  const trimmed = String(text || "").trim().slice(0, maxLength);
  if (!trimmed) return { ok: true, text: "" };
  if (detectPromptInjection(trimmed)) return { ok: false, reason: "injection" };
  if (looksFactoryLeak(trimmed)) return { ok: false, reason: "factory" };
  return { ok: true, text: trimmed };
}

export function postCheckPublicAnswer(answer: string): {
  ok: boolean;
  text: string;
  refused: boolean;
} {
  const text = String(answer || "").trim();
  if (!text) {
    return { ok: false, text: FIRM_QUOTE_REFUSAL_TH, refused: true };
  }
  if (looksFactoryLeak(text)) {
    return { ok: false, text: FACTORY_LEAK_REFUSAL_TH, refused: true };
  }
  if (looksFirmQuote(text)) {
    return { ok: false, text: FIRM_QUOTE_REFUSAL_TH, refused: true };
  }
  return { ok: true, text, refused: false };
}

export const MOCKUP_POLICY_SUFFIX =
  "Never print prices, SKUs, factory names, 1688, Alibaba offer IDs, CNY amounts, or internal cost notes on the image. This is a logo placement preview only — not a production proof.";
