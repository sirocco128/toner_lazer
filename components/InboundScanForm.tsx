"use client";

import { useRouter } from "next/navigation";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { WmsSkuKeyField } from "@/components/WmsSkuKeyField";
import { receiveGoodsAction } from "@/app/actions/ops-cycle";
import {
  DESTINATION_LABELS,
  DESTINATIONS,
} from "@/lib/ops-cycle-types";
import type { WmsSkuKeyOption } from "@/lib/wms-sku-options";
import { locationDisplay } from "@/lib/wms-location-labels";
import {
  DEFAULT_LOCATION_CODE,
  XDOCK_LOCATION_CODE,
} from "@/lib/wms-types";

type PoOption = {
  poId: string;
  productName: string;
  remainingQty: number;
  receiveMode: "stock" | "cross_dock";
  sourceOfferId: string | null;
};

type LocOption = {
  locationCode: string;
  name: string;
};

export function InboundScanForm({
  pos,
  selectedPoId,
  selectedProductName,
  snapLine,
  isCrossDock,
  defaultLocation,
  defaultDestination,
  defaultQty,
  skuOptions,
  locations,
  skuDefault,
}: {
  pos: PoOption[];
  selectedPoId: string;
  selectedProductName: string | null;
  snapLine: string | null;
  isCrossDock: boolean;
  defaultLocation: string;
  defaultDestination: string;
  defaultQty: number | "";
  skuOptions: WmsSkuKeyOption[];
  locations: LocOption[];
  skuDefault: string;
}) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-forest/15 bg-paper p-5">
      <OpsCycleForm
        key={selectedPoId || "none"}
        action={receiveGoodsAction}
        submitLabel="บันทึกการรับ"
      >
        <input
          type="hidden"
          name="receiveMode"
          value={isCrossDock ? "cross_dock" : "stock"}
        />
        {isCrossDock ? (
          <>
            <input type="hidden" name="locationCode" value={XDOCK_LOCATION_CODE} />
            <input type="hidden" name="destination" value="warehouse" />
          </>
        ) : null}

        <label className="block text-sm">
          <span className="font-medium">ใบสั่งโรงงาน</span>
          <select
            name="poId"
            value={selectedPoId}
            onChange={(e) => {
              const id = e.target.value;
              router.push(
                id
                  ? `/ops/inbound?poId=${encodeURIComponent(id)}`
                  : "/ops/inbound",
              );
            }}
            className="mt-1 min-h-11 w-full rounded-lg border border-forest/20 px-3 py-2.5 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
          >
            {pos.length === 0 ? (
              <option value="">ยังไม่มีใบสั่งที่รับได้</option>
            ) : null}
            {pos.map((po) => (
              <option key={po.poId} value={po.poId}>
                {po.poId} · {po.productName} · ค้าง {po.remainingQty}
                {po.receiveMode === "cross_dock" ? " · จุดแพ็ก" : " · ขึ้นชั้น"}
              </option>
            ))}
          </select>
        </label>

        {selectedProductName ? (
          <p className="text-sm text-ink/80">{selectedProductName}</p>
        ) : (
          <p className="text-sm text-red-700">ยังไม่ได้เลือกใบสั่งโรงงาน</p>
        )}
        {snapLine ? <p className="text-xs text-ink/60">{snapLine}</p> : null}

        {isCrossDock ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            รับเข้า <strong>จุดแพ็ก</strong>
            <span className="ml-1 font-mono text-xs text-ink/55">
              {XDOCK_LOCATION_CODE}
            </span>
            {" — "}
            อย่าขึ้นชั้น · ไปแพ็กส่งต่อ
          </p>
        ) : null}

        <WmsSkuKeyField
          label="สแกนรหัสสินค้า"
          options={skuOptions}
          defaultValue={skuDefault}
          autoFocus
          scanFriendly
          nextFocusId="qtyReceived"
          hint="สแกนแล้วกด Enter เพื่อไปช่องจำนวน"
        />

        <div
          className={
            isCrossDock
              ? "grid gap-4 sm:grid-cols-2"
              : "grid gap-4 sm:grid-cols-3"
          }
        >
          <label className="block text-sm">
            <span className="font-medium">จำนวนที่รับดี</span>
            <input
              id="qtyReceived"
              name="qtyReceived"
              type="number"
              min={1}
              required
              defaultValue={defaultQty}
              inputMode="numeric"
              className="mt-1 min-h-11 w-full rounded-lg border border-forest/20 px-3 py-2.5 text-lg tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">เสีย / ไม่ผ่าน QC</span>
            <input
              name="qtyDamaged"
              type="number"
              min={0}
              defaultValue={0}
              inputMode="numeric"
              className="mt-1 min-h-11 w-full rounded-lg border border-forest/20 px-3 py-2.5 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
            />
          </label>
          {!isCrossDock ? (
            <label className="block text-sm">
              <span className="font-medium">ปลายทาง</span>
              <select
                name="destination"
                defaultValue={defaultDestination}
                className="mt-1 min-h-11 w-full rounded-lg border border-forest/20 px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
              >
                {DESTINATIONS.map((d) => (
                  <option key={d} value={d}>
                    {DESTINATION_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {!isCrossDock ? (
          <label className="block text-sm">
            <span className="font-medium">ที่เก็บ</span>
            <select
              name="locationCode"
              defaultValue={
                locations.some((l) => l.locationCode === defaultLocation)
                  ? defaultLocation
                  : locations[0]?.locationCode || DEFAULT_LOCATION_CODE
              }
              className="mt-1 min-h-11 w-full rounded-lg border border-forest/20 px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
            >
              {locations.map((loc) => (
                <option key={loc.locationCode} value={loc.locationCode}>
                  {locationDisplay(loc.locationCode, loc.name)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <details className="rounded-lg border border-forest/10 bg-ink/[0.02] px-3 py-2">
          <summary className="cursor-pointer text-sm text-ink/70">
            เลขติดตาม / บันทึก QC (ไม่บังคับ)
          </summary>
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="font-medium">เลขติดตามไทย</span>
              <input
                name="trackingTh"
                className="mt-1 min-h-11 w-full rounded-lg border border-forest/20 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">บันทึก QC</span>
              <textarea
                name="qcNotes"
                rows={2}
                className="mt-1 w-full rounded-lg border border-forest/20 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
              />
            </label>
          </div>
        </details>
      </OpsCycleForm>
    </div>
  );
}
