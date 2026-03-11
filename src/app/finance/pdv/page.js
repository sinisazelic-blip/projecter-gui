import Link from "next/link";
import { cookies } from "next/headers";
import FluxaLogo from "@/components/FluxaLogo";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { getLastMonthRange, getPdvPrijavaData } from "@/lib/pdv-prijava";

export const dynamic = "force-dynamic";

const fmtKM = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " KM";
};

const fmtDate = (s) => {
  if (!s || typeof s !== "string") return "—";
  const part = String(s).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return "—";
  const [y, m, d] = part.split("-");
  return `${d}.${m}.${y}`;
};

export default async function PdvPrijavaPage({ searchParams }) {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  const sp = await Promise.resolve(searchParams);
  const prosliMjesec = sp?.prosli_mjesec === "1" || sp?.prošli_mjesec === "1";
  let from = (sp?.from ?? "").trim();
  let to = (sp?.to ?? "").trim();
  if (prosliMjesec) {
    const range = getLastMonthRange();
    from = range.from;
    to = range.to;
  }
  const data = await getPdvPrijavaData(from || null, to || null);
  const { from: dataFrom, to: dataTo, summary, kif, kuf } = data;

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">{t("pdv.title")}</div>
                  <div className="brandSub">{t("pdv.subtitle")}</div>
                </div>
              </div>
              <Link href="/finance" className="btn" title={t("finance.title")}>
                ← {t("finance.title")}
              </Link>
            </div>
            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          {/* Filter perioda */}
          <div
            className="card"
            style={{
              marginBottom: 20,
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <form
              method="get"
              action="/finance/pdv"
              style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="subtle" style={{ fontSize: 12 }}>{t("pdv.from")}</span>
                <input
                  type="date"
                  name="from"
                  defaultValue={dataFrom}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="subtle" style={{ fontSize: 12 }}>Do</span>
                <input
                  type="date"
                  name="to"
                  defaultValue={dataTo}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
                />
              </label>
              <button type="submit" className="btn btn--active" style={{ padding: "8px 16px" }}>
                {t("pdv.refresh")}
              </button>
              <Link
                href="/finance/pdv?prosli_mjesec=1"
                className="btn"
                style={{ padding: "8px 16px" }}
              >
                {t("pdv.lastMonth")}
              </Link>
            </form>
          </div>

          {/* Obračun – rezime */}
          <div
            className="card"
            style={{
              marginBottom: 24,
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
            }}
          >
            <div style={{ fontSize: 13, marginBottom: 12, color: "var(--muted)" }}>
              Period: {fmtDate(dataFrom)} – {fmtDate(dataTo)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
              <div>
                <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>Izlazni PDV (KIF)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtKM(summary.pdv_izlazni_km)}</div>
              </div>
              <div>
                <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>Ulazni PDV (KUF)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtKM(summary.pdv_ulazni_km)}</div>
              </div>
              <div style={{ padding: "8px 0", paddingLeft: 12, borderLeft: "2px solid var(--accent)" }}>
                <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>Za prijavu</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)" }}>
                  {fmtKM(summary.za_prijavu_km)}
                </div>
              </div>
            </div>
          </div>

          {/* KIF – dokumenti izlazni PDV */}
          <div
            className="card"
            style={{
              marginBottom: 24,
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 14, borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
              Dokumenti – izlazni PDV (KIF)
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Broj</th>
                    <th>Datum</th>
                    <th>Kupac / Naručilac</th>
                    <th style={{ textAlign: "right" }}>Osnovica (KM)</th>
                    <th style={{ textAlign: "right" }}>PDV (KM)</th>
                    <th style={{ textAlign: "right" }}>Ukupno (KM)</th>
                  </tr>
                </thead>
                <tbody>
                  {kif.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="subtle" style={{ padding: 24, textAlign: "center" }}>
                        Nema dokumenata u izabranom periodu.
                      </td>
                    </tr>
                  ) : (
                    kif.map((r) => (
                      <tr key={r.id ?? r.broj}>
                        <td>{r.broj}{r.iz_arhive ? " (arh.)" : ""}</td>
                        <td>{fmtDate(r.datum)}</td>
                        <td>{r.kupac}</td>
                        <td style={{ textAlign: "right" }}>{fmtKM(r.osnovica_km)}</td>
                        <td style={{ textAlign: "right" }}>{fmtKM(r.pdv_km)}</td>
                        <td style={{ textAlign: "right" }}>{fmtKM(r.ukupno_km)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* KUF – dokumenti ulazni PDV */}
          <div
            className="card"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 14, borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
              Dokumenti – ulazni PDV (KUF)
            </div>
            <div className="subtle" style={{ padding: "8px 14px", fontSize: 12 }}>
              Ulazni PDV je preračunat iz ukupnog iznosa (17% uključen) ako u KUF nije unesen posebno.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Broj</th>
                    <th>Datum</th>
                    <th>Partner</th>
                    <th style={{ textAlign: "right" }}>Osnovica (KM)</th>
                    <th style={{ textAlign: "right" }}>PDV ulazni (KM)</th>
                    <th style={{ textAlign: "right" }}>Ukupno (KM)</th>
                  </tr>
                </thead>
                <tbody>
                  {kuf.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="subtle" style={{ padding: 24, textAlign: "center" }}>
                        Nema dokumenata u izabranom periodu.
                      </td>
                    </tr>
                  ) : (
                    kuf.map((r) => (
                      <tr key={r.id}>
                        <td>{r.broj}</td>
                        <td>{fmtDate(r.datum)}</td>
                        <td>{r.partner}</td>
                        <td style={{ textAlign: "right" }}>{fmtKM(r.osnovica_km)}</td>
                        <td style={{ textAlign: "right" }}>{fmtKM(r.pdv_km)}</td>
                        <td style={{ textAlign: "right" }}>{fmtKM(r.ukupno_km)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
