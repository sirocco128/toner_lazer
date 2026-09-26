/**
 * SmartGift catalog MySQL (sg_offer / sg_offer_price).
 * Server-only — do not import from client components.
 */

import mysql from "mysql2/promise";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type SmartgiftMysqlConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  enabled: boolean;
  connectionUrl?: string;
};

let pool: Pool | null = null;

function flagOn(value: string | undefined): boolean {
  const raw = (value || "").trim().toLowerCase();
  return raw === "1" || raw === "true";
}

function isMysqlConnectFailure(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "PROTOCOL_CONNECTION_LOST"
  );
}

async function resetSmartgiftPool(): Promise<void> {
  const current = pool;
  pool = null;
  if (!current) return;
  try {
    await current.end();
  } catch {
    /* ignore stale pool shutdown */
  }
}

export function getSmartgiftMysqlConfig(): SmartgiftMysqlConfig {
  const url = (process.env.SMARTGIFT_MYSQL_URL || "").trim();
  const host = (
    process.env.SMARTGIFT_MYSQL_HOST ||
    process.env.NEXTERP_MYSQL_HOST ||
    "127.0.0.1"
  ).trim();
  const port = Number(
    process.env.SMARTGIFT_MYSQL_PORT || process.env.NEXTERP_MYSQL_PORT || 3307,
  );
  const user = (
    process.env.SMARTGIFT_MYSQL_USER ||
    process.env.NEXTERP_MYSQL_USER ||
    "biz"
  ).trim();
  const password =
    process.env.SMARTGIFT_MYSQL_PASSWORD ??
    process.env.NEXTERP_MYSQL_PASSWORD ??
    "biz_secret";
  const database = (
    process.env.SMARTGIFT_MYSQL_DATABASE || "smartgift"
  ).trim();

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 3307,
    user,
    password,
    database,
    enabled: flagOn(process.env.SMARTGIFT_MYSQL_ENABLED),
    connectionUrl: url || undefined,
  };
}

export function isSmartgiftMysqlEnabled(): boolean {
  return getSmartgiftMysqlConfig().enabled;
}

export function getSmartgiftPool(): Pool {
  const config = getSmartgiftMysqlConfig();
  if (!config.enabled) {
    throw new Error("SmartGift MySQL is not enabled");
  }
  if (!pool) {
    // Docker Desktop port-proxy on Windows can idle >3s before the first handshake.
    const poolOptions = {
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 15_000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      namedPlaceholders: true,
      timezone: "Z",
    } as const;
    pool = config.connectionUrl
      ? mysql.createPool(config.connectionUrl)
      : mysql.createPool({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          database: config.database,
          ...poolOptions,
        });
  }
  return pool;
}

async function withFreshPoolRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isMysqlConnectFailure(error)) throw error;
    await resetSmartgiftPool();
    return fn();
  }
}

export async function smartgiftQuery<T extends RowDataPacket[]>(
  sql: string,
  params?: Record<string, unknown> | unknown[],
): Promise<T> {
  return withFreshPoolRetry(async () => {
    const [rows] = await getSmartgiftPool().query<T>(sql, params);
    return rows;
  });
}

export async function smartgiftExec(
  sql: string,
  params?: Record<string, unknown> | unknown[],
): Promise<ResultSetHeader> {
  return withFreshPoolRetry(async () => {
    const [result] = await getSmartgiftPool().query<ResultSetHeader>(sql, params);
    return result;
  });
}

export async function withSmartgiftTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  return withFreshPoolRetry(async () => {
    const conn = await getSmartgiftPool().getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  });
}

export async function pingSmartgiftMysql(): Promise<{
  ok: boolean;
  database?: string;
  offerCount?: number;
  pricedCount?: number;
  error?: string;
}> {
  try {
    const config = getSmartgiftMysqlConfig();
    if (!config.enabled) {
      return { ok: false, error: "SMARTGIFT_MYSQL_ENABLED is off" };
    }
    const rows = await smartgiftQuery<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM sg_offer) AS offer_count,
         (SELECT COUNT(*) FROM sg_offer WHERE has_price = 1) AS priced_count,
         DATABASE() AS db_name`,
    );
    const row = rows[0] as
      | { offer_count: number; priced_count: number; db_name: string }
      | undefined;
    return {
      ok: true,
      database: row?.db_name || config.database,
      offerCount: Number(row?.offer_count ?? 0),
      pricedCount: Number(row?.priced_count ?? 0),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "SmartGift MySQL ping failed",
    };
  }
}

export function resetSmartgiftPoolForTests(): void {
  void resetSmartgiftPool();
}
