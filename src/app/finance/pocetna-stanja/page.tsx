import Link from "next/link";
import { getPocetnaStanja } from "@/lib/pocetna-stanja";
import PocetnaStanjaImport from "./PocetnaStanjaImport";
import OtpisPocetnoStanjeButton from "./OtpisPocetnoStanjeButton";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

const fmtKM = (v: number) => {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + " KM";
};

/** Suma samo aktivnih (ne otpisanih) stavki */
function sumAktivno<T extends { iznos_km: number; otpisano?: boolean }>(rows: T[]): number {
  return rows.reduce((s, r) => (r.otpisano ? s : s + r.iznos_km), 0);
}

export default async function PocetnaStanjaPage() {
  const data = await getPocetnaStanja();

  const sumKlijenti = sumAktivno(data.klijenti);
  const sumDobavljaci = sumAktivno(data.dobavljaci);
  const sumTalenti = sumAktivno(data.talenti);

  return (
    <div className="container">
      <div className="pocetna-stanja-layout">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">Evidencija početnih stanja</div>
                  <div className="brandSub">
                    Finansije / Stanje na 31.12.2025 — klijenti, dobavljači, talenti
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                    Klijenti: <strong style={{ color: "var(--text)" }}>{data.klijenti.length}</strong> stanja
                    {" · "}
                    Dobavljači: <strong style={{ color: "var(--text)" }}>{data.dobavljaci.length}</strong> stanja
                    {" · "}
                    Talenti: <strong style={{ color: "var(--text)" }}>{data.talenti.length}</strong> stanja
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Link href="/finance" className="btn" title="Finansije">
                  Finansije
                </Link>
                <Link href="/dashboard" className="btn" title="Dashboard">
                  🏠 Dashboard
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        {/* Klijenti */}
        <section
          className="card"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--panel)",
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 15 }}>
            Klijenti — potraživanja od klijenata
          </div>
          <div style={{ padding: "6px 16px", fontSize: 12, color: "var(--muted)" }}>
            Pozitivan iznos = klijent duguje nama.
          </div>
          <div className="pocetna-stanja-table-wrap">
            <table className="table pocetna-stanja-table" style={{ width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "34%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Naziv</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>Iznos (KM)</th>
                    <th style={{ textAlign: "center", padding: "10px 14px" }}>Akcija</th>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Napomena</th>
                  </tr>
                </thead>
                <tbody>
                  {data.klijenti.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 20, color: "var(--muted)" }}>
                        Nema unosa ili tabela nije dostupna.
                      </td>
                    </tr>
                  ) : (
                    data.klijenti.map((r) => (
                      <tr key={r.klijent_id} style={r.otpisano ? { opacity: 0.75 } : undefined}>
                        <td style={{ padding: "10px 14px", whiteSpace: "normal", wordBreak: "break-word" }}>
                          <Link href={`/studio/klijenti`} style={{ color: "inherit", fontWeight: 500 }}>
                            {r.naziv}
                          </Link>
                          {r.otpisano && (
                            <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>Otpisano</span>
                          )}
                          {r.otpisano && r.otpis_razlog && (
                            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{r.otpis_razlog}</div>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                          {fmtKM(r.iznos_km)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {!r.otpisano && (
                            <OtpisPocetnoStanjeButton tip="klijent" refId={r.klijent_id} />
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--muted)", fontSize: 13, whiteSpace: "normal", wordBreak: "break-word" }}>
                          {r.napomena ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                    <td style={{ padding: "12px 14px" }}>Ukupno (aktivna)</td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {fmtKM(sumKlijenti)}
                    </td>
                    <td style={{ padding: "12px 14px" }} />
                    <td style={{ padding: "12px 14px" }} />
                  </tr>
                </tfoot>
              </table>
          </div>
          <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--muted)" }}>
            Prikazano: {data.klijenti.length} stavki
          </div>
        </section>

        {/* Dobavljači */}
        <section
          className="card"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--panel)",
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 15 }}>
            Dobavljači — naša dugovanja prema dobavljačima
          </div>
          <div style={{ padding: "6px 16px", fontSize: 12, color: "var(--muted)" }}>
            Iznos = koliko dugujemo dobavljaču.
          </div>
          <div className="pocetna-stanja-table-wrap">
            <table className="table pocetna-stanja-table" style={{ width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "44%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Naziv</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>Iznos (KM)</th>
                    <th style={{ textAlign: "center", padding: "10px 14px" }}>Akcija</th>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Napomena</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dobavljaci.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 20, color: "var(--muted)" }}>
                        Nema unosa u evidenciji. Kad uneseš početna stanja dobavljača (baza ili buduća forma), ovdje će se prikazati.
                      </td>
                    </tr>
                  ) : (
                    data.dobavljaci.map((r) => {
                      const fromPocetno = r.napomena !== "Tekuće dugovanje (projekt_dugovanja)";
                      return (
                        <tr key={r.dobavljac_id} style={r.otpisano ? { opacity: 0.75 } : undefined}>
                          <td style={{ padding: "10px 14px", whiteSpace: "normal", wordBreak: "break-word" }}>
                            <Link href={`/studio/dobavljaci`} style={{ color: "inherit", fontWeight: 500 }}>
                              {r.naziv}
                            </Link>
                            {r.otpisano && (
                              <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>Otpisano</span>
                            )}
                            {r.otpisano && r.otpis_razlog && (
                              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{r.otpis_razlog}</div>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                            {fmtKM(r.iznos_km)}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            {!r.otpisano && fromPocetno && (
                              <OtpisPocetnoStanjeButton tip="dobavljac" refId={r.dobavljac_id} />
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", color: "var(--muted)", fontSize: 13, whiteSpace: "normal", wordBreak: "break-word" }}>
                            {r.napomena ?? "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                    <td style={{ padding: "12px 14px" }}>Ukupno (aktivna)</td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {fmtKM(sumDobavljaci)}
                    </td>
                    <td style={{ padding: "12px 14px" }} />
                    <td style={{ padding: "12px 14px" }} />
                  </tr>
                </tfoot>
              </table>
          </div>
          <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--muted)" }}>
            Prikazano: {data.dobavljaci.length} stavki
          </div>
        </section>

        {/* Talenti */}
        <section
          className="card"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--panel)",
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 15 }}>
            Talenti — naša dugovanja prema talentima
          </div>
          <div style={{ padding: "6px 16px", fontSize: 12, color: "var(--muted)" }}>
            Iznos = koliko dugujemo talentu.
          </div>
          <div className="pocetna-stanja-table-wrap">
            <table className="table pocetna-stanja-table" style={{ width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "44%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Ime i prezime</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>Iznos (KM)</th>
                    <th style={{ textAlign: "center", padding: "10px 14px" }}>Akcija</th>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Napomena</th>
                  </tr>
                </thead>
                <tbody>
                  {data.talenti.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 20, color: "var(--muted)" }}>
                        Nema unosa ili tabela nije dostupna.
                      </td>
                    </tr>
                  ) : (
                    data.talenti.map((r) => {
                      const fromPocetno = r.napomena !== "Tekuće dugovanje (projekt_dugovanja)";
                      return (
                        <tr key={r.talent_id} style={r.otpisano ? { opacity: 0.75 } : undefined}>
                          <td style={{ padding: "10px 14px", whiteSpace: "normal", wordBreak: "break-word" }}>
                            <Link href={`/studio/talenti`} style={{ color: "inherit", fontWeight: 500 }}>
                              {r.naziv}
                            </Link>
                            {r.otpisano && (
                              <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>Otpisano</span>
                            )}
                            {r.otpisano && r.otpis_razlog && (
                              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{r.otpis_razlog}</div>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                            {fmtKM(r.iznos_km)}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            {!r.otpisano && fromPocetno && (
                              <OtpisPocetnoStanjeButton tip="talent" refId={r.talent_id} />
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", color: "var(--muted)", fontSize: 13, whiteSpace: "normal", wordBreak: "break-word" }}>
                            {r.napomena ?? "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                    <td style={{ padding: "12px 14px" }}>Ukupno (aktivna)</td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {fmtKM(sumTalenti)}
                    </td>
                    <td style={{ padding: "12px 14px" }} />
                    <td style={{ padding: "12px 14px" }} />
                  </tr>
                </tfoot>
              </table>
          </div>
          <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--muted)" }}>
            Prikazano: {data.talenti.length} stavki
          </div>
        </section>

        <PocetnaStanjaImport />
      </div>
    </div>
  );
}
