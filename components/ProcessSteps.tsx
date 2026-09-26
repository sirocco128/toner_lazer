import { HOW_IT_WORKS } from "@/lib/ux-copy";

type ProcessStepsProps = {
  heading?: string;
  className?: string;
};

export function ProcessSteps({
  heading = "สั่งผลิตอย่างไร",
  className = "",
}: ProcessStepsProps) {
  return (
    <section className={className} aria-labelledby="process-steps-heading">
      <h2
        id="process-steps-heading"
        className="text-2xl font-bold text-forest sm:text-3xl"
      >
        {heading}
      </h2>
      <p className="mt-3 max-w-2xl text-ink/75">
        ไม่ใช่ร้านค้าออนไลน์ชำระเงินทันที — เป็นบริการรับผลิตของขวัญองค์กรแบบขอใบเสนอราคา
      </p>
      <ol className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {HOW_IT_WORKS.map((item) => (
          <li
            key={item.step}
            className="relative rounded-2xl border border-forest/10 bg-paper/90 px-5 py-6 shadow-sm backdrop-blur-md"
          >
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brass text-sm font-bold text-paper"
              aria-hidden
            >
              {item.step}
            </span>
            <h3 className="mt-4 text-lg font-semibold text-forest">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">{item.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
