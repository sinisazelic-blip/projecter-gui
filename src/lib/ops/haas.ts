import { query, withTransaction } from "@/lib/db";
import { computeNextInvoiceNumbers } from "@/lib/fakture/next-invoice-numbers";
import {
  ensureOpsTables,
  type OpsHaasCijena,
  type OpsHaasFaktura,
  type OpsHaasStavka,
} from "@/lib/ops/schema";
import { assertOpsNarucilac } from "@/lib/ops/queries";

export async function listOpsHaasCjenovnik(): Promise<OpsHaasCijena[]> {
  await ensureOpsTables();
  const rows = await query<OpsHaasCijena>(
    `SELECT a.artikal_id, a.sifra, a.naziv,
            COALESCE(c.cijena_bam, 0) AS cijena_bam,
            COALESCE(c.cijena_eur, 0) AS cijena_eur
     FROM ops_artikli a
     LEFT JOIN ops_haas_cjenovnik c ON c.artikal_id = a.artikal_id
     WHERE a.vrsta = 'SABLON' AND a.aktivan = 1
     ORDER BY a.sifra ASC`,
  );
  return (rows ?? []).map((r) => ({
    ...r,
    cijena_bam: Number(r.cijena_bam),
    cijena_eur: Number(r.cijena_eur),
  }));
}

export async function upsertOpsHaasCijena(input: {
  artikal_id: number;
  cijena_bam: number;
  cijena_eur: number;
}): Promise<void> {
  await ensureOpsTables();
  const id = Number(input.artikal_id);
  if (!id) throw new Error("ARTIKAL_REQUIRED");
  await query(
    `INSERT INTO ops_haas_cjenovnik (artikal_id, cijena_bam, cijena_eur)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE cijena_bam = VALUES(cijena_bam), cijena_eur = VALUES(cijena_eur)`,
    [id, Number(input.cijena_bam) || 0, Number(input.cijena_eur) || 0],
  );
}

export async function previewOpsHaas(kompletacijaId: number, valuta: "BAM" | "EUR") {
  await ensureOpsTables();
  const ev = await query<{
    kompletacija_id: number;
    broj: string;
    event_naziv: string;
    klasa_rizika: string;
    klijent_id: number | null;
    klijent_naziv: string | null;
    faktura_id: number | null;
  }>(
    `SELECT kompletacija_id, broj, event_naziv, klasa_rizika, klijent_id,
            klijent_naziv, faktura_id
     FROM ops_kompletacije WHERE kompletacija_id = ? LIMIT 1`,
    [kompletacijaId],
  );
  const event = ev?.[0];
  if (!event) throw new Error("KOMPLETACIJA_INVALID");
  if (event.faktura_id) throw new Error("VEC_FAKTURISANO");

  const units = await query<{
    artikal_id: number;
    sifra: string;
    naziv: string;
    kod: string;
  }>(
    `SELECT a.artikal_id, a.sifra, a.naziv, s.kod
     FROM ops_kompletacija_stavke s
     JOIN ops_jedinice_opreme e ON e.jedinica_id = s.jedinica_id
     JOIN ops_artikli a ON a.artikal_id = e.artikal_id
     WHERE s.kompletacija_id = ?
     ORDER BY a.sifra ASC, s.kod ASC`,
    [kompletacijaId],
  );
  if (!units?.length) throw new Error("NEMA_KOMADA");

  const cjenovnik = await listOpsHaasCjenovnik();
  const byArt = new Map<number, OpsHaasStavka>();
  for (const u of units) {
    const price = cjenovnik.find((c) => c.artikal_id === u.artikal_id);
    const cijena =
      valuta === "EUR" ? Number(price?.cijena_eur ?? 0) : Number(price?.cijena_bam ?? 0);
    const row = byArt.get(u.artikal_id) ?? {
      artikal_id: u.artikal_id,
      sifra: u.sifra,
      naziv: u.naziv,
      kolicina: 0,
      cijena,
      serije: [],
    };
    row.kolicina += 1;
    row.serije.push(u.kod);
    byArt.set(u.artikal_id, row);
  }
  const lines = [...byArt.values()];
  const osnovica = lines.reduce((acc, l) => acc + l.kolicina * l.cijena, 0);
  return { event, lines, osnovica, valuta };
}

