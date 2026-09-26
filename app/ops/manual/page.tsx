import { Suspense } from "react";
import { requireOpsPage } from "@/lib/ops-auth";
import { ROLE_LABELS } from "@/lib/ops-roles";
import {
  OPS_MANUAL_GROUP_LABELS,
  OPS_MANUAL_GROUPS,
} from "@/lib/ops-manual-catalog";
import { buildManualToc } from "@/lib/ops-manual-loader";
import { OpsManualApp } from "@/components/ops/OpsManualApp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsManualPage() {
  const actor = await requireOpsPage();
  const toc = buildManualToc(actor);

  return (
    <Suspense
      fallback={
        <p className="text-sm text-ink/60">กำลังโหลดคู่มือการทำงาน…</p>
      }
    >
      <OpsManualApp
        actor={{
          email: actor.email,
          name: actor.name,
          role: actor.role,
          roleLabel: ROLE_LABELS[actor.role],
        }}
        groups={OPS_MANUAL_GROUPS.map((id) => ({
          id,
          label: OPS_MANUAL_GROUP_LABELS[id],
        }))}
        initialToc={toc}
      />
    </Suspense>
  );
}
