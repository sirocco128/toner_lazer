import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CustomerAuthPanel } from "@/components/CustomerAuthPanel";
import { RecentOrderHint } from "@/components/RecentOrderHint";
import {
  ACCOUNT_HUB_INTRO,
  ACCOUNT_HUB_ISSUES_BODY,
  ACCOUNT_HUB_ISSUES_TITLE,
  ACCOUNT_HUB_NEED_ORDER,
  ACCOUNT_HUB_ORDERS_BODY,
  ACCOUNT_HUB_ORDERS_TITLE,
  ACCOUNT_HUB_TITLE,
} from "@/lib/ux-copy";

/*
 * Quick DDP:
 * User=procurement / admin who already ordered — calm, needs the right door fast
 * Tension: Secure BUT frictionless
 * Aesthetic: existing forest/brass editorial (brand system) — hub of two doors, not a dashboard
 * UX: hub-first; lookup only after choosing a door
 */

export const metadata: Metadata = {
  title: ACCOUNT_HUB_TITLE,
  robots: { index: false, follow: false },
};

export default function AccountHubPage() {
  return (
    <div className="relative mx-auto max-w-2xl px-page py-12 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 bg-[radial-gradient(ellipse_at_top,_rgba(230,83,18,0.14),_transparent_70%)]"
      />
      <Breadcrumbs items={[{ label: ACCOUNT_HUB_TITLE }]} />
      <h1 className="relative text-3xl font-bold tracking-tight text-forest sm:text-4xl">
        {ACCOUNT_HUB_TITLE}
      </h1>
      <p className="relative mt-4 max-w-xl text-sm leading-relaxed text-ink/80">
        {ACCOUNT_HUB_INTRO}
      </p>

      <div className="relative mt-6">
        <CustomerAuthPanel />
      </div>

      <div className="relative mt-6">
        <RecentOrderHint variant="hub" />
      </div>

      <div className="relative mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/orders"
          className="group flex flex-col rounded-2xl border border-forest/15 bg-paper p-6 shadow-[0_1px_0_rgba(20,53,42,0.04)] transition hover:border-brass/50 hover:bg-forest-mist/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <span className="text-lg font-semibold text-forest group-hover:text-forest">
            {ACCOUNT_HUB_ORDERS_TITLE}
          </span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">
            {ACCOUNT_HUB_ORDERS_BODY}
          </span>
          <span className="mt-5 text-sm font-semibold text-brass-soft">เปิดดูออเดอร์ →</span>
        </Link>

        <Link
          href="/issues"
          className="group flex flex-col rounded-2xl border border-forest/15 bg-paper p-6 shadow-[0_1px_0_rgba(20,53,42,0.04)] transition hover:border-brass/50 hover:bg-forest-mist/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <span className="text-lg font-semibold text-forest">
            {ACCOUNT_HUB_ISSUES_TITLE}
          </span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">
            {ACCOUNT_HUB_ISSUES_BODY}
          </span>
          <span className="mt-5 text-sm font-semibold text-brass-soft">แจ้งปัญหา →</span>
        </Link>
      </div>

      <p className="relative mt-10 text-sm text-ink/65">
        {ACCOUNT_HUB_NEED_ORDER}{" "}
        <Link
          href="/contact"
          className="font-medium text-forest underline-offset-2 hover:underline"
        >
          ขอใบเสนอราคา
        </Link>
      </p>
    </div>
  );
}
