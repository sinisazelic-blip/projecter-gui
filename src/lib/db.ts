import mysql from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var __projecter_pool__: mysql.Pool | undefined;
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: mustEnv("DB_HOST"),
    user: mustEnv("DB_USER"),
    password: mustEnv("DB_PASSWORD"),
    database: mustEnv("DB_NAME"),
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    // ✅ dev stabilnost (socket keepalive + razumni timeout)
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10000,
  });
}

export const pool: mysql.Pool = global.__projecter_pool__ ?? createPool();

if (process.env.NODE_ENV !== "production") {
  global.__projecter_pool__ = pool;
}

function isTransientDbError(err: any) {
  const code = String(err?.code || "");
  return (
    code === "ECONNRESET" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "EPIPE" ||
    code === "ETIMEDOUT"
  );
}

/**
 * Named helper koji projekat već koristi:
 * import { query } from "@/lib/db"
 */
export async function query<T = any>(
  sql: string,
  params: any[] = [],
): Promise<T[]> {
  try {
    const [rows] = await pool.query(sql, params);
    return rows as T[];
  } catch (err: any) {
    // ✅ Jedan retry za tipične dev resetove konekcije
    if (isTransientDbError(err)) {
      try {
        // pokušaj zatvoriti stari pool (ignore errors)
        await pool.end().catch(() => null);
      } catch {}

      const fresh = createPool();
      if (process.env.NODE_ENV !== "production") {
        global.__projecter_pool__ = fresh;
      }

      const [rows] = await fresh.query(sql, params);
      return rows as T[];
    }

    throw err;
  }
}

/**
 * Kompatibilnost sa starim fajlovima koji rade:
 * import pool from "@/lib/db"
 */
export default pool;
