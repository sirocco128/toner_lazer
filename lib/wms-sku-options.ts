import { listSkus } from "@/lib/sku-master-repository";
import { skuMasterTablesReady } from "@/lib/sku-master-schema";
import { listBalances } from "@/lib/wms-repository";

export type WmsSkuKeyOption = {
  productId: string;
  label: string;
};

/** Merge SKU master + keys already in balances for datalist pickers. */
export async function getWmsSkuKeyOptions(
  limit = 300,
): Promise<WmsSkuKeyOption[]> {
  const byId = new Map<string, WmsSkuKeyOption>();

  for (const bal of listBalances({ limit: 500 })) {
    const id = bal.productKey;
    if (!byId.has(id)) {
      byId.set(id, {
        productId: id,
        label: `${id} · ในคลัง ${bal.qtyOnHand}`,
      });
    }
  }

  try {
    if (await skuMasterTablesReady()) {
      const skus = await listSkus({ limit });
      for (const s of skus) {
        const existing = byId.get(s.productId);
        byId.set(s.productId, {
          productId: s.productId,
          label: `${s.productId} · ${s.nameTh}${
            s.oriProductCode ? ` · ${s.oriProductCode}` : ""
          }${existing ? ` · สต็อก` : ""}`,
        });
      }
    }
  } catch {
    /* MySQL optional */
  }

  return [...byId.values()].sort((a, b) =>
    a.productId.localeCompare(b.productId, "en"),
  );
}
