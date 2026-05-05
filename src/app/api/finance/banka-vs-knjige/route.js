// GET: Banka vs knjige – usporedba stanja po izvodima i po internoj evidenciji (prihodi, plaćanja).
// Query: to=YYYY-MM-DD (opciono; default = danas). from=YYYY-MM-DD (opciono; za promet u periodu).
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// EUR → KM ako nema kursne liste (pojednostavljeno)
const EUR_TO_KM = 1.95;

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const toParam = (url.searchParams.get("to") ?? "").trim();
    const fromParam = (url.searchParams.get("from") ?? "").trim();

    const toDate = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : new Date().toISOString().slice(0, 10);
    const fromDate = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : null;

    // 1) Stanje po banki (suma postinga do to_date, u KM; isključujemo stornirane)
    let stanjeBanke = 0;
    try {
      const bankRows = await query(
        `
        SELECT
          SUM(
            CASE
              WHEN UPPER(TRIM(COALESCE(currency, ''))) IN ('EUR') THEN amount * ?
              ELSE amount
            END
          ) AS total_km
        FROM bank_tx_posting
        WHERE value_date <= ?
          AND (reversed_at IS NULL AND (reversed_by_batch_id IS NULL OR reversed_by_batch_id = 0))
        `,
        [EUR_TO_KM, toDate],
      );
      const val = bankRows?.[0]?.total_km;
      stanjeBanke = Number(val) != null && !Number.isNaN(Number(val)) ? Number(val) : 0;
    } catch {
      stanjeBanke = 0;
    }

    // 2) Stanje po knjigama do to_date: suma(prihodi) - suma(placanja)
    let sumaPrihodi = 0;
    let sumaPlacanja = 0;
    try {
      const [prihodiRows, placanjaRows] = await Promise.all([
        query(
          `SELECT COALESCE(SUM(iznos_km), 0) AS s FROM projektni_prihodi WHERE COALESCE(datum_prihoda, datum) <= ?`,
          [toDate],
        ).catch(() => [{ s: 0 }]),
        query(
          `SELECT COALESCE(SUM(iznos_km), 0) AS s FROM placanja WHERE COALESCE(datum_placanja, datum) <= ?`,
          [toDate],
        ).catch(() => [{ s: 0 }]),
      ]);
      sumaPrihodi = Number(prihodiRows?.[0]?.s ?? 0) || 0;
      sumaPlacanja = Number(placanjaRows?.[0]?.s ?? 0) || 0;
    } catch {
      sumaPrihodi = 0;
      sumaPlacanja = 0;
    }

    const stanjeKnjige = sumaPrihodi - sumaPlacanja;

    // 2b) Kreditne obaveze (preostali dug aktivnih kredita)
    let kreditObaveze = 0;
    try {
      const cols = await query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'krediti'`,
      ).catch(() => []);
      const colSet = new Set((cols ?? []).map((c) => String(c.column_name)));
      const hasIznosKredita = colSet.has("iznos_kredita");
      const hasKamataTroskovi = colSet.has("iznos_kamata_troskovi");

      const kreditiRows = await query(
        `
        SELECT
          broj_rata,
          uplaceno_rata,
          iznos_rate,
          ukupan_iznos,
          ${hasIznosKredita ? "iznos_kredita" : "NULL AS iznos_kredita"},
          ${hasKamataTroskovi ? "iznos_kamata_troskovi" : "NULL AS iznos_kamata_troskovi"}
        FROM krediti
        WHERE COALESCE(aktivan, 1) = 1
        `,
      ).catch(() => []);

      kreditObaveze = (kreditiRows ?? []).reduce((sum, r) => {
        const brojRata = Number(r?.broj_rata ?? 0);
        const uplaceno = Number(r?.uplaceno_rata ?? 0);
        const ostaloRata = Math.max(0, brojRata - uplaceno);
        if (ostaloRata <= 0) return sum;

        const glavnica = Number(r?.iznos_kredita ?? 0);
        const kamataTroskovi = Number(r?.iznos_kamata_troskovi ?? 0);
        const ukupno = Number(
          r?.ukupan_iznos ??
            (Number.isFinite(glavnica) && Number.isFinite(kamataTroskovi)
              ? glavnica + kamataTroskovi
              : 0),
        );
        const iznosRate =
          r?.iznos_rate != null && Number.isFinite(Number(r.iznos_rate))
            ? Number(r.iznos_rate)
            : brojRata > 0
              ? ukupno / brojRata
              : 0;
        const ostatak = ostaloRata * (Number.isFinite(iznosRate) ? iznosRate : 0);
        return sum + (Number.isFinite(ostatak) ? ostatak : 0);
      }, 0);
    } catch {
      kreditObaveze = 0;
    }

    const stanjeKnjigeNeto = stanjeKnjige - kreditObaveze;
    const razlika = Math.round((stanjeBanke - stanjeKnjige) * 100) / 100;

    // 3) Opciono: promet u periodu (from – to)
    let prometBanke = null;
    let prometPrihodi = null;
    let prometPlacanja = null;
    if (fromDate) {
      try {
        const [pb, pp, pl] = await Promise.all([
          query(
            `
            SELECT SUM(
              CASE WHEN UPPER(TRIM(COALESCE(currency, ''))) IN ('EUR') THEN amount * ? ELSE amount END
            ) AS s
            FROM bank_tx_posting
            WHERE value_date >= ? AND value_date <= ?
              AND (reversed_at IS NULL AND (reversed_by_batch_id IS NULL OR reversed_by_batch_id = 0))
            `,
            [EUR_TO_KM, fromDate, toDate],
          ).then((r) => Number(r?.[0]?.s ?? 0) || 0),
          query(
            `SELECT COALESCE(SUM(iznos_km), 0) AS s FROM projektni_prihodi WHERE COALESCE(datum_prihoda, datum) >= ? AND COALESCE(datum_prihoda, datum) <= ?`,
            [fromDate, toDate],
          ).then((r) => Number(r?.[0]?.s ?? 0) || 0),
          query(
            `SELECT COALESCE(SUM(iznos_km), 0) AS s FROM placanja WHERE COALESCE(datum_placanja, datum) >= ? AND COALESCE(datum_placanja, datum) <= ?`,
            [fromDate, toDate],
          ).then((r) => Number(r?.[0]?.s ?? 0) || 0),
        ]);
        prometBanke = pb;
        prometPrihodi = pp;
        prometPlacanja = pl;
      } catch {
        prometBanke = 0;
        prometPrihodi = 0;
        prometPlacanja = 0;
      }
    }

    return NextResponse.json({
      ok: true,
      to_date: toDate,
      from_date: fromDate || null,
      stanje_banke_km: Math.round(stanjeBanke * 100) / 100,
      stanje_knjige_km: Math.round(stanjeKnjige * 100) / 100,
      kredit_obaveze_km: Math.round(kreditObaveze * 100) / 100,
      stanje_knjige_neto_km: Math.round(stanjeKnjigeNeto * 100) / 100,
      suma_prihodi_km: Math.round(sumaPrihodi * 100) / 100,
      suma_placanja_km: Math.round(sumaPlacanja * 100) / 100,
      razlika_km: razlika,
      u_ravnotezi: Math.abs(razlika) < 0.02,
      promet_u_periodu: fromDate
        ? {
            banka_km: prometBanke,
            prihodi_km: prometPrihodi,
            placanja_km: prometPlacanja,
            knjige_neto_km: (prometPrihodi ?? 0) - (prometPlacanja ?? 0),
          }
        : null,
    });
  } catch (e) {
    console.error("GET /api/finance/banka-vs-knjige", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
