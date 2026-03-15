import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { query } from "@/lib/db";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

const fmtKM = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2) + " KM";
};

const fmtDate = (d) => {
  if (!d) return "—";
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}.${m}.${y}`;
  }
  const s = String(d).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, day] = s.split("-");
    return `${day}.${m}.${y}`;
  }
  const parsed = new Date(d);
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getDate()).padStart(2, "0")}.${String(parsed.getMonth() + 1).padStart(2, "0")}.${parsed.getFullYear()}`;
  }
  return "—";
};

function badge(text, kind = "neutral") {
  const cls =
    kind === "ok"
      ? "badge badge-green"
      : kind === "warn"
        ? "badge badge-orange"
        : kind === "bad"
          ? "badge badge-red"
          : "badge";
  return <span className={cls}>{text}</span>;
}

function classifyDue(t, dueDate) {
  if (!dueDate) return { text: "—", kind: "neutral" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let due;
  if (dueDate instanceof Date) {
    due = dueDate;
  } else {
    const s = String(dueDate).trim().slice(0, 10);
    due = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00") : new Date(dueDate);
  }
  if (Number.isNaN(due.getTime()))
    return { text: fmtDate(dueDate), kind: "neutral" };

  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0)
    return { text: (t("fiksniTroskovi.overdueDaysRaspored") || "").replace("{{days}}", Math.abs(diffDays)), kind: "bad" };
  if (diffDays === 0) return { text: t("fiksniTroskovi.todayRaspored"), kind: "bad" };
  if (diffDays <= 7) return { text: (t("fiksniTroskovi.soonRaspored") || "").replace("{{days}}", diffDays), kind: "warn" };
  return { text: (t("fiksniTroskovi.inDaysRaspored") || "").replace("{{days}}", diffDays), kind: "ok" };
}

