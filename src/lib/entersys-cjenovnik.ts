import { query } from "@/lib/db";
import type { EnterSysCjenovnikRow, EnterSysCjenovnikVrsta } from "@/lib/entersys-cjenovnik-calc";

export type { EnterSysCjenovnikRow, EnterSysCjenovnikVrsta, EnterSysPriceBreakdown } from "@/lib/entersys-cjenovnik-calc";
export {
  amountForCurrency,
  calculateEnterSysMonthly,
  calculateEnterSysMonthlyForTenant,
  displayEnterSysCurrency,
  normalizeEnterSysCurrency,
  parseEnterSysModuleKeys,
} from "@/lib/entersys-cjenovnik-calc";

type SeedItem = {
  stavka_key: string;
  naziv: string;
  module_key: string | null;
  vrsta: EnterSysCjenovnikVrsta;
  bam: number;
  sort_order: number;
};

/** BAM iz cjenovnika; EUR/USD startni omjeri dok se ne urede u tabeli. */
const BAM_TO_EUR = 1.95583;
const BAM_TO_USD = 1.8;

function fromBam(bam: number) {
  return {
    bam,
    eur: Math.round((bam / BAM_TO_EUR) * 100) / 100,
    usd: Math.round((bam / BAM_TO_USD) * 100) / 100,
  };
}

const SEED: SeedItem[] = [
  { stavka_key: "ENTER_ARGUS", naziv: "Enter + Argus", module_key: "enterCore", vrsta: "PAKET", bam: 100, sort_order: 10 },
  { stavka_key: "POOL_MANAGER", naziv: "PoolManager", module_key: "poolManager", vrsta: "PAKET", bam: 200, sort_order: 20 },
  { stavka_key: "HALL_MANAGER", naziv: "HallManager", module_key: "hallManager", vrsta: "PAKET", bam: 200, sort_order: 30 },
  { stavka_key: "FIELD_MANAGER", naziv: "FieldManager", module_key: "fieldManager", vrsta: "PAKET", bam: 200, sort_order: 40 },
  { stavka_key: "GYM_MANAGER", naziv: "GymManager", module_key: "gymManager", vrsta: "PAKET", bam: 200, sort_order: 50 },
  { stavka_key: "DOOR_MAN", naziv: "DoorMan", module_key: "doorMan", vrsta: "DODATAK", bam: 80, sort_order: 60 },
  { stavka_key: "LOCKER", naziv: "Locker", module_key: "lockers", vrsta: "DODATAK", bam: 80, sort_order: 70 },
  { stavka_key: "RENTALS", naziv: "Rentals", module_key: "rentals", vrsta: "DODATAK", bam: 80, sort_order: 80 },
  { stavka_key: "MOJ_RADIO", naziv: "MojRadio", module_key: "mojRadio", vrsta: "DODATAK", bam: 100, sort_order: 90 },
  { stavka_key: "MOJ_TV", naziv: "MojTV", module_key: "mojTv", vrsta: "DODATAK", bam: 200, sort_order: 100 },
  { stavka_key: "CCTV_GATE", naziv: "CCTV Gate", module_key: "cctvGate", vrsta: "DODATAK", bam: 150, sort_order: 110 },
  { stavka_key: "WEB_SHOP", naziv: "WebShop", module_key: "webShop", vrsta: "DODATAK", bam: 30, sort_order: 120 },
  { stavka_key: "EVENT_MANAGER", naziv: "EventManager (dan događaja)", module_key: "eventManager", vrsta: "EVENT", bam: 500, sort_order: 200 },
];

let ensured = false;

export async function ensureEnterSysCjenovnikTable(): Promise<void> {
  if (ensured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS entersys_cjenovnik (
      stavka_key VARCHAR(40) NOT NULL,
      naziv VARCHAR(120) NOT NULL,
      module_key VARCHAR(40) NULL,
      vrsta VARCHAR(16) NOT NULL DEFAULT 'DODATAK',
      cijena_bam DECIMAL(12,2) NOT NULL DEFAULT 0,
      cijena_eur DECIMAL(12,2) NOT NULL DEFAULT 0,
      cijena_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      aktivan TINYINT NOT NULL DEFAULT 1,
      updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (stavka_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  for (const item of SEED) {
    const fx = fromBam(item.bam);
    await query(
      `INSERT IGNORE INTO entersys_cjenovnik
        (stavka_key, naziv, module_key, vrsta, cijena_bam, cijena_eur, cijena_usd, sort_order, aktivan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        item.stavka_key,
        item.naziv,
        item.module_key,
        item.vrsta,
        fx.bam,
        fx.eur,
        fx.usd,
        item.sort_order,
      ],
    );
  }
  ensured = true;
}

export async function listEnterSysCjenovnik(): Promise<EnterSysCjenovnikRow[]> {
  await ensureEnterSysCjenovnikTable();
  const rows = await query<EnterSysCjenovnikRow>(
    `SELECT stavka_key, naziv, module_key, vrsta,
            cijena_bam, cijena_eur, cijena_usd, sort_order, aktivan
     FROM entersys_cjenovnik
     ORDER BY sort_order ASC, stavka_key ASC`,
  );
  return (rows ?? []).map((r) => ({
    ...r,
    cijena_bam: Number(r.cijena_bam),
    cijena_eur: Number(r.cijena_eur),
    cijena_usd: Number(r.cijena_usd),
    sort_order: Number(r.sort_order),
    aktivan: Number(r.aktivan),
  }));
}

export async function upsertEnterSysCjenovnik(
  items: Array<Partial<EnterSysCjenovnikRow> & { stavka_key: string }>,
): Promise<void> {
  await ensureEnterSysCjenovnikTable();
  for (const item of items) {
    const key = String(item.stavka_key ?? "").trim().toUpperCase();
    if (!key) continue;
    await query(
      `UPDATE entersys_cjenovnik
       SET naziv = COALESCE(?, naziv),
           cijena_bam = ?,
           cijena_eur = ?,
           cijena_usd = ?,
           aktivan = COALESCE(?, aktivan)
       WHERE stavka_key = ?`,
      [
        item.naziv != null ? String(item.naziv).trim() : null,
        Number(item.cijena_bam ?? 0),
        Number(item.cijena_eur ?? 0),
        Number(item.cijena_usd ?? 0),
        item.aktivan == null ? 1 : Number(item.aktivan) ? 1 : 0,
        key,
      ],
    );
  }
}
