import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CustomerAuthPanel } from "@/components/CustomerAuthPanel";
import { OrderLookupForm } from "@/components/OrderLookupForm";
import {
  ACCOUNT_HUB_TITLE,
  ORDER_TRACKING_INTRO,
} from "@/lib/ux-copy";

export const metadata: Metadata = {
  title: "ติดตามออเดอร์และชำระเงิน",
  robots: { index: false, follow: false },
};

export default function OrdersLookupPage() {
  return (
    <div className="mx-auto max-w-2xl px-page py-12 sm:py-16">
      <Breadcrumbs
        items={[
          { href: "/account", label: ACCOUNT_HUB_TITLE },
          { label: "ออเดอร์ของฉัน" },
        ]}
      />
      <h1 className="text-3xl font-bold text-forest">ออเดอร์และการชำระเงิน</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink/80">
        {ORDER_TRACKING_INTRO}
      </p>
      <div className="mt-8">
        <CustomerAuthPanel />
      </div>
      <div className="mt-8">
        <OrderLookupForm />
      </div>
    </div>
  );
}
