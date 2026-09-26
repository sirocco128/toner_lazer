import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FactoryPoForm } from "@/components/FactoryPoForm";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { draftFromOrder } from "@/lib/factory-po-queries";
import { listFactoriesForPoForm } from "@/lib/factory-registry-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ orderId?: string }>;

export default async function NewFactoryPoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireOpsPage("factory.write");
  if (!actorMay(actor, "factory.write")) redirect("/ops/quotes");

  const sp = await searchParams;
  const orderId = (sp.orderId || "").trim();
  if (!orderId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-forest">สร้างใบสั่งโรงงาน</h1>
        <p className="mt-3 text-sm text-ink/70">
          เปิดใบสั่งจากหน้ารายละเอียดออเดอร์ลูกค้า เพื่อดึงสเปคและที่อยู่จัดส่งมาให้ครบ
        </p>
        <p className="mt-4 text-sm">
          <Link href="/ops/orders" className="text-forest underline">
            ไปที่รายการออเดอร์
          </Link>
        </p>
      </div>
    );
  }

  const draft = draftFromOrder(orderId);
  if (!draft) notFound();

  return (
    <div>
      <p className="text-sm">
        <Link href={`/ops/orders/${orderId}`} className="text-forest underline-offset-2 hover:underline">
          ← ออเดอร์ {orderId}
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">สร้างใบสั่งโรงงาน</h1>
      <div className="mt-6">
        <FactoryPoForm
          orderId={orderId}
          defaults={draft}
          factories={listFactoriesForPoForm()}
        />
      </div>
    </div>
  );
}
