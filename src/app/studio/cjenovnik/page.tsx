import { query } from "@/lib/db";
import CjenovnikClient from "./CjenovnikClient";

export const dynamic = "force-dynamic";

export type CjenovnikItem = {
  stavka_id: number;
  naziv: string;
  jedinica: "KOM" | "SAT" | "MIN" | "PAKET" | "DAN" | "OSTALO";
  cijena_default: string | number;
  cijena_ino_eur: string | number | null; // NEW
  valuta_default: string; // "BAM" in DB, display "KM" in UI
  sort_order: number;
  active: number; // 1/0
  created_at: string;
  updated_at: string;
};

export default async function CjenovnikPage() {
  // Default sort: naziv A–Z (LOCK)
  const rows = await query(
    `SELECT stavka_id, naziv, jedinica, cijena_default, cijena_ino_eur, valuta_default,
            sort_order, active, created_at, updated_at
     FROM cjenovnik_stavke
     ORDER BY naziv ASC`
  );

  const items = (rows ?? []) as CjenovnikItem[];

  return (
    <div className="min-h-[calc(100vh-0px)]">
      <CjenovnikClient initialItems={items} />
    </div>
  );
}
