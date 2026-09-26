import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BillingDocumentView } from "@/components/BillingDocumentView";
import { DocumentPreviewShell } from "@/components/DocumentPreviewShell";
import { getPublicOrder } from "@/lib/order-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "เอกสารทางบัญชี",
  robots: { index: false, follow: false },
};

type Params = Promise<{ orderId: string; documentId: string }>;
type Search = Promise<{ t?: string }>;

export default async function PublicBillingDocumentPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { orderId, documentId } = await params;
  const { t: token } = await searchParams;
  if (!token) notFound();
  const bundle = getPublicOrder(orderId, token);
  const document = bundle?.documents.find((d) => d.documentId === documentId);
  if (!document) notFound();

  const backToken = token ? `?t=${encodeURIComponent(token)}` : "";
  return (
    <div className="px-4 py-10 print:px-0 print:py-0">
      <DocumentPreviewShell
        backHref={`/orders/${orderId}${backToken}`}
        backLabel="← กลับออเดอร์"
        fileName={document.documentId}
      >
        <BillingDocumentView document={document} />
      </DocumentPreviewShell>
    </div>
  );
}
