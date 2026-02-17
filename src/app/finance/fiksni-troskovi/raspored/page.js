import Link from "next/link";
import { query } from "@/lib/db";

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

function classifyDue(dueDate) {
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
    return { text: `Kasni (${Math.abs(diffDays)}d)`, kind: "bad" };
  if (diffDays === 0) return { text: "Danas", kind: "bad" };
  if (diffDays <= 7) return { text: `Uskoro (${diffDays}d)`, kind: "warn" };
  return { text: `Za ${diffDays}d`, kind: "ok" };
}

export default async function FiksniRasporedPage({ searchParams }) {
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
              <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
              <span className="brandSlogan">Project & Finance Engine</span>
            </div>
            <div>
              <h1 className="h1" style={{ margin: 0 }}>Fiksni troškovi — raspored</h1>
              <div className="subtle">
                Read-only pregled iz <code>vw_fiksni_troskovi_raspored</code> +{" "}
                <code>vw_fiksni_troskovi_status</code>
              </div>
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <Link className="btn" href="/finance" title="Nazad na Finansije">
            ← Nazad
          </Link>
          <Link className="btn" href="/finance/fiksni-troskovi" title="Lista fiksnih troškova">
            ☰ Lista
          </Link>
          <Link className="btn" href="/dashboard" title="Dashboard">
            🏠 Dashboard
          </Link>
        </div>
      </div>

      <div className="card fiksni-raspored-filters">
        <form
          className="fiksni-raspored-form"
          method="GET"
        >
          <div className="fiksni-filter-group">
            <label className="label">Pretraga</label>
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder="naziv troška…"
            />
          </div>
          <div className="fiksni-filter-group">
            <label className="label">Due od</label>
            <input
              className="input"
              name="due_from"
              type="date"
              defaultValue={dueFrom}
            />
          </div>
          <div className="fiksni-filter-group">
            <label className="label">Due do</label>
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
            Samo dospjelo / uskoro (≤ 7 dana)
          </label>
          <div className="fiksni-filter-actions">
            <button className="btn btn--active" type="submit">
              Primijeni
            </button>
            <Link className="btn" href="/finance/fiksni-troskovi/raspored">
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-row" style={{ justifyContent: "space-between" }}>
          <div className="subtle">
            Prikazano: {scheduleRows?.length ?? 0} (limit 200)
          </div>
          <div className="subtle">Boje su signal (kasni / uskoro / ok).</div>
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
                <th>ID</th>
                <th>Naziv</th>
                <th>Frekv.</th>
                <th>Dan</th>
                <th>Dospijeće</th>
                <th style={{ textAlign: "right" }}>Iznos</th>
                <th>Zadnje plaćeno</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {scheduleRows?.length
                ? scheduleRows.map((r, idx) => {
                    const id = Number(r.trosak_id);
                    const due = r.due_date ?? r.datum_dospijeca ?? null;
                    const sig = classifyDue(due);

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
                      Nema rezultata.
                    </td>
                  </tr>}
            </tbody>
          </table>
        </div>

        <div className="hr" />
        <div className="subtle">
          Ovo je read-only raspored. Kasnije: kreiranje “plaćanja” iz dospjelih
          fiksnih + link na bank posting.
        </div>
      </div>

      {/* RAW STATUS VIEW (debug panel, read-only) */}
      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>
          Status (raw view preview)
        </div>
        <div className="subtle">
          {statusRows?.length
            ? <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(statusRows.slice(0, 20), null, 2)}
              </pre>
            : "Nema redova (ili view nije dostupan)."}
        </div>
      </div>
    </div>
  );
}
