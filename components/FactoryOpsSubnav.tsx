import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "po", href: "/ops/factory-po", label: "ใบสั่งโรงงาน" },
  { id: "registry", href: "/ops/factories", label: "ทะเบียนโรงงาน" },
] as const;

export function FactoryOpsSubnav({ current }: { current: "po" | "registry" }) {
  return (
    <nav className="mt-4 h-scroll" aria-label="โรงงาน">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm",
            current === tab.id
              ? "border-forest bg-forest text-paper"
              : "border-forest/20 bg-paper text-ink/70",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
