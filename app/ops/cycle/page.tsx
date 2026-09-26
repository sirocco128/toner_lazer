import Link from "next/link";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CARDS = [
  {
    href: "/ops/approvals",
    perm: "orders.read" as const,
    title: "รอบัญชีอนุมัติยอด",
    body: "ดูสลิปที่ลูกค้าส่ง แล้วกดอนุมัติรับเงิน หรือปฏิเสธพร้อมเหตุผล",
  },
  {
    href: "/ops/receipts",
    perm: "orders.write" as const,
    title: "ฟอร์มรับเงิน",
    body: "ใบรับเงินตามรายการรับ — มัดจำ ส่วนที่เหลือ หรือรายการอื่น พร้อม QR พร้อมเพย์",
  },
  {
    href: "/ops/inbound",
    perm: "factory.write" as const,
    title: "รับสินค้าเข้า",
    body: "รับตามใบสั่งโรงงาน — เข้าคลังไทย หรือไม่เข้าคลังส่งตรงลูกค้า (ship to)",
  },
  {
    href: "/ops/pay-factory",
    perm: "finance.write" as const,
    title: "จ่ายเจ้าหนี้โรงงาน / ขนส่ง",
    body: "จ่ายเจ้าหนี้โรงงานตามของที่รับ หรือจ่ายเจ้าหนี้ขนส่งและนำเข้าตามยอดที่ตั้งในสมุด",
  },
  {
    href: "/ops/assets",
    perm: "finance.read" as const,
    title: "ทะเบียนทรัพย์",
    body: "ล็อตสินค้าจากใบรับเข้า และทรัพย์สินสำนักงาน",
  },
  {
    href: "/ops/claims",
    perm: "factory.write" as const,
    title: "เคลมสินค้า",
    body: "เคลมโรงงาน ลูกค้า หรือขนส่ง จากของเสีย / ของขาด",
  },
  {
    href: "/ops/issues",
    perm: "orders.read" as const,
    title: "รับแจ้งปัญหา",
    body: "เรื่องจากเว็บสาธารณะและที่เซลล์รับไว้",
  },
  {
    href: "/ops/qr-pay",
    perm: "orders.read" as const,
    title: "QR พร้อมเพย์",
    body: "รวม QR พร้อมเพย์ของใบรับเงินและงวดที่รอชำระ",
  },
];

export default async function OpsCycleHubPage() {
  const actor = await requireOpsPage("orders.read");

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">วงจรปฏิบัติการ</h1>
      <p className="mt-1 text-sm text-ink/70">
        รับของตาม PO · รับเงินตามรายการ · บัญชีอนุมัติสลิป · จ่ายโรงงานตามของที่รับ · ทรัพย์ · เคลม · QR
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {CARDS.filter((card) => actorMay(actor, card.perm)).map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-forest/15 bg-paper p-5 hover:border-brass/50"
          >
            <h2 className="font-semibold text-forest">{card.title}</h2>
            <p className="mt-2 text-sm text-ink/70">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
