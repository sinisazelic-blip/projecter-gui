"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";

const DEFAULT_VRSTE: string[] = [
  "studio", "freelancer", "servis", "ostalo",
  "rental", "video_produkcija", "organizacija_dogadaja", "restoran",
  "transport", "rasvjeta", "bina", "led_video", "bilbordi", "novine",
  "web_portali", "socijalne_mreze", "developing", "web_developing",
  "tv", "radio", "oglasivaci", "agencije",
];

function cleanStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function cleanBool01(v: any) {
  return v === true || v === 1 || v === "1" || v === "true" ? 1 : 0;
}

function normalizeVrsta(v: any): string {
  const s = String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (s) return s;
  return "ostalo";
}

async function ensureVrsteTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS sifarnik_vrste (
      vrsta_id INT NOT NULL AUTO_INCREMENT,
      sifarnik VARCHAR(80) NOT NULL,
      value_key VARCHAR(80) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      aktivan TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (vrsta_id),
      UNIQUE KEY uq_sifarnik_value (sifarnik, value_key),
      KEY idx_sifarnik_aktivan_sort (sifarnik, aktivan, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

export async function getDobavljacVrste() {
  await ensureVrsteTable();
  const rows = await query(
    `SELECT value_key
     FROM sifarnik_vrste
     WHERE sifarnik = 'dobavljaci_vrsta' AND aktivan = 1
     ORDER BY sort_order ASC, value_key ASC`,
  );
  const list = (rows ?? [])
    .map((r: any) => String(r.value_key || "").trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_VRSTE;
}

export async function saveDobavljacVrste(vrste: string[]) {
  await ensureVrsteTable();
  const clean = Array.from(
    new Set(
      (vrste ?? [])
        .map((v) => normalizeVrsta(v))
        .filter(Boolean),
    ),
  );
  const finalList = clean.length ? clean : DEFAULT_VRSTE;
  await query(`DELETE FROM sifarnik_vrste WHERE sifarnik = 'dobavljaci_vrsta'`);
  for (let i = 0; i < finalList.length; i += 1) {
    await query(
      `INSERT INTO sifarnik_vrste (sifarnik, value_key, sort_order, aktivan)
       VALUES ('dobavljaci_vrsta', ?, ?, 1)`,
      [finalList[i], i + 1],
    );
  }
  revalidatePath("/studio/dobavljaci");
  return { ok: true };
}

function jibDigits(v: any): string {
  return String(v ?? "").replace(/\D/g, "");
}

function isDomesticBa(drzava_iso2: string | null | undefined): boolean {
  const iso = String(drzava_iso2 ?? "").trim().toUpperCase();
  return !iso || iso === "BA";
}

function validateDobavljacBanking(input: {
  drzava_iso2?: string | null;
  jib?: string | null;
  bank_broj_racuna?: string | null;
  bank_swift?: string | null;
  bank_naziv?: string | null;
  bank_adresa?: string | null;
}) {
  const domestic = isDomesticBa(input.drzava_iso2);
  if (domestic) {
    const j = jibDigits(input.jib);
    if (!/^\d{13}$/.test(j)) {
      throw new Error("Za dobavljače iz BiH, JIB mora imati tačno 13 cifara.");
    }
  }
  const rac = String(input.bank_broj_racuna ?? "").trim();
  if (!rac) {
    throw new Error("Broj bankovnog računa je obavezan.");
  }
  if (!domestic) {
    if (!String(input.bank_swift ?? "").trim()) {
      throw new Error("Za ino dobavljača, SWIFT/BIC je obavezan.");
    }
    if (!String(input.bank_naziv ?? "").trim()) {
      throw new Error("Za ino dobavljača, naziv banke je obavezan.");
    }
    if (!String(input.bank_adresa ?? "").trim()) {
      throw new Error("Za ino dobavljača, adresa banke je obavezna.");
    }
  }
}

type DobavljacBankInput = {
  jib?: string | null;
  bank_broj_racuna?: string | null;
  bank_iban?: string | null;
  bank_swift?: string | null;
  bank_naziv?: string | null;
  bank_adresa?: string | null;
};

function normalizeBankRow(
  drzava_iso2: string | null,
  b: DobavljacBankInput,
): {
  jib: string | null;
  bank_broj_racuna: string | null;
  bank_iban: string | null;
  bank_swift: string | null;
  bank_naziv: string | null;
  bank_adresa: string | null;
} {
  const domestic = isDomesticBa(drzava_iso2);
  const jd = jibDigits(b.jib);
  return {
    jib: domestic && jd.length === 13 ? jd : null,
    bank_broj_racuna: cleanStr(b.bank_broj_racuna),
    bank_iban: cleanStr(b.bank_iban),
    bank_swift: cleanStr(b.bank_swift),
    bank_naziv: cleanStr(b.bank_naziv),
    bank_adresa: cleanStr(b.bank_adresa),
  };
}

export async function createDobavljac(
  input: {
    naziv: string;
    vrsta: string;
    pravno_lice?: boolean;
    drzava_iso2?: string | null;
    grad?: string | null;
    postanski_broj?: string | null;
    email?: string | null;
    telefon?: string | null;
    adresa?: string | null;
    napomena?: string | null;
    aktivan?: boolean;
  } & DobavljacBankInput,
) {
  const naziv = String(input?.naziv ?? "").trim();
  if (!naziv) throw new Error("Naziv dobavljača je obavezan.");

  const vrsta = normalizeVrsta(input?.vrsta);
  const pravno_lice = input?.pravno_lice === false ? 0 : 1;

  const drzava_iso2 = cleanStr(input?.drzava_iso2);
  const grad = cleanStr(input?.grad);
  const postanski_broj = cleanStr(input?.postanski_broj);
  const email = cleanStr(input?.email);
  const telefon = cleanStr(input?.telefon);
  const adresa = cleanStr(input?.adresa);
  const napomena = cleanStr(input?.napomena);
  const aktivan = input?.aktivan === false ? 0 : 1;

  validateDobavljacBanking({
    drzava_iso2,
    jib: input.jib,
    bank_broj_racuna: input.bank_broj_racuna,
    bank_swift: input.bank_swift,
    bank_naziv: input.bank_naziv,
    bank_adresa: input.bank_adresa,
  });
  const fin = normalizeBankRow(drzava_iso2, input);

  await query(
    `INSERT INTO dobavljaci
      (naziv, vrsta, pravno_lice, drzava_iso2, grad, postanski_broj, email, telefon, adresa, napomena,
       jib, bank_broj_racuna, bank_iban, bank_swift, bank_naziv, bank_adresa,
       aktivan, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`,
    [
      naziv,
      vrsta,
      pravno_lice,
      drzava_iso2,
      grad,
      postanski_broj,
      email,
      telefon,
      adresa,
      napomena,
      fin.jib,
      fin.bank_broj_racuna,
      fin.bank_iban,
      fin.bank_swift,
      fin.bank_naziv,
      fin.bank_adresa,
      aktivan,
    ],
  );

  revalidatePath("/studio/dobavljaci");
  return { ok: true };
}

export async function updateDobavljac(
  input: {
    dobavljac_id: number;
    naziv: string;
    vrsta: string;
    pravno_lice?: boolean;
    drzava_iso2?: string | null;
    grad?: string | null;
    postanski_broj?: string | null;
    email?: string | null;
    telefon?: string | null;
    adresa?: string | null;
    napomena?: string | null;
    aktivan?: boolean;
  } & DobavljacBankInput,
) {
  const id = Number(input?.dobavljac_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan dobavljac_id.");

  const naziv = String(input?.naziv ?? "").trim();
  if (!naziv) throw new Error("Naziv dobavljača je obavezan.");

  const vrsta = normalizeVrsta(input?.vrsta);
  const pravno_lice = input?.pravno_lice === false ? 0 : 1;

  const drzava_iso2 = cleanStr(input?.drzava_iso2);
  const grad = cleanStr(input?.grad);
  const postanski_broj = cleanStr(input?.postanski_broj);
  const email = cleanStr(input?.email);
  const telefon = cleanStr(input?.telefon);
  const adresa = cleanStr(input?.adresa);
  const napomena = cleanStr(input?.napomena);
  const aktivan = input?.aktivan === false ? 0 : 1;

  validateDobavljacBanking({
    drzava_iso2,
    jib: input.jib,
    bank_broj_racuna: input.bank_broj_racuna,
    bank_swift: input.bank_swift,
    bank_naziv: input.bank_naziv,
    bank_adresa: input.bank_adresa,
  });
  const fin = normalizeBankRow(drzava_iso2, input);

  await query(
    `UPDATE dobavljaci
        SET naziv=?, vrsta=?, pravno_lice=?, drzava_iso2=?, grad=?, postanski_broj=?,
            email=?, telefon=?, adresa=?, napomena=?,
            jib=?, bank_broj_racuna=?, bank_iban=?, bank_swift=?, bank_naziv=?, bank_adresa=?,
            aktivan=?,
            updated_at=NOW()
      WHERE dobavljac_id=?`,
    [
      naziv,
      vrsta,
      pravno_lice,
      drzava_iso2,
      grad,
      postanski_broj,
      email,
      telefon,
      adresa,
      napomena,
      fin.jib,
      fin.bank_broj_racuna,
      fin.bank_iban,
      fin.bank_swift,
      fin.bank_naziv,
      fin.bank_adresa,
      aktivan,
      id,
    ],
  );

  const [row] = (await query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM dobavljaci WHERE dobavljac_id = ?`,
    [id],
  )) as { created_at: string | null; updated_at: string | null }[];

  revalidatePath("/studio/dobavljaci");
  return {
    ok: true,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

export async function setDobavljacActive(input: {
  dobavljac_id: number;
  aktivan: boolean;
}) {
  const id = Number(input?.dobavljac_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan dobavljac_id.");

  await query(`UPDATE dobavljaci SET aktivan=?, updated_at=NOW() WHERE dobavljac_id=?`, [
    input?.aktivan ? 1 : 0,
    id,
  ]);

  revalidatePath("/studio/dobavljaci");
  return { ok: true };
}
