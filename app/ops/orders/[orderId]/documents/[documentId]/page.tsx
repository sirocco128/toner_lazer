import { notFound } from "next/navigation";
import { BillingDocumentView } from "@/components/BillingDocumentView";
import { DocumentPreviewShell } from "@/components/DocumentPreviewShell";
import { requireOpsPage } from "@/lib/ops-auth";
import { getOrderBundle } from "@/lib/order-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ orderId: string; documentId: string }>;

export default async function OpsBillingDocumentPage({
  params,
}: {
  params: Params;
}) {
  await requireOpsPage("orders.read");
  const { orderId, documentId } = await params;
  const bundle = getOrderBundle(orderId);
  const document = bundle?.documents.find((d) => d.documentId === documentId);
  if (!document) notFound();

  return (
    <DocumentPreviewShell
      backHref={`/ops/orders/${orderId}`}
      backLabel="← กลับออเดอร์"
      fileName={document.documentId}
    >
      <BillingDocumentView document={document} />
    </DocumentPreviewShell>
  );
}
