// src/app/fakture/za-fakturisanje/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

type Item = {
  projekat_id: number;
  radni_naziv: string;
  narucilac_id: number | null;
  narucilac_naziv: string | null;
  krajnji_klijent_id: number | null;
  krajnji_klijent_naziv: string | null;
  rok_glavni: string | null; // date
  status_id: number;
  closed_at: string; // datetime (MySQL) ili ISO string
};

const TZ = "Europe/Sarajevo";

function parseAnyDate(value: string | null): Date | null {
  if (!value) return null;

  if (value.includes("T")) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (value.includes(" ")) {
    const d = new Date(value.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value + "T00:00:00");
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(value: string | null): string {
  const d = parseAnyDate(value);
  if (!d) return value ?? "—";

  return new Intl.DateTimeFormat("bs-BA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtDate(value: string | null): string {
  const d = parseAnyDate(value);
  if (!d) return value ?? "—";

  return new Intl.DateTimeFormat("bs-BA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function getData(): Promise<Item[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/fakture/za-fakturisanje`,
    { cache: "no-store" }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

export default async function Page() {
  const items = await getData();

  return (
    <div className="container">
      <style>{`
        /* ✅ Fluxa glass style — ali sa normalnom hijerarhijom (nije sve bold) */
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

        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandLogo { height: 30px; width:auto; opacity:.92; }
        .brandTitle { font-size: 22px; font-weight: 800; line-height: 1.1; margin: 0; }
        .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; line-height: 1.25; }

        .topRow {
          display:flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .divider {
          height: 1px;
          background: rgba(255,255,255,.12);
          margin: 12px 0 0;
        }

        .bodyWrap {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 14px 0 18px;
        }

        /* Card */
        .card {
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,.16);
          padding: 14px;
        }

        .cardHead { margin-bottom: 12px; }
        .cardTitleRow { display:flex; align-items:center; justify-content: space-between; gap:10px; flex-wrap: wrap; }
        .cardTitle { font-size: 14px; font-weight: 800; letter-spacing: .2px; }
        .cardSub { margin-top: 6px; font-size: 12px; opacity: .72; line-height: 1.35; }

        .pillRow { display:flex; gap:8px; flex-wrap: wrap; margin-top: 10px; }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600; /* ✅ nije 800 */
          letter-spacing: .15px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.05);
          opacity: .92;
          white-space: nowrap;
        }
        .pillCode {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-weight: 650; /* ✅ umjereno */
          letter-spacing: .10px;
        }

        /* btn */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 12px;
          min-width: 120px;
          text-align: center;
          white-space: nowrap;
          border-radius: 14px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.03);
          font-weight: 650; /* ✅ nije 800 */
        }
        .btn:hover {
          border-color: rgba(255,255,255,.18);
          background: rgba(255,255,255,.05);
        }

        /* Table */
        .tableWrap {
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 14px;
          overflow: hidden;
          background: rgba(255,255,255,.02);
        }

        table { width: 100%; border-collapse: collapse; }

        thead tr { background: rgba(255,255,255,.04); }

        th {
          text-align: left;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 700; /* ✅ header je jači, ali ne ekstremno */
          letter-spacing: .25px;
          opacity: .80;
          border-bottom: 1px solid rgba(255,255,255,.10);
          white-space: nowrap;
        }

        td {
          padding: 12px;
          font-size: 13.5px;
          border-top: 1px solid rgba(255,255,255,.08);
          vertical-align: top;
        }

        tbody tr:nth-child(2n) { background: rgba(255,255,255,.02); }
        tbody tr:hover { background: rgba(255,255,255,.05); }

        .idLink {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.04);
          text-decoration: none;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          font-weight: 750; /* ✅ ID može biti jači */
          letter-spacing: .12px;
          opacity: .96;
        }

        .cellTitle {
          font-weight: 700; /* ✅ srednje */
          letter-spacing: .05px;
          line-height: 1.25;
        }
        .cellSub { margin-top: 4px; font-size: 12px; opacity: .72; }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.05);
          font-size: 12px;
          font-weight: 650; /* ✅ normalno */
          letter-spacing: .10px;
          white-space: nowrap;
        }

        .empty { padding: 14px; opacity: .75; }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
                <div>
                  <div className="brandTitle">Fakture</div>
                  <div className="brandSub">Za fakturisanje — izvještaj (status 8 + datum zatvaranja)</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Link href="/dashboard" className="btn" title="Dashboard">
                  Dashboard
                </Link>
                <Link href="/projects" className="btn" title="Lista projekata">
                  Projekti
                </Link>
                <Link href="/narudzbenice" className="btn" title="Narudžbenice">
                  Narudžbenice
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <div className="card">
            <div className="cardHead">
              <div className="cardTitleRow">
                <div className="cardTitle">Za fakturisanje</div>
                <div className="pill">
                  Ukupno: <span className="pillCode">{items.length}</span>
                </div>
              </div>

              <div className="cardSub">
                Filter: <span className="pillCode">projekti.status_id = 8</span> · Datum zatvaranja:{" "}
                <span className="pillCode">project_audit(action=PROJECT_CLOSE)</span> · TZ:{" "}
                <span className="pillCode">{TZ}</span>
              </div>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Projekat</th>
                    <th>Naziv</th>
                    <th style={{ width: 260 }}>Naručilac</th>
                    <th style={{ width: 260 }}>Krajnji klijent</th>
                    <th style={{ width: 150 }}>Rok</th>
                    <th style={{ width: 210 }}>Zatvoren</th>
                  </tr>
                </thead>

                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty">
                        Nema projekata u statusu <span className="pillCode">ZATVOREN (8)</span>.
                      </td>
                    </tr>
                  ) : (
                    items.map((x) => (
                      <tr key={x.projekat_id}>
                        <td>
                          <Link href={`/projects/${x.projekat_id}`} className="idLink">
                            #{x.projekat_id}
                          </Link>
                        </td>

                        <td>
                          <div className="cellTitle">{x.radni_naziv ?? "—"}</div>
                          <div className="cellSub">
                            Status: <span className="pillCode">{x.status_id}</span>
                          </div>
                        </td>

                        <td>
                          <div className="cellTitle">{x.narucilac_naziv ?? "—"}</div>
                          {x.narucilac_id ? (
                            <div className="cellSub">
                              ID: <span className="pillCode">{x.narucilac_id}</span>
                            </div>
                          ) : null}
                        </td>

                        <td>
                          <div className="cellTitle">{x.krajnji_klijent_naziv ?? "—"}</div>
                          {x.krajnji_klijent_id ? (
                            <div className="cellSub">
                              ID: <span className="pillCode">{x.krajnji_klijent_id}</span>
                            </div>
                          ) : null}
                        </td>

                        <td>
                          <span className="badge">{fmtDate(x.rok_glavni)}</span>
                        </td>

                        <td>
                          <span className="badge">{fmtDateTime(x.closed_at)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ništa više — čisti izvještaj */}
          </div>
        </div>
      </div>
    </div>
  );
}
