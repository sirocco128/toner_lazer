import Link from "next/link";
import { RecentOrderHint } from "@/components/RecentOrderHint";
import { formatOpeningHoursDisplay, formatRegisteredAddress } from "@/lib/company";
import { getPublicContact } from "@/lib/public-contact";
import { site } from "@/lib/site";
import { ACCOUNT_HUB_TITLE } from "@/lib/ux-copy";

const SERVICE_LINKS = [
  { href: "/premium-giftset", label: "ชุดของขวัญองค์กร" },
  { href: "/products", label: "สินค้าพรีเมียม — เลือกขอราคา" },
  { href: "/catalog", label: "สมุดแคตตาล็อก — พลิกดู" },
  { href: "/ideas", label: "ไอเดียชุดของขวัญ" },
  { href: "/customize-gift-set", label: "ออกแบบเซ็ตเอง" },
  { href: "/portfolio", label: "ผลงาน" },
  { href: "/blog", label: "บทความ" },
  { href: "/contact", label: "ติดต่อขอใบเสนอราคา" },
] as const;

const INFO_LINKS = [
  { href: "/about", label: "เกี่ยวกับเรา" },
  { href: "/privacy", label: "นโยบายความเป็นส่วนตัว" },
  { href: "/terms", label: "ข้อกำหนดการใช้งาน" },
] as const;

export function Footer() {
  const year = new Date().getFullYear();
  const contact = getPublicContact(site);
  const address = formatRegisteredAddress({
    streetAddress: site.localBusiness.streetAddress,
    locality: site.localBusiness.locality,
    region: site.localBusiness.region,
    postalCode: site.localBusiness.postalCode,
  });
  const hours = formatOpeningHoursDisplay(site.localBusiness.openingHours);

  return (
    <footer className="mt-auto border-t border-white/10 bg-forest text-paper">
      <div className="mx-auto grid max-w-content gap-8 px-page py-10 sm:gap-10 sm:py-12 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xl font-bold text-brass-soft">{site.name}</p>
          <p className="mt-3 text-sm leading-relaxed text-paper/80">
            {site.description}
          </p>
          {site.legalName ? (
            <p className="mt-4 text-xs text-paper/60">นิติบุคคล: {site.legalName}</p>
          ) : null}
          {site.taxId ? (
            <p className="mt-1 text-xs text-paper/60">
              เลขประจำตัวผู้เสียภาษี: {site.taxId}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brass-soft">
            บริการ
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {SERVICE_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-paper/85 hover:text-brass-soft">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brass-soft">
            ติดต่อ
          </p>
          <ul className="mt-4 space-y-2 text-sm text-paper/85">
            {contact.showPhone ? (
              <li>
                <a href={site.phoneHref} className="hover:text-brass-soft">
                  โทร {site.phoneDisplay}
                </a>
              </li>
            ) : null}
            {contact.showEmail ? (
              <li>
                <a href={`mailto:${site.email}`} className="hover:text-brass-soft">
                  {site.email}
                </a>
              </li>
            ) : null}
            {contact.showLine ? (
              <li>
                <a
                  href={site.lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brass-soft"
                >
                  แชทไลน์ {site.lineId}
                </a>
              </li>
            ) : (
              <li>
                <Link href="/contact?intent=message" className="hover:text-brass-soft">
                  ส่งข้อความติดต่อ
                </Link>
              </li>
            )}
            {address ? (
              <li className="pt-2 text-paper/70">{address}</li>
            ) : null}
            {hours ? (
              <li className="text-paper/70">เวลาทำการ: {hours}</li>
            ) : null}
          </ul>
          <ul className="mt-6 space-y-2 text-sm">
            {INFO_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-paper/85 hover:text-brass-soft">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/account" className="text-paper/85 hover:text-brass-soft">
                {ACCOUNT_HUB_TITLE}
              </Link>
            </li>
            <RecentOrderHint variant="footer" />
          </ul>
        </div>
      </div>
      <div className="border-t border-paper/10 px-page py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-paper/55">
        © {year} {site.legalName || site.name}. สงวนลิขสิทธิ์.
      </div>
    </footer>
  );
}
