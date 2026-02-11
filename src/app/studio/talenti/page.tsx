import TalentiClient from "./TalentiClient";
import { query } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export type TalentRow = {
  talent_id: number;
  ime_prezime: string;
  vrsta: "spiker" | "glumac" | "pjevac" | "dijete" | "muzicar" | "ostalo";
  email: string | null;
  telefon: string | null;
  napomena: string | null;
  aktivan: number; // 1/0
  created_at: string | null;
  updated_at: string | null;
};

export default async function TalentiPage() {
  // talenti po tvojoj strukturi nemaju updated_at, ali držimo kompatibilno
  const cols: any[] = (await query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'talenti'
        AND COLUMN_NAME IN ('updated_at')`,
  )) as any[];

  const hasUpdatedAt = (cols ?? []).some(
    (r) => String(r.COLUMN_NAME).toLowerCase() === "updated_at",
  );

  const sql = hasUpdatedAt
    ? `SELECT
         talent_id, ime_prezime, vrsta, email, telefon, napomena, aktivan, created_at, updated_at
       FROM talenti
       ORDER BY aktivan DESC, ime_prezime ASC
       LIMIT 1000`
    : `SELECT
         talent_id, ime_prezime, vrsta, email, telefon, napomena, aktivan, created_at,
         NULL AS updated_at
       FROM talenti
       ORDER BY aktivan DESC, ime_prezime ASC
       LIMIT 500`;

  const rows = await query(sql);

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img
                  src="/fluxa/logo-light.png"
                  alt="FLUXA"
                  className="brandLogo"
                />
                <div>
                  <div className="brandTitle">Talenti</div>
                  <div className="brandSub">Studio / Šifarnici</div>
                </div>
              </div>

              <Link href="/dashboard" className="btn" title="Dashboard">
                🏠 Dashboard
              </Link>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <TalentiClient initialItems={(rows ?? []) as TalentRow[]} />
        </div>
      </div>
    </div>
  );
}
