import DobavljaciClient from "./DobavljaciClient";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export type DobavljacRow = {
  dobavljac_id: number;
  naziv: string;
  vrsta: "studio" | "freelancer" | "servis" | "ostalo";
  pravno_lice: number; // 1/0
  drzava_iso2: string | null;
  grad: string | null;
  postanski_broj: string | null;
  email: string | null;
  telefon: string | null;
  adresa: string | null;
  napomena: string | null;
  aktivan: number; // 1/0
  created_at: string | null;
  updated_at: string | null;
};

export default async function DobavljaciPage() {
  // dobavljaci po tvojoj strukturi nemaju updated_at, ali ostavljamo kompatibilno
  const cols: any[] = (await query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'dobavljaci'
        AND COLUMN_NAME IN ('updated_at')`
  )) as any[];

  const hasUpdatedAt = (cols ?? []).some(
    (r) => String(r.COLUMN_NAME).toLowerCase() === "updated_at"
  );

  const sql = hasUpdatedAt
    ? `SELECT
         dobavljac_id, naziv, vrsta, pravno_lice, drzava_iso2, grad, postanski_broj,
         email, telefon, adresa, napomena, aktivan, created_at, updated_at
       FROM dobavljaci
       ORDER BY aktivan DESC, naziv ASC
       LIMIT 1000`
    : `SELECT
         dobavljac_id, naziv, vrsta, pravno_lice, drzava_iso2, grad, postanski_broj,
         email, telefon, adresa, napomena, aktivan, created_at,
         NULL AS updated_at
       FROM dobavljaci
       ORDER BY aktivan DESC, naziv ASC
       LIMIT 500`;

  const rows = await query(sql);
  return <DobavljaciClient initialItems={(rows ?? []) as DobavljacRow[]} />;
}
