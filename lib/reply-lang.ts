export type ReplyLang = "th" | "en" | "lo" | "my" | "zh";

export function detectReplyLang(text: string): ReplyLang {
  const t = String(text || "");
  if (/[\u4e00-\u9fff]/.test(t)) return "zh";
  if (/[\u1000-\u109f]/.test(t)) return "my";
  if (/[\u0e80-\u0eff]/.test(t)) return "lo";
  if (/[\u0e00-\u0e7f]/.test(t)) return "th";
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (
    letters.length >= 6 ||
    /\b(what|how|why|when|where|please|hello|hi|thanks|minimum|logo|quote|price|order|gift|screen|print|shipping|deposit|invoice)\b/i.test(
      t,
    )
  ) {
    return "en";
  }
  return "th";
}

export function buyerLanguageInstruction(lang: ReplyLang): string {
  const scope =
    "You are the Smart Gift public assistant. Answer ONLY by restating the knowledge snippets. If the question is outside that knowledge, refuse and say you can only answer Smart Gift ordering questions on this site. Never invent prices, stock, delivery dates, or facts about other companies. Never say 1688, MOQ, SKU, RFQ, P2, HomePower.";
  switch (lang) {
    case "zh":
      return `${scope} 用简体中文口语回答 2-6 句。`;
    case "my":
      return `${scope} မြန်မာလို ၂-၆ ကြောင်း ပြန်ပါ။`;
    case "lo":
      return `${scope} ຕອບເປັນພາສາລາວ 2-6 ປະໂຫຍກ.`;
    case "en":
      return `${scope} Reply in natural English, 2-6 sentences.`;
    default:
      return `${scope} ตอบภาษาไทยสุภาพ 2-6 ประโยค.`;
  }
}

const COPY: Record<
  ReplyLang,
  { empty: string; factory: string; quote: string; scope: string; inject: string }
> = {
  th: {
    empty: "พิมพ์คำถามสั้น ๆ ได้ เช่น จำนวนขั้นต่ำ วิธีใส่โลโก้ หรือขั้นตอนสั่งผลิต",
    factory: "ข้อมูลต้นทุนโรงงานและรหัสแหล่งผลิตเป็นข้อมูลภายใน ทีมขายจะยืนยันราคาหลังได้รับรายละเอียดจากแบบฟอร์ม",
    quote: "ราคาบนเว็บเป็นช่วงโดยประมาณ ไม่ใช่ใบเสนอราคา กรุณาใช้แบบฟอร์มขอใบเสนอราคา หรือแชท LINE เพื่อให้ทีมขายยืนยัน",
    scope:
      "ผู้ช่วยนี้ตอบได้เฉพาะข้อมูลสั่งผลิตของพรีเมียม Smart Gift บนเว็บนี้ เช่น จำนวนขั้นต่ำ วิธีใส่โลโก้ และขั้นตอนสั่ง ไม่ตอบเรื่องอื่น",
    inject: "ไม่สามารถทำตามคำสั่งนี้ได้ — ใช้เครื่องมือตามที่ระบบกำหนดเท่านั้น",
  },
  en: {
    empty: "Ask a short question such as minimum quantity, logo options, or how to order.",
    factory: "Factory cost and supplier codes are internal. Sales will confirm pricing after the quote form.",
    quote: "Website prices are approximate ranges, not a quotation. Please use the quote form or LINE.",
    scope: "This assistant covers Therabis made-to-order gifts only — not parcel tracking or another company's products.",
    inject: "That instruction cannot be followed. Only the tools provided by the system are available.",
  },
  zh: {
    empty: "请用短句提问，例如起订数量、如何印标志，或下单流程。",
    factory: "出厂成本和供货编码为内部资料。销售会在收到询价表后确认价格。",
    quote: "网页价格是大约区间，不是报价单。请用询价表或 LINE。",
    scope: "本助手只解答泰拉比斯企业礼品订制，不查询物流，也不回答其他公司的商品价格。",
    inject: "无法执行该指令。只能使用系统提供的工具。",
  },
  lo: {
    empty: "ຖາມສັ້ນໆ ໄດ້ ເຊັ່ນ ຈຳນວນຂັ້ນຕ່ຳ ວິທີໃສ່ໂລໂກ້ ຫຼືຂັ້ນຕອນສັ່ງຜະລິດ",
    factory: "ຕົ້ນທຶນໂຮງງານເປັນຂໍ້ມູນພາຍໃນ ທີມຂາຍຈະຢືນຢັນລາຄາຫຼັງໄດ້ແບບຟອມ",
    quote: "ລາຄາໃນເວັບເປັນຊ່ວງໂດຍປະມານ ບໍ່ແມ່ນໃບສະເໜີລາຄາ ກະລຸນາໃຊ້ແບບຟອມ ຫຼື LINE",
    scope: "ຜູ້ຊ່ວຍນີ້ຕອບເລື່ອງສັ່ງຜະລິດຂອງຂວັນອົງກອນເທຣາບິສເທົ່ານັ້ນ ບໍ່ຕິດຕາມພັດສະດຸ",
    inject: "ບໍ່ສາມາດເຮັດຕາມຄຳສັ່ງນີ້ໄດ້",
  },
  my: {
    empty: "အနည်းဆုံးအရေအတွက်၊ လိုဂို သို့မဟုတ် မှာယူပုံကို အတိုမေးပါ။",
    factory: "စက်ရုံကုန်ကျစရိတ်သည် အတွင်းအချက်အလက်ဖြစ်သည်။ အရောင်းအဖွဲ့က ဖောင်ရပြီးမှ ဈေးအတည်ပြုပါမည်။",
    quote: "ဝက်ဘ်ပေါ်ဈေးသည် ခန့်မှန်းအပိုင်းအခြားသာဖြစ်ပြီး ကိုးကားဈေးမဟုတ်ပါ။",
    scope: "ဤအကူသည် Therabis လက်ဆောင်အမှာသာ ဖြေသည်။ ပစ္စည်းလိုက်လံခြင်း မလုပ်ပါ။",
    inject: "ဤညွှန်ကြားချက်ကို မလိုက်နာနိုင်ပါ။",
  },
};

