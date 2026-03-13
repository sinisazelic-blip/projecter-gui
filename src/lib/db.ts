import mysql from "mysql2/promise";
import { AsyncLocalStorage } from "async_hooks";
import type { SessionPayload } from "@/lib/auth/session";

declare global {
  // eslint-disable-next-line no-var
  var __projecter_studio_pool__: mysql.Pool | undefined;
  // eslint-disable-next-line no-var
  var __projecter_demo_pool__: mysql.Pool | undefined;
}

/** Kontekst za trenutni request: koji pool koristiti. Postavlja se u runWithSession(). */
type DbContext = { isDemo: boolean };

const dbStorage = new AsyncLocalStorage<DbContext>();

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function optEnv(name: string): string | undefined {
  return process.env[name];
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

function createDemoPool(): mysql.Pool {
  const demoDb = optEnv("DEMO_DB_NAME");
  if (!demoDb) throw new Error("DEMO_DB_NAME is required for demo pool");
  return mysql.createPool(getPoolOptions(demoDb));
}

const studioPoolRef: { current: mysql.Pool | null } = {
  current: global.__projecter_studio_pool__ ?? null,
};

const demoPoolRef: { current: mysql.Pool | null } = {
  current: global.__projecter_demo_pool__ ?? null,
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

/** Vraća demo pool samo ako je DEMO_DB_NAME postavljen. Inače null (demo login neće raditi). Export za login rutu. */
export function getDemoPoolOrNull(): mysql.Pool | null {
  if (!optEnv("DEMO_DB_NAME")) return null;
  if (!demoPoolRef.current) {
    try {
      demoPoolRef.current = createDemoPool();
      if (process.env.NODE_ENV !== "production") {
        global.__projecter_demo_pool__ = demoPoolRef.current;
      }
    } catch {
      return null;
    }
  }
  return demoPoolRef.current;
}

/** Za login rutu: eksplicitno dohvatiti demo pool (baca ako DEMO_DB_NAME nije set). */
export function getDemoPool(): mysql.Pool {
  const p = getDemoPoolOrNull();
  if (!p) throw new Error("DEMO_DB_NAME not set – demo baza nije konfigurirana");
  return p;
}

export function getStudioPoolExport(): mysql.Pool {
  return getStudioPool();
}

/**
 * Vraća pool za trenutni request: ako je session.isDemo === true i demo pool postoji, demo; inače studio.
 * Kad nema konteksta (npr. login prije sessiona), koristi studio.
 */
function getPool(): mysql.Pool {
  const ctx = dbStorage.getStore();
  if (ctx?.isDemo) {
    const demo = getDemoPoolOrNull();
    if (demo) return demo;
  }
  return getStudioPool();
}

/**
 * Pokreće fn u kontekstu gdje query()/pool koriste demo ili studio bazu prema session.isDemo.
 * Koristi u root layoutu i u API rutama koje koriste bazu.
 */
export function runWithSession<T>(
  session: SessionPayload | null | undefined,
  fn: () => T | Promise<T>
): Promise<T> {
  const isDemo = session?.isDemo === true;
  return dbStorage.run({ isDemo }, fn) as Promise<T>;
}

/** Export za kompatibilnost; pool uvijek odgovara trenutnom request kontekstu (runWithSession). */
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
 * Koristi pool iz trenutnog konteksta (runWithSession).
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
        if (dbStorage.getStore()?.isDemo && demoPoolRef.current) {
          demoPoolRef.current = null;
          global.__projecter_demo_pool__ = undefined;
        } else {
          studioPoolRef.current = null;
          global.__projecter_studio_pool__ = undefined;
        }
      }
      const [rows] = await run(getPool());
      return rows as T[];
    }
    throw err;
  }
}

/**
 * Wrapper za transakcije: prima callback koji dobija connection.
 * Koristi pool iz trenutnog konteksta (runWithSession).
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
