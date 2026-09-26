import { CatalogImage } from "@/components/CatalogImage";
import { skuOpsImageSrc } from "@/lib/product-media";
import { cn } from "@/lib/utils";

export function SkuThumb({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-block h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-forest-mist",
        className,
      )}
    >
      <CatalogImage
        src={skuOpsImageSrc(src)}
        alt={alt}
        sizes="48px"
        className="rounded-lg group-hover:scale-100"
      />
    </span>
  );
}
