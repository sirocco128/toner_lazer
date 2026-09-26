export type SeoFields = {
  seoTitle: string;
  metaDescription: string;
  canonicalPath: string;
  ogImage?: string;
  noIndex?: boolean;
  /** Comma-separated focus phrases. Used in JSON-LD / ops, not stuffed into copy. */
  keywords?: string;
};

export type Category = {
  name: string;
  slug: string;
  description: string;
  heroImage: string;
  seo: SeoFields;
};

export type Product = {
  name: string;
  slug: string;
  description: string;
  material: string;
  minOrder: number;
  priceRange: string;
  priceMin: number;
  priceMax: number;
  /** Unit THB without China→TH international freight (optional). */
  priceExFreightMin?: number;
  priceExFreightMax?: number;
  packagingMin?: number;
  packagingMax?: number;
  currency: "THB";
  images: string[];
  categorySlug: string;
  /** Human category label from SmartGift / CMS. */
  categoryName?: string;
  /** Commercial SKU such as A00001 or SmartGift offer code. */
  productId?: string;
  stockClass?: "A" | "B" | "C" | "D";
  isBundle?: boolean;
  isClearance?: boolean;
  clearanceReason?: string;
  colors?: Array<{ name: string; hex?: string | null }>;
  /** Production lead time in days when the catalog provides it. */
  leadDays?: number | null;
  /** Itemized gift-set bill of materials. */
  components?: Array<{ name: string; qty: number; sku?: string }>;
  capacity?: string;
  dimensions?: string;
  seo: SeoFields;
  /**
   * When true, product page shows the customer mockup studio
   * (logo/text → 3 styles → confirm). Managed in Strapi admin.
   */
  enableCustomDesign?: boolean;
  /** Which mockup surfaces to offer when enableCustomDesign is true. */
  customDesignPreset?: "tumbler_set" | "product_photo";
};

export type Faq = {
  question: string;
  answer: string;
  order: number;
};

export type Portfolio = {
  title: string;
  slug: string;
  client: string;
  industry: string;
  summary: string;
  image: string;
  services: string[];
  quantity: number;
  completedAt: string;
  featured: boolean;
};

export type Article = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover: string;
  author: string;
  category?: string;
  categoryName?: string;
  publishedAt: string;
  updatedAt: string;
  seo: SeoFields;
};

export const clientSegments: string[] = [
  "กลุ่มธุรกิจการเงิน",
  "ธุรกิจประกันภัย",
  "โรงพยาบาลและสุขภาพ",
  "สถาบันการศึกษา",
  "หน่วยงานภาครัฐ",
  "บริษัทเทคโนโลยี",
];

