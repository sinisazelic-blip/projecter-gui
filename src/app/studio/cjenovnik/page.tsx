import { query } from "@/lib/db";
import CjenovnikClient from "./CjenovnikClient";
import Link from "next/link";

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
     ORDER BY naziv ASC`,
  );

  const items = (rows ?? []) as CjenovnikItem[];

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
                  <div className="brandTitle">Cjenovnik</div>
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
          <CjenovnikClient initialItems={items} />
        </div>
      </div>
    </div>
  );
}
