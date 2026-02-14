import Link from "next/link";
import { query } from "@/lib/db";
import OtpisPotrazivanjeForm from "./OtpisPotrazivanjeForm";

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

export default async function PotrazivanjeDetailPage({ params }) {
  const { potrazivanje_id } = await Promise.resolve(params);
  const pid = Number(potrazivanje_id);

  if (!Number.isFinite(pid)) {
    return (
      <div className="container">
        <div className="card">
          <div className="h2">Greška</div>
          <div className="subtle">Neispravan potrazivanje_id.</div>
          <div style={{ marginTop: 12 }}>
            <Link className="btn" href="/finance/potrazivanja">
              Nazad
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 1) Potrazivanje (best effort: minimalne kolone)
  // Ne znamo 100% šemu, pa prvo pokušamo "standard", pa fallback SELECT *
  let pot = null;
  try {
    const rows = await query(
      `
      SELECT
        p.potrazivanje_id,
        p.projekat_id,
        p.klijent_id,
        p.datum,
        p.datum_dospijeca,
        p.iznos_km,
        p.opis,
        p.napomena,
        p.status
      FROM projekt_potrazivanja p
      WHERE p.potrazivanje_id = ?
      LIMIT 1
      `,
      [pid],
    );
    pot = rows?.[0] ?? null;
  } catch {
    const rows = await query(
      `
      SELECT *
      FROM projekt_potrazivanja
      WHERE potrazivanje_id = ?
      LIMIT 1
      `,
      [pid],
    );
    pot = rows?.[0] ?? null;
  }

  if (!pot) {
    return (
      <div className="container">
        <div className="topbar glass">
          <div className="topbar-left">
            <h1 className="h1">Potraživanje — detalj</h1>
            <div className="subtle">ID #{pid} nije pronađen.</div>
          </div>
          <div className="topbar-right">
            <Link className="btn" href="/finance/potrazivanja">
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

  // 2) Paid sum view (ako postoji)
  const paidRows = await query(
    `
    SELECT *
    FROM v_potrazivanja_paid_sum
    WHERE potrazivanje_id = ?
    LIMIT 1
    `,
    [pid],
  ).catch(async () => []);

  const paid = paidRows?.[0] ?? null;
  const paidKm =
    paid?.paid_km ?? paid?.paid_sum_km ?? paid?.paid_sum ?? paid?.paid ?? 0;

  const iznosKm = pot.iznos_km ?? pot.iznos ?? null;
  const remaining =
    Number.isFinite(Number(iznosKm)) && Number.isFinite(Number(paidKm))
      ? Number(iznosKm) - Number(paidKm)
      : null;

  // 3) Linkovi potrazivanje -> prihod
  const links = await query(
    `
    SELECT
      link_id,
      potrazivanje_id,
      prihod_id,
      amount_km,
      aktivan,
      created_at
    FROM projekt_potrazivanje_prihod_link
    WHERE potrazivanje_id = ?
    ORDER BY link_id
    `,
    [pid],
  ).catch(async () => []);

  const prihodIds = links
    .filter((x) => Number(x.aktivan) === 1)
    .map((x) => Number(x.prihod_id))
    .filter((n) => Number.isFinite(n) && n > 0);

  let prihodi = [];
  if (prihodIds.length) {
    const uniq = Array.from(new Set(prihodIds));
    const placeholders = uniq.map(() => "?").join(",");
    prihodi = await query(
      `
      SELECT prihod_id, projekat_id, datum, iznos_km, opis, status
      FROM projektni_prihodi
      WHERE prihod_id IN (${placeholders})
      `,
      uniq,
    ).catch(async () => []);
  }

  // 4) 2.19 bank context
  // needle: opis/napomena (kratko) + eventualno partner/klijent string ako postoji
  const needleRaw = (pot.opis || pot.napomena || "").trim();
  const needle = needleRaw.length > 40 ? needleRaw.slice(0, 40) : needleRaw;

  const bankSearchHref = needle
    ? `/finance/banka?q=${encodeURIComponent(needle)}`
    : `/finance/banka`;

  // 2.19 fallback: related bank postings by text
  // Ako potrazivanje nije “poklopljeno”, najviše pomaže.
  let related = [];
  if (needle) {
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
      [`%${needle}%`, `%${needle}%`],
    ).catch(async () => []);
  }

  const isOtpisano = (pot.status || "").toUpperCase() === "OTPISANO";
  const statusBadge =
    isOtpisano
      ? badge("OTPISANO", "bad")
      : remaining === null
        ? badge("—", "neutral")
        : remaining <= 0.0001
          ? badge("ZATVORENO", "ok")
          : badge("OTVORENO", "warn");

  return (
    <div className="container">
      <div className="topbar glass">
        <div className="topbar-left">
          <h1 className="h1">Potraživanje #{pot.potrazivanje_id}</h1>
          <div className="subtle">
            projekat_id: <b>{pot.projekat_id ?? "—"}</b> · datum:{" "}
            <b>{fmtDate(pot.datum)}</b>
            {pot.datum_dospijeca
              ? <>
                  {" "}
                  · dospijeće: <b>{fmtDate(pot.datum_dospijeca)}</b>
                </>
              : null}
          </div>
        </div>

        <div className="topbar-right" style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href={bankSearchHref}>
            Banka (filter)
          </Link>
          <Link className="btn" href="/finance/potrazivanja">
            Nazad
          </Link>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="card">
        <div
          className="card-row"
          style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
        >
          <div>
            <div className="label">Iznos</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtKM(iznosKm)}
            </div>
            <div className="subtle">
              status: {pot.status ?? "—"} · {statusBadge}
            </div>
          </div>

          <div style={{ minWidth: 320, flex: 1 }}>
            <div className="label">Opis</div>
            <div style={{ fontWeight: 800 }}>{pot.opis ?? "—"}</div>
            {pot.napomena
              ? <div className="subtle" style={{ marginTop: 6 }}>
                  {pot.napomena}
                </div>
              : null}
          </div>

          <div>
            <div className="label">Naplaćeno (view)</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtKM(paidKm)}
            </div>
            <div className="subtle">
              preostalo:{" "}
              {remaining === null
                ? "—"
                : remaining <= 0.0001
                  ? badge(fmtKM(remaining), "ok")
                  : badge(fmtKM(remaining), "warn")}
            </div>
          </div>
        </div>

        <div className="hr" />
        <div className="subtle" style={{ lineHeight: 1.7 }}>
          <b>Read-only.</b> Ovo je meaning + linkovi. Banka je canonical. “Banka
          (filter)” je samo kontekst, ne link.
        </div>
        {!isOtpisano && (
          <>
            <div className="hr" />
            <div className="cardTitle" style={{ marginBottom: 4 }}>Otpisi potraživanje</div>
            <div className="subtle" style={{ fontSize: 13 }}>
              Nenaplativa potraživanja (firma ugašena, dužnik nestao) mogu se označiti kao otpisana.
            </div>
            <OtpisPotrazivanjeForm potrazivanjeId={pot.potrazivanje_id} />
          </>
        )}
      </div>

      {/* LINKS */}
      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>
          Veze na prihode (projekt_potrazivanje_prihod_link)
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>link_id</th>
                <th style={{ width: 140 }}>prihod_id</th>
                <th style={{ width: 160, textAlign: "right" }}>amount_km</th>
                <th style={{ width: 110 }}>aktivan</th>
                <th>created_at</th>
              </tr>
            </thead>
            <tbody>
              {links?.length
                ? links.map((r) => (
                    <tr key={r.link_id}>
                      <td>{r.link_id}</td>
                      <td>
                        {Number(r.prihod_id) > 0
                          ? <Link
                              className="link"
                              href={`/finance/prihodi/${r.prihod_id}`}
                            >
                              {r.prihod_id}
                            </Link>
                          : r.prihod_id}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmtKM(r.amount_km)}
                      </td>
                      <td>
                        {r.aktivan ? badge("DA", "ok") : badge("NE", "warn")}
                      </td>
                      <td className="subtle">{fmtDT(r.created_at)}</td>
                    </tr>
                  ))
                : <tr>
                    <td colSpan={5} className="subtle" style={{ padding: 12 }}>
                      Nema veza na prihode.
                    </td>
                  </tr>}
            </tbody>
          </table>
        </div>

        {prihodi?.length
          ? <>
              <div className="hr" />
              <div className="subtle" style={{ marginBottom: 8 }}>
                Povezani prihodi (read-only):
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>prihod_id</th>
                      <th style={{ width: 120 }}>projekat</th>
                      <th style={{ width: 140 }}>datum</th>
                      <th style={{ width: 160, textAlign: "right" }}>iznos</th>
                      <th>opis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prihodi.map((r) => (
                      <tr key={r.prihod_id}>
                        <td>
                          <Link
                            className="link"
                            href={`/finance/prihodi/${r.prihod_id}`}
                          >
                            {r.prihod_id}
                          </Link>
                        </td>
                        <td>{r.projekat_id ?? "—"}</td>
                        <td>{fmtDate(r.datum)}</td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtKM(r.iznos_km)}
                        </td>
                        <td className="subtle">{r.opis ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          : null}
      </div>

      {/* 2.19 BANK CONTEXT */}
      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>
          Bank context (fallback)
        </div>
        <div className="subtle" style={{ marginBottom: 10, lineHeight: 1.7 }}>
          Ovo je best-effort lista sličnih bank posting-a po tekstu
          (opis/napomena). Ne utiče na podatke.
        </div>

        <div style={{ marginBottom: 10 }}>
          <Link className="btn" href={bankSearchHref}>
            Otvori banku sa filterom
          </Link>
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
              {related?.length
                ? related.map((r) => (
                    <tr key={r.posting_id}>
                      <td>
                        <Link
                          className="link"
                          href={`/finance/banka/${r.posting_id}`}
                        >
                          {r.posting_id}
                        </Link>
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
                      <td className="subtle">{r.alloc_status ?? "—"}</td>
                      <td>
                        <div style={{ fontWeight: 800 }}>
                          {r.counterparty?.trim() ? r.counterparty : "—"}
                        </div>
                        <div className="subtle">{r.description ?? "—"}</div>
                      </td>
                    </tr>
                  ))
                : <tr>
                    <td colSpan={5} className="subtle" style={{ padding: 12 }}>
                      Nema fallback rezultata (ili nema needle).
                    </td>
                  </tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* RAW PAID VIEW */}
      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>
          Paid sum (raw view)
        </div>
        <div className="subtle">
          {paid
            ? <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(paid, null, 2)}
              </pre>
            : "Nema reda u v_potrazivanja_paid_sum (možda još nije linkovano)."}
        </div>
      </div>
    </div>
  );
}
