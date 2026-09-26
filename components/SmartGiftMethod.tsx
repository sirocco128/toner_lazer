import Image from "next/image";
import Link from "next/link";
import {
  SMART_GIFT_AUDIENCES,
  SMART_GIFT_CATEGORIES,
  SMART_GIFT_DECORATIONS,
  SMART_GIFT_MATERIALS,
  SMART_GIFT_PARTNER_POINTS,
  SMART_GIFT_TAGLINE_TH,
} from "@/lib/smart-gift-method";

type SmartGiftPart = "categories" | "decorate" | "partner";

export function SmartGiftMethod({
  parts = ["categories", "decorate", "partner"],
}: {
  parts?: readonly SmartGiftPart[];
}) {
  return (
    <>
      {parts.includes("categories") ? <CategoryWall /> : null}
      {parts.includes("decorate") ? <DecorationBand /> : null}
      {parts.includes("partner") ? <PartnerGrid /> : null}
    </>
  );
}

function CategoryWall() {
  return (
    <section className="mx-auto max-w-content px-page py-14 sm:py-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold text-forest sm:text-3xl">
          ครบทุกหมวด ของพรีเมียมที่ใช้ได้จริง
        </h2>
        <p className="mt-3 text-ink/75">
          {SMART_GIFT_TAGLINE_TH} เลือกหมวด แล้วขอใบเสนอราคาเมื่อล็อกแนวสินค้า
        </p>
      </div>
      <ul className="mt-6 flex flex-wrap gap-2">
        {SMART_GIFT_AUDIENCES.map((audience) => (
          <li
            key={audience}
            className="rounded-full border border-forest/15 bg-paper px-4 py-2 text-sm text-forest"
          >
            {audience}
          </li>
        ))}
      </ul>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SMART_GIFT_CATEGORIES.map((category) => (
          <li key={category.title}>
            <Link
              href={category.href}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-forest/10 bg-paper transition hover:border-brass/60"
            >
              <div className="media-frame media-frame--tile rounded-none">
                <Image
                  src={category.image}
                  alt={category.imageAlt}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                  sizes="(max-width:768px) 100vw, 33vw"
                />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brass">
                  {category.titleEn}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-forest group-hover:text-brass">
                  {category.title}
                </h3>
                <ul className="mt-3 space-y-1 text-sm text-ink/70">
                  {category.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" aria-hidden />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DecorationBand() {
  return (
    <section className="bg-paper py-14 sm:py-16">
      <div className="mx-auto max-w-content px-page">
        <h2 className="text-2xl font-bold text-forest sm:text-3xl">
          ใส่โลโก้และเลือกวัสดุได้
        </h2>
        <p className="mt-3 max-w-2xl text-ink/75">
          แบบบนเว็บใช้ดูแนวทาง ไฟล์โลโก้จริงส่งให้ทีมขาย แล้วอนุมัติก่อนผลิต
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SMART_GIFT_DECORATIONS.map((item, index) => (
            <li key={item.title} className="rounded-2xl border border-forest/10 bg-forest-mist/60 p-5">
              <p className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brass text-sm font-bold text-paper">
                {index + 1}
              </p>
              <h3 className="mt-3 font-semibold text-forest">{item.title}</h3>
              <p className="mt-2 text-sm text-ink/70">{item.body}</p>
            </li>
          ))}
        </ul>
        <ul className="mt-8 flex flex-wrap gap-2">
          {SMART_GIFT_MATERIALS.map((material) => (
            <li
              key={material}
              className="rounded-full border border-forest/10 bg-forest-mist px-3 py-1.5 text-sm text-forest"
            >
              {material}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PartnerGrid() {
  return (
    <section className="mx-auto max-w-content px-page py-14 sm:py-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold text-forest sm:text-3xl">
          พาร์ตเนอร์ของงานองค์กร
        </h2>
        <p className="mt-3 text-ink/75">
          ช่วยคิดของ ทำแบบ ผลิต และดูแลงานซ้ำ เริ่มจากปรึกษาหรือขอใบเสนอราคา
        </p>
      </div>
      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SMART_GIFT_PARTNER_POINTS.map((item, index) => (
          <li key={item.title} className="rounded-2xl border border-forest/10 bg-paper p-5">
            <p className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-brass px-2 text-sm font-bold text-paper">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-3 font-semibold text-forest">{item.title}</h3>
            <p className="mt-2 text-sm text-ink/70">{item.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
