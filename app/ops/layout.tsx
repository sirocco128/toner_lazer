import Link from "next/link";
import type { Metadata } from "next";
import { getOpsActor, isOpsAuthConfigured } from "@/lib/ops-auth";
import { opsDeskUserLine } from "@/lib/ops-desk-guard";
import { buildOpsNavLinks, opsActorLabel } from "@/lib/ops-nav";
import { OpsNav } from "@/components/OpsNav";
import { OPS_CONSOLE_KICKER, OPS_CONSOLE_TITLE } from "@/lib/ux-copy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: `${OPS_CONSOLE_TITLE} · ${OPS_CONSOLE_KICKER}`,
};

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isOpsAuthConfigured();
  const actor = configured ? await getOpsActor() : null;

  if (actor) {
    return (
      <div className="ops-shell min-h-dvh bg-forest-mist/40 text-ink">
        <OpsNav
          actorLabel={opsActorLabel(actor)}
          watermarkUser={opsDeskUserLine(actor)}
          links={buildOpsNavLinks(actor)}
        >
          {children}
        </OpsNav>
      </div>
    );
  }

  return (
    <div className="ops-shell min-h-dvh bg-forest-mist/40 text-ink">
      <header className="sticky top-0 z-30 border-b border-forest/10 bg-forest text-paper print:hidden pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl min-w-0 flex-wrap items-center gap-3 px-page py-3">
          <Link href="/ops" className="text-lg font-semibold tracking-tight">
            <span className="text-brass-soft">{OPS_CONSOLE_TITLE}</span>
            <span className="ml-2 text-sm font-medium text-paper/70">{OPS_CONSOLE_KICKER}</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl overflow-x-auto px-page py-6 sm:py-8 print:max-w-none print:overflow-visible print:px-0 print:py-0">
        {children}
      </main>
    </div>
  );
}
