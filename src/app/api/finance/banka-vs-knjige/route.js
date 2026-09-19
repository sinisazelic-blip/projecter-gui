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

    // 1) Banka - Prilivi i Odlivi do toDate
    let bankaPrilivi = 0;
    let bankaOdlivi = 0;
    try {
      const bankRows = await query(
        `
        SELECT
          SUM(CASE WHEN amount > 0 THEN amount * CASE WHEN UPPER(TRIM(COALESCE(currency, ''))) = 'EUR' THEN ? ELSE 1.0 END ELSE 0 END) AS prilivi_km,
          SUM(CASE WHEN amount < 0 THEN amount * CASE WHEN UPPER(TRIM(COALESCE(currency, ''))) = 'EUR' THEN ? ELSE 1.0 END ELSE 0 END) AS odlivi_km
        FROM bank_tx_posting
        WHERE value_date <= ?
          AND (reversed_at IS NULL AND (reversed_by_batch_id IS NULL OR reversed_by_batch_id = 0))
        `,
        [EUR_TO_KM, EUR_TO_KM, toDate],
      );
      bankaPrilivi = Number(bankRows?.[0]?.prilivi_km ?? 0) || 0;
      bankaOdlivi = Number(bankRows?.[0]?.odlivi_km ?? 0) || 0;
    } catch {
      bankaPrilivi = 0;
      bankaOdlivi = 0;
    }

    const stanjeBanke = bankaPrilivi + bankaOdlivi; // odlivi su negativni

    // 2) Knjigovodstvo: Fakturisano i KUF/Troškovi
    let ukupnoFakturisano = 0;
    let ukupnoKufTroskovi = 0;
    try {
      const [faktRows, kufRows] = await Promise.all([
        query(
          `
          SELECT COALESCE(SUM(iznos_ukupno_km * CASE WHEN UPPER(TRIM(COALESCE(valuta, 'BAM'))) = 'EUR' THEN 1.95583 ELSE 1.0 END), 0) AS s
          FROM fakture
          WHERE DATE(datum_izdavanja) <= ?
            AND (fiskalni_status IS NULL OR fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
          `,
          [toDate],
        ).catch(() => [{ s: 0 }]),
        query(
          `
          SELECT COALESCE(SUM(iznos_km), 0) AS s
          FROM kuf_ulazne_fakture
          WHERE DATE(datum_fakture) <= ?
            AND (status IS NULL OR status <> 'STORNIRANO')
          `,
          [toDate],
        ).catch(() => [{ s: 0 }]),
      ]);

      ukupnoFakturisano = Number(faktRows?.[0]?.s ?? 0) || 0;
      ukupnoKufTroskovi = Number(kufRows?.[0]?.s ?? 0) || 0;
    } catch {
      ukupnoFakturisano = 0;
      ukupnoKufTroskovi = 0;
    }

    // 3) Kreditne obaveze (preostali dug aktivnih poslovnih kredita npr. EKI)
    let kreditObaveze = 0;
    let kreditNaziv = "";
    try {
      const kreditiRows = await query(
        `
        SELECT
          kredit_id,
          naziv_kredita,
          broj_rata,
          uplaceno_rata,
          iznos_rate,
          ukupan_iznos
        FROM krediti
        WHERE COALESCE(aktivan, 1) = 1
        `,
      ).catch(() => []);

      kreditObaveze = (kreditiRows ?? []).reduce((sum, r) => {
        const brojRata = Number(r?.broj_rata ?? 0);
        const uplaceno = Number(r?.uplaceno_rata ?? 0);
        const ostaloRata = Math.max(0, brojRata - uplaceno);
        if (ostaloRata <= 0) return sum;
        if (!kreditNaziv) kreditNaziv = r?.naziv_kredita || "Poslovni kredit";

        const iznosRate = Number(r?.iznos_rate ?? 0);
        const ostatak = ostaloRata * iznosRate;
        return sum + (Number.isFinite(ostatak) ? ostatak : 0);
      }, 0);
    } catch {
      kreditObaveze = 0;
    }

    // 4) Nealocirani bankovni promet (potrebno povezati)
    let nealociraniPrilivi = 0;
    let nealociraniOdlivi = 0;
    try {
      const unallocRows = await query(
        `
        SELECT
          SUM(CASE WHEN b.amount > 0 THEN b.amount ELSE 0 END) AS unalloc_in,
          SUM(CASE WHEN b.amount < 0 THEN ABS(b.amount) ELSE 0 END) AS unalloc_out
        FROM bank_tx_posting b
        LEFT JOIN bank_tx_posting_prihod_link l ON l.posting_id = b.posting_id AND l.aktivan = 1
        LEFT JOIN bank_tx_posting_placanje_link pl ON pl.posting_id = b.posting_id AND pl.aktivan = 1
        LEFT JOIN bank_tx_fixed_link fl ON fl.posting_id = b.posting_id
        WHERE b.value_date <= ?
          AND l.link_id IS NULL
          AND pl.link_id IS NULL
          AND fl.link_id IS NULL
          AND (b.reversed_at IS NULL AND (b.reversed_by_batch_id IS NULL OR b.reversed_by_batch_id = 0))
        `,
        [toDate],
      ).catch(() => []);
      nealociraniPrilivi = Number(unallocRows?.[0]?.unalloc_in ?? 0) || 0;
      nealociraniOdlivi = Number(unallocRows?.[0]?.unalloc_out ?? 0) || 0;
    } catch {
      nealociraniPrilivi = 0;
      nealociraniOdlivi = 0;
    }

    // 5) Promet u traženom periodu (ako je zadat fromDate)
    let prometBanke = null;
    let prometFakturisano = null;
    let prometKuf = null;
    if (fromDate) {
      try {
        const [pb, pf, pk] = await Promise.all([
          query(
            `
            SELECT SUM(amount * CASE WHEN UPPER(TRIM(COALESCE(currency, ''))) = 'EUR' THEN ? ELSE 1.0 END) AS s
            FROM bank_tx_posting
            WHERE value_date >= ? AND value_date <= ?
              AND (reversed_at IS NULL AND (reversed_by_batch_id IS NULL OR reversed_by_batch_id = 0))
            `,
            [EUR_TO_KM, fromDate, toDate],
          ).then((r) => Number(r?.[0]?.s ?? 0) || 0),
          query(
            `
            SELECT COALESCE(SUM(iznos_ukupno_km * CASE WHEN UPPER(TRIM(COALESCE(valuta, 'BAM'))) = 'EUR' THEN 1.95583 ELSE 1.0 END), 0) AS s
            FROM fakture
            WHERE DATE(datum_izdavanja) >= ? AND DATE(datum_izdavanja) <= ?
              AND (fiskalni_status IS NULL OR fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
            `,
            [fromDate, toDate],
          ).then((r) => Number(r?.[0]?.s ?? 0) || 0),
          query(
            `
            SELECT COALESCE(SUM(iznos_km), 0) AS s
            FROM kuf_ulazne_fakture
            WHERE DATE(datum_fakture) >= ? AND DATE(datum_fakture) <= ?
              AND (status IS NULL OR status <> 'STORNIRANO')
            `,
            [fromDate, toDate],
          ).then((r) => Number(r?.[0]?.s ?? 0) || 0),
        ]);
        prometBanke = pb;
        prometFakturisano = pf;
        prometKuf = pk;
      } catch {
        prometBanke = 0;
        prometFakturisano = 0;
        prometKuf = 0;
      }
    }

    return NextResponse.json({
      ok: true,
      to_date: toDate,
      from_date: fromDate || null,
      stanje_banke_km: Math.round(stanjeBanke * 100) / 100,
      banka_prilivi_km: Math.round(bankaPrilivi * 100) / 100,
      banka_odlivi_km: Math.round(Math.abs(bankaOdlivi) * 100) / 100,
      fakturisano_km: Math.round(ukupnoFakturisano * 100) / 100,
      kuf_troskovi_km: Math.round(ukupnoKufTroskovi * 100) / 100,
      kredit_obaveze_km: Math.round(kreditObaveze * 100) / 100,
      kredit_naziv: kreditNaziv,
      nealocirani_prilivi_km: Math.round(nealociraniPrilivi * 100) / 100,
      nealocirani_odlivi_km: Math.round(nealociraniOdlivi * 100) / 100,
      u_ravnotezi: Math.abs(nealociraniPrilivi) < 0.01 && Math.abs(nealociraniOdlivi) < 0.01,
      promet_u_periodu: fromDate
        ? {
            banka_neto_km: prometBanke,
            fakturisano_km: prometFakturisano,
            kuf_troskovi_km: prometKuf,
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
