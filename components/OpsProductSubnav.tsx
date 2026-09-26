import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "sku", href: "/ops/products", label: "รหัสขาย" },
  { id: "ori", href: "/ops/products/ori", label: "รหัสโรงงาน" },
  { id: "groups", href: "/ops/products/groups", label: "กลุ่ม" },
  { id: "colors", href: "/ops/products/colors", label: "สี" },
] as const;

export type OpsProductTab = (typeof TABS)[number]["id"];

export function OpsProductSubnav({ current }: { current: OpsProductTab }) {
  return (
    <nav className="h-scroll" aria-label="สินค้า">
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
