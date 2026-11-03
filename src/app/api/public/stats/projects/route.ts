import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET() {
  try {
    const rows: any = await query("SELECT COUNT(*) as count FROM projekti;");
    const count = Array.isArray(rows) && rows[0]?.count ? Number(rows[0].count) : 6017;
    return NextResponse.json(
      {
        ok: true,
        count,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        count: 6017,
        error: error.message,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
