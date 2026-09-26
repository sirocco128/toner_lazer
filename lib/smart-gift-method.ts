/**
 * Public selling method for Smart Gift, taken from the approved catalog
 * and partner posters. Buyer copy stays in Thai. Do not publish unverified
 * client logos or headcount claims from those sheets.
 */

export const SMART_GIFT_TAGLINE_EN = "The Right Gift. The Right Impact.";

export const SMART_GIFT_TAGLINE_TH =
  "มากกว่างของพรีเมียม คือพาร์ตเนอร์ที่ช่วยคิดของให้ตรงแบรนด์";

export const SMART_GIFT_PROMISE =
  "ครบทุกสินค้า ของพรีเมียมที่ใช้ได้สำหรับทุกแบรนด์ ทุกแคมเปญ";

export type SmartGiftCategory = {
  slug: string;
  title: string;
  titleEn: string;
  points: readonly string[];
  href: string;
  image: string;
  imageAlt: string;
  /** Catalog category slugs that belong in this group, including older gift-set slugs. */
  categorySlugs: readonly string[];
  /** Known product slugs to show even when their stored category is a sibling group. */
  productSlugs: readonly string[];
};

export const SMART_GIFT_CATEGORIES: readonly SmartGiftCategory[] = [
  {
    slug: "drinkware",
    title: "แก้วน้ำและกระบอกน้ำ",
    titleEn: "Drinkware",
    points: ["แก้วมัค", "กระบอกสุญญากาศ", "สกรีนโลโก้และพิมพ์ยูวี"],
    href: "/products?category=drinkware",
    image: "/images/category-tumbler.jpg",
    imageAlt: "กระบอกน้ำพรีเมียมสำหรับสกรีนโลโก้",
    categorySlugs: ["drinkware", "tumbler-set"],
    productSlugs: ["tumbler-notebook-pen-set"],
  },
  {
    slug: "bag",
    title: "กระเป๋าและสิ่งทอ",
    titleEn: "Bags & Textile",
    points: ["กระเป๋าผ้า", "ผ้าแคนวาส", "ผ้าพับ"],
    href: "/products?category=bag",
    image: "/images/category-bags.jpg",
    imageAlt: "ถุงผ้าแคนวาสสำหรับใส่โลโก้",
    categorySlugs: ["bag", "bags"],
    productSlugs: ["eco-tote-bamboo-set"],
  },
  {
    slug: "technology",
    title: "อุปกรณ์เทคโนโลยี",
    titleEn: "Tech & Electronics",
    points: ["หูฟัง", "พาวเวอร์แบงก์", "แฟลชไดรฟ์"],
    href: "/products?category=technology",
    image: "/images/category-it.jpg",
    imageAlt: "อุปกรณ์ไอทีพรีเมียมสำหรับองค์กร",
    categorySlugs: ["technology", "it-set", "executive-smart-tech"],
    productSlugs: ["it-powerbank-set"],
  },
  {
    slug: "office",
    title: "ของใช้สำนักงาน",
    titleEn: "Office & Stationery",
    points: ["สมุด", "ปากกา", "ปฏิทิน"],
    href: "/products?category=office",
    image: "/images/mockup-notebook.jpg",
    imageAlt: "สมุดและปากกาสำหรับใส่โลโก้",
    categorySlugs: ["office", "team-building-set"],
    productSlugs: ["tumbler-notebook-pen-set"],
  },
  {
    slug: "lifestyle",
    title: "ของใช้ในชีวิตประจำวัน",
    titleEn: "Daily Lifestyle",
    points: ["ร่ม", "กล่องอาหาร", "ของใช้ในบ้าน"],
    href: "/products?category=lifestyle",
    image: "/images/category-lifestyle.jpg",
    imageAlt: "ร่มและกล่องอาหารสำหรับใส่โลโก้",
    categorySlugs: ["lifestyle"],
    productSlugs: [],
  },
  {
    slug: "eco",
    title: "ของพรีเมียมรักษ์โลก",
    titleEn: "Eco Friendly",
    points: ["วัสดุรีไซเคิล", "ไม้และไม้ไผ่", "ผ้า"],
    href: "/products?category=eco",
    image: "/images/category-eco.jpg",
    imageAlt: "ของพรีเมียมรักษ์โลกจากวัสดุธรรมชาติ",
    categorySlugs: ["eco", "eco-giftset", "eco-friendly"],
    productSlugs: ["eco-tote-bamboo-set"],
  },
  {
    slug: "apparel",
    title: "เสื้อผ้าและยูนิฟอร์ม",
    titleEn: "Apparel & Uniform",
    points: ["เสื้อโปโล", "เสื้อที", "งานปัก"],
    href: "/products?category=apparel",
    image: "/images/category-apparel.jpg",
    imageAlt: "เสื้อโปโลสำหรับปักหรือสกรีนโลโก้",
    categorySlugs: ["apparel"],
    productSlugs: [],
  },
  {
    slug: "campaign",
    title: "ของสำหรับแคมเปญ",
    titleEn: "Campaign & Event",
    points: ["ของแจก", "ของแฟนคลับ", "ของอีเวนต์"],
    href: "/products?category=campaign",
    image: "/images/category-campaign.jpg",
    imageAlt: "สายคล้องบัตร เข็มกลัด และถุงกระดาษสำหรับงานอีเวนต์",
    categorySlugs: ["campaign"],
    productSlugs: [],
  },
  {
    slug: "gift-set",
    title: "ชุดของขวัญพรีเมียม",
    titleEn: "Premium Gift Set",
    points: ["เซ็ตตามงบ", "เซ็ตผู้บริหาร", "แพ็กพร้อมมอบ"],
    href: "/products?category=gift-set",
    image: "/images/hero-giftset.jpg",
    imageAlt: "กล่องของขวัญพรีเมียมพร้อมโบ",
    categorySlugs: ["gift-set"],
    productSlugs: [
      "tumbler-notebook-pen-set",
      "eco-tote-bamboo-set",
      "it-powerbank-set",
    ],
  },
  {
    slug: "packaging",
    title: "บรรจุภัณฑ์และกล่อง",
    titleEn: "Packaging",
    points: ["กล่องของขวัญ", "ถุงผ้า", "กล่องพรีเมียม"],
    href: "/products?category=packaging",
    image: "/images/category-packaging.jpg",
    imageAlt: "กล่องกระดาษคราฟท์สำหรับแพ็กของพรีเมียม",
    categorySlugs: ["packaging"],
    productSlugs: [],
  },
  {
    slug: "seasonal",
    title: "สินค้าตามฤดูกาล",
    titleEn: "Seasonal & Festive",
    points: ["ปีใหม่", "เทศกาล", "ของขวัญตามโอกาส"],
    href: "/products?category=seasonal",
    image: "/images/portfolio-newyear.jpg",
    imageAlt: "ของขวัญแพ็กพร้อมโบสำหรับเทศกาล",
    categorySlugs: ["seasonal"],
    productSlugs: [],
  },
  {
    slug: "custom",
    title: "สั่งผลิตตามแบบ",
    titleEn: "Custom Made",
    points: ["รูปทรงตามแบรนด์", "วัสดุตามโจทย์", "แพ็กเกจเฉพาะงาน"],
    href: "/products?category=custom",
    image: "/images/category-custom.jpg",
    imageAlt: "ขวด สมุด และกล่องเปล่าสำหรับสั่งผลิตตามแบบ",
    categorySlugs: ["custom"],
    productSlugs: [],
  },
];

