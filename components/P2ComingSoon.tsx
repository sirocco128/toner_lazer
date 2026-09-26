import Link from "next/link";

type P2ComingSoonProps = {
  title?: string;
  description?: string;
};

export function P2ComingSoon({
  title = "เครื่องมือนี้ยังไม่เปิดใช้",
  description = "ตะกร้าใบเสนอราคาและการปรับแต่งเซ็ตแบบละเอียดยังอยู่ระหว่างพัฒนา คุณยังขอใบเสนอราคาผ่านแบบฟอร์มหลักได้ตามปกติ",
}: P2ComingSoonProps) {
  return (
    <div className="mx-auto max-w-content px-page py-16 sm:py-20">
      <section className="mx-auto max-w-xl rounded-3xl border border-forest/10 bg-forest-mist/40 px-6 py-12 text-center sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-brass">
          เร็ว ๆ นี้
        </p>
        <h1 className="mt-3 text-3xl font-bold text-forest sm:text-4xl">{title}</h1>
        <p className="mt-4 leading-relaxed text-ink/75">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-forest transition hover:bg-brass-soft"
          >
            ขอใบเสนอราคา
          </Link>
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
          >
            ดูสินค้า
          </Link>
        </div>
      </section>
    </div>
  );
}