export async function listOpsHaasFakture(): Promise<OpsHaasFaktura[]> {
  await ensureOpsTables();
  const rows = await query<OpsHaasFaktura>(
    `SELECT h.haas_faktura_id, h.faktura_id, f.broj_fakture_puni AS broj_fakture,
            h.kompletacija_id, k.event_naziv, c.naziv_klijenta AS klijent_naziv,
            h.osnovica, h.valuta, h.created_at
     FROM ops_haas_fakture h
     JOIN ops_kompletacije k ON k.kompletacija_id = h.kompletacija_id
     LEFT JOIN fakture f ON f.faktura_id = h.faktura_id
     LEFT JOIN klijenti c ON c.klijent_id = h.klijent_id
     ORDER BY h.haas_faktura_id DESC
     LIMIT 80`,
  );
  return (rows ?? []).map((r) => ({ ...r, osnovica: Number(r.osnovica) }));
}

export async function getOpsHaasByFaktura(fakturaId: number): Promise<{
  header: OpsHaasFaktura | null;
  event_naziv?: string;
  klasa_rizika?: string;
  lines: Array<OpsHaasStavka & { serije: string[] }>;
} | null> {
  await ensureOpsTables();
  const hdr = await query<OpsHaasFaktura & { event_naziv?: string; klasa_rizika?: string }>(
    `SELECT h.haas_faktura_id, h.faktura_id, h.kompletacija_id, h.osnovica, h.valuta,
            k.event_naziv, k.klasa_rizika
     FROM ops_haas_fakture h
     JOIN ops_kompletacije k ON k.kompletacija_id = h.kompletacija_id
     WHERE h.faktura_id = ?
     LIMIT 1`,
    [fakturaId],
  );
  const header = hdr?.[0];
  if (!header) return null;
  const lines = await query<{
    artikal_id: number;
    sifra: string;
    naziv: string;
    kolicina: number;
    cijena: number;
    serije: string | null;
  }>(
    `SELECT artikal_id, sifra, naziv, kolicina, cijena, serije
     FROM ops_haas_stavke WHERE haas_faktura_id = ? ORDER BY stavka_id ASC`,
    [header.haas_faktura_id],
  );
  return {
    header: { ...header, osnovica: Number(header.osnovica) },
    event_naziv: header.event_naziv,
    klasa_rizika: header.klasa_rizika,
    lines: (lines ?? []).map((l) => ({
      artikal_id: l.artikal_id,
      sifra: l.sifra,
      naziv: l.naziv,
      kolicina: Number(l.kolicina),
      cijena: Number(l.cijena),
      serije: l.serije
        ? String(l.serije)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    })),
  };
}

