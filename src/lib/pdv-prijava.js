// Obračun PDV za prijavu: izlazni (KIF) − ulazni (KUF) = za prijavu. Liste dokumenata.
import { query } from "@/lib/db";

const LIST_LIMIT = 5000;
const ARHIVA_CUTOFF = "2025-12-31";

/** Vraća datum kao YYYY-MM-DD (iz Date objekta ili stringa). */
function toIsoDate(val) {
  if (val == null) return null;
  const s = typeof val === "string" ? val.trim() : null;
  if (s && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getLastMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export async function getPdvPrijavaData(from, to) {
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) from = null;
  if (!to || !/^\d{4}-\d{2}-\d{2}$/.test(to)) to = null;
  const range = getLastMonthRange();
  from = from || range.from;
  to = to || range.to;

  const whereF = ["(f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))"];
  const paramsF = [from, to];
  whereF.push("f.datum_izdavanja >= ?", "f.datum_izdavanja <= ?");

  let kifRows = [];
  try {
    kifRows = await query(
      `SELECT f.faktura_id, f.broj_fakture_puni AS broj_fakture, f.datum_izdavanja,
              f.osnovica_km, f.pdv_iznos_km AS pdv_iznos, f.iznos_ukupno_km,
              c.naziv_klijenta AS kupac
       FROM fakture f
       LEFT JOIN klijenti c ON c.klijent_id = f.bill_to_klijent_id
       WHERE ${whereF.join(" AND ")}
       ORDER BY f.datum_izdavanja ASC, f.faktura_id ASC
       LIMIT ${LIST_LIMIT}`,
      paramsF,
    );
  } catch {
    kifRows = [];
  }

  const kif = (kifRows || []).map((r) => ({
    tip: "KIF",
    id: r.faktura_id,
    broj: r.broj_fakture ?? `#${r.faktura_id}`,
    datum: toIsoDate(r.datum_izdavanja),
    kupac: r.kupac ?? "—",
    osnovica_km: Number(r.osnovica_km) || 0,
    pdv_km: Number(r.pdv_iznos) || 0,
    ukupno_km: Number(r.iznos_ukupno_km) || 0,
    iz_arhive: false,
  }));

  try {
    const archRows = await query(
      `SELECT broj_fakture, MAX(datum_fakture) AS datum_fakture,
              ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS iznos_km,
              ROUND(SUM(COALESCE(iznos_ukupno_km, iznos_sa_pdv_km, iznos_km)), 2) AS ukupno_faktura
       FROM stg_master_finansije
       WHERE datum_fakture IS NOT NULL AND datum_fakture <= ?
         AND datum_fakture >= ? AND datum_fakture <= ?
       GROUP BY broj_fakture
       ORDER BY datum_fakture ASC, broj_fakture ASC
       LIMIT ${LIST_LIMIT}`,
      [ARHIVA_CUTOFF, from, to],
    );
    for (const r of archRows || []) {
      const osn = Number(r.iznos_km) || 0;
      const uk = Number(r.ukupno_faktura ?? r.iznos_km) || osn;
      const pdv = Math.max(0, uk - osn);
      kif.push({
        tip: "KIF",
        id: null,
        broj: r.broj_fakture ?? "—",
        datum: toIsoDate(r.datum_fakture),
        kupac: "(arhiva)",
        osnovica_km: osn,
        pdv_km: pdv,
        ukupno_km: uk,
        iz_arhive: true,
      });
    }
  } catch {
    // no archive
  }
  kif.sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));

  const pdv_izlazni_ukupno = kif.reduce((s, i) => s + i.pdv_km, 0);

  let kufRows = [];
  try {
    kufRows = await query(
      `SELECT k.kuf_id, k.broj_fakture, k.datum_fakture, k.iznos_km, k.partner_naziv,
              d.naziv AS dobavljac_naziv, kl.naziv_klijenta AS klijent_naziv
       FROM kuf_ulazne_fakture k
       LEFT JOIN dobavljaci d ON d.dobavljac_id = k.dobavljac_id
       LEFT JOIN klijenti kl ON kl.klijent_id = k.klijent_id
       WHERE k.datum_fakture >= ? AND k.datum_fakture <= ?
         AND (k.status IS NULL OR k.status NOT IN ('STORNO'))
       ORDER BY k.datum_fakture ASC, k.kuf_id ASC
       LIMIT ${LIST_LIMIT}`,
      [from, to],
    );
  } catch {
    kufRows = [];
  }

  const kuf = (kufRows || []).map((r) => {
    const ukupno = Number(r.iznos_km) || 0;
    const pdvUlazni = Math.round(ukupno * (17 / 117) * 100) / 100;
    const osnovica = Math.round((ukupno - pdvUlazni) * 100) / 100;
    const partner = r.dobavljac_naziv || r.klijent_naziv || r.partner_naziv || "—";
    return {
      tip: "KUF",
      id: r.kuf_id,
      broj: r.broj_fakture ?? `KUF#${r.kuf_id}`,
      datum: toIsoDate(r.datum_fakture),
      partner,
      osnovica_km: osnovica,
      pdv_km: pdvUlazni,
      ukupno_km: ukupno,
    };
  });

  const pdv_ulazni_ukupno = kuf.reduce((s, i) => s + i.pdv_km, 0);
  const za_prijavu = Math.round((pdv_izlazni_ukupno - pdv_ulazni_ukupno) * 100) / 100;

  return {
    from,
    to,
    summary: {
      pdv_izlazni_km: Math.round(pdv_izlazni_ukupno * 100) / 100,
      pdv_ulazni_km: Math.round(pdv_ulazni_ukupno * 100) / 100,
      za_prijavu_km: za_prijavu,
    },
    kif,
    kuf,
  };
}
