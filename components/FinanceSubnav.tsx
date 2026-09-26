import Link from "next/link";

const LINKS = [
  { href: "/ops/finance", label: "ภาพรวม" },
  { href: "/ops/finance/coa", label: "ผังบัญชี" },
  { href: "/ops/finance/journals", label: "สมุดรายวัน" },
  { href: "/ops/finance/ledger", label: "สมุดแยกประเภท" },
  { href: "/ops/finance/trial-balance", label: "งบทดลอง" },
  { href: "/ops/finance/balance-sheet", label: "งบดุล" },
  { href: "/ops/finance/cash-flow", label: "งบกระแสเงินสด" },
  { href: "/ops/finance/manual", label: "ใบสำคัญทั่วไป" },
] as const;

export function FinanceSubnav({ current }: { current: string }) {
  return (
    <nav className="h-scroll text-sm" aria-label="การเงิน">
      {LINKS.map((link) => {
        const active =
          link.href === "/ops/finance"
            ? current === "/ops/finance"
            : current === link.href || current.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "shrink-0 rounded-full bg-forest px-3 py-1.5 text-paper"
                : "shrink-0 rounded-full border border-forest/20 px-3 py-1.5 text-forest hover:bg-forest/10"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
