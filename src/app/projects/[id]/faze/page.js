import Link from "next/link";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { redirect } from "next/navigation";
import { getValidLocale } from "@/lib/i18n";
import { getT } from "@/lib/translations";
import FluxaLogo from "@/components/FluxaLogo";
import FazeClient from "./FazeClient";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProjekatFazePage({ params }) {
  const { id } = await params;
  const projekatId = Number(id);
  if (!Number.isFinite(projekatId)) redirect("/projects");

  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value ?? "sr");
  const t = getT(locale);
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const session = token ? verifySessionToken(token) : null;
  const isSaradnik = session?.nivo === 0;
  if (isSaradnik) {
    const userRows = await query(
      "SELECT radnik_id FROM users WHERE user_id = ? LIMIT 1",
      [session.user_id],
    );
    const radnikId = userRows?.[0]?.radnik_id != null ? Number(userRows[0].radnik_id) : null;
    if (radnikId == null) redirect("/projects");
    const accessRows = await query(
      `SELECT 1 FROM projekat_faze pf
       INNER JOIN projekat_faza_radnici pfr ON pfr.projekat_faza_id = pf.projekat_faza_id
       WHERE pf.projekat_id = ? AND pfr.radnik_id = ?
       UNION
       SELECT 1 FROM projekat_crew pc
       WHERE pc.projekat_id = ? AND pc.radnik_id = ?
       LIMIT 1`,
      [projekatId, radnikId, projekatId, radnikId],
    );
    if (!accessRows?.length) redirect("/projects");
  }

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
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("fazePage.dashboard")}
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
            readOnly={isSaradnik}
          />
        </div>
      </div>
    </div>
  );
}