export function buyerCopy(
  lang: ReplyLang,
  kind: "empty" | "factory" | "quote" | "scope" | "inject",
): string {
  return COPY[lang][kind];
}

const SNIPPET_FALLBACK: Partial<Record<string, Record<ReplyLang, string>>> = {
  moq: {
    th: "สินค้าเป็นงานสั่งผลิตจำนวนมากสำหรับองค์กร ไม่ใช่ขายปลีกทีละชิ้น ต้องถึงจำนวนขั้นต่ำตามที่ระบุบนหน้าสินค้านั้น ๆ",
    en: "Made to order for organisations, not sold one piece at a time. Use the minimum quantity printed on that product page.",
    zh: "企业批量订制，不零售单件。起订数量以该产品页为准。",
    lo: "ສັ່ງຜະລິດສຳລັບອົງກອນ ບໍ່ຂາຍຍ່ອຍຕໍ່ຊິ້ນ ຈຳນວນຂັ້ນຕ່ຳຕາມໜ້າສິນຄ້າ.",
    my: "အဖွဲ့အစည်းအတွက် အမှာထုတ်လုပ်ခြင်းဖြစ်ပြီး တစ်ခုချင်းမရောင်းပါ။ အနည်းဆုံးအရေအတွက်ကို ထိုကုန်ပစ္စည်းစာမျက်နှာတွင် ကြည့်ပါ။",
  },
  logo: {
    th: "ใส่โลโก้ได้ด้วยสกรีน ปั๊มนูน เลเซอร์ พิมพ์สี พิมพ์ UV หรือปัก ตัวอย่างบนเว็บใช้ดูตำแหน่งเท่านั้น",
    en: "Add a logo by screen print, emboss, laser, full-color print, UV print, or embroidery. Website photos show placement only.",
    zh: "可用丝印、UV、激光或刺绣印企业标志。网页图只供看位置。",
    lo: "ໃສ່ໂລໂກ້ດ້ວຍສະກຣີນ ພິມ UV ເລເຊີ ຫຼືປັກ ຮູບໃນເວັບໃຊ້ເບິ່ງຕຳແໜ່ງເທົ່ານັ້ນ.",
    my: "စခရင်၊ UV၊ လေဆာ သို့မဟုတ် ပေါင်ထိုး၍ လိုဂိုထည့်နိုင်သည်။ ဝက်ဘ်ပုံသည် တည်နေရာပြရန်သာ။",
  },
  process: {
    th: "เลือกเซ็ตหรือบอกโจทย์ แล้วกรอกแบบฟอร์มขอใบเสนอราคาหรือแชท LINE ยืนยันแบบโลโก้แล้วจึงผลิตจากจีน",
    en: "Choose a set or describe the brief, send the quote form or LINE, approve the logo proof, then production in China.",
    zh: "选套装或说明需求，提交询价表或 LINE，确认标志小样后在中国生产。",
    lo: "ເລືອກເຊັດ ຫຼືບອກໂຈທຍ໌ ແລ້ວໃຊ້ແບບຟອມ ຫຼື LINE ຢືນຢັນແບບໂລໂກ້ຈຶ່ງຜະລິດຈາກຈີນ.",
    my: "ဆက်ရွေး သို့မဟုတ် လိုအင်ပြော၊ ဖောင်/LINE ပို့၊ လိုဂိုနမူနာအတည်ပြုပြီး တရုတ်တွင်ထုတ်လုပ်သည်။",
  },
  price: {
    th: "ราคาบนเว็บเป็นช่วงโดยประมาณ ไม่ใช่ใบเสนอราคา และไม่มีการชำระเงินในแชท",
    en: "Website prices are approximate ranges, not a quotation, and there is no payment in chat.",
    zh: "网页价格是大约区间，不是报价单，聊天里不能付款。",
    lo: "ລາຄາໃນເວັບເປັນຊ່ວງໂດຍປະມານ ບໍ່ແມ່ນໃບສະເໜີລາຄາ ແລະບໍ່ຊຳລະໃນແຊັດ.",
    my: "ဝက်ဘ်ပေါ်ဈေးသည် ခန့်မှန်းအပိုင်းအခြားသာဖြစ်ပြီး ကိုးကားဈေးမဟုတ်၊ ချတ်တွင် ငွေမပေးရပါ။",
  },
};

export function snippetFallback(id: string, lang: ReplyLang): string | null {
  return SNIPPET_FALLBACK[id]?.[lang] || null;
}
