import Link from "next/link";
import { PRICE_SHEET_TEMPLATE_HREF } from "@/lib/price-sheet";

/** Shared ops copy for download → edit → re-upload price loop. */
export function PriceRoundTripGuide({
  variant = "products",
}: {
  variant?: "products" | "import" | "price-sheet";
}) {
  if (variant === "import") {
    return (
      <div className="mt-4 rounded-xl border border-forest/15 bg-paper px-4 py-3 text-sm text-ink/75">
        <p className="font-medium text-forest">วงจรรีเช็คราคา</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            ดาวน์โหลดจาก{" "}
            <Link href="/ops/products" className="text-forest underline-offset-2 hover:underline">
              รหัสขาย
            </Link>{" "}
            (ไฟล์ .xlsx ชีต <code className="text-xs">import</code>)
          </li>
          <li>แก้เฉพาะ <strong>sku = รหัสโรงงาน</strong> และ <strong>rmb</strong> (อย่าใส่ A/B/C/D)</li>
          <li>อัปโหลดไฟล์ด้านล่าง → พรีวิว → อัปเดตขึ้นเว็บ</li>
        </ol>
      </div>
    );
  }

  if (variant === "price-sheet") {
    return (
      <div className="mt-4 rounded-xl border border-brass/40 bg-[#FFFDF8] px-4 py-3 text-sm text-ink/75">
        <p className="font-medium text-forest">ชีตราคา 3 แท็บ · ใช้ยังไง</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            ดาวน์โหลด{" "}
            <a
              href={PRICE_SHEET_TEMPLATE_HREF}
              className="text-forest underline-offset-2 hover:underline"
              download
            >
              แม่แบบ Excel 3 แท็บ
            </a>{" "}
            เพื่อลองสูตรในไฟล์ (ไม่เขียนขึ้นเว็บ)
          </li>
          <li>
            บนหน้านี้: เลือกสินค้าจากแคตตาล็อก → แก้จำนวน → พรีวิว Final → สร้างใบเสนอราคา Ops
          </li>
          <li>
            ถ้าจะ<strong>ยิงราคาขึ้นเว็บ</strong> ไปที่{" "}
            <Link
              href="/ops/pricing/import"
              className="text-forest underline-offset-2 hover:underline"
            >
              อัปเดตจาก Excel
            </Link>{" "}
            (ดาวน์โหลดจากรหัสขาย → แก้ rmb → อัปโหลด)
          </li>
        </ol>
        <p className="mt-2 text-xs text-ink/55">
          หน้านี้เป็นพรีวิว/ใบเสนอราคา — ไม่เขียนแคตตาล็อกโดยตรง
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-brass/40 bg-[#FFFDF8] px-4 py-3 text-sm text-ink/75">
      <p className="font-medium text-forest">รีเช็ค / แก้ราคาแล้วยิงขึ้นเว็บ</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>
          กด <strong>ดาวน์โหลด Excel</strong> (ตามตัวกรองด้านล่าง) — ชีตสรุปบอกว่ากี่แถวอัปได้
        </li>
        <li>
          เปิดชีต <code className="text-xs">import</code> แก้ <strong>rmb</strong> / ขนาด แล้วเซฟ
        </li>
        <li>
          ไป{" "}
          <Link
            href="/ops/pricing/import"
            className="text-forest underline-offset-2 hover:underline"
          >
            อัปเดตราคาจาก Excel
          </Link>{" "}
          อัปโหลด → พรีวิว → อัปเดต
        </li>
      </ol>
      <p className="mt-2 text-xs text-ink/55">
        คอลัมน์ qty_* ในไฟล์เป็นราคาปัจจุบันสำหรับรีเช็ค — ระบบอัปโหลดไม่อ่านคอลัมน์นี้
      </p>
    </div>
  );
}
