import Link from "next/link";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { redirect } from "next/navigation";
import { getValidLocale } from "@/lib/i18n";
import { getT } from "@/lib/translations";
import FluxaLogo from "@/components/FluxaLogo";
import FazeClient from "./FazeClient";

export const dynamic = "force-dynamic";

export default async function ProjekatFazePage({ params }) {
  const { id } = await params;
  const projekatId = Number(id);
  if (!Number.isFinite(projekatId)) redirect("/projects");

  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value ?? "sr");
  const t = getT(locale);

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
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">{t("fazePage.pageTitle")}</div>
                  <div className="brandSub">
                    #{projekatId} — {proj.radni_naziv}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Link href={`/projects/${projekatId}`} className="btn" title={t("fazePage.backToProjectTitle")}>
                  {t("fazePage.backToProject")}
                </Link>
                <Link href="/dashboard" className="btn" title={t("fazePage.dashboard")}>
                  🏠 {t("fazePage.dashboard")}
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
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
