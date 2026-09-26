"use client";

import { useMemo, useState } from "react";
import { SkuClassBadge } from "@/components/SkuClassBadge";
import type { SkuRecord } from "@/lib/sku-master-types";

type SkuOption = Pick<SkuRecord, "productId" | "nameTh" | "stockClass" | "isBundle">;

export function SkuGroupItemPicker({
  skus,
  selectedIds,
}: {
  skus: SkuOption[];
  selectedIds: string[];
}) {
  const byId = useMemo(() => new Map(skus.map((sku) => [sku.productId, sku])), [skus]);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState(() =>
    selectedIds.filter((id) => byId.has(id) || parseLoose(id)),
  );
  const [dragId, setDragId] = useState<string | null>(null);

  const memberSet = useMemo(() => new Set(members), [members]);
  const filteredPool = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return skus.filter((item) => {
      if (memberSet.has(item.productId)) return false;
      if (!needle) return true;
      return `${item.productId} ${item.nameTh}`.toLowerCase().includes(needle);
    });
  }, [query, skus, memberSet]);

  function add(productId: string) {
    setMembers((current) => (current.includes(productId) ? current : [...current, productId]));
  }

  function remove(productId: string) {
    setMembers((current) => current.filter((id) => id !== productId));
  }

  function move(productId: string, delta: number) {
    setMembers((current) => {
      const index = current.indexOf(productId);
      if (index < 0) return current;
      const next = [...current];
      const target = Math.min(Math.max(index + delta, 0), next.length - 1);
      next.splice(index, 1);
      next.splice(target, 0, productId);
      return next;
    });
  }

  function onDropOnMember(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setMembers((current) => {
      const next = current.filter((id) => id !== dragId);
      const at = next.indexOf(targetId);
      if (at < 0) return [...next, dragId];
      next.splice(at, 0, dragId);
      return next;
    });
    setDragId(null);
  }

  function onDropOnMembersPane() {
    if (!dragId) return;
    add(dragId);
    setDragId(null);
  }

  return (
    <div className="space-y-3">
      {members.map((productId) => (
        <input key={productId} type="hidden" name="productId" value={productId} />
      ))}
      <p className="text-xs text-ink/55">
        ลากจัดลำดับบนเดสก์ท็อป หรือใช้ลูกศรบนมือถือ — เลือกแล้ว {members.length} รหัส
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-forest/10 p-3">
          <h3 className="text-sm font-medium text-forest">ยังไม่อยู่ในกลุ่ม</h3>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นรหัสหรือชื่อ"
            className="mt-2 w-full rounded border border-forest/20 px-3 py-2 text-sm"
          />
          <ul className="mt-2 max-h-[24rem] space-y-1 overflow-auto text-sm">
            {filteredPool.map((sku) => (
              <li key={sku.productId}>
                <div
                  draggable
                  onDragStart={() => setDragId(sku.productId)}
                  onDragEnd={() => setDragId(null)}
                  className="flex cursor-grab items-center gap-2 rounded-lg px-1 py-1 hover:bg-forest-mist/50"
                >
                  <span className="font-mono">{sku.productId}</span>
                  <SkuClassBadge stockClass={sku.stockClass} bundle={sku.isBundle} />
                  <span className="min-w-0 flex-1 truncate">{sku.nameTh}</span>
                  <button
                    type="button"
                    onClick={() => add(sku.productId)}
                    className="shrink-0 rounded border border-forest/20 px-2 py-0.5 text-xs text-forest"
                  >
                    เพิ่ม
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section
          className="rounded-xl border border-dashed border-forest/25 bg-forest-mist/20 p-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDropOnMembersPane}
        >
          <h3 className="text-sm font-medium text-forest">สมาชิกกลุ่ม (ลำดับนี้)</h3>
          {members.length === 0 ? (
            <p className="mt-3 text-sm text-ink/55">ลากรหัสมาที่นี่ หรือกดเพิ่มจากซ้าย</p>
          ) : (
            <ol className="mt-2 max-h-[24rem] space-y-1 overflow-auto text-sm">
              {members.map((productId) => {
                const sku = byId.get(productId);
                return (
                  <li
                    key={productId}
                    draggable
                    onDragStart={() => setDragId(productId)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDropOnMember(productId);
                    }}
                    className="flex cursor-grab items-center gap-2 rounded-lg bg-paper px-2 py-1.5"
                  >
                    <span className="w-5 text-ink/40">⋮⋮</span>
                    <span className="font-mono">{productId}</span>
                    {sku ? (
                      <>
                        <SkuClassBadge stockClass={sku.stockClass} bundle={sku.isBundle} />
                        <span className="min-w-0 flex-1 truncate">{sku.nameTh}</span>
                      </>
                    ) : (
                      <span className="flex-1 text-ink/50">ไม่พบชื่อ</span>
                    )}
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => move(productId, -1)}
                        className="rounded border border-forest/20 px-1.5 text-xs"
                        aria-label="ขึ้น"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(productId, 1)}
                        className="rounded border border-forest/20 px-1.5 text-xs"
                        aria-label="ลง"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(productId)}
                        className="rounded border border-forest/20 px-1.5 text-xs"
                      >
                        นำออก
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function parseLoose(id: string): boolean {
  return /^[ABCD]\d{5}$/.test(id);
}
