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

const fmtDT = (d) => {
  if (!d) return "—";
  const s = String(d).replace("T", " ").slice(0, 19);
  const [date, time] = s.split(" ");
  if (!date) return String(d);
  const [y, m, day] = date.split("-");
  if (!y || !m || !day) return s;
  return `${day}.${m}.${y}${time ? " " + time : ""}`;
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

export default async function PlacanjeDetailPage({ params }) {
  const { placanje_id } = await Promise.resolve(params);
  const payId = Number(placanje_id);

  if (!Number.isFinite(payId)) {
    return (
      <div className="container">
        <div className="card">
          <div className="h2">Greška</div>
          <div className="subtle">Neispravan placanje_id.</div>
          <div style={{ marginTop: 12 }}>
            <Link className="btn" href="/finance/placanja">
              Nazad
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const placRows = await query(
    `
    SELECT
      p.placanje_id,
      p.datum AS datum,
      p.iznos_km,
      p.partner,
      p.opis,
      p.napomena,
      p.status
    FROM placanja p
    WHERE p.placanje_id = ?
    LIMIT 1
    `,
    [payId]
  ).catch(async () => {
    return await query(`SELECT * FROM placanja WHERE placanje_id = ? LIMIT 1`, [payId]);
  });

  const plac = placRows?.[0] ?? null;

  if (!plac) {
    return (
      <div className="container">
        <div className="topbar glass">
          <div className="topbar-left">
            <h1 className="h1">Plaćanje — detalj</h1>
            <div className="subtle">ID #{payId} nije pronađen.</div>
          </div>
          <div className="topbar-right">
            <Link className="btn" href="/finance/placanja">
              Nazad
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="subtle">Provjeri ID ili listu.</div>
        </div>
      </div>
    );
  }

  const bankLinks = await query(
    `
    SELECT
      l.link_id,
      l.posting_id,
      l.placanje_id,
      l.amount_km,
      l.aktivan,
      l.created_at
    FROM bank_tx_posting_placanje_link l
    WHERE l.placanje_id = ?
    ORDER BY l.link_id
    `,
    [payId]
  );

  const sumLinked = bankLinks
    .filter((x) => Number(x.aktivan) === 1)
    .reduce((acc, x) => acc + Number(x.amount_km || 0), 0);

  const postingIds = bankLinks
    .map((x) => Number(x.posting_id))
    .filter((n) => Number.isFinite(n) && n > 0);

  let postings = [];
  if (postingIds.length) {
    const uniq = Array.from(new Set(postingIds));
    const placeholders = uniq.map(() => "?").join(",");
    postings = await query(
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
        f.alloc_status
      FROM v_bank_posting_feed f
      WHERE f.posting_id IN (${placeholders})
      `,
      uniq
    ).catch(async () => {
      return await query(
        `
        SELECT posting_id, tx_id, batch_id, value_date, amount, currency, counterparty, description
        FROM bank_tx_posting
        WHERE posting_id IN (${placeholders})
        `,
        uniq
      );
    });
  }

  // 2.18 fallback needle: partner ili opis (kraće)
  const needleRaw = (plac.partner || plac.opis || plac.napomena || "").trim();
  const needle = needleRaw.length > 40 ? needleRaw.slice(0, 40) : needleRaw;

  let related = [];
  if (!postingIds.length && needle) {
    related = await query(
      `
      SELECT
        f.posting_id,
        f.value_date,
        f.amount,
        f.currency,
        f.counterparty,
        f.description,
        f.alloc_status
      FROM v_bank_posting_feed f
      WHERE (f.counterparty LIKE ? OR f.description LIKE ?)
      ORDER BY f.value_date DESC, f.posting_id DESC
      LIMIT 20
      `,
      [`%${needle}%`, `%${needle}%`]
    ).catch(async () => []);
  }

  const bankSearchHref = needle
    ? `/finance/banka?q=${encodeURIComponent(needle)}`
    : `/finance/banka`;

  // stavke (best effort)
  const stavke = await query(
    `
    SELECT
      s.placanje_id,
      s.trosak_id,
      s.iznos_km,
      s.opis
    FROM placanja_stavke s
    WHERE s.placanje_id = ?
    ORDER BY s.trosak_id
    `,
    [payId]
  ).catch(async () => {
    try {
      return await query(`SELECT * FROM placanja_stavke WHERE placanje_id = ?`, [payId]);
    } catch {
      return [];
    }
  });

  const trosakIds = stavke
    .map((x) => Number(x.trosak_id))
    .filter((n) => Number.isFinite(n) && n > 0);

  let troskovi = [];
  if (trosakIds.length) {
    const uniq = Array.from(new Set(trosakIds));
    const placeholders = uniq.map(() => "?").join(",");
    troskovi = await query(
      `
      SELECT
        t.trosak_id,
        t.projekat_id,
        t.tip_id,
        t.datum_troska,
        t.opis,
        t.iznos_km,
        t.status
      FROM projektni_troskovi t
      WHERE t.trosak_id IN (${placeholders})
      `,
      uniq
    ).catch(async () => []);
  }

  return (
    <div className="container">
      <div className="topbar glass">
        <div className="topbar-left">
          <h1 className="h1">Plaćanje #{plac.placanje_id}</h1>
          <div className="subtle">
            datum: <b>{fmtDate(plac.datum)}</b> · iznos: <b>{fmtKM(plac.iznos_km)}</b>
          </div>
        </div>
        <div className="topbar-right" style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href={bankSearchHref}>Banka (filter)</Link>
          <Link className="btn" href="/finance/placanja">Nazad</Link>
        </div>
      </div>

      <div className="card">
        <div className="card-row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="label">Iznos</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {fmtKM(plac.iznos_km)}
            </div>
            <div className="subtle">status: {plac.status ?? "—"}</div>
          </div>

          <div style={{ minWidth: 320, flex: 1 }}>
            <div className="label">Partner / opis</div>
            <div style={{ fontWeight: 800 }}>{plac.partner ?? "—"}</div>
            <div className="subtle" style={{ marginTop: 6 }}>{plac.opis ?? "—"}</div>
            {plac.napomena ? <div className="subtle">napomena: {plac.napomena}</div> : null}
          </div>

          <div>
            <div className="label">Banka (aktivni linkovi)</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {fmtKM(sumLinked)}
            </div>
            <div className="subtle">
              {sumLinked === Number(plac.iznos_km) ? badge("MATCH", "ok") : badge("CHECK", "warn")}
            </div>
          </div>
        </div>

        <div className="hr" />
        <div className="subtle" style={{ lineHeight: 1.7 }}>
          <b>Read-only.</b> Ovo je meaning + kontekst. Linkovanje je kasnija faza.
        </div>
      </div>

      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>Veze na banku (bank_tx_posting_placanje_link)</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>link_id</th>
                <th style={{ width: 110 }}>posting</th>
                <th style={{ width: 160, textAlign: "right" }}>amount_km</th>
                <th style={{ width: 110 }}>aktivan</th>
                <th>created_at</th>
              </tr>
            </thead>
            <tbody>
              {bankLinks?.length ? (
                bankLinks.map((r) => (
                  <tr key={r.link_id}>
                    <td>{r.link_id}</td>
                    <td>
                      <Link className="link" href={`/finance/banka/${r.posting_id}`}>
                        {r.posting_id}
                      </Link>
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmtKM(r.amount_km)}
                    </td>
                    <td>{r.aktivan ? badge("DA", "ok") : badge("NE", "warn")}</td>
                    <td className="subtle">{fmtDT(r.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="subtle" style={{ padding: 12 }}>
                    Nema bank linkova.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>Povezani postinzi (read-only)</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>posting</th>
                <th style={{ width: 140 }}>datum</th>
                <th style={{ width: 160, textAlign: "right" }}>iznos</th>
                <th style={{ width: 170 }}>alloc</th>
                <th>partner / opis</th>
              </tr>
            </thead>
            <tbody>
              {postings?.length ? (
                postings.map((p) => (
                  <tr key={p.posting_id}>
                    <td>
                      <Link className="link" href={`/finance/banka/${p.posting_id}`}>
                        {p.posting_id}
                      </Link>
                    </td>
                    <td>{fmtDate(p.value_date)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmtKM(p.amount)}
                    </td>
                    <td className="subtle">{p.alloc_status ?? "—"}</td>
                    <td>
                      <div style={{ fontWeight: 800 }}>{p.counterparty?.trim() ? p.counterparty : "—"}</div>
                      <div className="subtle">{p.description ?? "—"}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="subtle" style={{ padding: 12 }}>
                    Nema postinga.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2.18 fallback */}
      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>Bank context (fallback)</div>
        <div className="subtle" style={{ marginBottom: 10, lineHeight: 1.7 }}>
          Ako nema eksplicitnih linkova, ovo je best-effort lista sličnih posting-a po tekstu.
        </div>

        <div style={{ marginBottom: 10 }}>
          <Link className="btn" href={bankSearchHref}>Otvori banku sa filterom</Link>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>posting</th>
                <th style={{ width: 140 }}>datum</th>
                <th style={{ width: 160, textAlign: "right" }}>iznos</th>
                <th style={{ width: 170 }}>alloc</th>
                <th>partner / opis</th>
              </tr>
            </thead>
            <tbody>
              {related?.length ? (
                related.map((r) => (
                  <tr key={r.posting_id}>
                    <td>
                      <Link className="link" href={`/finance/banka/${r.posting_id}`}>
                        {r.posting_id}
                      </Link>
                    </td>
                    <td>{fmtDate(r.value_date)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmtKM(r.amount)}
                    </td>
                    <td className="subtle">{r.alloc_status ?? "—"}</td>
                    <td>
                      <div style={{ fontWeight: 800 }}>{r.counterparty?.trim() ? r.counterparty : "—"}</div>
                      <div className="subtle">{r.description ?? "—"}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="subtle" style={{ padding: 12 }}>
                    Nema fallback rezultata (ili nema needle).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* STAVKE */}
      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>Stavke (placanja_stavke)</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>trosak_id</th>
                <th style={{ width: 160, textAlign: "right" }}>iznos</th>
                <th>opis</th>
              </tr>
            </thead>
            <tbody>
              {stavke?.length ? (
                stavke.map((s, idx) => (
                  <tr key={`${s.trosak_id ?? "x"}-${idx}`}>
                    <td>{s.trosak_id ?? "—"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmtKM(s.iznos_km)}
                    </td>
                    <td className="subtle">{s.opis ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="subtle" style={{ padding: 12 }}>
                    Nema stavki (ili tabela nema očekivane kolone).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TROSKOVI */}
      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>Referencirani projektni troškovi (projektni_troskovi)</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>trosak_id</th>
                <th style={{ width: 120 }}>projekat</th>
                <th style={{ width: 120 }}>tip</th>
                <th style={{ width: 140 }}>datum</th>
                <th style={{ width: 160, textAlign: "right" }}>iznos</th>
                <th>opis</th>
                <th style={{ width: 120 }}>status</th>
              </tr>
            </thead>
            <tbody>
              {troskovi?.length ? (
                troskovi.map((t) => (
                  <tr key={t.trosak_id}>
                    <td>{t.trosak_id}</td>
                    <td>{t.projekat_id ?? "—"}</td>
                    <td>{t.tip_id ?? "—"}</td>
                    <td>{fmtDate(t.datum_troska)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmtKM(t.iznos_km)}
                    </td>
                    <td className="subtle">{t.opis ?? "—"}</td>
                    <td>{t.status ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="subtle" style={{ padding: 12 }}>
                    Nema referenciranih troškova (ili stavke nemaju trosak_id).
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