export async function createOpsHaasFaktura(input: {
  kompletacija_id: number;
  klijent_id: number;
  datum: string;
  valuta: "BAM" | "EUR";
  vat: "BH_17" | "INO_0";
  lines?: Array<{ artikal_id: number; cijena: number }>;
}): Promise<{ faktura_id: number; broj_fakture: string }> {
  await ensureOpsTables();
  const preview = await previewOpsHaas(input.kompletacija_id, input.valuta);
  const billTo = await assertOpsNarucilac(input.klijent_id);
  const klijentId = billTo.klijent_id;
  const datum = String(input.datum ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw new Error("DATUM_REQUIRED");

  const overrides = new Map(
    (input.lines ?? []).map((l) => [Number(l.artikal_id), Number(l.cijena)]),
  );
  const lines = preview.lines.map((l) => ({
    ...l,
    cijena: overrides.has(l.artikal_id) ? Number(overrides.get(l.artikal_id)) : l.cijena,
  }));
  if (lines.some((l) => !(l.cijena > 0))) throw new Error("CIJENA_REQUIRED");
  const osnovica = Math.round(
    lines.reduce((acc, l) => acc + l.kolicina * l.cijena, 0) * 100,
  ) / 100;
  if (!(osnovica > 0)) throw new Error("OSNOVICA_REQUIRED");

  const vatMode = input.vat === "INO_0" ? "INO_0" : "BH_17";
  const pdvStopa = vatMode === "BH_17" ? 17 : 0;
  const pdvIznos = vatMode === "BH_17" ? Math.round(osnovica * 0.17 * 100) / 100 : 0;
  const ukupno = Math.round((osnovica + pdvIznos) * 100) / 100;
  const godina = Number(datum.slice(0, 4));
  const nums = await computeNextInvoiceNumbers(godina);
  const valuta = input.valuta === "EUR" ? "EUR" : "BAM";
  const pnb = `${String(godina).slice(2)}${String(nums.next_broj_u_godini).padStart(6, "0")}`;

  let fakturaId = 0;
  await withTransaction(async (conn) => {
    const [lock] = (await conn.query(
      `SELECT faktura_id FROM ops_kompletacije WHERE kompletacija_id = ? FOR UPDATE`,
      [input.kompletacija_id],
    )) as unknown as [{ faktura_id: number | null }[]];
    if (lock?.[0]?.faktura_id) throw new Error("VEC_FAKTURISANO");

    const [ins] = (await conn.query(
      `INSERT INTO fakture
         (bill_to_klijent_id, godina, broj_u_godini, broj_fiskalni, fiskalni_status,
          datum_izdavanja, tip, valuta, osnovica_km, pdv_stopa, pdv_iznos_km,
          pdv_obracunat, iznos_ukupno_km, poziv_na_broj)
       VALUES (?, ?, ?, ?, 'DODIJELJEN', ?, 'obicna', ?, ?, ?, ?, ?, ?, ?)`,
      [
        klijentId,
        godina,
        nums.next_broj_u_godini,
        nums.next_pfr,
        datum,
        valuta,
        osnovica,
        pdvStopa,
        pdvIznos,
        vatMode === "BH_17" ? 1 : 0,
        ukupno,
        pnb,
      ],
    )) as unknown as [{ insertId?: number }];
    fakturaId = Number(ins?.insertId ?? 0);
    if (!fakturaId) throw new Error("FAKTURA_INSERT");

    try {
      await conn.query(
        `INSERT INTO brojac_faktura (godina, zadnji_broj_u_godini) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE zadnji_broj_u_godini = GREATEST(zadnji_broj_u_godini, ?)`,
        [godina, nums.next_broj_u_godini, nums.next_broj_u_godini],
      );
    } catch {
      /* brojac optional */
    }

    const [hins] = (await conn.query(
      `INSERT INTO ops_haas_fakture
         (faktura_id, kompletacija_id, klijent_id, valuta, osnovica)
       VALUES (?, ?, ?, ?, ?)`,
      [fakturaId, input.kompletacija_id, klijentId, valuta, osnovica],
    )) as unknown as [{ insertId?: number }];
    const haasId = Number(hins?.insertId ?? 0);
    if (!haasId) throw new Error("HAAS_INSERT");

    for (const line of lines) {
      await conn.query(
        `INSERT INTO ops_haas_stavke
           (haas_faktura_id, artikal_id, sifra, naziv, kolicina, cijena, serije)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          haasId,
          line.artikal_id,
          line.sifra,
          line.naziv,
          line.kolicina,
          line.cijena,
          line.serije.join(","),
        ],
      );
    }

    await conn.query(
      `UPDATE ops_kompletacije SET faktura_id = ? WHERE kompletacija_id = ?`,
      [fakturaId, input.kompletacija_id],
    );
  });

  return { faktura_id: fakturaId, broj_fakture: nums.next_broj_fakture };
}
