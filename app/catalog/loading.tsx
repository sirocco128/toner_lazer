import { CatalogSkeleton } from "@/components/CatalogSkeleton";

export default function CatalogLoading() {
  return (
    <div className="bg-premium-mesh">
      <div className="mx-auto max-w-content px-page py-8">
        <CatalogSkeleton />
      </div>
    </div>
  );
}
