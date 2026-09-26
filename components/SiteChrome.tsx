"use client";

import { usePathname } from "next/navigation";

/** Hide public chrome on /ops console routes. */
export function SiteChrome({
  children,
  chrome,
}: {
  children: React.ReactNode;
  chrome: React.ReactNode;
}) {
  const pathname = usePathname() || "/";
  const isOps = pathname === "/ops" || pathname.startsWith("/ops/");
  const isSop = pathname === "/sop" || pathname.startsWith("/sop/");
  if (isOps || isSop) return <>{children}</>;
  return (
    <>
      <div className="print:hidden">{chrome}</div>
      {children}
    </>
  );
}
