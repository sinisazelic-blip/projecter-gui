// GET: postavke fiskalnog uređaja za aktivnu firmu
// POST: snimi postavke (body JSON: base_url, api_key, pin, use_external_printer, external_printer_name, external_printer_width)
import { NextResponse } from "next/server";
import pool, { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function cleanStr(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function GET() {
  try {
    const active = await query(
      `SELECT firma_id FROM firma_profile WHERE is_active = 1 ORDER BY firma_id DESC LIMIT 1`,
    );
    const firmaId = active?.[0]?.firma_id;
    if (!firmaId) {
      return NextResponse.json({
        ok: true,
        settings: null,
        message: "Nema aktivne firme",
      });
    }

    const rows = await query(
      `SELECT base_url, api_path, api_key, yid, pin, use_external_printer, external_printer_name, external_printer_width
       FROM firma_fiskal_settings WHERE firma_id = ?`,
      [firmaId],
    );
    const s = rows?.[0] || null;
    return NextResponse.json({
      ok: true,
      settings: s
        ? {
            base_url: s.base_url ?? "",
            api_path: s.api_path ?? "",
            api_key: s.api_key ?? "",
            yid: s.yid ?? "",
            pin: s.pin ?? "",
            use_external_printer: Boolean(Number(s.use_external_printer)),
            external_printer_name: s.external_printer_name ?? "",
            external_printer_width:
              s.external_printer_width != null
                ? Number(s.external_printer_width)
                : "",
          }
        : {
            base_url: "",
            api_path: "",
            api_key: "",
            yid: "",
            pin: "",
            use_external_printer: false,
            external_printer_name: "",
            external_printer_width: "",
          },
    });
  } catch (e) {
    console.error("GET /api/firma/fiskal", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Greška učitavanja" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const active = await query(
      `SELECT firma_id FROM firma_profile WHERE is_active = 1 ORDER BY firma_id DESC LIMIT 1`,
    );
    const firmaId = active?.[0]?.firma_id;
    if (!firmaId) {
      return NextResponse.json(
        { ok: false, error: "Nema aktivne firme" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const base_url = cleanStr(body.base_url);
    const api_path = cleanStr(body.api_path);
    const api_key = cleanStr(body.api_key);
    const yid = cleanStr(body.yid);
    const pin = cleanStr(body.pin);
    const use_external_printer = Boolean(body.use_external_printer);
    const external_printer_name = cleanStr(body.external_printer_name);
    const external_printer_width =
      body.external_printer_width !== "" &&
      body.external_printer_width != null &&
      !Number.isNaN(Number(body.external_printer_width))
        ? Number(body.external_printer_width)
        : null;

    await pool.query(
      `
      INSERT INTO firma_fiskal_settings (
        firma_id, base_url, api_path, api_key, yid, pin,
        use_external_printer, external_printer_name, external_printer_width
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        base_url = VALUES(base_url),
        api_path = VALUES(api_path),
        api_key = VALUES(api_key),
        yid = VALUES(yid),
        pin = VALUES(pin),
        use_external_printer = VALUES(use_external_printer),
        external_printer_name = VALUES(external_printer_name),
        external_printer_width = VALUES(external_printer_width),
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        firmaId,
        base_url,
        api_path,
        api_key,
        yid,
        pin,
        use_external_printer ? 1 : 0,
        external_printer_name,
        external_printer_width,
      ],
    );

    return NextResponse.json({ ok: true, message: "Postavke snimljene" });
  } catch (e) {
    console.error("POST /api/firma/fiskal", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Greška snimanja" },
      { status: 500 },
    );
  }
}
