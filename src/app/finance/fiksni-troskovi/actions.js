"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";

const FREQUENCIES = ["MJESECNO", "GODISNJE", "JEDNOKRATNO"];
const VALUTE = ["BAM", "EUR", "USD"];
const NACINI_PLACANJA = ["POSLOVNI_RACUN", "PRIVATNI_RACUN"];

function assertNaziv(naziv) {
  const s = String(naziv ?? "").trim();
  if (!s) throw new Error("Naziv je obavezan.");
  if (s.length > 255) throw new Error("Naziv je predugačak (max 255).");
}

function assertFrekvencija(frekvencija) {
  if (!FREQUENCIES.includes(frekvencija))
    throw new Error("Neispravna frekvencija.");
}

function parseIznos(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) throw new Error("Iznos mora biti broj.");
  if (n < 0) throw new Error("Iznos ne može biti negativan.");
  return Math.round(n * 100) / 100;
}

function parseDan(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 31)
    throw new Error("Dan u mjesecu mora biti 1–31.");
  return n;
}

function parseDate(v) {
  const s = String(v ?? "").trim().slice(0, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function normValuta(v) {
  const u = String(v ?? "BAM").trim().toUpperCase();
  if (u === "KM") return "BAM";
  return VALUTE.includes(u) ? u : "BAM";
}

function normNacinPlacanja(v) {
  const s = String(v ?? "POSLOVNI_RACUN").trim().toUpperCase();
  return NACINI_PLACANJA.includes(s) ? s : "POSLOVNI_RACUN";
}

async function tableExists(tableName) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName],
  );
  return Number(rows?.[0]?.cnt ?? 0) > 0;
}

