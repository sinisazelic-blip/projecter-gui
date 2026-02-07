import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const EUR_TO_BAM = 1.95583;

export async function GET(req, { params }) {
  try {
    const p = await params;
    const idStr = p?.id ?? "";
    const id = Number(idStr);

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { success: false, message: "Neispravan ID", debug: { idStr } },
        { status: 400 }
      );
    }

    // ✅ view + kanonski budžet iz projekat_stavke (KM)
    const rows = await query(
      `
      SELECT
        v.projekat_id,
        v.radni_naziv,

        -- ✅ NOVO: operativni signal (owner -> tim)
        p.operativni_signal,

        COALESCE(ps.budzet_km, v.budzet_planirani, 0) AS budzet_planirani,

        v.troskovi_ukupno,
        v.troskovi_novi,
        v.troskovi_legacy,
        v.legacy_flag,

        (COALESCE(ps.budzet_km, v.budzet_planirani, 0) - COALESCE(v.troskovi_ukupno, 0)) AS planirana_zarada,

        v.finansijski_status
      FROM vw_projekti_finansije v
      JOIN projekti p
        ON p.projekat_id = v.projekat_id
      LEFT JOIN (
        SELECT
          projekat_id,
          ROUND(SUM(
            CASE
              WHEN UPPER(COALESCE(valuta,'BAM')) IN ('BAM','KM') THEN COALESCE(line_total,0)
              WHEN UPPER(COALESCE(valuta,'')) = 'EUR' THEN COALESCE(line_total,0) * ${EUR_TO_BAM}
              ELSE 0
            END
          ), 2) AS budzet_km
        FROM projekat_stavke
        WHERE projekat_id = ?
        GROUP BY projekat_id
      ) ps ON ps.projekat_id = v.projekat_id
      WHERE v.projekat_id = ?
      LIMIT 1
      `,
      [id, id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Projekat nije pronađen", data: null },
        { status: 404 }
      );
    }

    const includeStornirano =
      new URL(req.url).searchParams.get("include_stornirano") === "1";

    const costs = await query(
      `
      SELECT
        trosak_id,
        projekat_id,
        tip_id,
        opis,
        datum_troska,
        iznos_km,
        status
      FROM projektni_troskovi
      WHERE projekat_id = ?
        ${includeStornirano ? "" : "AND status <> 'STORNIRANO'"}
      ORDER BY datum_troska DESC, trosak_id DESC
      LIMIT 200
      `,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: { project: rows[0], costs },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
