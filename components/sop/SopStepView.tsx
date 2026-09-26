"use client";

import { useState } from "react";
import type { SopStep } from "@/lib/sop-guide-content";

function ScreenshotFrame({
  src,
  alt,
  title,
  path,
}: {
  src: string;
  alt: string;
  title: string;
  path: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="mt-3 overflow-hidden rounded-xl border border-forest/12 bg-forest-mist/40 shadow-[0_12px_40px_-24px_rgba(20,53,42,0.45)]">
      {failed ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(-45deg,#e9f0ea,#e9f0ea_12px,#f7f5f0_12px,#f7f5f0_24px)] px-6 py-16 text-center">
          <p className="text-sm font-medium text-forest">{title}</p>
          <p className="text-xs text-ink/55">
            ยังไม่มีภาพหน้าจอ — รัน <code>npm run sop:screenshots</code>
          </p>
          <p className="text-xs text-ink/45">{path}</p>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          width={1440}
          height={900}
          className="mx-auto max-h-[min(48dvh,22rem)] w-auto max-w-full bg-paper object-contain object-top"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption className="border-t border-forest/10 bg-paper px-4 py-2.5 text-xs text-ink/60">
        {title} — {path}
      </figcaption>
    </figure>
  );
}

export function SopStepView({ step }: { step: SopStep }) {
  return (
    <article className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass">
        {step.role}
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-forest sm:text-3xl">
        {step.title}
      </h2>
      <p className="mt-2 text-sm text-ink/65">
        หน้าจอ:{" "}
        <code className="rounded bg-forest-mist/80 px-1.5 py-0.5 text-forest">
          {step.opsPath}
        </code>
        {step.customerPath ? (
          <>
            {" "}
            · ลูกค้า:{" "}
            <code className="rounded bg-forest-mist/80 px-1.5 py-0.5 text-forest">
              {step.customerPath}
            </code>
          </>
        ) : null}
      </p>

      <section className="mt-8">
        <h3 className="text-sm font-semibold text-forest">จุดประสงค์</h3>
        <p className="mt-2 max-w-prose text-base leading-relaxed text-ink/85">
          {step.purpose}
        </p>
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-semibold text-forest">หน้าจอจริง</h3>
        <ScreenshotFrame
          src={`/sop/screenshots/${step.screenshot}`}
          alt={`ภาพหน้าจอ ${step.title}`}
          title={step.title}
          path={step.opsPath}
        />
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-semibold text-forest">ทำงานอย่างไร</h3>
        <ol className="mt-3 max-w-prose list-decimal space-y-2 pl-5 text-base leading-relaxed text-ink/85">
          {step.howTo.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>

      {step.donts.length > 0 ? (
        <section className="mt-8 rounded-xl border border-red-200/80 bg-red-50/70 px-4 py-4">
          <h3 className="text-sm font-semibold text-red-900">ข้อห้าม / จุดหยุด</h3>
          <ul className="mt-2 max-w-prose list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-red-950/85">
            {step.donts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
