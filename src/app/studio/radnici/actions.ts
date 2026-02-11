"use server";

import { query } from "@/lib/db";

function cleanStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function toBit(v: any): 0 | 1 {
  return v ? 1 : 0;
}

async function getRadniciColumns(): Promise<Set<string>> {
  const rows: any[] = await query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'radnici'
        AND COLUMN_NAME IN ('adresa','broj_telefona','telefon','email','datum_rodjenja','jib','aktivan','opis')`,
  );
  return new Set((rows ?? []).map((r) => String(r.COLUMN_NAME).toLowerCase()));
}

export async function createRadnik(input: {
  ime: string;
  prezime: string;
  adresa?: string | null;
  broj_telefona?: string | null;
  email?: string | null;
  datum_rodjenja?: string | null;
  jib?: string | null;
  aktivan?: boolean;
  opis?: string | null;
}) {
  const ime = String(input?.ime ?? "").trim();
  if (!ime) throw new Error("Ime je obavezno.");

  const prezime = String(input?.prezime ?? "").trim();
  if (!prezime) throw new Error("Prezime je obavezno.");

  const colSet = await getRadniciColumns();
  const hasAdresa = colSet.has("adresa");
  const hasBrojTelefona = colSet.has("broj_telefona");
  const hasTelefon = colSet.has("telefon");
  const hasEmail = colSet.has("email");
  const hasDatumRodjenja = colSet.has("datum_rodjenja");
  const hasJib = colSet.has("jib");
  const hasAktivan = colSet.has("aktivan");
  const hasOpis = colSet.has("opis");

  const telCol = hasBrojTelefona ? "broj_telefona" : hasTelefon ? "telefon" : null;
  const telVal = cleanStr(input?.broj_telefona);

  const cols: string[] = ["ime", "prezime"];
  const vals: any[] = [ime, prezime];

  if (hasAdresa) {
    cols.push("adresa");
    vals.push(cleanStr(input?.adresa));
  }
  if (telCol) {
    cols.push(telCol);
    vals.push(telVal);
  }
  if (hasEmail) {
    cols.push("email");
    vals.push(cleanStr(input?.email));
  }
  if (hasDatumRodjenja) {
    cols.push("datum_rodjenja");
    vals.push(cleanStr(input?.datum_rodjenja) || null);
  }
  if (hasJib) {
    cols.push("jib");
    vals.push(cleanStr(input?.jib));
  }
  if (hasAktivan) {
    cols.push("aktivan");
    vals.push(toBit(input?.aktivan));
  }
  if (hasOpis) {
    cols.push("opis");
    vals.push(cleanStr(input?.opis));
  }

  const placeholders = cols.map(() => "?").join(",");
  await query(
    `INSERT INTO radnici (${cols.join(", ")}) VALUES (${placeholders})`,
    vals,
  );

  return { ok: true };
}

export async function updateRadnik(input: {
  radnik_id: number;
  ime: string;
  prezime: string;
  adresa?: string | null;
  broj_telefona?: string | null;
  email?: string | null;
  datum_rodjenja?: string | null;
  jib?: string | null;
  aktivan?: boolean;
  opis?: string | null;
}) {
  const id = Number(input?.radnik_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan radnik_id.");

  const ime = String(input?.ime ?? "").trim();
  if (!ime) throw new Error("Ime je obavezno.");

  const prezime = String(input?.prezime ?? "").trim();
  if (!prezime) throw new Error("Prezime je obavezno.");

  const colSet = await getRadniciColumns();
  const hasAdresa = colSet.has("adresa");
  const hasBrojTelefona = colSet.has("broj_telefona");
  const hasTelefon = colSet.has("telefon");
  const hasEmail = colSet.has("email");
  const hasDatumRodjenja = colSet.has("datum_rodjenja");
  const hasJib = colSet.has("jib");
  const hasAktivan = colSet.has("aktivan");
  const hasOpis = colSet.has("opis");

  const telCol = hasBrojTelefona ? "broj_telefona" : hasTelefon ? "telefon" : null;
  const telVal = cleanStr(input?.broj_telefona);

  const sets: string[] = ["ime=?", "prezime=?"];
  const vals: any[] = [ime, prezime];

  if (hasAdresa) {
    sets.push("adresa=?");
    vals.push(cleanStr(input?.adresa));
  }
  if (telCol) {
    sets.push(`${telCol}=?`);
    vals.push(telVal);
  }
  if (hasEmail) {
    sets.push("email=?");
    vals.push(cleanStr(input?.email));
  }
  if (hasDatumRodjenja) {
    sets.push("datum_rodjenja=?");
    vals.push(cleanStr(input?.datum_rodjenja) || null);
  }
  if (hasJib) {
    sets.push("jib=?");
    vals.push(cleanStr(input?.jib));
  }
  if (hasAktivan) {
    sets.push("aktivan=?");
    vals.push(toBit(input?.aktivan));
  }
  if (hasOpis) {
    sets.push("opis=?");
    vals.push(cleanStr(input?.opis));
  }

  vals.push(id);
  await query(`UPDATE radnici SET ${sets.join(", ")} WHERE radnik_id=?`, vals);

  return { ok: true };
}

export async function setRadnikActive(input: {
  radnik_id: number;
  aktivan: boolean;
}) {
  const id = Number(input?.radnik_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan radnik_id.");

  const colSet = await getRadniciColumns();
  if (!colSet.has("aktivan")) {
    return { ok: true };
  }

  await query(`UPDATE radnici SET aktivan=? WHERE radnik_id=?`, [
    input?.aktivan ? 1 : 0,
    id,
  ]);
  return { ok: true };
}
