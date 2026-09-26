"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  SOP_GUIDE_WORKFLOWS,
  findSopStep,
  findSopWorkflow,
  type SopWorkflow,
} from "@/lib/sop-guide-content";
import { SopStepView } from "@/components/sop/SopStepView";
import { sopLogoutAction } from "@/app/actions/sop-guide";

function filterWorkflows(query: string): SopWorkflow[] {
  const q = query.trim().toLocaleLowerCase("th");
  if (!q) return SOP_GUIDE_WORKFLOWS;
  return SOP_GUIDE_WORKFLOWS.flatMap((workflow) => {
    if (workflow.title.toLocaleLowerCase("th").includes(q)) return [workflow];
    const steps = workflow.steps.filter(
      (step) =>
        step.title.toLocaleLowerCase("th").includes(q) ||
        step.opsPath.toLocaleLowerCase("th").includes(q) ||
        step.purpose.toLocaleLowerCase("th").includes(q),
    );
    if (!steps.length) return [];
    return [{ ...workflow, steps }];
  });
}

export function SopGuideApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [, startLogout] = useTransition();

  const workflows = useMemo(() => filterWorkflows(query), [query]);

  const workflowId =
    searchParams.get("w") || SOP_GUIDE_WORKFLOWS[0]?.id || "start";
  const stepId =
    searchParams.get("s") ||
    findSopWorkflow(workflowId)?.steps[0]?.id ||
    SOP_GUIDE_WORKFLOWS[0]?.steps[0]?.id ||
    "";

  const activeWorkflow =
    findSopWorkflow(workflowId) || SOP_GUIDE_WORKFLOWS[0];
  const activeStep =
    findSopStep(stepId) || activeWorkflow?.steps[0] || SOP_GUIDE_WORKFLOWS[0]?.steps[0];

  useEffect(() => {
    if (!activeWorkflow || !activeStep) return;
    if (
      searchParams.get("w") === activeWorkflow.id &&
      searchParams.get("s") === activeStep.id
    ) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("w", activeWorkflow.id);
    params.set("s", activeStep.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeWorkflow, activeStep, pathname, router, searchParams]);

  function selectStep(nextWorkflowId: string, nextStepId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("w", nextWorkflowId);
    params.set("s", nextStepId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setNavOpen(false);
  }

  const stepIndex = activeWorkflow
    ? activeWorkflow.steps.findIndex((s) => s.id === activeStep?.id)
    : -1;

  function goRelative(delta: number) {
    if (!activeWorkflow || stepIndex < 0) return;
    const next = activeWorkflow.steps[stepIndex + delta];
    if (next) {
      selectStep(activeWorkflow.id, next.id);
      return;
    }
    const wi = SOP_GUIDE_WORKFLOWS.findIndex((w) => w.id === activeWorkflow.id);
    const neighbor = SOP_GUIDE_WORKFLOWS[wi + delta];
    if (!neighbor?.steps.length) return;
    const target =
      delta > 0 ? neighbor.steps[0] : neighbor.steps[neighbor.steps.length - 1];
    if (!target) return;
    selectStep(neighbor.id, target.id);
  }

  return (
    <div className="sop-guide relative min-h-dvh bg-[linear-gradient(165deg,#f4f7f4_0%,#e9f0ea_42%,#f7f5f0_100%)] text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,_rgba(230,83,18,0.2),_transparent_60%)]"
      />

      <header className="sticky top-0 z-40 border-b border-forest/10 bg-forest/95 text-paper backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="rounded-lg border border-paper/20 px-2.5 py-1.5 text-sm lg:hidden"
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
            aria-controls="sop-sidebar"
          >
            เมนู
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-soft">
              คู่มือปฏิบัติงาน
            </p>
            <h1 className="truncate font-display text-lg font-semibold tracking-tight sm:text-xl">
              SOP · คอนโซล Ops
            </h1>
          </div>
          <button
            type="button"
            className="rounded-lg border border-paper/25 px-3 py-1.5 text-xs font-medium hover:bg-paper/10"
            onClick={() => startLogout(() => sopLogoutAction())}
          >
            ปิดการอ่าน
          </button>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-7xl gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          id="sop-sidebar"
          className={`border-forest/10 bg-paper/90 backdrop-blur-sm lg:sticky lg:top-[57px] lg:h-[calc(100dvh-57px)] lg:overflow-y-auto lg:border-r ${
            navOpen
              ? "fixed inset-x-0 top-[57px] z-30 max-h-[calc(100dvh-57px)] overflow-y-auto border-b shadow-lg lg:static lg:shadow-none"
              : "hidden lg:block"
          }`}
        >
          <div className="p-4">
            <label className="block text-xs font-medium text-forest">
              ค้นหาเมนู / ขั้นตอน
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="เช่น มัดจำ, โรงงาน, ใบเสนอราคา"
                className="mt-1.5 w-full rounded-lg border border-forest/15 bg-forest-mist/50 px-3 py-2 text-sm"
              />
            </label>

            <nav className="mt-5 space-y-5" aria-label="Workflow SOP">
              {workflows.map((workflow) => (
                <div key={workflow.id}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brass">
                    {workflow.title}
                  </p>
                  <p className="mt-1 text-xs leading-snug text-ink/55">
                    {workflow.summary}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {workflow.steps.map((step) => {
                      const active = step.id === activeStep?.id;
                      return (
                        <li key={step.id}>
                          <button
                            type="button"
                            onClick={() => selectStep(workflow.id, step.id)}
                            className={`w-full rounded-lg px-2.5 py-2 text-left text-sm transition ${
                              active
                                ? "bg-forest text-paper"
                                : "text-ink/80 hover:bg-forest-mist"
                            }`}
                          >
                            {step.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {!workflows.length ? (
                <p className="text-sm text-ink/60">ไม่พบขั้นตอนที่ตรงคำค้น</p>
              ) : null}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-8 sm:px-8 sm:py-10">
          {activeStep ? <SopStepView step={activeStep} /> : null}

          <div className="mt-10 flex flex-wrap gap-3 border-t border-forest/10 pt-6">
            <button
              type="button"
              onClick={() => goRelative(-1)}
              className="rounded-lg border border-forest/20 bg-paper px-4 py-2 text-sm font-medium text-forest hover:bg-forest-mist"
            >
              ← ก่อนหน้า
            </button>
            <button
              type="button"
              onClick={() => goRelative(1)}
              className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-paper hover:bg-forest-light"
            >
              ถัดไป →
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
