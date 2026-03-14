import { query } from "@/lib/db";
import NewDealFormClient from "./NewDealFormClient";

export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const rows: any[] = await query(
    `SELECT klijent_id, naziv_klijenta FROM klijenti ORDER BY naziv_klijenta ASC LIMIT 2000`,
  );
  const klijenti = rows.map((r) => ({
    klijent_id: r.klijent_id,
    naziv_klijenta: r.naziv_klijenta,
    is_ino: 0,
  }));

  return (
    <div className="container">
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Novi Deal</h1>
      <NewDealFormClient initialKlijenti={klijenti} />
    </div>
  );
}
