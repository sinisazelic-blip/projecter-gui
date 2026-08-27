import { AsyncLocalStorage } from "node:async_hooks";
import mysql from "mysql2/promise";
import type { SessionPayload } from "@/lib/auth/session";

declare global {
  // eslint-disable-next-line no-var
  var __projecter_studio_pool__: mysql.Pool | undefined;
}

const dbStorage = new AsyncLocalStorage<Record<string, never>>();

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getPoolOptions(dbName: string) {
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const opts: mysql.PoolOptions = {
    host: mustEnv("DB_HOST"),
    user: mustEnv("DB_USER"),
    password: mustEnv("DB_PASSWORD"),
    database: dbName,
    port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 15000,
  };
  // DO Managed MySQL zahtijeva SSL; ostale instalacije mogu raditi bez
  if (port === 25060 || process.env.DB_SSL === "1" || process.env.DB_SSL === "true") {
    opts.ssl = { rejectUnauthorized: false };
  }
  return opts;
}

function createStudioPool(): mysql.Pool {
  return mysql.createPool(getPoolOptions(mustEnv("DB_NAME")));
}

const studioPoolRef: { current: mysql.Pool | null } = {
  current: global.__projecter_studio_pool__ ?? null,
};

function getStudioPool(): mysql.Pool {
  if (!studioPoolRef.current) {
    studioPoolRef.current = createStudioPool();
    if (process.env.NODE_ENV !== "production") {
      global.__projecter_studio_pool__ = studioPoolRef.current;
    }
  }
  return studioPoolRef.current;
}

export function getStudioPoolExport(): mysql.Pool {
  return getStudioPool();
}

function getPool(): mysql.Pool {
  return getStudioPool();
}

/**
 * Pokreće fn u request kontekstu. Session se čuva radi kompatibilnosti API ruta;
 * baza je uvijek DB_NAME (nema dual-pool / demo instance).
 */
export function runWithSession<T>(
  _session: SessionPayload | null | undefined,
  fn: () => T | Promise<T>,
): Promise<T> {
  return dbStorage.run({}, fn) as Promise<T>;
}

/** Export za kompatibilnost; pool uvijek odgovara DB_NAME. */
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
  const p = getPool();
  const run = (pool: mysql.Pool) => pool.query(sql, params);
  try {
    const [rows] = await run(p);
    return rows as T[];
  } catch (err: any) {
    if (isTransientDbError(err)) {
      if (String(err?.message || "").includes("Pool is closed")) {
        studioPoolRef.current = null;
        global.__projecter_studio_pool__ = undefined;
      }
      const [rows] = await run(getPool());
      return rows as T[];
    }
    throw err;
  }
}

/**
 * Wrapper za transakcije: prima callback koji dobija connection.
 */
export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const p = getPool();
  const conn = await p.getConnection();
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