export const categories: Category[] = [
  {
    name: "ของพรีเมียมรักษ์โลก",
    slug: "eco-giftset",
    description:
      "ของพรีเมียมจากวัสดุรีไซเคิลและวัสดุธรรมชาติ เช่น สมุดรีไซเคิล หลอดไม้ไผ่ และถุงผ้า เหมาะกับงานรักษ์โลกและแคมเปญองค์กร",
    heroImage: "/images/category-eco.jpg",
    seo: {
      seoTitle: "ของพรีเมียมรักษ์โลก สกรีนโลโก้",
      metaDescription:
        "สั่งผลิตของพรีเมียมรักษ์โลกจากวัสดุธรรมชาติและรีไซเคิล ถุงผ้า หลอดไม้ไผ่ สมุดรีไซเคิล สกรีนโลโก้ได้ สั่งผลิตตามแบบจากจีน ขอใบเสนอราคาได้โดยไม่ชำระเงินบนเว็บ",
      canonicalPath: "/giftset/eco-giftset",
      ogImage: "/images/category-eco.jpg",
      keywords: "gift set รักษ์โลก, ของขวัญองค์กรธรรมชาติ, ถุงผ้าสกรีนโลโก้",
    },
  },
  {
    name: "ชุดของขวัญทริปบริษัท ทีมบิลดิ้ง",
    slug: "team-building-set",
    description:
      "เซ็ตของที่ระลึกสำหรับทริปบริษัทและงานทีมบิลดิ้ง ประกอบด้วยเสื้อ หมวก กระเป๋า กระบอกน้ำ และของใช้ตามธีมงาน",
    heroImage: "/images/category-team.jpg",
    seo: {
      seoTitle: "ของที่ระลึกทริปบริษัท สกรีนโลโก้",
      metaDescription:
        "ออกแบบของที่ระลึกทริปบริษัทและทีม เสื้อ หมวก กระเป๋า กระบอกน้ำ สกรีนโลโก้ได้ สั่งผลิตตามแบบจากจีน ขอใบเสนอราคาตามงบได้โดยไม่ชำระเงินบนเว็บ",
      canonicalPath: "/giftset/team-building-set",
      ogImage: "/images/category-team.jpg",
      keywords: "ของที่ระลึกทริปบริษัท, ของแจกทีมบิลดิ้ง, gift set ท่องเที่ยว",
    },
  },
  {
    name: "ชุดแก้วสแตนเลสเก็บอุณหภูมิ",
    slug: "tumbler-set",
    description:
      "เซ็ตกระบอกน้ำหรือแก้วสแตนเลสคู่กับสมุด ปากกา และกล่องจั่วปัง เหมาะเป็นของขวัญองค์กรที่ใช้ได้จริงทุกวัน",
    heroImage: "/images/category-tumbler.jpg",
    seo: {
      seoTitle: "ชุดแก้วสแตนเลสเก็บอุณหภูมิ",
      metaDescription:
        "รับผลิตชุดแก้วสแตนเลสเก็บอุณหภูมิ คู่สมุด ปากกา และกล่อง สกรีนโลโก้องค์กรได้ สั่งผลิตตามออเดอร์จากจีน ขั้นต่ำตามสินค้า ขอใบเสนอราคาได้โดยไม่ชำระเงินบนเว็บ",
      canonicalPath: "/giftset/tumbler-set",
      ogImage: "/images/category-tumbler.jpg",
      keywords: "กระบอกน้ำสกรีนโลโก้, ชุดแก้วองค์กร, ของขวัญสุขภาพพนักงาน",
    },
  },
  {
    name: "อุปกรณ์เทคโนโลยี",
    slug: "it-set",
    description:
      "ของพรีเมียมด้านเทคโนโลยี เช่น พาวเวอร์แบงก์ สายชาร์จ และอุปกรณ์พกพา สำหรับพนักงานใหม่หรือคู่ค้า สกรีนหรือเลเซอร์โลโก้ได้",
    heroImage: "/images/category-it.jpg",
    seo: {
      seoTitle: "อุปกรณ์เทคโนโลยี สกรีนโลโก้",
      metaDescription:
        "สั่งทำอุปกรณ์เทคโนโลยี พาวเวอร์แบงก์ สายชาร์จ และอุปกรณ์พกพา สกรีนหรือเลเซอร์โลโก้ได้ สำหรับพนักงานใหม่และคู่ค้า สั่งผลิตจากจีน ขอใบเสนอราคาได้ทันที",
      canonicalPath: "/giftset/it-set",
      ogImage: "/images/category-it.jpg",
      keywords: "gift set ไอที, powerbank สกรีนโลโก้, ของขวัญพนักงานใหม่",
    },
  },
];

