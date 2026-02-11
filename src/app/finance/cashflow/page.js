import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const fmtKM = (v, valuta = "BAM") => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} ${valuta ?? "BAM"}`;
};

const fmtDate = (d) => {
  if (!d) return "—";
  const match = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "—";
  const [, y, m, day] = match;
  return `${day}.${m}.${y}`;
};

/**
 * Generiše sve datume dospijeća za fiksni trošak unutar horizonta.
 * - MJESECNO + dan_u_mjesecu: svaki mjesec, taj dan
 * - GODISNJE + datum_dospijeca: datum (+1 god ako prošlo)
 * - JEDNOKRATNO: datum_dospijeca
 */
function computeAllDueDates(row, fromDate, toDate) {
  const dates = [];
  const frek = (row?.frekvencija ?? "").toUpperCase();
  const dan = Number(row?.dan_u_mjesecu);
  const datum = row?.datum_dospijeca ? String(row.datum_dospijeca).slice(0, 10) : null;

  if (frek === "MJESECNO" && Number.isFinite(dan) && dan >= 1 && dan <= 31) {
    const curr = new Date(fromDate);
    curr.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(0, 0, 0, 0);

    while (curr <= end) {
      const lastDay = new Date(curr.getFullYear(), curr.getMonth() + 1, 0).getDate();
      const safeDay = Math.min(dan, lastDay);
      const d = new Date(curr.getFullYear(), curr.getMonth(), safeDay);
      dates.push(d.toISOString().slice(0, 10));
      curr.setMonth(curr.getMonth() + 1);
    }
    return dates;
  }

  if ((frek === "GODISNJE" || frek === "JEDNOKRATNO") && datum) {
    let d = new Date(datum + "T00:00:00");
    if (Number.isNaN(d.getTime())) return [];
    if (frek === "GODISNJE") {
      while (d < fromDate) d.setFullYear(d.getFullYear() + 1);
    }
    if (d <= toDate) dates.push(d.toISOString().slice(0, 10));
    return dates;
  }

  if (datum) {
    const d = new Date(datum + "T00:00:00");
    if (!Number.isNaN(d.getTime()) && d >= fromDate && d <= toDate) {
      dates.push(datum);
    }
  }
  return dates;
}

function classifyDue(dueDate) {
  if (!dueDate) return { text: "—", kind: "neutral" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(String(dueDate).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(due.getTime())) return { text: String(dueDate), kind: "neutral" };

  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) return { text: `Kasni ${Math.abs(diffDays)}d`, kind: "bad" };
  if (diffDays === 0) return { text: "Danas", kind: "bad" };
  if (diffDays === 1) return { text: "Sutra", kind: "warn" };
  if (diffDays <= 7) return { text: `Za ${diffDays}d`, kind: "warn" };
  if (diffDays <= 14) return { text: `Za ${diffDays}d`, kind: "ok" };
  return { text: `Za ${diffDays}d`, kind: "ok" };
}

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

export default async function CashFlowPage({ searchParams }) {
  const sp = await Promise.resolve(searchParams);
  const horizonDays = Math.min(90, Math.max(14, Number(sp?.dana ?? 60) || 60));

  const rows = await query(
    `
    SELECT
      trosak_id,
      naziv_troska,
      frekvencija,
      dan_u_mjesecu,
      datum_dospijeca,
      zadnje_placeno,
      iznos,
      valuta,
      aktivan
    FROM fiksni_troskovi
    WHERE aktivan = 1
    ORDER BY trosak_id ASC
    `,
    [],
  ).catch(() => []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonStart = new Date(today);
  horizonStart.setDate(horizonStart.getDate() - 30); // uključi i kasneće (prošli mjesec)
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

  const items = [];
  for (const r of rows || []) {
    const dueDates = computeAllDueDates(r, horizonStart, horizonEnd);
    for (const dueStr of dueDates) {
      const due = new Date(dueStr + "T00:00:00");
      if (Number.isNaN(due.getTime())) continue;
      items.push({
        ...r,
        due_date: dueStr,
        due_obj: due,
      });
    }
  }

  items.sort((a, b) => a.due_obj.getTime() - b.due_obj.getTime());

  const nextDue = items.find((x) => x.due_obj >= today) ?? items[0];

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
                  <div className="brandTitle">CashFlow</div>
                  <div className="brandSub">
                    Hronologija plaćanja · Uvijek vidiš šta je sljedeće
                  </div>
                </div>
              </div>

              <div className="actions">
                <Link className="btn" href="/finance/fiksni-troskovi">
                  Fiksni troškovi
                </Link>
                <Link className="btn" href="/finance" title="Finansije">
                  Finansije
                </Link>
                <Link className="btn" href="/dashboard" title="Dashboard">
                  🏠 Dashboard
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          {/* Sljedeće za plaćanje - highlight */}
          {nextDue && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="cardHead">
                <div className="cardTitleRow">
                  <div className="cardTitle">Sljedeće za plaćanje</div>
                  <span className="muted">
                    {fmtDate(nextDue.due_date)} · {nextDue.naziv_troska}
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 900 }}>
                  {nextDue.naziv_troska}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtKM(nextDue.iznos, nextDue.valuta)}
                </div>
                <div>{badge(classifyDue(nextDue.due_date).text, classifyDue(nextDue.due_date).kind)}</div>
                <div className="muted" style={{ fontSize: 14 }}>
                  {nextDue.frekvencija === "MJESECNO"
                    ? `Svaki ${nextDue.dan_u_mjesecu}. u mjesecu`
                    : nextDue.frekvencija === "GODISNJE"
                      ? "Godišnje"
                      : "Jednokratno"}
                </div>
              </div>
            </div>
          )}

          {/* Hronologija */}
          <div className="card">
            <div className="cardHead">
              <div className="cardTitleRow">
                <div className="cardTitle">
                  Hronologija plaćanja (narednih {horizonDays} dana)
                </div>
                <span className="muted">
                  Prikazano: {items.length} stavki
                </span>
              </div>
            </div>

            <div className="tableCard">
              <table className="table" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "12%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Trošak</th>
                    <th>Frekvencija</th>
                    <th className="num">Iznos</th>
                    <th>Zadnje plaćeno</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length
                    ? items.map((r, idx) => {
                        const sig = classifyDue(r.due_date);
                        return (
                          <tr
                            key={`${r.trosak_id}-${r.due_date}-${idx}`}
                            style={
                              nextDue?.trosak_id === r.trosak_id &&
                              nextDue?.due_date === r.due_date
                                ? { background: "rgba(255,255,255,.06)" }
                                : undefined
                            }
                          >
                            <td className="nowrap">{fmtDate(r.due_date)}</td>
                            <td style={{ fontWeight: 700 }}>
                              {r.naziv_troska ?? "—"}
                            </td>
                            <td>
                              {r.frekvencija === "MJESECNO"
                                ? `${r.dan_u_mjesecu}. u mjesecu`
                                : r.frekvencija ?? "—"}
                            </td>
                            <td className="num">
                              {fmtKM(r.iznos, r.valuta)}
                            </td>
                            <td className="nowrap">
                              {r.zadnje_placeno
                                ? fmtDate(r.zadnje_placeno)
                                : "—"}
                            </td>
                            <td>{badge(sig.text, sig.kind)}</td>
                          </tr>
                        );
                      })
                    : (
                        <tr>
                          <td colSpan={6} className="muted" style={{ padding: 16 }}>
                            Nema aktivnih fiksnih troškova u narednih{" "}
                            {horizonDays} dana.
                          </td>
                        </tr>
                      )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <form method="GET" className="filters" style={{ flexWrap: "wrap" }}>
              <div className="field">
                <span className="label">Horizont (dana)</span>
                <input
                  className="input"
                  type="number"
                  name="dana"
                  defaultValue={horizonDays}
                  min={14}
                  max={180}
                  style={{ width: 80 }}
                />
              </div>
              <div className="actions">
                <button className="btn btn--active" type="submit">
                  Primijeni
                </button>
                <Link className="btn" href="/finance/cashflow">
                  Reset (60 dana)
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
