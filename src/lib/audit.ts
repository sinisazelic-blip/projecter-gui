import { pool } from "@/lib/db";

export async function audit(event: string, payload: any) {
  await pool.query(
    `INSERT INTO audit_log (event, payload_json) VALUES (?, ?)`,
    [event, JSON.stringify(payload ?? {})]
  );
}
