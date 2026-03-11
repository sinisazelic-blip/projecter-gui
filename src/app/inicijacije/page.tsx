// src/app/inicijacije/page.tsx
import Link from "next/link";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { getValidLocale } from "@/lib/i18n";
import { getT } from "@/lib/translations";
import FluxaLogo from "@/components/FluxaLogo";
import DealTableRow from "./DealTableRow";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const locale = getValidLocale((await cookies()).get("NEXT_LOCALE")?.value ?? "sr");
  const t = getT(locale);
  return { title: t("deals.title") };
}

// Date | string -> "YYYY-MM-DD" (ili null)
function toISODateOnly(v: any): string | null {
  if (!v) return null;

  if (v instanceof Date && Number.isFinite(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }

  const s = String(v);
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}

// dd.mm.yyyy
function fmtDate(v: any) {
  const iso = toISODateOnly(v);
  if (!iso) return "—";
  const y = iso.slice(0, 4);
  const m = iso.slice(5, 7);
  const d = iso.slice(8, 10);
  return `${d}.${m}.${y}`;
}

// dd.mm.yyyy HH:mm
function fmtDateTime(v: any) {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  if (!Number.isFinite(d.getTime())) return String(v);

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function daysDiffFromToday(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map((x) => Number(x));
  const target = new Date(y, (m || 1) - 1, d || 1);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function semaforFor(
  isoDate: string | null,
  t: (key: string) => string,
) {
  if (!isoDate) return { cls: "sem--none", title: t("deals.semaforNone") };
  const diff = daysDiffFromToday(isoDate);
  if (!Number.isFinite(diff))
    return { cls: "sem--none", title: t("deals.semaforInvalid") };

  if (diff <= 0)
    return { cls: "sem--red", title: t("deals.semaforOverdue") };
  if (diff <= 3)
    return { cls: "sem--orange", title: t("deals.semaforSoon") };
  return { cls: "sem--green", title: t("deals.semaforOk") };
}

function normSignal(v: any) {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

function signalMeta(
  sigRaw: any,
  t: (key: string) => string,
) {
  const sig = normSignal(sigRaw);

  if (sig === "STOP") {
    return {
      label: "STOP",
      bg: "rgba(255, 80, 80, .16)",
      border: "rgba(255, 80, 80, .40)",
      dot: "rgba(255, 80, 80, .95)",
      title: t("deals.signalStop"),
    };
  }

  if (sig === "PAZNJA" || sig === "PAŽNJA") {
    return {
      label: "PAŽNJA",
      bg: "rgba(255, 165, 0, .16)",
      border: "rgba(255, 165, 0, .40)",
      dot: "rgba(255, 165, 0, .95)",
      title: t("deals.signalPaznja"),
    };
  }

  return null; // NORMALNO i ostalo: ne prikazuj u Deal UI
}

type ViewMode =
  | "active"
  | "to_invoice"
  | "invoiced"
  | "archived"
  | "no_project"
  | "all";

const VIEW_OPTIONS_KEYS: ViewMode[] = [
  "active",
  "to_invoice",
  "invoiced",
  "archived",
  "no_project",
  "storno",
  "all",
];

export default async function DealsPage({ searchParams }: any) {
  const locale = getValidLocale((await cookies()).get("NEXT_LOCALE")?.value ?? "sr");
  const t = getT(locale);
  const sp = await Promise.resolve(searchParams);

  const q = String(sp?.q ?? "").trim();
  const viewRaw = String(sp?.view ?? "active")
    .trim()
    .toLowerCase();
  const view: ViewMode =
    viewRaw === "to_invoice" ||
    viewRaw === "invoiced" ||
    viewRaw === "archived" ||
    viewRaw === "no_project" ||
    viewRaw === "storno" ||
    viewRaw === "all"
      ? (viewRaw as ViewMode)
      : "active";

  const where: string[] = [];
  const params: any[] = [];

  if (q) {
    const qNum = Number(q);
    if (Number.isFinite(qNum)) {
      // Pretraga po ID Deal-a, broju projekta (id_po) ili nazivu
      where.push("(i.inicijacija_id = ? OR p.id_po = ? OR i.radni_naziv LIKE ?)");
      params.push(Math.trunc(qNum), Math.trunc(qNum), `%${q}%`);
    } else {
      // Tekstualna pretraga po nazivu ili broju projekta (ako je tekstualni format)
      where.push("(i.radni_naziv LIKE ? OR CAST(p.id_po AS CHAR) LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }
  }

  /**
   * ✅ FILTER LOGIKA (kanonski za Deals):
   * - Ako postoji projekat: filtriramo po p.status_id
   * - Ako nema projekta: filtriramo po i.status_id (deal pregovori)
   *
   * statusi_projekta:
   * 8 = ZATVOREN (soft-lock)  -> "spremno za fakturisanje"
   * 9 = FAKTURISAN            -> "za naplatu"
   * 10 = ARHIVIRAN            -> arhiva
   * 12 = OTKAZAN              -> storno
   *
   * Deal statusi (inicijacije.status_id):
   * 4 = ODBIJENO (storno deal)
   */
  if (view === "no_project") {
    where.push("i.projekat_id IS NULL");
    // Sakrij stornirane deale (status 4) - stornirani deals se ne prikazuju u "no_project"
    where.push("i.status_id <> 4");
  } else if (view === "to_invoice") {
    where.push("i.projekat_id IS NOT NULL");
    where.push("p.status_id = 8");
  } else if (view === "invoiced") {
    where.push("i.projekat_id IS NOT NULL");
    where.push("p.status_id = 9");
  } else if (view === "storno") {
    // Samo stornirani: projekti sa status_id = 12 ili deals sa status_id = 4
    where.push(
      "((i.projekat_id IS NOT NULL AND p.status_id = 12) OR (i.projekat_id IS NULL AND i.status_id = 4))",
    );
  } else if (view === "archived") {
    // Arhiva: samo arhivirani (10), bez storniranih (12) i odbijenih deals (4)
    where.push(
      "((i.projekat_id IS NOT NULL AND p.status_id = 10) OR (i.projekat_id IS NULL AND i.status_id = 4))",
    );
  } else if (view === "active") {
    // default: sakrij arhivu (10/12) + fakturisane (9) + zatvorene (8) + odbijene deale (4)
    where.push(
      "((i.projekat_id IS NOT NULL AND p.status_id NOT IN (8,9,10,12)) OR (i.projekat_id IS NULL AND i.status_id <> 4))",
    );
  } else if (view === "all") {
    // "all" = prikaži sve osim storniranih (po defaultu sakrij storno)
    where.push(
      "((i.projekat_id IS NOT NULL AND p.status_id <> 12) OR (i.projekat_id IS NULL AND i.status_id <> 4))",
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // ✅ ključ: povuci zadnji timeline event (accepted_deadline) i koristi kao rok i prije otvaranja projekta
  const rows: any[] = await query(
    `
    SELECT
      i.inicijacija_id,
      i.radni_naziv,
      i.status_id,
      s.naziv AS status_naziv,
      i.updated_at,
      i.created_at,
      i.projekat_id,

      -- ✅ operativni signal sa projekta (owner -> tim / pregovarač)
      p.operativni_signal,

      -- ✅ status projekta (za prikaz + filter mental model)
      p.status_id AS projekat_status_id,
      sp.naziv_statusa AS projekat_status_naziv,

      -- rok: projekat rok (ako postoji) ili accepted_deadline iz timeline-a
      COALESCE(
        DATE_FORMAT(p.rok_glavni, '%Y-%m-%d'),
        DATE_FORMAT(tl.accepted_deadline, '%Y-%m-%d')
      ) AS rok_glavni

    FROM inicijacije i
    LEFT JOIN statusi s
      ON s.status_id = i.status_id
    LEFT JOIN projekti p
      ON p.projekat_id = i.projekat_id
    LEFT JOIN statusi_projekta sp
      ON sp.status_id = p.status_id
    LEFT JOIN (
      SELECT t1.inicijacija_id, t1.accepted_deadline
      FROM deal_timeline_events t1
      INNER JOIN (
        SELECT inicijacija_id, MAX(event_id) AS max_event_id
        FROM deal_timeline_events
        GROUP BY inicijacija_id
      ) t2
        ON t2.inicijacija_id = t1.inicijacija_id
       AND t2.max_event_id = t1.event_id
    ) tl
      ON tl.inicijacija_id = i.inicijacija_id

    ${whereSql}
    ORDER BY i.updated_at DESC, i.inicijacija_id DESC
    LIMIT 300
    `,
    params,
  );

  return (
    <div className="container">
      <style>{`
        /* ✅ Sticky topblock + scroll lista (kao Projects) */
        .pageWrap {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .topBlock {
          position: sticky;
          top: 0;
          z-index: 30;
          padding: 14px 0 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          box-shadow: 0 14px 40px rgba(0,0,0,.22);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .topInner { padding: 0 14px; }

        .topbar { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .filtersRowWrap { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
        .filtersRowWrap .filtersRow { flex:1; min-width:0; margin:0; }

        .glassbtn {
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
        }
        .glassbtn:hover { background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.26); }
        .glassbtn:active { transform: scale(.985); }
        .glassbtn.btnNovi { border-color: rgba(55, 214, 122, .4); background: rgba(55, 214, 122, .08); }
        .glassbtn.btnNovi:hover { background: rgba(55, 214, 122, .14); border-color: rgba(55, 214, 122, .55); }

        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandLogo { height: 30px; width: auto; opacity: .92; }
        .brandTitle { font-size: 22px; font-weight: 750; line-height: 1.1; margin: 0; }
        .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; }

        .divider {
          height: 1px;
          background: rgba(255,255,255,.12);
          margin: 12px 0 12px;
        }

        .listWrap {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 14px 0 18px;
        }

        .tableCard {
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,.16);
          overflow: hidden;
        }

        /* Fino: tabela header ostaje vidljiv */
        .table thead th {
          position: sticky;
          top: 0;
          z-index: 5;
          background: rgba(10,10,10,.35);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .sem { width: 12px; height: 12px; border-radius: 999px; display: inline-block; box-shadow: 0 0 0 2px rgba(0,0,0,.15) inset; }
        .sem--none { background: rgba(255,255,255,.18); }
        .sem--green { background: #37d67a; }
        .sem--orange { background: #ffb020; }
        .sem--red { background: #ff3b30; }

        .dealLink { text-decoration:none; color:inherit; font-weight:650; }
        .dealLink:hover { text-decoration: underline; }
        .mutedSmall { font-size:12px; opacity:.78; margin-top:3px; }

        .sigPill {
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding: 6px 10px;
          border-radius: 999px;
          font-weight: 800;
          letter-spacing: .2px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          font-size: 12px;
          line-height: 1;
          margin-left: 10px;
          white-space: nowrap;
        }
        .sigDot {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          display: inline-block;
          box-shadow: 0 0 0 3px rgba(255,255,255,.06);
        }

        .dealNameWrap { display:flex; align-items:center; gap:8px; min-width:0; }
        .dealIcon { width:14px; height:14px; opacity:.55; flex:0 0 auto; }

        .filtersRow { display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; margin-top: 12px; }
        .field { display:flex; flex-direction:column; gap:6px; }
        .labelSmall { font-size:12px; opacity:.75; }

        .input {
          padding: 10px 12px;
          borderRadius: 12px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          color: inherit;
          outline: none;
        }
          
      `}</style>

      <div className="pageWrap">
        {/* ✅ TOPBLOCK (sticky + glass) */}
        <div className="topBlock">
          <div className="topInner">
            <div className="topbar">
              {/* ✅ LOGO + naslov (diskretno) */}
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">{t("deals.pageSubtitle")}</span>
                </div>
                <div>
                  <div className="brandTitle">📋 {t("deals.pageTitle")}</div>
                  <div className="brandSub">{t("deals.pageDescription")}</div>
                </div>
              </div>

              <div className="actions">
                <Link
                  href="/dashboard"
                  className="glassbtn"
                  title={t("deals.backToDashboard")}
                >
                  🏠 {t("dashboard.title")}
                </Link>
              </div>
            </div>

            {/* ✅ Red ispod: filteri lijevo, +NOVI i Osvježi desno */}
            <div className="filtersRowWrap">
              <form method="GET" className="filtersRow">
                <div className="field">
                  <div className="labelSmall">{t("deals.searchLabel")}</div>
                  <input
                    name="q"
                    defaultValue={q}
                    placeholder={t("deals.searchPlaceholder")}
                    className="input"
                    style={{ width: 320 }}
                  />
                </div>

                <div className="field">
                  <div className="labelSmall">{t("deals.viewLabel")}</div>
                  <select
                    name="view"
                    defaultValue={view}
                    className="input"
                    style={{ width: 260 }}
                  >
                    {VIEW_OPTIONS_KEYS.map((v) => (
                      <option key={v} value={v}>
                        {t(`deals.view_${v}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="glassbtn"
                  title={t("deals.applyFilters")}
                >
                  🔎 {t("deals.applyFilters")}
                </button>
              </form>

              <div className="actions">
                <Link
                  href="/inicijacije/novo"
                  className="glassbtn btnNovi"
                  title={t("deals.newDeal")}
                  data-onboarding="new-deal"
                >
                  ➕ {t("deals.newDealBtn")}
                </Link>
                <Link
                  href="/inicijacije"
                  className="glassbtn"
                  title={t("deals.refreshTitle")}
                >
                  ⟳ {t("deals.refresh")}
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        {/* ✅ LISTA (skrola) */}
        <div className="listWrap">
          <div className="tableCard">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("deals.colId")}</th>
                  <th>{t("deals.colDeal")}</th>
                  <th>{t("deals.colRok")}</th>
                  <th>{t("deals.colStatus")}</th>
                  <th>{t("deals.colTime")}</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ opacity: 0.7, padding: 18 }}>
                      {t("deals.noDeals")}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const opened = !!r.projekat_id;

                    // ✅ Status prikaz:
                    // - ako ima projekat: prikazi status PROJEKTA (naziv_statusa)
                    // - ako nema projekta: prikazi status DEAL-a (naziv)
                    const projectStatusName = r.projekat_status_naziv
                      ? String(r.projekat_status_naziv)
                      : null;
                    const dealStatusName = r.status_naziv
                      ? String(r.status_naziv)
                      : null;

                    const dealStatusKey = `statuses.deal.${r.status_id}`;
                    const dealStatusTranslated = t(dealStatusKey);
                    const dealStatusDisplay =
                      dealStatusName === "Nova inicijacija"
                        ? t("deals.statusNoviDeal")
                        : dealStatusTranslated !== dealStatusKey
                          ? dealStatusTranslated
                          : dealStatusName;
                    const projectStatusKey = `statuses.project.${r.projekat_status_id}`;
                    const projectStatusTranslated = t(projectStatusKey);
                    const statusLabel = opened
                      ? (projectStatusTranslated !== projectStatusKey
                          ? projectStatusTranslated
                          : projectStatusName ?? t("deals.projectHash") + Number(r.projekat_status_id ?? 0))
                      : (dealStatusDisplay ?? "—");

                    const rokIso = toISODateOnly(r.rok_glavni);
                    const sem = semaforFor(rokIso, t);

                    const sig = opened ? signalMeta(r.operativni_signal, t) : null;

                    return (
                      <DealTableRow
                        key={r.inicijacija_id}
                        deal={r}
                        opened={opened}
                        projectStatusName={projectStatusName}
                        dealStatusName={dealStatusName}
                        statusLabel={statusLabel}
                        rokIso={rokIso}
                        sem={sem}
                        sig={sig}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
