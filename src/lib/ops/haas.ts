import { query } from "@/lib/db";
import {
  ensureOpsTables,
  type OpsHaasCijena,
  type OpsHaasFaktura,
  type OpsHaasStavka,
} from "@/lib/ops/schema";

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

export async function createOpsHaasFaktura(_input: {
  kompletacija_id: number;
  klijent_id: number;
  datum: string;
  valuta: "BAM" | "EUR";
  vat: "BH_17" | "INO_0";
  lines?: Array<{ artikal_id: number; cijena: number }>;
}): Promise<{ faktura_id: number; broj_fakture: string }> {
  throw new Error("HAAS_FAKTURA_ZABRANJENA");
}
