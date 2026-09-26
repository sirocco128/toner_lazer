/**
 * WMS store selection + optional sync SQLite → MySQL + mirror sg_sku.on_hand_qty.
 * Default remains sqlite until WMS_STORE=mysql after DDL applied.
 *
 * Dual-read rule: every request reads from exactly one store (getWmsStoreMode()).
 * Never mix SQLite + MySQL balances in the same request.
 */

import { getDb } from "@/lib/database";
import { listBalances, sumOnHand } from "@/lib/wms-repository";
import {
  isSmartgiftMysqlEnabled,
  smartgiftExec,
  smartgiftQuery,
} from "@/lib/smartgift-mysql";
import type { RowDataPacket } from "mysql2/promise";

export type WmsStoreMode = "sqlite" | "mysql";

export function getWmsStoreMode(): WmsStoreMode {
  const raw = String(process.env.WMS_STORE || "sqlite")
    .trim()
    .toLowerCase();
  return raw === "mysql" ? "mysql" : "sqlite";
}

/** Resolve WMS product_key → sg_sku.product_id rows (exact / slug / ORI code). */
export async function resolveSkuProductIdsForKey(
  productKey: string,
): Promise<string[]> {
  if (!isSmartgiftMysqlEnabled()) return [];
  const key = String(productKey || "")
    .trim()
    .toUpperCase();
  if (!key) return [];
  try {
    const rows = await smartgiftQuery<RowDataPacket[]>(
      `SELECT DISTINCT s.product_id AS product_id
       FROM sg_sku s
       LEFT JOIN sg_ori_products o ON o.ori_product_id = s.ori_product_id
       WHERE UPPER(s.product_id) = ?
          OR UPPER(COALESCE(s.catalog_slug, '')) = ?
          OR UPPER(COALESCE(o.ori_product_code, '')) = ?
       LIMIT 20`,
      [key, key, key],
    );
    return rows
      .map((r) => String(r.product_id || "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Best-effort mirror physical on-hand into MySQL sg_sku when enabled. */
export async function mirrorSkuOnHandQty(productKey: string): Promise<void> {
  if (!isSmartgiftMysqlEnabled()) return;
  const key = String(productKey || "")
    .trim()
    .toUpperCase();
  if (!key) return;
  try {
    const qty = sumOnHand(key);
    const ids = await resolveSkuProductIdsForKey(key);
    const targets = ids.length > 0 ? ids : [key];
    for (const productId of targets) {
      await smartgiftExec(
        `UPDATE sg_sku SET on_hand_qty = GREATEST(?, 0) WHERE product_id = ?`,
        [qty, productId],
      );
    }
  } catch {
    // SKU master optional; do not fail WMS mutation.
  }
}

/** Upsert one product's SQLite balances into MySQL wms_balance (by location_code). */
export async function mirrorProductBalancesToMysql(
  productKey: string,
): Promise<void> {
  if (!isSmartgiftMysqlEnabled()) return;
  const key = String(productKey || "")
    .trim()
    .toUpperCase();
  if (!key) return;
  try {
    const locRows = await smartgiftQuery<RowDataPacket[]>(
      `SELECT id, location_code FROM wms_location WHERE status = 'active'`,
    );
    if (locRows.length === 0) return;
    const locByCode = new Map(
      locRows.map((row) => [String(row.location_code), Number(row.id)]),
    );
    const balances = listBalances({ productKey: key, limit: 50 });
    for (const bal of balances) {
      const locId = locByCode.get(bal.locationCode || "BIN-DEFAULT");
      if (!locId) continue;
      await smartgiftExec(
        `INSERT INTO wms_balance (product_key, location_id, qty_on_hand, qty_reserved)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           qty_on_hand = VALUES(qty_on_hand),
           qty_reserved = VALUES(qty_reserved)`,
        [bal.productKey, locId, bal.qtyOnHand, bal.qtyReserved],
      );
    }
  } catch {
    // MySQL WMS optional until DDL applied.
  }
}

/**
 * Fire-and-forget after a stock mutation:
 * - always try sg_sku.on_hand_qty mirror
 * - when WMS_STORE=mysql also push balance rows to MySQL wms_balance
 */
export function scheduleSkuOnHandMirror(productKey: string | null | undefined): void {
  const key = String(productKey || "")
    .trim()
    .toUpperCase();
  if (!key) return;
  void (async () => {
    await mirrorSkuOnHandQty(key);
    if (getWmsStoreMode() === "mysql") {
      await mirrorProductBalancesToMysql(key);
    }
  })();
}

export type WmsSyncResult = {
  ok: boolean;
  mode: WmsStoreMode;
  balanceRows: number;
  mirroredSkus?: number;
  message: string;
  error?: string;
};

/**
 * One-shot export of SQLite balances for operators / future MySQL loader.
 * When WMS_STORE=mysql, apply db/mysql/wms_core.sql first.
 */
export function exportSqliteBalancesForSync(): {
  balances: Array<{
    productKey: string;
    locationCode: string | undefined;
    qtyOnHand: number;
    qtyReserved: number;
  }>;
} {
  const balances = listBalances({ limit: 5000 }).map((b) => ({
    productKey: b.productKey,
    locationCode: b.locationCode,
    qtyOnHand: b.qtyOnHand,
    qtyReserved: b.qtyReserved,
  }));
  return { balances };
}

/**
 * Push SQLite wms_balances into MySQL wms_balance (by location_code) and
 * mirror each product_key into sg_sku.on_hand_qty.
 * Requires SMARTGIFT_MYSQL_ENABLED=1 and db/mysql/wms_core.sql applied.
 */
export async function syncSqliteBalancesToMysql(): Promise<WmsSyncResult> {
  const mode = getWmsStoreMode();
  if (!isSmartgiftMysqlEnabled()) {
    return {
      ok: false,
      mode,
      balanceRows: 0,
      message: "SMARTGIFT_MYSQL_ENABLED ปิดอยู่ — เปิดก่อน sync",
      error: "mysql_disabled",
    };
  }

  try {
    const { balances } = exportSqliteBalancesForSync();
    const locRows = await smartgiftQuery<RowDataPacket[]>(
      `SELECT id, location_code FROM wms_location WHERE status = 'active'`,
    );
    const locByCode = new Map<string, number>();
    for (const row of locRows) {
      locByCode.set(String(row.location_code), Number(row.id));
    }
    if (locByCode.size === 0) {
      return {
        ok: false,
        mode,
        balanceRows: 0,
        message: "MySQL ยังไม่มี wms_location — apply db/mysql/wms_core.sql ก่อน",
        error: "locations_missing",
      };
    }

    let written = 0;
    for (const bal of balances) {
      const locId = locByCode.get(bal.locationCode || "BIN-DEFAULT");
      if (!locId) continue;
      await smartgiftExec(
        `INSERT INTO wms_balance (product_key, location_id, qty_on_hand, qty_reserved)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           qty_on_hand = VALUES(qty_on_hand),
           qty_reserved = VALUES(qty_reserved)`,
        [bal.productKey, locId, bal.qtyOnHand, bal.qtyReserved],
      );
      written += 1;
    }

    const productKeys = [
      ...new Set(balances.map((b) => b.productKey).filter(Boolean)),
    ];
    for (const key of productKeys) {
      await mirrorSkuOnHandQty(key);
    }

    return {
      ok: true,
      mode,
      balanceRows: written,
      mirroredSkus: productKeys.length,
      message: `ซิงก์ ${written} แถว balance → MySQL และ mirror ${productKeys.length} SKU`,
    };
  } catch (error) {
    return {
      ok: false,
      mode,
      balanceRows: 0,
      message: "ซิงก์ MySQL ล้มเหลว",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function wmsSyncStatus(): WmsSyncResult {
  const mode = getWmsStoreMode();
  const balanceRows = (
    getDb()
      .prepare(`SELECT COUNT(*) AS n FROM wms_balances`)
      .get() as { n: number }
  ).n;
  return {
    ok: true,
    mode,
    balanceRows: Number(balanceRows) || 0,
    message:
      mode === "sqlite"
        ? "แหล่งความจริงปัจจุบันคือ SQLite — ตั้ง WMS_STORE=mysql หลัง apply db/mysql/wms_core.sql และ syncSqliteBalancesToMysql()"
        : "โหมด MySQL เปิดแล้ว — mutation ควรเขียน MySQL; mirror sg_sku.on_hand_qty ทำงานเมื่อ SMARTGIFT_MYSQL_ENABLED=1",
  };
}
