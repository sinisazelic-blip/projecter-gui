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
  const onlyDue = sp?.only_due === "1";
  const dueTo = (sp?.due_to ?? "").trim();
  const dueFrom = (sp?.due_from ?? "").trim();

  const where = ["f.aktivan = 1"];
  const params = [];

  if (q) {
    where.push("(f.naziv_troska LIKE ? OR CAST(f.trosak_id AS CHAR) LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Učitaj aktivne fiksne troškove
  const rawRows = await query(
    `
    SELECT
      f.trosak_id,
      f.naziv_troska,
      f.frekvencija,
      f.dan_u_mjesecu,
      f.datum_dospijeca,
      f.zadnje_placeno,
      f.iznos,
      f.valuta,
      f.nacin_placanja,
      f.napomena
    FROM fiksni_troskovi f
    ${whereSql}
    ORDER BY f.dan_u_mjesecu ASC, f.trosak_id ASC
    `,
    params,
  ).catch(() => []);

  // Učitaj ugovorne obaveze za 2026. godinu da provjerimo statuse po mjesecima
  const ugovorneRows = await query(
    `
    SELECT
      u.obaveza_id,
      u.naziv,
      u.kategorija,
      m.godina,
      m.mjesec,
      m.status,
      m.iznos_km,
      m.placeno_km,
      m.datum_placanja
    FROM ugovorne_obaveze u
    JOIN ugovorne_obaveze_mjeseci m ON m.obaveza_id = u.obaveza_id
    WHERE m.godina = YEAR(CURDATE()) AND m.mjesec = MONTH(CURDATE())
    `,
  ).catch(() => []);

  const ugovorneByNaziv = new Map();
  for (const u of ugovorneRows ?? []) {
    ugovorneByNaziv.set(String(u.naziv || "").toLowerCase().trim(), u);
  }

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  // Izračunaj dinamičko dospijeće za tekući period
  const scheduleRows = (rawRows ?? []).map((f) => {
    let dueStr = null;
    const dan = Number(f.dan_u_mjesecu) || 10;

    if (f.datum_dospijeca) {
      dueStr = f.datum_dospijeca;
    } else {
      const dayPad = String(Math.min(28, Math.max(1, dan))).padStart(2, "0");
      const monthPad = String(curMonth).padStart(2, "0");
      dueStr = `${curYear}-${monthPad}-${dayPad}`;
    }

    // Provjeri status uplate za tekući mjesec
    const fNaziv = String(f.naziv_troska || "").toLowerCase().trim();
    let isPaidThisMonth = false;
    let zadnjePlaceno = f.zadnje_placeno;

    for (const [key, u] of ugovorneByNaziv.entries()) {
      if (fNaziv.includes(key) || key.includes(fNaziv) || (fNaziv.includes("porez") && key.includes("porez"))) {
        if (u.status === "PLACENO") {
          isPaidThisMonth = true;
          zadnjePlaceno = u.datum_placanja || zadnjePlaceno || `${curYear}-${String(curMonth).padStart(2, "0")}-01`;
        }
        break;
      }
    }

    return {
      trosak_id: f.trosak_id,
      naziv_troska: f.naziv_troska,
      frekvencija: f.frekvencija,
      dan_u_mjesecu: f.dan_u_mjesecu,
      due_date: dueStr,
      datum_dospijeca: dueStr,
      amount_km: f.iznos,
      iznos_km: f.iznos,
      zadnje_placeno: zadnjePlaceno,
      is_paid_this_month: isPaidThisMonth,
      status: isPaidThisMonth ? "PLAĆENO" : "AKTIVNO",
    };
  });

  // Filtriranje po datumima i onlyDue ako je traženo
  const filteredRows = scheduleRows.filter((r) => {
    if (dueFrom && r.due_date < dueFrom) return false;
    if (dueTo && r.due_date > dueTo) return false;
    if (onlyDue) {
      const todayStr = now.toISOString().slice(0, 10);
      if (r.is_paid_this_month) return false;
      const diffMs = new Date(r.due_date).getTime() - now.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }
    return true;
  });

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
                Dinamički raspored dospijeća fiksnih i ugovornih obaveza za {curYear}. godinu
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
            {(t("fiksniTroskovi.shownCount") || "").replace("{{count}}", filteredRows.length)}
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
              {filteredRows.length
                ? filteredRows.map((r, idx) => {
                    const due = r.due_date ?? r.datum_dospijeca ?? null;
                    const sig = r.is_paid_this_month
                      ? { text: "Plaćeno", kind: "ok" }
                      : classifyDue(t, due);

                    const iznos = r.amount_km ?? r.iznos_km ?? r.iznos ?? null;
                    const zadnje = r.zadnje_placeno ?? null;

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
        <div className="subtle" style={{ fontSize: 13, lineHeight: 1.6 }}>
          💡 Pregled kombinuje definisane fiksne troškove firme sa stvarnim stanjem uplata iz banke i ugovornih obaveza za {curYear}. godinu.
        </div>
      </div>
    </div>
  );
}
