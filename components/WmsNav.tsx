import Link from "next/link";

const LINKS = [
  { href: "/ops/stock", label: "คงเหลือ" },
  { href: "/ops/inbound", label: "รับเข้า" },
  { href: "/ops/stock/movements", label: "เคลื่อนไหว" },
  { href: "/ops/stock/adjust", label: "ปรับ / โอน" },
  { href: "/ops/stock/counts", label: "ตรวจนับ" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/ops/stock") {
    return (
      pathname === "/ops/stock" ||
      (pathname.startsWith("/ops/stock/") &&
        !pathname.startsWith("/ops/stock/movements") &&
        !pathname.startsWith("/ops/stock/adjust") &&
        !pathname.startsWith("/ops/stock/counts"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WmsNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="เมนูคลัง" className="mt-4 flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "rounded-lg bg-forest px-3 py-2 text-sm font-medium text-paper"
                : "rounded-lg border border-forest/25 bg-paper px-3 py-2 text-sm font-medium text-forest hover:border-forest/50"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