export const products: Product[] = [
  {
    name: "เซ็ตกระบอกน้ำสแตนเลส + สมุด + ปากกา",
    slug: "tumbler-notebook-pen-set",
    description:
      "ชุดของขวัญองค์กรประกอบด้วยกระบอกน้ำสแตนเลสเก็บอุณหภูมิ สมุดโน้ต และปากกา ในกล่องจั่วปังพรีเมียม พร้อมสกรีนหรือพิมพ์โลโก้ตามแบรนด์",
    material: "สแตนเลส 304 / หนัง PU / กระดาษจั่วปัง",
    minOrder: 30,
    priceRange: "350–590 บาท/ชุด",
    priceMin: 350,
    priceMax: 590,
    currency: "THB",
    images: ["/images/product-tumbler.jpg"],
    categorySlug: "tumbler-set",
    enableCustomDesign: true,
    customDesignPreset: "tumbler_set",
    seo: {
      seoTitle: "เซ็ตกระบอกน้ำ สมุด ปากกา",
      metaDescription:
        "เซ็ตกระบอกน้ำสแตนเลสพร้อมสมุดและปากกา สกรีนโลโก้องค์กรได้ สั่งขั้นต่ำ 30 ชุด ราคาโดยประมาณ 350–590 บาท สั่งผลิตจากจีน ขอใบเสนอราคาได้โดยไม่ชำระเงินบนเว็บ",
      canonicalPath: "/products/tumbler-notebook-pen-set",
      ogImage: "/images/product-tumbler.jpg",
      keywords: "เซ็ตกระบอกน้ำองค์กร, สมุดปากกาสกรีนโลโก้",
    },
  },
  {
    name: "เซ็ตรักษ์โลก ถุงผ้า + หลอดไม้ไผ่ + สมุดรีไซเคิล",
    slug: "eco-tote-bamboo-set",
    description:
      "ชุดของพรีเมียมรักษ์โลก ประกอบถุงผ้าดิบ หลอดไม้ไผ่ และสมุดกระดาษรีไซเคิล เหมาะกับแคมเปญรักษ์โลกและของแจกงานองค์กร",
    material: "ผ้าดิบ / ไม้ไผ่ / กระดาษรีไซเคิล",
    minOrder: 50,
    priceRange: "180–320 บาท/ชุด",
    priceMin: 180,
    priceMax: 320,
    currency: "THB",
    images: ["/images/category-bags.jpg"],
    categorySlug: "eco-giftset",
    seo: {
      seoTitle: "เซ็ตรักษ์โลก ถุงผ้า หลอดไม้ไผ่",
      metaDescription:
        "เซ็ตของขวัญรักษ์โลก ถุงผ้า หลอดไม้ไผ่ สมุดรีไซเคิล สกรีนโลโก้ได้ สั่งขั้นต่ำ 50 ชุด ราคาโดยประมาณ 180–320 บาท สั่งผลิตจากจีน ขอใบเสนอราคาได้โดยไม่ชำระเงินบนเว็บ",
      canonicalPath: "/products/eco-tote-bamboo-set",
      ogImage: "/images/category-bags.jpg",
      keywords: "ถุงผ้าสกรีนโลโก้, เซ็ตรักษ์โลกองค์กร",
    },
  },
  {
    name: "เซ็ตไอที Powerbank + สายชาร์จ 3-in-1",
    slug: "it-powerbank-set",
    description:
      "ชุดของขวัญไอทีสำหรับองค์กร ประกอบ Powerbank และสายชาร์จ 3-in-1 ในบรรจุภัณฑ์พรีเมียม พร้อมเลเซอร์หรือสกรีนโลโก้",
    material: "ABS / อะลูมิเนียม",
    minOrder: 50,
    priceRange: "420–690 บาท/ชุด",
    priceMin: 420,
    priceMax: 690,
    currency: "THB",
    images: ["/images/product-it.jpg"],
    categorySlug: "it-set",
    seo: {
      seoTitle: "เซ็ตไอที Powerbank สายชาร์จ",
      metaDescription:
        "เซ็ตของขวัญไอที Powerbank พร้อมสายชาร์จ 3-in-1 สกรีนหรือเลเซอร์โลโก้ได้ สั่งขั้นต่ำ 50 ชุด ราคาโดยประมาณ 420–690 บาท สั่งผลิตจากจีน ขอใบเสนอราคาได้ทันที",
      canonicalPath: "/products/it-powerbank-set",
      ogImage: "/images/product-it.jpg",
      keywords: "powerbank สกรีนโลโก้, เซ็ตไอทีองค์กร",
    },
  },
];

