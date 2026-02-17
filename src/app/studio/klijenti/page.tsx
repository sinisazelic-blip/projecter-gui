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
  is_ino: number; // 1/0
  pdv_oslobodjen?: number; // 1/0 — oslobođen po članu 24
  pdv_oslobodjen_napomena?: string | null; // napomena za fakturu
  created_at: string | null;
  updated_at: string | null;
};

export default async function KlijentiPage() {
  const cols: any[] = (await query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND LOWER(TABLE_NAME) = 'klijenti'
        AND LOWER(COLUMN_NAME) IN ('created_at', 'updated_at', 'pdv_oslobodjen')`,
  )) as any[];

  const colSet = new Set((cols ?? []).map((r) => String(r.COLUMN_NAME).toLowerCase()));
  const hasPdvOslobodjen = colSet.has("pdv_oslobodjen");

  const pdvCols = hasPdvOslobodjen
    ? `, COALESCE(pdv_oslobodjen, 0) AS pdv_oslobodjen, pdv_oslobodjen_napomena`
    : ", 0 AS pdv_oslobodjen, NULL AS pdv_oslobodjen_napomena";

  const rows = await query(
    `SELECT klijent_id, naziv_klijenta, tip_klijenta, porezni_id, adresa, grad, drzava,
            rok_placanja_dana, napomena, aktivan, is_ino${pdvCols},
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM klijenti
       ORDER BY aktivan DESC, naziv_klijenta ASC
       LIMIT 1500`,
  );

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <img
                    src="/fluxa/logo-light.png"
                    alt="FLUXA"
                    className="brandLogo"
                  />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
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
