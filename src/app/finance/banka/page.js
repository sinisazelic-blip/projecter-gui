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
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  if (!y || !m || !day) return String(d);
  return `${day}.${m}.${y}`;
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
    where.push("(f.counterparty LIKE ? OR f.description LIKE ? OR CAST(f.tx_id AS CHAR) LIKE ?)");
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
       ))`
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
      params
    );
  } catch {
    // fallback (no view)
    const w2 = [];
    const p2 = [];

    if (q) {
      w2.push("(counterparty LIKE ? OR description LIKE ? OR CAST(tx_id AS CHAR) LIKE ?)");
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
        ))`
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
      p2
    );
  }

  return (
    <div className="container">
      <div className="topbar glass">
        <div className="topbar-left">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 className="h1" style={{ margin: 0 }}>Banka</h1>

            {/* ✅ 2.23: projekat badge */}
            {hasProject ? (
              <span title="Aktivan filter: projekat_id" className="badge badge-green">
                PROJEKAT #{projekatId}
              </span>
            ) : null}

            {alloc ? <span className="badge">{alloc}</span> : null}
            {q ? <span className="badge">q</span> : null}
          </div>

          <div className="subtle">Canonical ledger (read-only). Filteri su UX.</div>
        </div>

        <div className="topbar-right" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* ✅ 2.23: quick reset samo projekat */}
          {hasProject ? (
            <Link className="btn" href={resetProjectHref} title="Ukloni projekat filter (ostavi ostale filtere)">
              Reset projekat
            </Link>
          ) : null}

          <Link className="btn" href="/finance">
            Finansije
          </Link>
        </div>
      </div>

      <div className="card">
        <form className="card-row" method="GET" style={{ gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 260 }}>
            <div className="label">Pretraga (q)</div>
            <input className="input" name="q" defaultValue={q} placeholder="partner / opis / tx_id…" />
            {q ? <div className="subtle" style={{ marginTop: 6 }}>Traži u partner/opis/tx_id</div> : null}
          </div>

          <div style={{ width: 170 }}>
            <div className="label">alloc</div>
            <select className="input" name="alloc" defaultValue={alloc}>
              <option value="">(sve)</option>
              <option value="OK">OK</option>
              <option value="UNLINKED">UNLINKED</option>
              <option value="OVER_ALLOCATED">OVER_ALLOCATED</option>
            </select>
          </div>

          <div style={{ width: 180 }}>
            <div className="label">projekat_id</div>
            <input className="input" name="projekat_id" defaultValue={projekatIdRaw} placeholder="npr. 77" />
            {hasProject ? (
              <div className="subtle" style={{ marginTop: 6 }}>
                Aktivno: <b>PROJEKAT #{projekatId}</b> ·{" "}
                <Link className="link" href={`/projects/${projekatId}`}>
                  otvori projekat
                </Link>
              </div>
            ) : null}
          </div>

          <div style={{ width: 170 }}>
            <div className="label">from</div>
            <input className="input" name="from" defaultValue={from} placeholder="YYYY-MM-DD" />
          </div>

          <div style={{ width: 170 }}>
            <div className="label">to</div>
            <input className="input" name="to" defaultValue={to} placeholder="YYYY-MM-DD" />
          </div>

          <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
            <button className="btn btn-primary" type="submit">
              Primijeni
            </button>
            <Link className="btn" href="/finance/banka">
              Reset sve
            </Link>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="subtle">Prikazano: {rows.length} (limit 200)</div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>posting</th>
                <th style={{ width: 140 }}>datum</th>
                <th style={{ width: 160, textAlign: "right" }}>iznos</th>
                <th style={{ width: 160 }}>alloc</th>
                <th style={{ width: 110 }}>rev</th>
                <th>partner / opis</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => {
                  const rev = r.reversed_at || r.reversed_by_batch_id ? badge("YES", "bad") : badge("NO", "ok");
                  return (
                    <tr key={r.posting_id}>
                      <td>
                        <Link className="link" href={`/finance/banka/${r.posting_id}`}>
                          {r.posting_id}
                        </Link>
                        <div className="subtle">tx:{r.tx_id}</div>
                      </td>
                      <td>{fmtDate(r.value_date)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {fmtKM(r.amount)}
                      </td>
                      <td>{r.alloc_status ? allocBadge(r.alloc_status) : badge("—")}</td>
                      <td>{rev}</td>
                      <td>
                        <div style={{ fontWeight: 900 }}>{r.counterparty?.trim() ? r.counterparty : "—"}</div>
                        <div className="subtle">{r.description ?? "—"}</div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="subtle" style={{ padding: 14 }}>
                    Nema rezultata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
