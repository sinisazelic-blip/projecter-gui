// GET /api/firma/logo — servira logo aktivne firme (iz Volume na DO App Platform ili iz public/)
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const CT_MAP = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

export async function GET() {
  try {
    const [rows] = await pool.query(
      "SELECT logo_path FROM firma_profile WHERE is_active = 1 ORDER BY firma_id DESC LIMIT 1",
    );
    const logoPath = rows?.[0]?.logo_path;
    if (!logoPath || typeof logoPath !== "string") {
      return new NextResponse(null, { status: 404 });
    }

    const trimmed = logoPath.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return NextResponse.redirect(trimmed);
    }

    const basename = path.basename(trimmed);
    const ext = path.extname(basename).toLowerCase();
    const contentType = CT_MAP[ext] || "application/octet-stream";

    const uploadDir =
      process.env.UPLOAD_PATH || path.join(process.cwd(), "public", "logos");
    const filepath = path.join(uploadDir, basename);

    const buf = await readFile(filepath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    if (err?.code === "ENOENT") return new NextResponse(null, { status: 404 });
    console.error("firma/logo", err);
    return new NextResponse(null, { status: 500 });
  }
}
