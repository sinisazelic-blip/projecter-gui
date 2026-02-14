// src/app/fakture/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { downloadExcel } from "@/lib/exportExcel";

function fmtDDMMYYYY(iso: string | null): string {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "—";
  return `${d}.${m}.${y}`;
}

function fmtMoney(n: number, ccy: string): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toFixed(2)} ${ccy}`;
}

type Faktura = {
  faktura_id: number;
  broj_fakture: string;
  broj_fiskalni: number | null;
  datum_izdavanja: string;
  datum_dospijeca: string | null;
  narucilac_id: number;
  narucilac_naziv: string | null;
  iznos_bez_pdv: number;
  pdv_iznos: number | null;
  iznos_sa_pdv: number;
  valuta: string;
  poziv_na_broj: string | null;
  status: string;
};

type Narucioc = {
  klijent_id: number;
  naziv_klijenta: string;
};

export default function FakturePage() {
  const sp = useSearchParams();
  const router = useRouter();

  const [fakture, setFakture] = useState<Faktura[]>([]);
  const [narucioci, setNarucioci] = useState<Narucioc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const brojFaktureFilter = sp.get("broj_fakture") || "";
  const narucilacIdFilter = sp.get("narucilac_id") || "";

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams();
        if (brojFaktureFilter) qs.set("broj_fakture", brojFaktureFilter);
        if (narucilacIdFilter)
          qs.set("narucilac_id", narucilacIdFilter);

        qs.set("_", String(Date.now())); // cache bust — svaki load dobija novi URL
        const res = await fetch(`/api/fakture/list?${qs.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Greška pri učitavanju");
        }

        setFakture(data.fakture || []);
        setNarucioci(data.narucioci || []);
      } catch (err: any) {
        setError(err?.message || "Greška");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [brojFaktureFilter, narucilacIdFilter]);

  function handleFilter() {
    const qs = new URLSearchParams();
    const brojInput = (
      document.getElementById("broj_fakture") as HTMLInputElement
    )?.value.trim();
    const narucilacSelect = (
      document.getElementById("narucilac_id") as HTMLSelectElement
    )?.value;

    if (brojInput) qs.set("broj_fakture", brojInput);
    if (narucilacSelect) qs.set("narucilac_id", narucilacSelect);

    router.push(`/fakture?${qs.toString()}`);
  }

  function handleReset() {
    router.push("/fakture");
  }

  return (
    <div className="container">
      <style>{`
        .tableCard {
          overflow-x: auto;
        }
        .table {
          table-layout: auto;
          min-width: 1000px;
        }
        .table th,
        .table td {
          white-space: nowrap;
        }
        .table td:nth-child(5) {
          white-space: normal;
          min-width: 150px;
        }
      `}</style>
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow" style={{ justifyContent: "space-between" }}>
              <div className="brandWrap">
                <img
                  src="/fluxa/logo-light.png"
                  alt="FLUXA"
                  className="brandLogo"
                />
                <div>
                  <div className="brandTitle">📄 Fakture</div>
                  <div className="brandSub">Lista izdatih faktura</div>
                </div>
              </div>

              <Link
                href="/dashboard"
                className="btn"
                style={{ minWidth: 130 }}
                title="Povratak na Dashboard"
              >
                🏠 Dashboard
              </Link>
            </div>

            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <label style={{ fontSize: 13 }}>Broj fakture:</label>
                <input
                  id="broj_fakture"
                  type="text"
                  defaultValue={brojFaktureFilter}
                  placeholder="001/2026..."
                  className="input"
                  style={{ width: 150, fontSize: 13 }}
                />

                <label style={{ fontSize: 13 }}>Naručioc:</label>
                <select
                  id="narucilac_id"
                  defaultValue={narucilacIdFilter}
                  className="input"
                  style={{ minWidth: 200, fontSize: 13 }}
                >
                  <option value="">Svi</option>
                  {narucioci.map((n) => (
                    <option key={n.klijent_id} value={String(n.klijent_id)}>
                      {n.naziv_klijenta}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn"
                  onClick={handleFilter}
                  style={{ fontSize: 13 }}
                >
                  🔎 Filtriraj
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={handleReset}
                  style={{ fontSize: 13 }}
                >
                  🔄 Reset
                </button>

                {fakture.length > 0 && (
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 13, marginLeft: 8 }}
                    onClick={() => {
                      const headers = ["Broj fakture", "PFR", "Datum izdavanja", "Datum dospijeća", "Naručioc", "Iznos", "Valuta", "PDV", "Status"];
                      const rows = fakture.map((f) => [
                        f.broj_fakture ?? "",
                        f.broj_fiskalni ?? "",
                        fmtDDMMYYYY(f.datum_izdavanja),
                        fmtDDMMYYYY(f.datum_dospijeca),
                        f.narucilac_naziv ?? "",
                        f.iznos_sa_pdv ?? "",
                        f.valuta ?? "",
                        f.pdv_iznos ?? "",
                        f.status ?? "",
                      ]);
                      downloadExcel({
                        filename: "fakture_lista",
                        sheetName: "Fakture",
                        headers,
                        rows,
                      });
                    }}
                    title="Preuzmi listu u Excel"
                  >
                    Export u Excel
                  </button>
                )}
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="listWrap">
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", opacity: 0.7 }}>
              Učitavanje...
            </div>
          ) : error ? (
            <div
              style={{
                padding: 20,
                background: "rgba(255, 59, 48, 0.1)",
                borderRadius: 8,
                color: "#ff3b30",
              }}
            >
              ⚠️ {error}
            </div>
          ) : (
            <div className="tableCard">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: "120px" }}>Broj fakture</th>
                    <th style={{ width: "80px" }}>PFR</th>
                    <th style={{ width: "120px" }}>Datum izdavanja</th>
                    <th style={{ width: "120px" }}>Datum dospijeća</th>
                    <th style={{ minWidth: "150px" }}>Naručioc</th>
                    <th className="num" style={{ width: "120px" }}>Iznos</th>
                    <th style={{ width: "80px" }}>Valuta</th>
                    <th className="num" style={{ width: "100px" }}>PDV</th>
                    <th style={{ width: "100px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fakture.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ opacity: 0.7, padding: 20 }}>
                        Nema faktura za zadate filtere.
                      </td>
                    </tr>
                  ) : (
                    fakture.map((f) => (
                      <tr
                        key={f.faktura_id}
                        onClick={async () => {
                          // Učitaj detalje fakture i otvori preview
                          try {
                            const res = await fetch(`/api/fakture/${f.faktura_id}`, {
                              cache: "no-store",
                            });
                            const data = await res.json();
                            if (data.ok && data.faktura?.projekti_ids?.length > 0) {
                              const qs = new URLSearchParams();
                              qs.set("ids", data.faktura.projekti_ids.join(","));
                              qs.set("date", data.faktura.datum_izdavanja);
                              if (data.faktura.datum_dospijeca) {
                                qs.set("due", data.faktura.datum_dospijeca);
                              }
                              qs.set("ccy", data.faktura.valuta);
                              qs.set("vat", data.faktura.pdv_iznos && data.faktura.pdv_iznos > 0 ? "BH_17" : "INO_0");
                              if (data.faktura.broj_fiskalni) {
                                qs.set("pfr", String(data.faktura.broj_fiskalni));
                              }
                              // Dodaj broj fakture u URL da se prikaže u preview-u
                              if (data.faktura.broj_fakture) {
                                qs.set("invoice_number", data.faktura.broj_fakture);
                              }
                              // Otvori novu preview stranicu umesto wizard preview-a
                              window.location.href = `/fakture/${f.faktura_id}/preview`;
                            } else {
                              alert("Faktura nema povezanih projekata");
                            }
                          } catch (err) {
                            alert("Greška pri učitavanju fakture");
                          }
                        }}
                        style={{ cursor: "pointer" }}
                        className="clickable-row"
                      >
                        <td style={{ fontWeight: 600, width: "120px" }}>{f.broj_fakture}</td>
                        <td style={{ width: "80px" }}>{f.broj_fiskalni || "—"}</td>
                        <td style={{ width: "120px" }}>{fmtDDMMYYYY(f.datum_izdavanja)}</td>
                        <td style={{ width: "120px" }}>{fmtDDMMYYYY(f.datum_dospijeca)}</td>
                        <td style={{ minWidth: "150px" }}>{f.narucilac_naziv || "—"}</td>
                        <td className="num" style={{ width: "120px" }}>
                          {fmtMoney(f.iznos_sa_pdv, f.valuta)}
                        </td>
                        <td style={{ width: "80px" }}>{f.valuta}</td>
                        <td className="num" style={{ width: "100px" }}>
                          {f.pdv_iznos
                            ? fmtMoney(f.pdv_iznos, f.valuta)
                            : "—"}
                        </td>
                        <td style={{ width: "100px" }}>
                          <span
                            className="status-badge"
                            style={{
                              background:
                                f.status === "Fakturisan" || f.status === "KREIRANA"
                                  ? "rgba(80, 170, 255, 0.15)"
                                  : f.status === "PLACENA"
                                    ? "rgba(52, 199, 89, 0.15)"
                                    : "rgba(255, 193, 7, 0.15)",
                              borderColor:
                                f.status === "Fakturisan" || f.status === "KREIRANA"
                                  ? "rgba(80, 170, 255, 0.3)"
                                  : f.status === "PLACENA"
                                    ? "rgba(52, 199, 89, 0.3)"
                                    : "rgba(255, 193, 7, 0.3)",
                            }}
                          >
                            {f.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
