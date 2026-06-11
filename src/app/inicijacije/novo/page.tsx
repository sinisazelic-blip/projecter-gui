import { query } from "@/lib/db";
import NewDealFormClient from "./NewDealFormClient";

export const dynamic = "force-dynamic";

async function hasNarucilacColumn(): Promise<boolean> {
  try {
    const rows: any[] = await query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'klijenti' AND COLUMN_NAME = 'is_narucilac'
       LIMIT 1`,
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export default async function NewDealPage() {
  const hasNarucilac = await hasNarucilacColumn();
  const narucilacSelect = hasNarucilac
    ? "COALESCE(is_narucilac, 0) AS is_narucilac"
    : "1 AS is_narucilac";

  // Samo aktivni klijenti; polje 1 (naručilac) dodatno filtrira is_narucilac = 1.
  const rows: any[] = await query(
    `SELECT klijent_id, naziv_klijenta, ${narucilacSelect}
       FROM klijenti
      WHERE COALESCE(aktivan, 1) = 1
      ORDER BY naziv_klijenta ASC
      LIMIT 2000`,
  );
  const klijenti = rows.map((r) => ({
    klijent_id: r.klijent_id,
    naziv_klijenta: r.naziv_klijenta,
    is_ino: 0,
    is_narucilac: Number(r.is_narucilac ?? 0),
  }));

  return (
    <div className="container">
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Novi Deal</h1>
      <NewDealFormClient initialKlijenti={klijenti} />
    </div>
  );
}
