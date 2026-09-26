import Link from "next/link";
import { decorationOptionsForProduct } from "@/lib/product-decoration";
import {
  LOGO_DECORATION_HEADING,
  LOGO_DECORATION_INTRO,
  LOGO_MOCKUP_NOTE,
} from "@/lib/ux-copy";

type LogoDecorationPanelProps = {
  productSlug: string;
  hasMockup: boolean;
};

export function LogoDecorationPanel({
  productSlug,
  hasMockup,
}: LogoDecorationPanelProps) {
  const options = decorationOptionsForProduct(productSlug);

  return (
    <section
      id="logo"
      className="mt-10 scroll-mt-28 rounded-3xl border border-forest/10 bg-paper p-5 sm:p-8"
      aria-labelledby="logo-decoration-heading"
    >
      <h2
        id="logo-decoration-heading"
        className="text-2xl font-bold text-forest"
      >
        {LOGO_DECORATION_HEADING}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/75">
        {LOGO_DECORATION_INTRO}
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {options.map((item) => (
          <li
            key={item.value}
            className="rounded-2xl border border-forest/10 bg-forest-mist/40 px-5 py-4"
          >
            <p className="font-semibold text-forest">{item.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink/70">{item.hint}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm leading-relaxed text-ink/65">{LOGO_MOCKUP_NOTE}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {hasMockup ? (
          <Link
            href="#mockup"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-5 text-sm font-semibold text-forest"
          >
            ลองวางโลโก้บนสินค้า
          </Link>
        ) : null}
        <Link
          href="#quote"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-5 text-sm font-semibold text-forest"
        >
          ขอราคาพร้อมระบุวิธีใส่โลโก้
        </Link>
      </div>
    </section>
  );
}
