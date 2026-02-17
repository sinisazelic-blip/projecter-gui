import RadneFazeClient from "./RadneFazeClient";
import { query } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export type RadnaFazaRow = {
  faza_id: number;
  naziv: string;
  opis_poslova: string | null;
  slozenost_posla: string | null;
  vrsta_posla: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export default async function RadneFazePage() {
  const rows = await query(
    `SELECT faza_id, naziv, opis_poslova, slozenost_posla, vrsta_posla, created_at, updated_at
       FROM radne_faze
       ORDER BY naziv ASC
       LIMIT 1000`,
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
                  <div className="brandTitle">Radne faze</div>
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
          <RadneFazeClient initialItems={(rows ?? []) as RadnaFazaRow[]} />
        </div>
      </div>
    </div>
  );
}
