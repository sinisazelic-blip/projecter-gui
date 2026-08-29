import { query } from "@/lib/db";

const OPS_SCHEMA_VERSION = 7;
let ensuredVersion = 0;
let ensureInFlight: Promise<void> | null = null;

function isDupColumnError(e: unknown): boolean {
  const err = e as { code?: string; errno?: number; message?: string };
  const msg = String(err?.message ?? "");
  return (
    err?.code === "ER_DUP_FIELDNAME" ||
    err?.errno === 1060 ||
    /duplicate column name/i.test(msg)
  );
}

async function addOpsColumnIfMissing(
  table: string,
  column: string,
  ddl: string,
): Promise<void> {
  const rows = await query<{ c: number }>(
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (Number(rows?.[0]?.c ?? 0) > 0) return;
  try {
    await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  } catch (e) {
    if (isDupColumnError(e)) return;
    throw e;
  }
}

export type OpsJm = {
  jm_id: number;
  oznaka: string;
  naziv: string;
};

export type OpsMagacin = {
  magacin_id: number;
  kod: string;
  naziv: string;
  vrsta: "MATERIJAL" | "OPREMA";
};

export type OpsArtikalVrsta = "MATERIJAL" | "OPREMA" | "SABLON";

export type OpsArtikal = {
  artikal_id: number;
  sifra: string;
  naziv: string;
  vrsta: OpsArtikalVrsta;
  jm_id: number;
  jm_oznaka?: string;
  default_magacin_id: number;
  magacin_kod?: string;
  aktivan: number;
};

export type OpsStanje = {
  magacin_id: number;
  artikal_id: number;
  kolicina: number;
  sifra?: string;
  naziv?: string;
  jm_oznaka?: string;
  magacin_kod?: string;
};

export type OpsJedinicaOpreme = {
  jedinica_id: number;
  kod: string;
  artikal_id: number;
  magacin_id: number;
  stanje: string;
  sifra?: string;
  rn_id?: number | null;
  kompletacija_id?: number | null;
  teski_eventi?: number;
};

export type OpsKlasaRizika = "POZORISTE" | "STADION" | "OSTALO";

export type OpsPovratStanje = "ISPRAVAN" | "OSTECEN" | "SERVIS" | "OTPIS";

export type OpsKompletacija = {
  kompletacija_id: number;
  broj: string;
  event_naziv: string;
  klasa_rizika: OpsKlasaRizika;
  projekat_id: number | null;
  klijent_id?: number | null;
  klijent_naziv: string | null;
  krajnji_klijent_id?: number | null;
  krajnji_klijent_naziv?: string | null;
  objekat: string | null;
  status: string;
  faktura_id?: number | null;
  created_at?: string;
  jedinica_count?: number;
};

export type OpsHaasCijena = {
  artikal_id: number;
  sifra: string;
  naziv: string;
  cijena_bam: number;
  cijena_eur: number;
};

export type OpsHaasStavka = {
  artikal_id: number;
  sifra: string;
  naziv: string;
  kolicina: number;
  cijena: number;
  serije: string[];
};

export type OpsHaasFaktura = {
  haas_faktura_id: number;
  faktura_id: number;
  broj_fakture?: string;
  kompletacija_id: number;
  event_naziv?: string;
  klijent_naziv?: string | null;
  osnovica: number;
  valuta: string;
  created_at?: string;
};

export type OpsKompletacijaStavka = {
  stavka_id: number;
  kompletacija_id: number;
  jedinica_id: number;
  kod: string;
  sifra?: string;
  faza: string;
  povrat_stanje: string | null;
  izdao_naziv: string | null;
  montaza_naziv: string | null;
  vratio_naziv: string | null;
};

export type OpsJedinicaZivot = {
  zivot_id: number;
  jedinica_id: number;
  kod: string;
  kompletacija_id: number | null;
  event_naziv?: string | null;
  akcija: string;
  klasa_rizika: string | null;
  povrat_stanje: string | null;
  osoba: string | null;
  created_at: string;
};

export type OpsRadniNalog = {
  rn_id: number;
  broj: string;
  datum: string;
  sablon_artikal_id: number;
  sablon_sifra?: string;
  sablon_naziv?: string;
  kolicina: number;
  sati: number | null;
  radnik_naziv: string | null;
  napomena: string | null;
  serije?: string[];
};

export type OpsSastavnicaLinija = {
  sablon_artikal_id: number;
  komponenta_artikal_id: number;
  kolicina: number;
  komponenta_sifra?: string;
  komponenta_naziv?: string;
  komponenta_jm?: string;
};

export async function ensureOpsTables(): Promise<void> {
  if (ensuredVersion === OPS_SCHEMA_VERSION) return;
  if (ensureInFlight) return ensureInFlight;
  ensureInFlight = runEnsureOpsTables().finally(() => {
    ensureInFlight = null;
  });
  return ensureInFlight;
}

async function runEnsureOpsTables(): Promise<void> {
  if (ensuredVersion === OPS_SCHEMA_VERSION) return;

  await query(`
    CREATE TABLE IF NOT EXISTS ops_jedinice (
      jm_id INT NOT NULL AUTO_INCREMENT,
      oznaka VARCHAR(16) NOT NULL,
      naziv VARCHAR(80) NOT NULL,
      PRIMARY KEY (jm_id),
      UNIQUE KEY uq_ops_jm_oznaka (oznaka)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ops_magacini (
      magacin_id INT NOT NULL AUTO_INCREMENT,
      kod VARCHAR(8) NOT NULL,
      naziv VARCHAR(80) NOT NULL,
      vrsta VARCHAR(16) NOT NULL,
      PRIMARY KEY (magacin_id),
      UNIQUE KEY uq_ops_magacin_kod (kod)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ops_artikli (
      artikal_id INT NOT NULL AUTO_INCREMENT,
      sifra VARCHAR(40) NOT NULL,
      naziv VARCHAR(160) NOT NULL,
      vrsta VARCHAR(16) NOT NULL,
      jm_id INT NOT NULL,
      default_magacin_id INT NOT NULL,
      aktivan TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (artikal_id),
      UNIQUE KEY uq_ops_artikal_sifra (sifra),
      KEY idx_ops_artikal_vrsta (vrsta)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ops_sastavnice (
      sablon_artikal_id INT NOT NULL,
      komponenta_artikal_id INT NOT NULL,
      kolicina DECIMAL(12,3) NOT NULL DEFAULT 1,
      PRIMARY KEY (sablon_artikal_id, komponenta_artikal_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ops_stanje (
      magacin_id INT NOT NULL,
      artikal_id INT NOT NULL,
      kolicina DECIMAL(14,3) NOT NULL DEFAULT 0,
      PRIMARY KEY (magacin_id, artikal_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ops_prijemnice (
      prijemnica_id INT NOT NULL AUTO_INCREMENT,
      broj VARCHAR(32) NOT NULL,
      datum DATE NOT NULL,
      dobavljac_id INT NULL,
      dobavljac_naziv VARCHAR(160) NULL,
      racun VARCHAR(80) NULL,
      napomena VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (prijemnica_id),
      UNIQUE KEY uq_ops_prijemnica_broj (broj)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ops_prijemnica_stavke (
      stavka_id INT NOT NULL AUTO_INCREMENT,
      prijemnica_id INT NOT NULL,
      artikal_id INT NOT NULL,
      magacin_id INT NOT NULL,
      kolicina DECIMAL(14,3) NOT NULL,
      PRIMARY KEY (stavka_id),
      KEY idx_ops_prijem_hdr (prijemnica_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ops_jedinice_opreme (
      jedinica_id INT NOT NULL AUTO_INCREMENT,
      kod VARCHAR(48) NOT NULL,
      artikal_id INT NOT NULL,
      magacin_id INT NOT NULL,
      prijemnica_id INT NULL,
      stanje VARCHAR(16) NOT NULL DEFAULT 'U_MAGACINU',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (jedinica_id),
      UNIQUE KEY uq_ops_jedinica_kod (kod),
      KEY idx_ops_jedinica_art (artikal_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addOpsColumnIfMissing(
    "ops_jedinice_opreme",
    "rn_id",
    "INT NULL AFTER prijemnica_id",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS ops_radni_nalozi (
      rn_id INT NOT NULL AUTO_INCREMENT,
      broj VARCHAR(32) NOT NULL,
      datum DATE NOT NULL,
      sablon_artikal_id INT NOT NULL,
      kolicina INT NOT NULL,
      sati DECIMAL(8,2) NULL,
      radnik_id INT NULL,
      radnik_naziv VARCHAR(160) NULL,
      napomena VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (rn_id),
      UNIQUE KEY uq_ops_rn_broj (broj)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ops_rn_potrosnja (
      potrosnja_id INT NOT NULL AUTO_INCREMENT,
      rn_id INT NOT NULL,
      artikal_id INT NOT NULL,
      magacin_id INT NOT NULL,
      kolicina DECIMAL(14,3) NOT NULL,
      PRIMARY KEY (potrosnja_id),
      KEY idx_ops_rn_pot (rn_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addOpsColumnIfMissing(
    "ops_jedinice_opreme",
    "kompletacija_id",
    "INT NULL AFTER rn_id",
  );
  await addOpsColumnIfMissing(
    "ops_jedinice_opreme",
    "teski_eventi",
    "INT NOT NULL DEFAULT 0 AFTER kompletacija_id",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS ops_kompletacije (
      kompletacija_id INT NOT NULL AUTO_INCREMENT,
      broj VARCHAR(32) NOT NULL,
      event_naziv VARCHAR(160) NOT NULL,
      klasa_rizika VARCHAR(16) NOT NULL,
      projekat_id INT NULL,
      klijent_id INT NULL,
      klijent_naziv VARCHAR(160) NULL,
      objekat VARCHAR(160) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'OTVOREN',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (kompletacija_id),
      UNIQUE KEY uq_ops_kompl_broj (broj)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addOpsColumnIfMissing(
    "ops_kompletacije",
    "krajnji_klijent_id",
    "INT NULL AFTER klijent_naziv",
  );
  await addOpsColumnIfMissing(
    "ops_kompletacije",
    "krajnji_klijent_naziv",
    "VARCHAR(160) NULL AFTER krajnji_klijent_id",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS ops_kompletacija_stavke (
      stavka_id INT NOT NULL AUTO_INCREMENT,
      kompletacija_id INT NOT NULL,
      jedinica_id INT NOT NULL,
      kod VARCHAR(48) NOT NULL,
      faza VARCHAR(16) NOT NULL,
      povrat_stanje VARCHAR(16) NULL,
      izdao_naziv VARCHAR(160) NULL,
      izdao_at DATETIME NULL,
      montaza_naziv VARCHAR(160) NULL,
      montaza_at DATETIME NULL,
      vratio_naziv VARCHAR(160) NULL,
      vratio_at DATETIME NULL,
      PRIMARY KEY (stavka_id),
      UNIQUE KEY uq_ops_kompl_jed (kompletacija_id, jedinica_id),
      KEY idx_ops_kompl_st (kompletacija_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ops_jedinica_zivot (
      zivot_id INT NOT NULL AUTO_INCREMENT,
      jedinica_id INT NOT NULL,
      kod VARCHAR(48) NOT NULL,
      kompletacija_id INT NULL,
      akcija VARCHAR(16) NOT NULL,
      klasa_rizika VARCHAR(16) NULL,
      povrat_stanje VARCHAR(16) NULL,
      osoba VARCHAR(160) NULL,
      napomena VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (zivot_id),
      KEY idx_ops_zivot_jed (jedinica_id),
      KEY idx_ops_zivot_kod (kod)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addOpsColumnIfMissing(
    "ops_kompletacije",
    "faktura_id",
    "INT NULL AFTER status",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS ops_haas_cjenovnik (
      artikal_id INT NOT NULL,
      cijena_bam DECIMAL(12,2) NOT NULL DEFAULT 0,
      cijena_eur DECIMAL(12,2) NOT NULL DEFAULT 0,
      updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (artikal_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ops_haas_fakture (
      haas_faktura_id INT NOT NULL AUTO_INCREMENT,
      faktura_id INT NOT NULL,
      kompletacija_id INT NOT NULL,
      klijent_id INT NOT NULL,
      valuta VARCHAR(8) NOT NULL DEFAULT 'BAM',
      osnovica DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (haas_faktura_id),
      UNIQUE KEY uq_ops_haas_faktura (faktura_id),
      UNIQUE KEY uq_ops_haas_kompl (kompletacija_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ops_haas_stavke (
      stavka_id INT NOT NULL AUTO_INCREMENT,
      haas_faktura_id INT NOT NULL,
      artikal_id INT NOT NULL,
      sifra VARCHAR(40) NOT NULL,
      naziv VARCHAR(160) NOT NULL,
      kolicina INT NOT NULL,
      cijena DECIMAL(12,2) NOT NULL,
      serije TEXT NULL,
      PRIMARY KEY (stavka_id),
      KEY idx_ops_haas_st (haas_faktura_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ops_tenant_audit (
      audit_id INT NOT NULL AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      actor_user_id INT NOT NULL,
      actor_username VARCHAR(80) NOT NULL,
      action VARCHAR(32) NOT NULL,
      detail TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (audit_id),
      KEY idx_ops_tenant_audit_tenant (tenant_id, created_at),
      KEY idx_ops_tenant_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(
    `INSERT IGNORE INTO ops_jedinice (oznaka, naziv) VALUES
      ('KOM', 'Komad'),
      ('M', 'Metar'),
      ('PAR', 'Par')`,
  );

  await query(
    `INSERT IGNORE INTO ops_magacini (kod, naziv, vrsta) VALUES
      ('M1', 'Materijal', 'MATERIJAL'),
      ('M2', 'Oprema', 'OPREMA')`,
  );

  const jmRows = await query<OpsJm>(`SELECT jm_id, oznaka, naziv FROM ops_jedinice`);
  const magRows = await query<OpsMagacin>(
    `SELECT magacin_id, kod, naziv, vrsta FROM ops_magacini`,
  );
  const jmBy = Object.fromEntries((jmRows ?? []).map((r) => [r.oznaka, r.jm_id]));
  const magBy = Object.fromEntries((magRows ?? []).map((r) => [r.kod, r.magacin_id]));
  const kom = jmBy.KOM;
  const metar = jmBy.M;
  const m1 = magBy.M1;
  const m2 = magBy.M2;

  if (kom && metar && m1 && m2) {
    const artikli: Array<[string, string, OpsArtikalVrsta, number, number]> = [
      ["ESP32-S3-WROOM", "ESP32-S3-WROOM-1U Dev (IPEX)", "MATERIJAL", kom, m1],
      ["IPEX-SMA-ANT", "IPEX na SMA pigtail + 5GHz antena 6dBi", "MATERIJAL", kom, m1],
      ["PCM5102A", "PCM5102A I2S DAC dekoder", "MATERIJAL", kom, m1],
      ["TPA3116D2", "TPA3116D2 mono pojačalo 50W/100W", "MATERIJAL", kom, m1],
      ["LM2596S", "LM2596S DC-DC step-down", "MATERIJAL", kom, m1],
      ["IP65-KUCISTE", "Plastično IP65 kućište + uvodnice + kleme", "MATERIJAL", kom, m1],
      ["HORNA-8OHM", "Vanjska horna 8Ω 20–30W IP66", "MATERIJAL", kom, m1],
      ["CAT6", "UTP Cat6 bunt", "MATERIJAL", metar, m1],
      ["RJ45", "RJ45 konektor", "MATERIJAL", kom, m1],
      ["HDMI-KABAL", "HDMI kabl", "MATERIJAL", kom, m1],
      ["LAN-KABAL", "Mrežni kabl (konfekcija)", "MATERIJAL", kom, m1],
      ["MINIPC", "MiniPC (MojTV točka)", "MATERIJAL", kom, m1],
      ["TV-MONITOR", "TV monitor", "MATERIJAL", kom, m1],
      ["TRIPOD-BAZA", "Tripod / stub (osnova)", "MATERIJAL", kom, m1],
      ["TTS-ZONA", "Zonski audio čvor (TTS)", "SABLON", kom, m2],
      ["KAPIJA-OSNOVNA", "Kapija — osnovni komplet", "SABLON", kom, m2],
      ["MOJTV-TOCKA", "MojTV točka (TV + MiniPC + veze)", "SABLON", kom, m2],
    ];
    for (const [sifra, naziv, vrsta, jmId, magId] of artikli) {
      await query(
        `INSERT IGNORE INTO ops_artikli (sifra, naziv, vrsta, jm_id, default_magacin_id, aktivan)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [sifra, naziv, vrsta, jmId, magId],
      );
    }

    const artRows = await query<{ artikal_id: number; sifra: string }>(
      `SELECT artikal_id, sifra FROM ops_artikli`,
    );
    const idBy = Object.fromEntries(
      (artRows ?? []).map((r) => [r.sifra, r.artikal_id]),
    );

    const bom: Array<[string, string, number]> = [
      ["TTS-ZONA", "ESP32-S3-WROOM", 1],
      ["TTS-ZONA", "IPEX-SMA-ANT", 1],
      ["TTS-ZONA", "PCM5102A", 1],
      ["TTS-ZONA", "TPA3116D2", 1],
      ["TTS-ZONA", "LM2596S", 1],
      ["TTS-ZONA", "IP65-KUCISTE", 1],
      ["TTS-ZONA", "HORNA-8OHM", 1],
      ["MOJTV-TOCKA", "TV-MONITOR", 1],
      ["MOJTV-TOCKA", "MINIPC", 1],
      ["MOJTV-TOCKA", "HDMI-KABAL", 1],
      ["MOJTV-TOCKA", "LAN-KABAL", 1],
      ["KAPIJA-OSNOVNA", "TRIPOD-BAZA", 1],
    ];
    for (const [sablon, komp, qty] of bom) {
      const sid = idBy[sablon];
      const kid = idBy[komp];
      if (!sid || !kid) continue;
      await query(
        `INSERT IGNORE INTO ops_sastavnice (sablon_artikal_id, komponenta_artikal_id, kolicina)
         VALUES (?, ?, ?)`,
        [sid, kid, qty],
      );
    }
  }

  ensuredVersion = OPS_SCHEMA_VERSION;
}
