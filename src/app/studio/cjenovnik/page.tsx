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
  created_at: string | null;
  updated_at: string | null;
};

export default async function CjenovnikPage() {
  const rows = await query(
    `SELECT stavka_id, naziv, jedinica, cijena_default, cijena_ino_eur, valuta_default,
            sort_order, active,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM cjenovnik_stavke
     ORDER BY naziv ASC`,
  );

  const items = (rows ?? []) as CjenovnikItem[];

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
