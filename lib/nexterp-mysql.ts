/**
 * NextERP MySQL staging connection (products + customers).
 * Server-only — do not import from client components.
 */

import mysql from "mysql2/promise";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export type NexterpMysqlConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  enabled: boolean;
  connectionUrl?: string;
};

let pool: Pool | null = null;

export function getNexterpMysqlConfig(): NexterpMysqlConfig {
  const url = (process.env.NEXTERP_MYSQL_URL || "").trim();
  const enabledFlag = (process.env.NEXTERP_MYSQL_ENABLED || "").trim().toLowerCase();
  const host = (process.env.NEXTERP_MYSQL_HOST || "127.0.0.1").trim();
  const port = Number(process.env.NEXTERP_MYSQL_PORT || 3307);
  const user = (process.env.NEXTERP_MYSQL_USER || "terabis").trim();
  const password = process.env.NEXTERP_MYSQL_PASSWORD ?? "terabis";
  const database = (process.env.NEXTERP_MYSQL_DATABASE || "nexterp_staging").trim();

  const enabled = enabledFlag === "1" || enabledFlag === "true";

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 3307,
    user,
    password,
    database,
    enabled,
    connectionUrl: url || undefined,
  };
}

export function isNexterpMysqlEnabled(): boolean {
  return getNexterpMysqlConfig().enabled;
}

export function getNexterpPool(): Pool {
  const config = getNexterpMysqlConfig();
  if (!config.enabled) {
    throw new Error("NextERP MySQL is not enabled");
  }
  if (!pool) {
    pool = config.connectionUrl
      ? mysql.createPool(config.connectionUrl)
      : mysql.createPool({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          database: config.database,
          waitForConnections: true,
          connectionLimit: 5,
          connectTimeout: 2000,
          namedPlaceholders: true,
          timezone: "Z",
        });
  }
  return pool;
}

export async function nexterpQuery<T extends RowDataPacket[]>(
  sql: string,
  params?: Record<string, unknown> | unknown[],
): Promise<T> {
  const [rows] = await getNexterpPool().query<T>(sql, params);
  return rows;
}

export async function nexterpExecute(
  sql: string,
  params?: Record<string, unknown> | unknown[],
): Promise<ResultSetHeader> {
  const [result] = await getNexterpPool().execute<ResultSetHeader>(sql, params);
  return result;
}

export async function pingNexterpMysql(): Promise<{
  ok: boolean;
  database?: string;
  productCount?: number;
  customerCount?: number;
  error?: string;
}> {
  try {
    const config = getNexterpMysqlConfig();
    if (!config.enabled) {
      return { ok: false, error: "NEXTERP_MYSQL_ENABLED is off" };
    }
    const rows = await nexterpQuery<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM products) AS product_count,
         (SELECT COUNT(*) FROM customers) AS customer_count,
         DATABASE() AS db_name`,
    );
    const row = rows[0] as
      | { product_count: number; customer_count: number; db_name: string }
      | undefined;
    return {
      ok: true,
      database: row?.db_name || config.database,
      productCount: Number(row?.product_count ?? 0),
      customerCount: Number(row?.customer_count ?? 0),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "MySQL ping failed",
    };
  }
}

/** Test helper — reset singleton between suites. */
export function resetNexterpPoolForTests(): void {
  if (pool) {
    void pool.end();
    pool = null;
  }
}