async function getFiksniColumns() {
  const rows = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'fiksni_troskovi'`,
  );
  const set = new Set((rows ?? []).map((r) => String(r.column_name)));
  return {
    hasNacinPlacanja: set.has("nacin_placanja"),
    hasNapomena: set.has("napomena"),
  };
}

export async function createFiksniTrosak(data) {
  assertNaziv(data.naziv_troska);
  assertFrekvencija(data.frekvencija);
  const iznos = parseIznos(data.iznos);
  const valuta = normValuta(data.valuta);
  const dan_u_mjesecu = parseDan(data.dan_u_mjesecu);
  const datum_dospijeca = parseDate(data.datum_dospijeca);
  const nacin_placanja = normNacinPlacanja(data.nacin_placanja);
  const napomena = String(data.napomena ?? "").trim() || null;
  const aktivan = data.aktivan ? 1 : 0;

  const cols = await getFiksniColumns();
  if (cols.hasNacinPlacanja && cols.hasNapomena) {
    await query(
      `INSERT INTO fiksni_troskovi
       (naziv_troska, frekvencija, dan_u_mjesecu, datum_dospijeca, zadnje_placeno, iznos, valuta, nacin_placanja, napomena, aktivan)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
      [
        data.naziv_troska.trim(),
        data.frekvencija,
        dan_u_mjesecu,
        datum_dospijeca,
        iznos,
        valuta,
        nacin_placanja,
        napomena,
        aktivan,
      ],
    );
  } else {
    await query(
      `INSERT INTO fiksni_troskovi
       (naziv_troska, frekvencija, dan_u_mjesecu, datum_dospijeca, zadnje_placeno, iznos, valuta, aktivan)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        data.naziv_troska.trim(),
        data.frekvencija,
        dan_u_mjesecu,
        datum_dospijeca,
        iznos,
        valuta,
        aktivan,
      ],
    );
  }

  revalidatePath("/finance/fiksni-troskovi");
  revalidatePath("/finance/fiksni-troskovi/raspored");
  revalidatePath("/finance/cashflow");
  revalidatePath("/finance/kuf");
  return { ok: true };
}

export async function updateFiksniTrosak(data) {
  const id = Number(data.trosak_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan ID troška.");

  assertNaziv(data.naziv_troska);
  assertFrekvencija(data.frekvencija);
  const iznos = parseIznos(data.iznos);
  const valuta = normValuta(data.valuta);
  const dan_u_mjesecu = parseDan(data.dan_u_mjesecu);
  const datum_dospijeca = parseDate(data.datum_dospijeca);
  const nacin_placanja = normNacinPlacanja(data.nacin_placanja);
  const napomena = String(data.napomena ?? "").trim() || null;
  const aktivan = data.aktivan ? 1 : 0;

  const cols = await getFiksniColumns();
  if (cols.hasNacinPlacanja && cols.hasNapomena) {
    await query(
      `UPDATE fiksni_troskovi
       SET naziv_troska = ?,
           frekvencija = ?,
           dan_u_mjesecu = ?,
           datum_dospijeca = ?,
           iznos = ?,
           valuta = ?,
           nacin_placanja = ?,
           napomena = ?,
           aktivan = ?
       WHERE trosak_id = ?`,
      [
        data.naziv_troska.trim(),
        data.frekvencija,
        dan_u_mjesecu,
        datum_dospijeca,
        iznos,
        valuta,
        nacin_placanja,
        napomena,
        aktivan,
        id,
      ],
    );
  } else {
    await query(
      `UPDATE fiksni_troskovi
       SET naziv_troska = ?,
           frekvencija = ?,
           dan_u_mjesecu = ?,
           datum_dospijeca = ?,
           iznos = ?,
           valuta = ?,
           aktivan = ?
       WHERE trosak_id = ?`,
      [
        data.naziv_troska.trim(),
        data.frekvencija,
        dan_u_mjesecu,
        datum_dospijeca,
        iznos,
        valuta,
        aktivan,
        id,
      ],
    );
  }

  revalidatePath("/finance/fiksni-troskovi");
  revalidatePath("/finance/fiksni-troskovi/raspored");
  revalidatePath("/finance/cashflow");
  revalidatePath("/finance/kuf");
  return { ok: true };
}

/** Postavi aktivan = 0 (soft delete) ili 1 (reaktiviraj). */
export async function setFiksniTrosakActive(trosak_id, aktivan) {
  const id = Number(trosak_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan ID troška.");
  const active = aktivan ? 1 : 0;

  await query(
    `UPDATE fiksni_troskovi SET aktivan = ? WHERE trosak_id = ?`,
    [active, id],
  );

  revalidatePath("/finance/fiksni-troskovi");
  revalidatePath("/finance/fiksni-troskovi/raspored");
  revalidatePath("/finance/cashflow");
  revalidatePath("/finance/kuf");
  return { ok: true };
}

/**
 * Brisanje je dozvoljeno samo ako nema prometa:
 * - nema vezu u KUF (kuf_ulazne_fakture.fiksni_trosak_id)
 * - nema link na bank posting (bank_tx_fixed_link.fiksni_trosak_id)
 * - nema evidentirano zadnje_placeno
 */
export async function deleteFiksniTrosak(trosak_id) {
  const id = Number(trosak_id);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Neispravan ID troška.");
  }

  const baseRows = await query(
    `SELECT trosak_id, zadnje_placeno FROM fiksni_troskovi WHERE trosak_id = ? LIMIT 1`,
    [id],
  );
  const row = baseRows?.[0];
  if (!row) throw new Error("Trošak nije pronađen.");
  if (row.zadnje_placeno) {
    throw new Error(
      "Stavka se ne može obrisati jer ima evidentirano plaćanje. Možete je samo deaktivirati.",
    );
  }

  let kufCnt = 0;
  if (await tableExists("kuf_ulazne_fakture")) {
    const kufRows = await query(
      `SELECT COUNT(*) AS cnt
       FROM kuf_ulazne_fakture
       WHERE fiksni_trosak_id = ?`,
      [id],
    );
    kufCnt = Number(kufRows?.[0]?.cnt ?? 0);
  }

  let bankCnt = 0;
  if (await tableExists("bank_tx_fixed_link")) {
    const bankRows = await query(
      `SELECT COUNT(*) AS cnt
       FROM bank_tx_fixed_link
       WHERE fiksni_trosak_id = ?`,
      [id],
    );
    bankCnt = Number(bankRows?.[0]?.cnt ?? 0);
  }

  if (kufCnt > 0 || bankCnt > 0) {
    throw new Error(
      "Stavka ima promet i ne može se obrisati. Možete je samo deaktivirati.",
    );
  }

  await query(`DELETE FROM fiksni_troskovi WHERE trosak_id = ?`, [id]);

  revalidatePath("/finance/fiksni-troskovi");
  revalidatePath("/finance/fiksni-troskovi/raspored");
  revalidatePath("/finance/cashflow");
  revalidatePath("/finance/kuf");
  return { ok: true };
}
