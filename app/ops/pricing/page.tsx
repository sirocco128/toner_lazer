import Link from "next/link";
import { OpsPricingCalculator } from "@/components/OpsPricingCalculator";
import { getFxGuide } from "@/lib/fx-rates";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { listOpsCatalog } from "@/lib/ops-pricing";
import { getSiteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ slug?: string }>;

export default async function OpsPricingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireOpsPage("quotes.read");
  const sp = await searchParams;
  const catalog = await listOpsCatalog();
  const fx = await getFxGuide();
  const site = getSiteConfig();
  const canSeeCost = actorMay(actor, "factory.read");

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">คิดราคาทีละชุด</h1>
      <p className="mt-1 text-sm text-ink/70">
        ใส่รหัสหรือชื่อชุด → กดดูราคา → เลือกจำนวนเพื่อรีเช็คสูตร
        {canSeeCost ? "" : " · เซลล์เห็นเฉพาะราคาขาย"}
      </p>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link
          href="/ops/price-sheet"
          className="text-forest underline-offset-2 hover:underline"
        >
          ชีตราคา 3 แท็บ (หลายรายการ + พรีวิว) →
        </Link>
        <Link
          href="/ops/products"
          className="text-forest underline-offset-2 hover:underline"
        >
          ดาวน์โหลด Excel จากรหัสขาย →
        </Link>
        <Link
          href="/ops/pricing/import"
          className="text-forest underline-offset-2 hover:underline"
        >
          อัปเดตราคาจาก Excel ขึ้นเว็บ →
        </Link>
      </p>
      <div className="mt-6">
        <OpsPricingCalculator
          catalog={catalog}
          canSeeCost={canSeeCost}
          initialSlug={(sp.slug || "").trim() || undefined}
          fxGuide={{
            cnyThb: fx.cnyThb,
            source: fx.source,
            live: fx.live,
          }}
          brand={{
            name: site.name,
            legalName: site.legalName,
            phone: site.phoneDisplay,
            email: site.email,
            lineId: site.lineId,
          }}
        />
      </div>
    </div>
  );
}
