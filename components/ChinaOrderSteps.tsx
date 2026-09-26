import { CHINA_AFTER_ORDER_HEADING, CHINA_AFTER_ORDER_INTRO, CHINA_AFTER_ORDER_STEPS } from "@/lib/ux-copy";

type ChinaOrderStepsProps = {
  heading?: string;
  variant?: "light" | "dark";
  className?: string;
};

export function ChinaOrderSteps({
  heading = CHINA_AFTER_ORDER_HEADING,
  variant = "light",
  className = "",
}: ChinaOrderStepsProps) {
  const dark = variant === "dark";

  return (
    <section
      id="china-flow"
      className={`scroll-mt-28 ${className}`.trim()}
      aria-labelledby="china-order-heading"
    >
      <h2
        id="china-order-heading"
        className={`text-2xl font-bold sm:text-3xl ${dark ? "text-paper" : "text-forest"}`}
      >
        {heading}
      </h2>
      <p
        className={`mt-3 max-w-2xl text-sm leading-relaxed sm:text-base ${
          dark ? "text-paper/80" : "text-ink/75"
        }`}
      >
        {CHINA_AFTER_ORDER_INTRO}
      </p>
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CHINA_AFTER_ORDER_STEPS.map((item) => (
          <li
            key={item.step}
            className={`rounded-2xl p-5 ${
              dark
                ? "border border-paper/15"
                : "border border-forest/10 bg-paper"
            }`}
          >
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                dark ? "bg-brass text-forest" : "bg-forest text-paper"
              }`}
              aria-hidden
            >
              {item.step}
            </span>
            <h3
              className={`mt-4 text-lg font-semibold ${dark ? "text-paper" : "text-forest"}`}
            >
              {item.title}
            </h3>
            <p
              className={`mt-2 text-sm leading-relaxed ${
                dark ? "text-paper/75" : "text-ink/70"
              }`}
            >
              {item.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
