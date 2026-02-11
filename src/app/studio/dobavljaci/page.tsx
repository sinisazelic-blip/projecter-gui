import DobavljaciClient from "./DobavljaciClient";
import { query } from "@/lib/db";
import Link from "next/link";

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
        AND COLUMN_NAME IN ('updated_at')`,
  )) as any[];

  const hasUpdatedAt = (cols ?? []).some(
    (r) => String(r.COLUMN_NAME).toLowerCase() === "updated_at",
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
                  <div className="brandTitle">Dobavljači</div>
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
          <DobavljaciClient initialItems={(rows ?? []) as DobavljacRow[]} />
        </div>
      </div>
    </div>
  );
}