export const SMART_GIFT_DECORATIONS = [
  { title: "สกรีนโลโก้", body: "พิมพ์โลโก้บนผิวเรียบ เช่น แก้ว ถุงผ้า และกล่อง" },
  { title: "ปั๊มนูน", body: "นูนโลโก้บนหนัง ปกสมุด หรือกล่อง" },
  { title: "เลเซอร์", body: "แกะโลโก้บนโลหะ กระบอกน้ำ และของพรีเมียม" },
  { title: "พิมพ์สี", body: "ลายสีเต็มบนผิวที่รับงานพิมพ์ได้" },
  { title: "ออกแบบแพ็กเกจ", body: "กล่อง ถุง และบัตร ตามโทนของแบรนด์" },
] as const;

export const SMART_GIFT_MATERIALS = [
  "สแตนเลส",
  "พลาสติก",
  "ไม้ไผ่",
  "ผ้า",
  "รีไซเคิล",
  "ไม้",
  "หนัง",
  "กระดาษ",
  "ซิลิโคน",
  "โลหะ",
] as const;

export const SMART_GIFT_AUDIENCES = [
  "ของขวัญองค์กร",
  "สินค้าขายปลีก",
  "แคมเปญและอีเวนต์",
  "งานภาครัฐ",
  "ของพนักงาน",
  "ชุดของขวัญพรีเมียม",
] as const;

export const SMART_GIFT_PARTNER_POINTS = [
  {
    title: "รับงานใหญ่ได้จริง",
    body: "จัดของหลายรายการ ให้หลายสาขา ในแคมเปญเดียว",
  },
  {
    title: "คุมคุณภาพก่อนผลิตจำนวนมาก",
    body: "ดูตัวอย่างและตรวจชิ้นงานก่อนเปิดผลิตเต็มจำนวน",
  },
  {
    title: "ตอบเร็ว พร้อมแนวทาง",
    body: "ส่งโจทย์แล้วได้แนวสินค้า แบบตำแหน่งโลโก้ และใบเสนอราคา",
  },
  {
    title: "ช่วยคิดของให้ตรงงาน",
    body: "จับคู่งบ โอกาสใช้งาน และภาพลักษณ์แบรนด์ แล้วเสนอตัวเลือก",
  },
  {
    title: "ของที่ใช้หรือมอบต่อได้",
    body: "ของแจก ของขาย และของขวัญที่ผู้รับเอาไปใช้จริง",
  },
  {
    title: "สั่งผลิตเฉพาะแบรนด์",
    body: "โลโก้ วัสดุ รูปทรง และแพ็กเกจทำให้เข้ากับแบรนด์นั้น",
  },
  {
    title: "สั่งซ้ำได้",
    body: "เก็บสเปคที่อนุมัติแล้วไว้ ใช้สั่งรอบถัดไปได้",
  },
  {
    title: "ทีมครบวงจร",
    body: "ขาย ออกแบบ ผลิต ตรวจคุณภาพ และจัดส่งอยู่ในงานเดียวกัน",
  },
] as const;
