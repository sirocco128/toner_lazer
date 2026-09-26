import { CatalogSkeleton } from "@/components/CatalogSkeleton";

export default function ProductsLoading() {
  return (
    <div className="bg-premium-mesh">
      <div className="mx-auto max-w-content px-page py-12">
        <CatalogSkeleton />
      </div>
    </div>
  );
}
