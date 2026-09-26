import type { Metadata } from "next";
import { P2ComingSoon } from "@/components/P2ComingSoon";
import { QuoteBasketPanel } from "@/components/QuoteBasketPanel";
import { isP2QuoteToolsEnabled } from "@/lib/feature-flags";
import { metadataForPath } from "@/lib/page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/quote-basket");
}

export default function QuoteBasketPage() {
  if (!isP2QuoteToolsEnabled()) {
    return (
      <P2ComingSoon
        title="ตะกร้าใบเสนอราคายังไม่พร้อม"
        description="ขณะนี้ยังเปิดใช้เฉพาะแบบฟอร์มขอใบเสนอราคาหลัก คุณยังเลือกสินค้าแล้วกดขอราคาได้ตามปกติ"
      />
    );
  }

  return (
    <div className="mx-auto max-w-content px-page py-12 sm:py-16">
      <QuoteBasketPanel />
    </div>
  );
}
