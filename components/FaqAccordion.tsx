"use client";

import { useId, useState } from "react";
import type { Faq } from "@/lib/data";

type FaqAccordionProps = {
  faqs: Faq[];
};

export function FaqAccordion({ faqs }: FaqAccordionProps) {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!faqs.length) {
    return <p className="text-ink/70">ยังไม่มีคำถามที่พบบ่อย</p>;
  }

  return (
    <div className="divide-y divide-forest/10 rounded-2xl border border-forest/10 bg-paper">
      {faqs.map((faq, index) => {
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;
        const isOpen = openIndex === index;

        return (
          <div key={`${faq.question}-${index}`} className="px-4 sm:px-5">
            <h3 className="m-0">
              <button
                id={buttonId}
                type="button"
                className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-semibold text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <span>{faq.question}</span>
                <span
                  aria-hidden
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass transition-transform ${isOpen ? "rotate-45" : ""}`}
                >
                  +
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="pb-4 text-ink/80 leading-relaxed"
            >
              {isOpen ? <p className="m-0">{faq.answer}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
