import Link from "next/link";
import { query } from "@/lib/db";
import { redirect } from "next/navigation";
import FazeClient from "./FazeClient";

export const dynamic = "force-dynamic";

export default async function ProjekatFazePage({ params }) {
  const { id } = await params;
  const projekatId = Number(id);
  if (!Number.isFinite(projekatId)) redirect("/projects");

  const [proj] = await query(
    `SELECT projekat_id, radni_naziv, DATE_FORMAT(rok_glavni, '%Y-%m-%d') AS rok_glavni FROM projekti WHERE projekat_id = ? LIMIT 1`,
    [projekatId]
  );
  if (!proj) redirect("/projects");

  const radneFaze = await query(
    `SELECT faza_id, naziv FROM radne_faze ORDER BY naziv ASC`
  );
  const radnici = await query(
    `SELECT radnik_id, ime, prezime FROM radnici WHERE aktivan = 1 ORDER BY ime, prezime ASC`
  );
  const dobavljaci = await query(
    `SELECT dobavljac_id, naziv FROM dobavljaci WHERE aktivan = 1 ORDER BY naziv ASC`
  );

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">Faze projekta</div>
                  <div className="brandSub">
                    #{projekatId} — {proj.radni_naziv}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Link href={`/projects/${projekatId}`} className="btn" title="Nazad na projekat">
                  ← Projekat
                </Link>
                <Link href="/dashboard" className="btn" title="Dashboard">
                  🏠 Dashboard
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <FazeClient
            projekatId={projekatId}
            rokGlavni={proj?.rok_glavni ? String(proj.rok_glavni).trim() : null}
            radneFaze={radneFaze || []}
            radnici={radnici || []}
            dobavljaci={dobavljaci || []}
          />
        </div>
      </div>
    </div>
  );
}
