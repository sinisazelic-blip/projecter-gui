import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    return Response.json({ success: true, rows });
  } catch (err) {
    return Response.json(
      { success: false, code: err?.code, message: err?.message },
      { status: 500 }
    );
  }
}
