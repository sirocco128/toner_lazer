import Link from "next/link";
import { OpsPriceSheet } from "@/components/OpsPriceSheet";
import { PriceRoundTripGuide } from "@/components/PriceRoundTripGuide";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { listOpsCatalog } from "@/lib/ops-pricing";
import {
  sanitizePriceSheetProducts,
  seedPriceSheetProducts,
} from "@/lib/price-sheet-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsPriceSheetPage() {
  const actor = await requireOpsPage("quotes.read");
  const canSeeCost = actorMay(actor, "factory.read");
  const [catalog, seeded] = await Promise.all([
    listOpsCatalog(),
    seedPriceSheetProducts(3),
  ]);
  const initialProducts = sanitizePriceSheetProducts(seeded, canSeeCost);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-forest">ชีตราคา 3 แท็บ</h1>
          <p className="mt-1 text-sm text-ink/70">
            Sheet2 โหลดจากแคตตาล็อกจริง · แก้ qty แล้วพรีวิว Final บน Sheet3
          </p>
        </div>
        <p className="text-sm">
          <Link
            href="/ops/pricing"
            className="text-forest underline-offset-2 hover:underline"
          >
            ← กลับเครื่องคิดราคา
          </Link>
        </p>
      </div>
      <PriceRoundTripGuide variant="price-sheet" />
      <div className="mt-6">
        <OpsPriceSheet
          canSeeCost={canSeeCost}
          catalog={catalog}
          initialProducts={initialProducts}
        />
      </div>
    </div>
  );
}