export const faqs: Faq[] = [
  {
    question: "สั่งผลิตของพรีเมียมขั้นต่ำเท่าไหร่",
    answer:
      "ขั้นต่ำขึ้นกับประเภทสินค้า โดยทั่วไปเริ่มต้นประมาณ 30–50 ชิ้น แจ้งจำนวนที่ต้องการในแบบฟอร์มขอใบเสนอราคา แล้วทีมขายจะประเมินให้ตรงงบ",
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
      "ได้ ขอตัวอย่างก่อนผลิตตามรายการที่สนใจ ทีมขายจะแนะนำวัสดุ วิธีใส่โลโก้ และบรรจุภัณฑ์ให้ตรงงบและภาพลักษณ์แบรนด์",
    order: 3,
  },
  {
    question: "ออกใบกำกับภาษีได้หรือไม่",
    answer:
      "ออกใบกำกับภาษีได้ในนาม บริษัท เทราบิส จำกัด (เลขประจำตัวผู้เสียภาษี 0105556003873) กรุณาระบุรายละเอียดบริษัทผู้ซื้อในแบบฟอร์มหรือแจ้งฝ่ายขายเมื่อยืนยันออเดอร์",
    order: 4,
  },
];

export const portfolios: Portfolio[] = [
  {
    title: "Welcome Kit พนักงานใหม่",
    slug: "employee-welcome-kit",
    client: "บริษัทตัวอย่าง A",
    industry: "เทคโนโลยี",
    summary:
      "ออกแบบและผลิต Welcome Kit สำหรับพนักงานใหม่ ประกอบสมุด กระบอกน้ำ และของใช้สำนักงานในกล่องจั่วปังพร้อมโลโก้บริษัท",
    image: "/images/portfolio-welcome.jpg",
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
    image: "/images/portfolio-newyear.jpg",
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
    image: "/images/portfolio-esg.jpg",
    services: ["เซ็ตรักษ์โลก", "สกรีนโลโก้", "แพ็กงานอีเวนต์"],
    quantity: 800,
    completedAt: "2026-03-01",
    featured: false,
  },
];

