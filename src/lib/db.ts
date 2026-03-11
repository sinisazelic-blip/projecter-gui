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

// Lazy init: ne kreiraj pool pri importu (build na DO nema DB env), nego pri prvom korištenju
const poolRef: { current: mysql.Pool | null } = {
  current: global.__projecter_pool__ ?? null,
};

function getPool(): mysql.Pool {
  if (!poolRef.current) {
    poolRef.current = createPool();
    if (process.env.NODE_ENV !== "production") {
      global.__projecter_pool__ = poolRef.current;
    }
  }
  return poolRef.current;
}

/** Export za kompatibilnost; pristup uvijek ide preko trenutnog poola. */
export const pool = new Proxy({} as mysql.Pool, {
  get(_, prop) {
    return (getPool() as unknown as Record<string, unknown>)[prop as string];
  },
});

function isTransientDbError(err: any) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "");
  return (
    code === "ECONNRESET" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "EPIPE" ||
    code === "ETIMEDOUT" ||
    msg.includes("Pool is closed")
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
  const run = (p: mysql.Pool) => p.query(sql, params);
  try {
    const [rows] = await run(getPool());
    return rows as T[];
  } catch (err: any) {
    if (isTransientDbError(err)) {
      if (String(err?.message || "").includes("Pool is closed")) {
        poolRef.current = createPool();
        global.__projecter_pool__ = poolRef.current;
      }
      const [rows] = await run(getPool());
      return rows as T[];
    }
    throw err;
  }
}

/**
 * Wrapper za transakcije: prima callback koji dobija connection.
 * Koristi conn.execute() umjesto pool.query().
 */
export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn as mysql.PoolConnection);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback().catch(() => null);
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Kompatibilnost sa starim fajlovima koji rade:
 * import pool from "@/lib/db"
 */
export default pool;
