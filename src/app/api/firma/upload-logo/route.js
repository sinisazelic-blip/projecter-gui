// POST /api/firma/upload-logo — upload logotipa firme
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const EXT_MAP = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/svg+xml": ".svg",
};

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("logo");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "Nema fajla (polje 'logo')" },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Dozvoljeni formati: PNG, JPG, JPEG, SVG" },
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Maksimalna veličina 2 MB" },
        { status: 400 },
      );
    }

    const ext = EXT_MAP[file.type] || ".png";
    const dir =
      process.env.UPLOAD_PATH || path.join(process.cwd(), "public", "logos");
    await mkdir(dir, { recursive: true });
    const filename = `logo-firma-${Date.now()}${ext}`;
    const filepath = path.join(dir, filename);
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    const publicPath = `/logos/${filename}`;

    const [rows] = await pool.query(
      "SELECT firma_id FROM firma_profile WHERE is_active = 1 ORDER BY firma_id DESC LIMIT 1",
    );
    if (rows && rows.length > 0) {
      await pool.query(
        "UPDATE firma_profile SET logo_path = ? WHERE is_active = 1",
        [publicPath],
      );
    }

    return NextResponse.json({ ok: true, path: publicPath });
  } catch (err) {
    console.error("upload-logo", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Greška pri uploadu" },
      { status: 500 },
    );
  }
}