export const articles: Article[] = [
  {
    title: "คู่มือเลือกสินค้าพรีเมียมให้องค์กร",
    slug: "premium-products-guide",
    excerpt:
      "หลักการเลือกของพรีเมียมให้เหมาะกับภาพลักษณ์องค์กร งบประมาณ และกลุ่มผู้รับ",
    body: `<h2>ทำไมองค์กรต้องเลือกของพรีเมียมอย่างมีหลักการ</h2>
<p>ของขวัญองค์กรไม่ใช่เพียงของแจก แต่สะท้อนภาพลักษณ์แบรนด์ ความใส่ใจต่อพนักงาน และความสัมพันธ์กับคู่ค้า</p>
<h3>กำหนดวัตถุประสงค์ให้ชัด</h3>
<p>เริ่มจากคำถามว่าของชุดนี้ใช้ต้อนรับพนักงานใหม่ มอบคู่ค้าปีใหม่ หรือแจกในงานสัมมนา เพื่อเลือกวัสดุและบรรจุภัณฑ์ให้เหมาะ</p>
<blockquote>เลือกของที่ใช้ได้จริง ดูแลรักษาง่าย และสอดคล้องกับค่านิยมองค์กร</blockquote>
<li>กำหนดงบต่อชุดและจำนวนขั้นต่ำ</li>
<li>เลือกรูปแบบการตกแต่งโลโก้ที่เหมาะสม</li>
<li>เผื่อเวลาผลิตและจัดส่งล่วงหน้า</li>
<h3>สรุป</h3>
<p>เมื่อมีวัตถุประสงค์ งบ และกำหนดส่งชัดเจน การขอใบเสนอราคาจะรวดเร็วและตรงความต้องการมากขึ้น</p>`,
    cover: "/images/article-guide.jpg",
    author: "ทีมงาน Smart Gift",
    publishedAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-15T00:00:00.000Z",
    seo: {
      seoTitle: "คู่มือเลือกสินค้าพรีเมียมองค์กร",
      metaDescription:
        "หลักการเลือกของพรีเมียมให้องค์กร ครอบคลุมงบ วัสดุ การสกรีนโลโก้ และเวลาผลิต สั่งตามแบบจากจีน อ่านแล้วขอใบเสนอราคาได้โดยไม่ชำระเงินบนเว็บ",
      canonicalPath: "/blog/premium-products-guide",
      ogImage: "/images/article-guide.jpg",
      keywords: "คู่มือ gift set, เลือกของขวัญองค์กร",
    },
  },
  {
    title: "เลือกของขวัญองค์กรธีมธรรมชาติอย่างไร ไม่ให้ดูแค่สีเขียว",
    slug: "gift-set-nature-theme",
    excerpt:
      "วิธีเลือกถุงผ้า ไม้ไผ่ และของใช้ซ้ำให้เข้ากับแคมเปญรักษ์โลก พร้อมใส่โลโก้องค์กรได้อย่างสุภาพ",
    body: `<h2>ธรรมชาติในของขวัญองค์กรหมายถึงอะไร</h2>
<p>ไม่ใช่การพิมพ์ใบไม้บนทุกชิ้น แต่คือของที่ผู้รับใช้ซ้ำได้ และวัสดุสื่อความรับผิดชอบ เช่น ผ้าดิบ ไม้ไผ่ กระดาษรีไซเคิล หรือกระบอกน้ำที่ใช้ทุกวัน</p>
<h3>เริ่มจากพฤติกรรมผู้รับ</h3>
<p>ถ้าผู้รับเดินทางด้วยรถไฟฟ้า ถุงผ้าพับได้มีประโยชน์ ถ้าทำงานออฟฟิศ กระบอกน้ำและสมุดมักถูกหยิบทุกวัน โลโก้ควรอ่านง่ายบนพื้นสีธรรมชาติ</p>
<blockquote>ของที่ใช้ได้จริงสื่อความใส่ใจได้มากกว่าของที่เก็บกล่อง</blockquote>
<li>กำหนดงบต่อชุดก่อนเลือกวัสดุพิเศษ</li>
<li>อย่าใส่คำรับรองสิ่งแวดล้อมเกินสเปคที่ยืนยันได้</li>
<li>เผื่อเวลาผลิต เพราะเป็นสินค้าสั่งตามออเดอร์</li>
<h3>ขั้นตอนถัดไป</h3>
<p>ดูไอเดียธีมธรรมชาติบนเว็บ แล้วส่งจำนวนกับวันใช้งานในแบบฟอร์มขอใบเสนอราคา ไม่มีการชำระเงินบนเว็บ</p>`,
    cover: "/images/category-eco.jpg",
    author: "ทีมงาน Smart Gift",
    publishedAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    seo: {
      seoTitle: "ของขวัญองค์กรธีมธรรมชาติ เลือกอย่างไร",
      metaDescription:
        "วิธีเลือกของขวัญองค์กรธีมธรรมชาติ ถุงผ้า ไม้ไผ่ ของใช้ซ้ำ สกรีนโลโก้ได้ สั่งผลิตตามออเดอร์จากจีน อ่านแนวทางแล้วขอใบเสนอราคาได้โดยไม่ชำระเงินบนเว็บ",
      canonicalPath: "/blog/gift-set-nature-theme",
      ogImage: "/images/category-eco.jpg",
      keywords: "ของขวัญองค์กรรักษ์โลก, ธีมธรรมชาติ",
    },
  },
  {
    title: "ของขวัญเทศกาลองค์กร ให้สุภาพและยังเป็นแบรนด์",
    slug: "gift-set-culture-theme",
    excerpt:
      "วางของขวัญปีใหม่ สงกรานต์ และของไหว้ให้เข้าวัฒนธรรมการมอบของ โดยโลโก้ยังชัดและไม่ฉูดฉาด",
    body: `<h2>เทศกาลคือจังหวะมอบของ ไม่ใช่ธีมตกแต่งอย่างเดียว</h2>
<p>ปีใหม่ คู่ค้า และของไหว้ผู้ใหญ่ต้องการโทนสุภาพ กล่องเรียบ ข้อความสั้น โลโก้ไม่แย่งการ์ดอวยพร</p>
<h3>เลือกของที่ใช้หลังเทศกาล</h3>
<p>กระบอกน้ำ สมุด ปากกา หรือถุงผ้ายังถูกใช้ในเดือนต่อมา ของกินและของตามฤดูกาลหมดไว ถ้าต้องการให้แบรนด์อยู่กับผู้รับนาน เลือกของใช้แล้วสกรีนโลโก้ขนาดพอดี</p>
<blockquote>วัฒนธรรมการให้ที่ดีคือให้ของที่ใช้ได้ โดยไม่ทำให้ผู้รับเกรงใจ</blockquote>
<li>ส่งคำขอล่วงหน้าก่อนคิวผลิตปลายปี</li>
<li>กำหนดโทนสีทอง ครีม หรือเขียวเข้มตามงาน</li>
<li>แจ้งข้อความบนการ์ดแยกจากโลโก้บนสินค้า</li>
<h3>สรุป</h3>
<p>ดูไอเดียธีมวัฒนธรรม แล้วบอกจำนวนและวันมอบในแบบฟอร์ม ทีมขายจะจัดชุดให้เข้าโอกาส โดยยังสั่งผลิตตามออเดอร์จากจีน</p>`,
    cover: "/images/portfolio-newyear.jpg",
    author: "ทีมงาน Smart Gift",
    publishedAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
    seo: {
      seoTitle: "ของขวัญเทศกาลองค์กร ธีมวัฒนธรรม",
      metaDescription:
        "แนวทางของขวัญปีใหม่ สงกรานต์ และของไหว้ให้องค์กร โทนสุภาพ โลโก้ชัด สกรีนได้ สั่งผลิตตามออเดอร์จากจีน อ่านแล้วขอใบเสนอราคาได้โดยไม่ชำระเงินบนเว็บ",
      canonicalPath: "/blog/gift-set-culture-theme",
      ogImage: "/images/portfolio-newyear.jpg",
      keywords: "ของขวัญปีใหม่องค์กร, ของที่ระลึกเทศกาล",
    },
  },
  {
    title: "ของที่ระลึกทริปบริษัท ที่คนเอาไปใช้จริงระหว่างเดินทาง",
    slug: "gift-set-travel-theme",
    excerpt:
      "คัดของพกพาสำหรับทริปและทีมบิลดิ้ง กระบอกน้ำ กระเป๋า พาวเวอร์แบงก์ แล้วใส่โลโก้ให้เข้าธีมปลายทาง",
    body: `<h2>ของท่องเที่ยวองค์กรไม่ควรเป็นของตกห้องพัก</h2>
<p>ของที่ถูกทิ้งที่โรงแรมไม่ได้ช่วยแบรนด์ ของที่ติดตัวระหว่างเดินทางช่วยได้ เช่น กระบอกน้ำ ถุงผ้า หมวก และพาวเวอร์แบงก์</p>
<h3>จัดชุดตามประเภททริป</h3>
<p>ทริปเขาหรือทะเลเน้นของเบา กันน้ำได้บ้าง ทริปทำงานต่างจังหวัดเน้นชาร์จไฟและกระบอกน้ำ โลโก้สีตัดกับยูนิฟอร์มจะถ่ายรูปกลุ่มแล้วอ่านออก</p>
<blockquote>แพ็กเป็นรายบุคคลก่อนวันเดินทาง ช่วยลดของหายในวันรวมตัว</blockquote>
<li>นับหัวผู้ร่วมทริปให้ตรงก่อนเปิดผลิต</li>
<li>แจ้งจุดส่งในไทยถ้าต้องการส่งที่สำนักงานหรือโรงแรม</li>
<li>อย่าคาดหวังของพร้อมส่งตัดจากคลัง</li>
<h3>ขั้นตอนถัดไป</h3>
<p>เปิดไอเดียธีมท่องเที่ยว เลือกเซ็ตใกล้เคียง แล้วส่งวันเดินทางในแบบฟอร์มขอใบเสนอราคา</p>`,
    cover: "/images/category-team.jpg",
    author: "ทีมงาน Smart Gift",
    publishedAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    seo: {
      seoTitle: "ของที่ระลึกทริปบริษัท ใช้จริงระหว่างทาง",
      metaDescription:
        "เลือกของที่ระลึกท่องเที่ยวและทริปบริษัท กระบอกน้ำ กระเป๋า พาวเวอร์แบงก์ สกรีนโลโก้ได้ สั่งผลิตตามออเดอร์จากจีน อ่านแนวทางแล้วขอใบเสนอราคาได้ทันที",
      canonicalPath: "/blog/gift-set-travel-theme",
      ogImage: "/images/category-team.jpg",
      keywords: "ของที่ระลึกทริปบริษัท, ของแจกทีมบิลดิ้ง",
    },
  },
  {
    title: "ของขวัญสุขภาพพนักงาน ที่ไม่ใช่ยาและไม่ต้องสัญญาผลลัพธ์",
    slug: "gift-set-health-theme",
    excerpt:
      "ใช้กระบอกน้ำ ถุงผ้า และของใช้ทุกวันสื่อเวลเนสองค์กร โดยโลโก้สุภาพและไม่มีคำรับรองทางการแพทย์",
    body: `<h2>สุขภาพในของขวัญองค์กรคือพฤติกรรม ไม่ใช่ผลิตภัณฑ์รักษา</h2>
<p>กระบอกน้ำช่วยให้มีขวดส่วนตัว ถุงผ้าช่วยลดถุงใช้ครั้งเดียว สมุดช่วยจดเป้าหมาย ข้อความบนสินค้าควรสั้นและไม่โฆษณาสรรพคุณ</p>
<h3>เหมาะกับใคร</h3>
<p>ฝ่ายบุคคลเปิดเดือนสุขภาพ วันกีฬาบริษัท โรงพยาบาลที่ต้องการของที่ระลึกโทนสะอาด และชุดต้อนรับพนักงานใหม่ที่อยากสื่อความห่วงใย</p>
<blockquote>โลโก้ชัดบนของที่ใช้ทุกวัน สื่อแบรนด์ได้โดยไม่ต้องพิมพ์คำขวัญยาว</blockquote>
<li>หลีกเลี่ยงคำว่า รักษา บำบัด หรือรับรองผล</li>
<li>เลือกวัสดุล้างง่าย สีไม่ฉูดฉาด</li>
<li>แจ้งโทนสีแบรนด์ในคำขอใบเสนอราคา</li>
<h3>สรุป</h3>
<p>ดูไอเดียธีมสุขภาพบนเว็บ แล้วส่งจำนวนผู้รับ ทีมขายจะจัดชุดของใช้ ไม่ใช่ยา และยังสั่งผลิตตามออเดอร์จากจีนหลังอนุมัติแบบ</p>`,
    cover: "/images/category-tumbler.jpg",
    author: "ทีมงาน Smart Gift",
    publishedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    seo: {
      seoTitle: "ของขวัญสุขภาพพนักงาน ที่ใช้ได้ทุกวัน",
      metaDescription:
        "แนวทางของขวัญเวลเนสพนักงาน กระบอกน้ำ ถุงผ้า ของใช้ทุกวัน สกรีนโลโก้สุภาพ ไม่ใช่ยา สั่งผลิตตามออเดอร์จากจีน อ่านแล้วขอใบเสนอราคาได้โดยไม่ชำระเงินบนเว็บ",
      canonicalPath: "/blog/gift-set-health-theme",
      ogImage: "/images/category-tumbler.jpg",
      keywords: "ของขวัญสุขภาพพนักงาน, gift set เวลเนส",
    },
  },
];