export default async function FiksniRasporedPage({ searchParams }) {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  const sp = await Promise.resolve(searchParams);

  const q = (sp?.q ?? "").trim();
  const onlyDue = sp?.only_due === "1"; // prikazi samo dospjele i uskoro
  const dueTo = (sp?.due_to ?? "").trim(); // YYYY-MM-DD
  const dueFrom = (sp?.due_from ?? "").trim(); // YYYY-MM-DD

  const where = [];
  const params = [];

  // tekst pretraga: naziv
  if (q) {
    where.push("(r.naziv_troska LIKE ?)");
    params.push(`%${q}%`);
  }

  // period dospijeća (ako view ima due_date / datum_dospijeca - koristimo COALESCE)
  if (dueFrom) {
    where.push("(COALESCE(r.due_date, r.datum_dospijeca) >= ?)");
    params.push(dueFrom);
  }
  if (dueTo) {
    where.push("(COALESCE(r.due_date, r.datum_dospijeca) <= ?)");
    params.push(dueTo);
  }

  // only_due: kasni ili u narednih 7 dana
  // Pošto je view nepoznat, radimo s datumom i MySQL DATEDIFF.
  if (onlyDue) {
    where.push(
      "(DATEDIFF(COALESCE(r.due_date, r.datum_dospijeca), CURDATE()) <= 7)",
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // 1) Statusi (summary)
  const statusRows = await query(
    `
    SELECT *
    FROM vw_fiksni_troskovi_status
    ORDER BY trosak_id DESC
    LIMIT 500
    `,
  ).catch(async () => []);

  // 2) Raspored (next due list)
  // Ne znamo kolone; prvo pokušamo "friendly" select, pa fallback na SELECT *
  const scheduleRows = await query(
    `
    SELECT
      r.trosak_id,
      r.naziv_troska,
      r.frekvencija,
      r.dan_u_mjesecu,
      r.due_date,
      r.datum_dospijeca,
      r.amount_km,
      r.iznos_km,
      r.zadnje_placeno,
      r.status
    FROM vw_fiksni_troskovi_raspored r
    ${whereSql}
    ORDER BY COALESCE(r.due_date, r.datum_dospijeca) ASC, r.trosak_id ASC
    LIMIT 200
    `,
    params,
  ).catch(async () => {
    return await query(
      `
      SELECT *
      FROM vw_fiksni_troskovi_raspored r
      ${whereSql}
      ORDER BY 1
      LIMIT 200
      `,
      params,
    );
  });

  // helper: map statusRows by trosak_id (ako postoji)
  const statusById = new Map();
  for (const r of statusRows || []) {
    const id = Number(r.trosak_id);
    if (Number.isFinite(id)) statusById.set(id, r);
  }

  return (
    <div className="container">
      <div className="topbar glass">
        <div className="topbar-left">
          <div className="brandWrap">
            <div className="brandLogoBlock">
              <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
            </div>
            <div>
              <h1 className="h1" style={{ margin: 0 }}>{t("fiksniTroskovi.rasporedTitle")}</h1>
              <div className="subtle">
                {t("fiksniTroskovi.rasporedSubtitle")} <code>vw_fiksni_troskovi_raspored</code> +{" "}
                <code>vw_fiksni_troskovi_status</code>
              </div>
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <Link className="btn" href="/finance" title={t("fiksniTroskovi.backToFinanceTitle")}>
            {t("fiksniTroskovi.backToFinance")}
          </Link>
          <Link className="btn" href="/finance/fiksni-troskovi" title={t("fiksniTroskovi.listLinkTitle")}>
            {t("fiksniTroskovi.listLink")}
          </Link>
          <Link className="btn" href="/dashboard" title={t("common.dashboard")}>
            <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("common.dashboard")}
          </Link>
        </div>
      </div>

      <div className="card fiksni-raspored-filters">
        <form
          className="fiksni-raspored-form"
          method="GET"
        >
          <div className="fiksni-filter-group">
            <label className="label">{t("fiksniTroskovi.search")}</label>
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder={t("fiksniTroskovi.searchPlaceholderRaspored")}
            />
          </div>
          <div className="fiksni-filter-group">
            <label className="label">{t("fiksniTroskovi.dueFrom")}</label>
            <input
              className="input"
              name="due_from"
              type="date"
              defaultValue={dueFrom}
            />
          </div>
          <div className="fiksni-filter-group">
            <label className="label">{t("fiksniTroskovi.dueTo")}</label>
            <input
              className="input"
              name="due_to"
              type="date"
              defaultValue={dueTo}
            />
          </div>
          <label className="fiksni-filter-checkbox">
            <input
              type="checkbox"
              name="only_due"
              value="1"
              defaultChecked={onlyDue}
            />
            {t("fiksniTroskovi.onlyDueLabel")}
          </label>
          <div className="fiksni-filter-actions">
            <button className="btn btn--active" type="submit">
              {t("fiksniTroskovi.apply")}
            </button>
            <Link className="btn" href="/finance/fiksni-troskovi/raspored">
              {t("fiksniTroskovi.reset")}
            </Link>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-row" style={{ justifyContent: "space-between" }}>
          <div className="subtle">
            {(t("fiksniTroskovi.shownCount") || "").replace("{{count}}", scheduleRows?.length ?? 0)}
          </div>
          <div className="subtle">{t("fiksniTroskovi.signalHint")}</div>
        </div>

        <div className="table-wrap fiksni-raspored-table-wrap">
          <table className="table fiksni-raspored-table">
            <colgroup>
              <col style={{ width: "52px" }} />
              <col style={{ width: "240px" }} />
              <col style={{ width: "88px" }} />
              <col style={{ width: "52px" }} />
              <col style={{ width: "92px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "92px" }} />
              <col style={{ width: "110px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>{t("fiksniTroskovi.colId")}</th>
                <th>{t("fiksniTroskovi.colName")}</th>
                <th>{t("fiksniTroskovi.colFreqShort")}</th>
                <th>{t("fiksniTroskovi.colDay")}</th>
                <th>{t("fiksniTroskovi.colDue")}</th>
                <th style={{ textAlign: "right" }}>{t("fiksniTroskovi.colAmount")}</th>
                <th>{t("fiksniTroskovi.colLastPaid")}</th>
                <th>{t("fiksniTroskovi.colSignal")}</th>
              </tr>
            </thead>
            <tbody>
              {scheduleRows?.length
                ? scheduleRows.map((r, idx) => {
                    const id = Number(r.trosak_id);
                    const due = r.due_date ?? r.datum_dospijeca ?? null;
                    const sig = classifyDue(t, due);

                    const iznos = r.amount_km ?? r.iznos_km ?? r.iznos ?? null;

                    const st = Number.isFinite(id) ? statusById.get(id) : null;
                    // ako status view ima "zadnje_placeno" ili sl., preferiraj
                    const zadnje =
                      st?.zadnje_placeno ?? r.zadnje_placeno ?? null;

                    return (
                      <tr key={`${r.trosak_id ?? "x"}-${idx}`}>
                        <td>{r.trosak_id ?? "—"}</td>
                        <td style={{ fontWeight: 800 }}>
                          {r.naziv_troska ?? "—"}
                        </td>
                        <td>{r.frekvencija ?? "—"}</td>
                        <td>{r.dan_u_mjesecu ?? "—"}</td>
                        <td>{fmtDate(due)}</td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtKM(iznos)}
                        </td>
                        <td>{fmtDate(zadnje)}</td>
                        <td>{badge(sig.text, sig.kind)}</td>
                      </tr>
                    );
                  })
                : <tr>
                    <td colSpan={8} className="subtle" style={{ padding: 16 }}>
                      {t("fiksniTroskovi.noResults")}
                    </td>
                  </tr>}
            </tbody>
          </table>
        </div>

        <div className="hr" />
        <div className="subtle">
          {t("fiksniTroskovi.rasporedNote")}
        </div>
      </div>
    </div>
  );
}
