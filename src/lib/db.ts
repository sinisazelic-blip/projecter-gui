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

export const pool: mysql.Pool =
  global.__projecter_pool__ ??
  mysql.createPool({
    host: mustEnv("DB_HOST"),
    user: mustEnv("DB_USER"),
    password: mustEnv("DB_PASSWORD"),
    database: mustEnv("DB_NAME"),
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== "production") {
  global.__projecter_pool__ = pool;
}

/**
 * Named helper koji projekat već koristi:
 * import { query } from "@/lib/db"
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

/**
 * Kompatibilnost sa starim fajlovima koji rade:
 * import pool from "@/lib/db"
 */
export default pool;
