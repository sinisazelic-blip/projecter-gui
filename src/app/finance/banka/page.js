import Link from "next/link";
import { query } from "@/lib/db";
import { ExportExcelButton } from "@/components/ExportExcelButton";

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

function allocBadge(a) {
  const v = String(a ?? "").toUpperCase();
  if (v === "OK") return badge("OK", "ok");
  if (v === "UNLINKED") return badge("UNLINKED", "warn");
  if (v === "OVER_ALLOCATED") return badge("OVER_ALLOCATED", "bad");
  return badge(v || "—");
}

function buildResetProjectHref(sp) {
  const params = new URLSearchParams();
  // zadrži sve osim projekat_id
  const q = (sp?.q ?? "").trim();
  const alloc = (sp?.alloc ?? "").trim();
  const from = (sp?.from ?? "").trim();
  const to = (sp?.to ?? "").trim();

  if (q) params.set("q", q);
  if (alloc) params.set("alloc", alloc);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const qs = params.toString();
  return qs ? `/finance/banka?${qs}` : "/finance/banka";
}

export default async function BankaPage({ searchParams }) {
  const sp = await Promise.resolve(searchParams);

  const q = (sp?.q ?? "").trim();
  const alloc = (sp?.alloc ?? "").trim(); // OK | UNLINKED | OVER_ALLOCATED
  const from = (sp?.from ?? "").trim(); // YYYY-MM-DD
  const to = (sp?.to ?? "").trim(); // YYYY-MM-DD
  const projekatIdRaw = (sp?.projekat_id ?? "").trim();

  const projekatId = projekatIdRaw ? Number(projekatIdRaw) : null;
  const hasProject = Number.isFinite(projekatId) && projekatId > 0;

  const resetProjectHref = buildResetProjectHref(sp);

  // query feed (prefer view)
  const where = [];
  const params = [];

  if (q) {
    where.push(
      "(f.counterparty LIKE ? OR f.description LIKE ? OR CAST(f.tx_id AS CHAR) LIKE ?)",
    );
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (alloc) {
    where.push("f.alloc_status = ?");
    params.push(alloc);
  }

  if (from) {
    where.push("f.value_date >= ?");
    params.push(from);
  }
  if (to) {
    where.push("f.value_date <= ?");
    params.push(to);
  }

  // projekat filter: f.projekat_id (ako postoji) OR bank_tx_cost_link.projekat_id
  if (hasProject) {
    where.push(
      `(f.projekat_id = ? OR EXISTS (
          SELECT 1 FROM bank_tx_cost_link cl
          WHERE cl.posting_id = f.posting_id AND cl.projekat_id = ?
       ))`,
    );
    params.push(projekatId, projekatId);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  let rows = [];
  try {
    rows = await query(
      `
      SELECT
        f.posting_id,
        f.tx_id,
        f.batch_id,
        f.value_date,
        f.amount,
        f.currency,
        f.counterparty,
        f.description,
        f.alloc_status,
        f.linked_total_km,
        f.reversed_at,
        f.reversed_by_batch_id
      FROM v_bank_posting_feed f
      ${whereSql}
      ORDER BY f.value_date DESC, f.posting_id DESC
      LIMIT 200
      `,
      params,
    );
  } catch {
    // fallback (no view)
    const w2 = [];
    const p2 = [];

    if (q) {
      w2.push(
        "(counterparty LIKE ? OR description LIKE ? OR CAST(tx_id AS CHAR) LIKE ?)",
      );
      p2.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (from) {
      w2.push("value_date >= ?");
      p2.push(from);
    }
    if (to) {
      w2.push("value_date <= ?");
      p2.push(to);
    }
    if (hasProject) {
      w2.push(
        `(projekat_id = ? OR EXISTS (
          SELECT 1 FROM bank_tx_cost_link cl
          WHERE cl.posting_id = bank_tx_posting.posting_id AND cl.projekat_id = ?
        ))`,
      );
      p2.push(projekatId, projekatId);
    }

    const wSql = w2.length ? `WHERE ${w2.join(" AND ")}` : "";

    rows = await query(
      `
      SELECT
        posting_id, tx_id, batch_id, value_date, amount, currency, counterparty, description,
        NULL AS alloc_status,
        NULL AS linked_total_km,
        reversed_at,
        reversed_by_batch_id
      FROM bank_tx_posting
      ${wSql}
      ORDER BY value_date DESC, posting_id DESC
      LIMIT 200
      `,
      p2,
    );
  }

  return (
    <div className="container">
      <div className="banka-page-layout">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span className="brandTitle">Banka</span>
                    {hasProject && (
                      <span className="badge badge-green" title="Aktivan filter">
                        PROJEKAT #{projekatId}
                      </span>
                    )}
                    {alloc && <span className="badge">{alloc}</span>}
                    {q && <span className="badge">q</span>}
                  </div>
                  <div className="brandSub">Canonical ledger (read-only). Filteri su UX.</div>
                </div>
              </div>
              <div className="actions">
                {hasProject && (
                  <Link className="btn" href={resetProjectHref} title="Ukloni projekat filter">
                    Reset projekat
                  </Link>
                )}
                <Link className="btn" href="/finance">Finansije</Link>
                <Link className="btn" href="/dashboard" title="Dashboard">🏠 Dashboard</Link>
              </div>
            </div>
            <div className="divider" />
          </div>
        </div>

        <div className="banka-body">
          <div className="card" style={{ marginBottom: 14 }}>
            <form method="GET" className="banka-filters">
              <div className="banka-filters-row">
                <div className="banka-field banka-field--wide">
                  <label className="label">Pretraga</label>
                  <input
                    className="input"
                    name="q"
                    defaultValue={q}
                    placeholder="partner / opis / tx_id…"
                  />
                </div>
                <div className="banka-field">
                  <label className="label">Status (alloc)</label>
                  <select className="input" name="alloc" defaultValue={alloc}>
                    <option value="">(sve)</option>
                    <option value="OK">OK</option>
                    <option value="UNLINKED">UNLINKED</option>
                    <option value="OVER_ALLOCATED">OVER_ALLOCATED</option>
                  </select>
                </div>
                <div className="banka-field">
                  <label className="label">Projekat ID</label>
                  <input
                    className="input"
                    name="projekat_id"
                    defaultValue={projekatIdRaw}
                    placeholder="npr. 77"
                  />
                  {hasProject && (
                    <div className="subtle" style={{ marginTop: 4, fontSize: 12 }}>
                      <Link className="link" href={`/projects/${projekatId}`}>Otvori projekat</Link>
                    </div>
                  )}
                </div>
              </div>
              <div className="banka-filters-row">
                <div className="banka-field">
                  <label className="label">Od datuma</label>
                  <input
                    className="input"
                    name="from"
                    type="date"
                    defaultValue={from}
                  />
                </div>
                <div className="banka-field">
                  <label className="label">Do datuma</label>
                  <input
                    className="input"
                    name="to"
                    type="date"
                    defaultValue={to}
                  />
                </div>
                <div className="banka-field banka-actions">
                  <label className="label" style={{ opacity: 0 }}>.</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn--active" type="submit">Primijeni</button>
                    <Link className="btn" href="/finance/banka">Reset</Link>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="card tableCard banka-table-card">
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span className="muted">Prikazano: {rows.length} (limit 200)</span>
              <ExportExcelButton
                filename="banka_izvod"
                sheetName="Banka"
                headers={["posting_id", "tx_id", "Datum", "Iznos", "Valuta", "alloc_status", "linked_total_km", "Partner", "Opis", "reversed"]}
                rows={rows.map((r) => [
                  r.posting_id,
                  r.tx_id ?? "",
                  fmtDate(r.value_date),
                  r.amount ?? "",
                  r.currency ?? "",
                  r.alloc_status ?? "",
                  r.linked_total_km ?? "",
                  r.counterparty ?? "",
                  r.description ?? "",
                  r.reversed_at || r.reversed_by_batch_id ? "DA" : "NE",
                ])}
              />
            </div>
            <div className="banka-table-wrap" style={{ overflowX: "auto" }}>
              <table className="table banka-table">
                <colgroup>
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "92px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "130px" }} />
                  <col style={{ width: "72px" }} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th>posting</th>
                    <th>Datum</th>
                    <th style={{ textAlign: "right" }}>iznos</th>
                    <th>alloc</th>
                    <th>rev</th>
                    <th>partner / opis</th>
                  </tr>
                </thead>
            <tbody>
              {rows.length
                ? rows.map((r) => {
                    const rev =
                      r.reversed_at || r.reversed_by_batch_id
                        ? badge("YES", "bad")
                        : badge("NO", "ok");
                    return (
                      <tr key={r.posting_id}>
                        <td>
                          <Link
                            className="link"
                            href={`/finance/banka/${r.posting_id}`}
                          >
                            {r.posting_id}
                          </Link>
                          <div className="subtle">tx:{r.tx_id}</div>
                        </td>
                        <td>{fmtDate(r.value_date)}</td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtKM(r.amount)}
                        </td>
                        <td>
                          {r.alloc_status
                            ? allocBadge(r.alloc_status)
                            : badge("—")}
                        </td>
                        <td>{rev}</td>
                        <td>
                          <div style={{ fontWeight: 900 }}>
                            {r.counterparty?.trim() ? r.counterparty : "—"}
                          </div>
                          <div className="subtle">{r.description ?? "—"}</div>
                        </td>
                      </tr>
                    );
                  })
                : <tr>
                    <td colSpan={6} className="subtle" style={{ padding: 14 }}>
                      Nema rezultata.
                    </td>
                  </tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
