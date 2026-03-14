import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const EUR_TO_BAM = 1.95583;
const SARADNIK_NIVO = 0;

export async function GET(req, { params }) {
  try {
    const p = await params;
    const idStr = p?.id ?? "";
    const id = Number(idStr);

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { success: false, message: "Neispravan ID", debug: { idStr } },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const session = token ? verifySessionToken(token) : null;
    const nivo = session?.nivo ?? 1;
    if (session && nivo === SARADNIK_NIVO) {
      const userRows = await query(
        "SELECT radnik_id FROM users WHERE user_id = ? LIMIT 1",
        [session.user_id],
      );
      const radnikId = userRows?.[0]?.radnik_id != null ? Number(userRows[0].radnik_id) : null;
      if (radnikId == null) {
        return NextResponse.json(
          { success: false, message: "Pristup nije dozvoljen", data: null },
          { status: 403 },
        );
      }
      const accessRows = await query(
        `SELECT 1 FROM projekat_faze pf
         INNER JOIN projekat_faza_radnici pfr ON pfr.projekat_faza_id = pf.projekat_faza_id
         WHERE pf.projekat_id = ? AND pfr.radnik_id = ?
         UNION
         SELECT 1 FROM projekat_crew pc
         WHERE pc.projekat_id = ? AND pc.radnik_id = ?
         LIMIT 1`,
        [id, radnikId, id, radnikId],
      );
      if (!accessRows?.length) {
        return NextResponse.json(
          { success: false, message: "Pristup nije dozvoljen", data: null },
          { status: 403 },
        );
      }
    }

    // ✅ view + kanonski budžet iz projekat_stavke (KM) + status za mobile
    const rows = await query(
      `
      SELECT
        v.projekat_id,
        v.radni_naziv,

        p.status_id,
        sp.naziv_statusa AS status_name,

        -- ✅ NOVO: operativni signal (owner -> tim)
        p.operativni_signal,

        -- ✅ NOVO: procenat budžeta vidljiv radnicima (default 100.00)
        COALESCE(p.budzet_procenat_za_tim, 100.00) AS budzet_procenat_za_tim,

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
      LEFT JOIN statusi_projekta sp
        ON sp.status_id = p.status_id
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
      [id, id],
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Projekat nije pronađen", data: null },
        { status: 404 },
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
      [id],
    );

    return NextResponse.json({
      success: true,
      data: { project: rows[0], costs },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
