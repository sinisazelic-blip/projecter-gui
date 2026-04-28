import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { formatAmount } from "@/lib/format";
import { getPocetnaStanja } from "@/lib/pocetna-stanja";
import PocetnaStanjaImport from "./PocetnaStanjaImport";
import OtpisPocetnoStanjeButton from "./OtpisPocetnoStanjeButton";
import EvidentirajUplatuButton from "./EvidentirajUplatuButton";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";


/** Suma samo aktivnih (ne otpisanih) stavki */
function sumAktivno<T extends { iznos_km: number; remaining_km?: number; otpisano?: boolean }>(rows: T[]): number {
  return rows.reduce((s, r) => {
    if (r.otpisano) return s;
    const v = Number.isFinite(Number(r.remaining_km)) ? Number(r.remaining_km) : Number(r.iznos_km);
    return s + (Number(v) || 0);
  }, 0);
}

export default async function PocetnaStanjaPage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

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
                  <div className="brandTitle">{t("pocetnaStanja.title")}</div>
                  <div className="brandSub">
                    {t("pocetnaStanja.subtitle")}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                    {(t("pocetnaStanja.klijentiCount") || "").replace("{{count}}", String(data.klijenti.length))}
                    {" · "}
                    {(t("pocetnaStanja.dobavljaciCount") || "").replace("{{count}}", String(data.dobavljaci.length))}
                    {" · "}
                    {(t("pocetnaStanja.talentiCount") || "").replace("{{count}}", String(data.talenti.length))}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Link href="/finance" className="btn" title={t("finance.title")}>
                  {t("finance.title")}
                </Link>
                <Link href="/dashboard" className="btn" title={t("common.dashboard")}>
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("common.dashboard")}
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
            {t("pocetnaStanja.klijentiPotrazivanja")}
          </div>
          <div style={{ padding: "6px 16px", fontSize: 12, color: "var(--muted)" }}>
            {t("pocetnaStanja.pozitivanIznos")}
          </div>
          <div className="pocetna-stanja-table-wrap">
            <table className="table pocetna-stanja-table" style={{ width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "24%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>{t("pocetnaStanja.colNaziv")}</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>{t("pocetnaStanja.colIznosKm")}</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>{t("pocetnaStanja.colPlaceno")}</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>{t("pocetnaStanja.colPreostalo")}</th>
                    <th style={{ textAlign: "center", padding: "10px 14px" }}>{t("pocetnaStanja.colAkcija")}</th>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>{t("pocetnaStanja.colNapomena")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.klijenti.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 20, color: "var(--muted)" }}>
                        {t("pocetnaStanja.noResults")}
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
                            <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>{t("pocetnaStanja.otpisano")}</span>
                          )}
                          {r.otpisano && r.otpis_razlog && (
                            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{r.otpis_razlog}</div>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                          {formatAmount(r.iznos_km, locale)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                          {formatAmount(Number(r.paid_km || 0), locale)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>
                          {formatAmount(Number(r.remaining_km ?? r.iznos_km), locale)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                            {!r.otpisano && (
                              <OtpisPocetnoStanjeButton tip="klijent" refId={r.klijent_id} />
                            )}
                            {!r.otpisano && Number(r.remaining_km ?? r.iznos_km) > 0.001 && (
                              <EvidentirajUplatuButton
                                tip="klijent"
                                refId={r.klijent_id}
                                defaultAmountKm={Number(r.remaining_km ?? r.iznos_km)}
                              >
                                Uplata
                              </EvidentirajUplatuButton>
                            )}
                          </div>
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
                    <td style={{ padding: "12px 14px" }}>{t("pocetnaStanja.ukupnoAktivna")}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {formatAmount(sumKlijenti, locale)}
                    </td>
                    <td style={{ padding: "12px 14px" }} />
                    <td style={{ padding: "12px 14px" }} />
                    <td style={{ padding: "12px 14px" }} />
                    <td style={{ padding: "12px 14px" }} />
                  </tr>
                </tfoot>
              </table>
          </div>
          <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--muted)" }}>
            {(t("pocetnaStanja.prikazanoStavki") || "").replace("{{count}}", String(data.klijenti.length))}
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
            {t("pocetnaStanja.dobavljaciDugovanja")}
          </div>
          <div style={{ padding: "6px 16px", fontSize: 12, color: "var(--muted)" }}>
            {t("pocetnaStanja.dobavljaciIznos")}
          </div>
          <div className="pocetna-stanja-table-wrap">
            <table className="table pocetna-stanja-table" style={{ width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "24%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>{t("pocetnaStanja.colNaziv")}</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>{t("pocetnaStanja.colIznosKm")}</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>{t("pocetnaStanja.colPlaceno")}</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>{t("pocetnaStanja.colPreostalo")}</th>
                    <th style={{ textAlign: "center", padding: "10px 14px" }}>{t("pocetnaStanja.colAkcija")}</th>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>{t("pocetnaStanja.colNapomena")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dobavljaci.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 20, color: "var(--muted)" }}>
                        {t("pocetnaStanja.noResultsDobavljaci")}
                      </td>
                    </tr>
                  ) : (
                    data.dobavljaci.map((r) => {
                      const fromPocetno = r.napomena !== "Tekuće dugovanje (projekt_dugovanja)";
                      const rem = Number(r.remaining_km ?? r.iznos_km);
                      return (
                        <tr key={r.dobavljac_id} style={r.otpisano ? { opacity: 0.75 } : undefined}>
                          <td style={{ padding: "10px 14px", whiteSpace: "normal", wordBreak: "break-word" }}>
                            <Link href={`/studio/dobavljaci`} style={{ color: "inherit", fontWeight: 500 }}>
                              {r.naziv}
                            </Link>
                            {r.otpisano && (
                              <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>{t("pocetnaStanja.otpisano")}</span>
                            )}
                            {r.otpisano && r.otpis_razlog && (
                              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{r.otpis_razlog}</div>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                            {formatAmount(r.iznos_km, locale)}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                            {formatAmount(Number(r.paid_km || 0), locale)}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>
                            {formatAmount(rem, locale)}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                              {!r.otpisano && fromPocetno && (
                                <OtpisPocetnoStanjeButton tip="dobavljac" refId={r.dobavljac_id} />
                              )}
                              {!r.otpisano && fromPocetno && rem > 0.001 && (
                                <EvidentirajUplatuButton
                                  tip="dobavljac"
                                  refId={r.dobavljac_id}
                                  defaultAmountKm={rem}
                                >
                                  Isplata
                                </EvidentirajUplatuButton>
                              )}
                            </div>
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
                    <td style={{ padding: "12px 14px" }}>{t("pocetnaStanja.ukupnoAktivna")}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {formatAmount(sumDobavljaci, locale)}
                    </td>
                    <td style={{ padding: "12px 14px" }} />
                    <td style={{ padding: "12px 14px" }} />
                    <td style={{ padding: "12px 14px" }} />
                    <td style={{ padding: "12px 14px" }} />
                  </tr>
                </tfoot>
              </table>
          </div>
          <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--muted)" }}>
            {(t("pocetnaStanja.prikazanoStavki") || "").replace("{{count}}", String(data.dobavljaci.length))}
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
            {t("pocetnaStanja.talentiDugovanja")}
          </div>
          <div style={{ padding: "6px 16px", fontSize: 12, color: "var(--muted)" }}>
            {t("pocetnaStanja.talentiIznos")}
          </div>
          <div className="pocetna-stanja-table-wrap">
            <table className="table pocetna-stanja-table" style={{ width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "24%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>{t("pocetnaStanja.colImePrezime")}</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>{t("pocetnaStanja.colIznosKm")}</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>{t("pocetnaStanja.colPlaceno")}</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>{t("pocetnaStanja.colPreostalo")}</th>
                    <th style={{ textAlign: "center", padding: "10px 14px" }}>{t("pocetnaStanja.colAkcija")}</th>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>{t("pocetnaStanja.colNapomena")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.talenti.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 20, color: "var(--muted)" }}>
                        {t("pocetnaStanja.noResults")}
                      </td>
                    </tr>
                  ) : (
                    data.talenti.map((r) => {
                      const fromPocetno = r.napomena !== "Tekuće dugovanje (projekt_dugovanja)";
                      const rem = Number(r.remaining_km ?? r.iznos_km);
                      return (
                        <tr key={r.talent_id} style={r.otpisano ? { opacity: 0.75 } : undefined}>
                          <td style={{ padding: "10px 14px", whiteSpace: "normal", wordBreak: "break-word" }}>
                            <Link href={`/studio/talenti`} style={{ color: "inherit", fontWeight: 500 }}>
                              {r.naziv}
                            </Link>
                            {r.otpisano && (
                              <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>{t("pocetnaStanja.otpisano")}</span>
                            )}
                            {r.otpisano && r.otpis_razlog && (
                              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{r.otpis_razlog}</div>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                            {formatAmount(r.iznos_km, locale)}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                            {formatAmount(Number(r.paid_km || 0), locale)}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>
                            {formatAmount(rem, locale)}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                              {!r.otpisano && fromPocetno && (
                                <OtpisPocetnoStanjeButton tip="talent" refId={r.talent_id} />
                              )}
                              {!r.otpisano && fromPocetno && rem > 0.001 && (
                                <EvidentirajUplatuButton
                                  tip="talent"
                                  refId={r.talent_id}
                                  defaultAmountKm={rem}
                                >
                                  Isplata
                                </EvidentirajUplatuButton>
                              )}
                            </div>
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
                    <td style={{ padding: "12px 14px" }}>{t("pocetnaStanja.ukupnoAktivna")}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {formatAmount(sumTalenti, locale)}
                    </td>
                    <td style={{ padding: "12px 14px" }} />
                    <td style={{ padding: "12px 14px" }} />
                    <td style={{ padding: "12px 14px" }} />
                    <td style={{ padding: "12px 14px" }} />
                  </tr>
                </tfoot>
              </table>
          </div>
          <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--muted)" }}>
            {(t("pocetnaStanja.prikazanoStavki") || "").replace("{{count}}", String(data.talenti.length))}
          </div>
        </section>

        <PocetnaStanjaImport />
      </div>
    </div>
  );
}
