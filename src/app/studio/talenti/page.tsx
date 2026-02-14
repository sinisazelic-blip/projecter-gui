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
  const rows = await query(
    `SELECT talent_id, ime_prezime, vrsta, email, telefon, napomena, aktivan,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM talenti
       ORDER BY aktivan DESC, ime_prezime ASC
       LIMIT 1000`,
  );

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
