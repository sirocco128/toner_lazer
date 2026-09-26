import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-content flex-col items-start gap-6 px-page py-16 sm:py-20">
      <p className="text-sm font-semibold uppercase tracking-wide text-brass">
        ไม่พบหน้า
      </p>
      <h1 className="text-3xl font-bold text-forest sm:text-4xl">
        หน้าที่ต้องการไม่มีในเว็บนี้
      </h1>
      <p className="max-w-xl text-ink/75">
        ลิงก์อาจพิมพ์ผิด ถูกย้าย หรือลบไปแล้ว เลือกทางใดทางหนึ่งด้านล่างเพื่อกลับสู่เส้นทางหลัก
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-6 text-sm font-semibold text-paper"
        >
          หน้าแรก
        </Link>
        <Link
          href="/products"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
        >
          ดูสินค้า
        </Link>
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-forest"
        >
          ขอใบเสนอราคา
        </Link>
      </div>
    </div>
  );
}
