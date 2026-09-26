import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "คู่มือ SOP · Ops",
};

export default function SopLayout({ children }: { children: React.ReactNode }) {
  return <div className="sop-shell min-h-dvh">{children}</div>;
}
