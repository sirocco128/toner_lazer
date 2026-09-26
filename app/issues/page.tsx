import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { IssueReportForm } from "@/components/IssueReportForm";
import { getPublicOrder } from "@/lib/order-service";
import {
  ACCOUNT_HUB_TITLE,
  ISSUE_REPORT_INTRO,
} from "@/lib/ux-copy";

export const metadata: Metadata = {
  title: "แจ้งปัญหาสินค้า",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Search = Promise<{ orderId?: string; t?: string }>;

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { orderId: rawOrderId, t: token } = await searchParams;
  const orderId = rawOrderId?.trim() || "";
  const accessToken = token?.trim() || "";

  let prefill: {
    orderId: string;
    token: string;
    company: string;
    contactName: string;
    email: string;
    phone: string;
  } | null = null;

  if (orderId && accessToken) {
    const bundle = getPublicOrder(orderId, accessToken);
    if (bundle) {
      prefill = {
        orderId: bundle.order.orderId,
        token: accessToken,
        company: bundle.order.company || "",
        contactName: bundle.order.contactName || "",
        email: bundle.order.email || "",
        phone: bundle.order.phone || "",
      };
    }
  }

  return (
    <div className="mx-auto max-w-xl px-page py-12 sm:py-16">
      <Breadcrumbs
        items={[
          { href: "/account", label: ACCOUNT_HUB_TITLE },
          { label: "แจ้งปัญหา" },
        ]}
      />
      <h1 className="text-3xl font-bold text-forest">แจ้งปัญหาสินค้า</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink/80">{ISSUE_REPORT_INTRO}</p>
      {prefill ? (
        <p className="mt-3 rounded-xl border border-forest/15 bg-forest-mist/40 px-3 py-2 text-sm text-forest">
          กำลังแจ้งปัญหาสำหรับออเดอร์{" "}
          <span className="font-mono font-semibold">{prefill.orderId}</span>
        </p>
      ) : null}
      <div className="mt-8">
        <IssueReportForm prefill={prefill} />
      </div>
    </div>
  );
}
