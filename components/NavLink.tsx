"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  title?: string;
  onClick?: () => void;
};

export function NavLink({
  href,
  children,
  className = "",
  activeClassName = "",
  title,
  onClick,
}: NavLinkProps) {
  const pathname = usePathname() || "/";
  const active = isNavActive(pathname, href);

  return (
    <Link
      href={href}
      title={title}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(className, active && activeClassName)}
    >
      {children}
    </Link>
  );
}
