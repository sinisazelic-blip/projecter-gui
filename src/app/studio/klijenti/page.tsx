import KlijentiClient from "./KlijentiClient";
import { query } from "@/lib/db";
import Link from "next/link";

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
        AND COLUMN_NAME IN ('updated_at')`,
  )) as any[];

  const hasUpdatedAt = (cols ?? []).some(
    (r) => String(r.COLUMN_NAME).toLowerCase() === "updated_at",
  );

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

  return (
    <div className="container">
      <style>{`
        .pageWrap { display:flex; flex-direction:column; height:100vh; overflow:hidden; }

        .topBlock{
          position: sticky; top:0; z-index: 50;
          padding: 14px 0 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          box-shadow: 0 14px 40px rgba(0,0,0,.22);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .topInner{ padding: 0 14px; }

        .topRow{
          display:flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .brandWrap{ display:flex; align-items:center; gap:12px; }
        .brandLogo{ height: 30px; width:auto; opacity:.92; }
        .brandTitle{ font-size: 20px; font-weight: 850; line-height: 1.1; margin: 0; }
        .brandSub{ font-size: 12px; opacity: .75; margin-top: 4px; }

        .btn{
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          box-shadow: 0 10px 30px rgba(0,0,0,.18);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: transform .12s ease, background .12s ease, border-color .12s ease;
          text-decoration: none;
          cursor: pointer;
          user-select: none;
          padding: 10px 12px;
          border-radius: 14px;
          font-weight: 650;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: inherit;
          white-space: nowrap;
        }
        .btn:hover{ background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.26); }
        .btn:active{ transform: scale(.985); }

        .divider{ height: 1px; background: rgba(255,255,255,.12); margin: 12px 0 0; }

        .bodyWrap{
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 14px 0 18px;
        }
      `}</style>

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
                  <div className="brandTitle">Klijenti</div>
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
          <KlijentiClient initialItems={(rows ?? []) as KlijentRow[]} />
        </div>
      </div>
    </div>
  );
}
