import KlijentiClient from "./KlijentiClient";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export type KlijentRow = {
  klijent_id: number;
  naziv_klijenta: string;
  tip_klijenta: "direktni" | "agencija";
  porezni_id: string | null;
  adresa: string | null;
  grad: string | null;
  drzava: string | null;
  rok_placanja_dana: number;
  napomena: string | null;
  aktivan: number; // 1/0
  is_ino: number; // NEW: 1/0
  created_at: string | null;
  updated_at: string | null;
};

export default async function KlijentiPage() {
  // NOTE: updated_at možda ne postoji u tvojoj bazi.
  // Zato ga uzimamo kroz INFORMATION_SCHEMA provjeru u jednom upitu.
  const cols: any[] = (await query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'klijenti'
        AND COLUMN_NAME IN ('updated_at')`
  )) as any[];

  const hasUpdatedAt = (cols ?? []).some((r) => String(r.COLUMN_NAME).toLowerCase() === "updated_at");

  const sql = hasUpdatedAt
    ? `SELECT
         klijent_id, naziv_klijenta, tip_klijenta, porezni_id, adresa, grad, drzava,
         rok_placanja_dana, napomena, aktivan, is_ino, created_at, updated_at
       FROM klijenti
       ORDER BY aktivan DESC, naziv_klijenta ASC
       LIMIT 1500`
    : `SELECT
         klijent_id, naziv_klijenta, tip_klijenta, porezni_id, adresa, grad, drzava,
         rok_placanja_dana, napomena, aktivan, is_ino, created_at,
         NULL as updated_at
       FROM klijenti
       ORDER BY aktivan DESC, naziv_klijenta ASC
       LIMIT 500`;

  const rows = await query(sql);
  return <KlijentiClient initialItems={(rows ?? []) as KlijentRow[]} />;
}
