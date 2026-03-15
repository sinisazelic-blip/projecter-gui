// src/app/narudzbenice/preview/page.js
import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { query } from "@/lib/db";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

function pad2(n) {
  const s = String(n ?? "");
  return s.length === 1 ? "0" + s : s;
}
function fmtDateDDMMYYYY(date) {
  const d = date instanceof Date ? date : new Date();
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function fmtAmount(n) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}
function buildQuery(paramsObj) {
  const parts = [];
  for (const [k, v] of Object.entries(paramsObj)) {
    if (v === null || v === undefined) continue;
    const s = String(v);
    if (!s) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(s)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

function buildEmail(t, {
  mode,
  projectSingle,
  klijent_id,
  supplierName,
  dateStr,
  items,
}) {
  let subject = "";
  if (mode === "single") {
    subject = (t("narudzbenice.emailSubjectSingle") || "")
      .replace("{{projectId}}", String(projectSingle?.projekat_id ?? ""))
      .replace("{{projectName}}", String(projectSingle?.radni_naziv ?? ""));
  } else {
    subject = (t("narudzbenice.emailSubjectMulti") || "")
      .replace("{{clientId}}", String(klijent_id ?? ""))
      .replace("{{supplierName}}", String(supplierName ?? ""))
      .replace("{{date}}", String(dateStr ?? ""));
  }

  const lines = [];
  lines.push(t("narudzbenice.emailGreeting"));
  lines.push("");
  lines.push(t("narudzbenice.emailIntro"));
  lines.push("");

  for (const it of items) {
    lines.push(`• ${t("narudzbenice.emailProject")} ${it.radni_naziv}`);
    lines.push(`  ${t("narudzbenice.emailPO")} PO-${it.projekat_id}`);
    lines.push(`  ${t("narudzbenice.emailAmount")} ${fmtAmount(it.iznos)} ${it.valuta_original}`);
    if (it.opis_agregat) lines.push(`  ${t("narudzbenice.emailOurDesc")} ${it.opis_agregat}`);
    lines.push("");
  }

  lines.push(t("narudzbenice.emailPleaseRef"));
  lines.push("");

  lines.push(t("narudzbenice.emailSignature"));

  return { subject, body: lines.join("\n") };
}

export default async function Page({ searchParams }) {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  const sp = await Promise.resolve(searchParams);
  const klijentRaw = String(sp?.klijent_id ?? "").trim();
  const dobRaw = String(sp?.dobavljac_id ?? "").trim();

  const klijent_id = klijentRaw ? Number(klijentRaw) : null;
  const dobavljac_id = dobRaw ? Number(dobRaw) : null;

  if (!klijent_id || !dobavljac_id) {
    return (
      <div className="container" style={{ padding: 18 }}>
        <div style={{ opacity: 0.8 }}>
          {t("narudzbenice.missingParams")}{" "}
          <Link href="/narudzbenice" className="btn">
            {t("narudzbenice.backToList")}
          </Link>
          .
        </div>
      </div>
    );
  }

  const suppliers = await query(
    `SELECT dobavljac_id, naziv, email, drzava_iso2 FROM dobavljaci WHERE dobavljac_id = ? LIMIT 1`,
    [dobavljac_id],
  );
  const supplier = suppliers?.[0] || null;

  const items = await query(
    `
    SELECT
      p.projekat_id,
      p.radni_naziv,
      p.narucilac_id,
      pt.valuta_original,
      SUM(pt.iznos_original) AS iznos,
      GROUP_CONCAT(DISTINCT pt.opis ORDER BY pt.opis SEPARATOR '; ') AS opis_agregat
    FROM projektni_troskovi pt
    JOIN projekti p ON p.projekat_id = pt.projekat_id
    WHERE p.status_id = 8
      AND p.narucilac_id = ?
      AND COALESCE(pt.dobavljac_id, IF(pt.entity_type IN ('vendor','dobavljac','supplier'), pt.entity_id, NULL)) = ?
      AND pt.status <> 'STORNIRANO'
      AND pt.status <> 'PLACENO'
    GROUP BY p.projekat_id, p.radni_naziv, p.narucilac_id, pt.valuta_original
    ORDER BY p.projekat_id ASC, pt.valuta_original ASC
    `,
    [klijent_id, dobavljac_id],
  );

  const projectIds = Array.from(
    new Set(items.map((x) => Number(x.projekat_id))),
  ).filter(Boolean);
  const mode = projectIds.length <= 1 ? "single" : "multi";
  const dateStr = fmtDateDDMMYYYY(new Date());

  const projectSingle =
    mode === "single" && items[0]
      ? { projekat_id: items[0].projekat_id, radni_naziv: items[0].radni_naziv }
      : null;

  const supplierName = supplier?.naziv || (t("narudzbenice.supplierFallback") || "").replace("{{id}}", String(dobavljac_id));

  const email = buildEmail(t, {
    mode,
    projectSingle,
    klijent_id,
    supplierName,
    dateStr,
    items,
  });

  const qsBack = buildQuery({ klijent_id: String(klijent_id) });

  // mailto: link — otvara email klijent s preddefiniranim Subject i Body
  const to = String(supplier?.email ?? "").trim();
  const mailto =
    to
      ? `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`
      : null;

  return (
    <div className="container">
      <style>{`
        .pageWrap { display:flex; flex-direction:column; height:100vh; overflow:hidden; }
        .topBlock {
          position: sticky; top: 0; z-index: 30;
          padding: 14px 0 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          box-shadow: 0 14px 40px rgba(0,0,0,.22);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .topInner { padding: 0 14px; }
        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandLogo { height: 30px; width:auto; opacity:.92; }
        .brandTitle { font-size: 22px; font-weight: 800; line-height: 1.1; margin: 0; }
        .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; }
        .topRow { display:flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
        .divider { height: 1px; background: rgba(255,255,255,.12); margin: 12px 0 12px; }
        .bodyWrap { flex: 1; min-height: 0; overflow: auto; padding: 14px 0 18px; }
        .card {
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,.16);
          overflow: hidden;
          padding: 14px;
        }
        .metaRow { display:flex; gap: 10px; flex-wrap: wrap; align-items: center; opacity: .9; font-size: 12px; margin-bottom: 12px; }
        .pill {
          display:inline-flex; align-items:center; gap:8px;
          padding: 6px 10px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.06);
          font-size: 12px; font-weight: 750;
          white-space: nowrap;
          opacity: .9;
        }
        .boxLabel { opacity: .75; font-size: 12px; margin-bottom: 6px; }
        .monoBox {
          width: 100%;
          min-height: 120px;
          white-space: pre-wrap;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          line-height: 1.45;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.04);
          color: inherit;
          outline: none;
        }
        .warn {
          border: 1px solid rgba(255, 190, 90, .22);
          background: rgba(255, 190, 90, .06);
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 12px;
          opacity: .92;
          margin-top: 12px;
        }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">{t("narudzbenice.previewTitle")}</div>
                  <div className="brandSub">{t("narudzbenice.previewSubtitle")}</div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link href={`/narudzbenice${qsBack}`} className="btn">
                  {t("narudzbenice.back")}
                </Link>
                <Link href="/dashboard" className="btn" title={t("common.dashboard")}>
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("common.dashboard")}
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <div className="card">
            <div className="metaRow">
              <span className="pill">
                {t("narudzbenice.pillClient")} <b>#{klijent_id}</b>
              </span>
              <span className="pill">
                {t("narudzbenice.pillSupplier")} <b>{supplierName}</b>
              </span>
              <span className="pill">
                {t("narudzbenice.pillMode")} <b>{mode === "single" ? t("narudzbenice.modeSingle") : t("narudzbenice.modeMulti")}</b>
              </span>
              <span className="pill">
                {t("narudzbenice.pillPO")} <b>{projectIds.map((id) => `PO-${id}`).join(", ")}</b>
              </span>
            </div>

            {!supplier?.email ? (
              <div className="warn">
                ⚠️ {t("narudzbenice.warnNoEmail")}
              </div>
            ) : null}

            <div style={{ marginTop: 12 }}>
              <div className="boxLabel">{t("narudzbenice.subjectLabel")}</div>
              <div className="monoBox" style={{ minHeight: 44 }}>
                {email.subject}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="boxLabel">{t("narudzbenice.bodyLabel")}</div>
              <div className="monoBox">{email.body}</div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 14,
                flexWrap: "wrap",
              }}
            >
              {mailto ? (
                <a
                  href={mailto}
                  className="btn"
                  style={{
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                  title={t("narudzbenice.sendMailLinkTitle")}
                >
                  📧 {t("narudzbenice.sendMail")}
                </a>
              ) : (
                <button type="button" className="btn" disabled title={t("narudzbenice.sendMailDisabledTitle")}>
                  📧 {t("narudzbenice.sendMail")}
                </button>
              )}

              <Link href={`/narudzbenice${qsBack}`} className="btn">
                {t("narudzbenice.cancel")}
              </Link>
            </div>

            <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
              {t("narudzbenice.sendMailHint")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
