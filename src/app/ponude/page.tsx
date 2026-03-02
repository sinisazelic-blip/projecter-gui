// Lista Ponuda – ista struktura i filteri kao Fakture, klik otvara preview ponude
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { downloadExcel } from "@/lib/exportExcel";
import { useTranslation } from "@/components/LocaleProvider";

function fmtDDMMYYYY(iso: string | null): string {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "—";
  return `${d}.${m}.${y}`;
}

function fmtMoney(n: number, ccy: string): string {
  const v = Number.isFinite(n) ? n : 0;
  const label = ccy === "BAM" || ccy === "KM" ? "KM" : ccy;
  return `${v.toFixed(2)} ${label}`;
}

type Ponuda = {
  ponuda_id: number;
  inicijacija_id: number;
  broj_ponude: string;
  datum_izdavanja: string;
  datum_vazenja: string;
  klijent_id: number;
  narucilac_naziv: string | null;
  valuta: string;
  ukupno: number;
};

type Klijent = {
  klijent_id: number;
  naziv_klijenta: string;
};

export default function PonudePage() {
  const sp = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();

  const [ponude, setPonude] = useState<Ponuda[]>([]);
  const [klijenti, setKlijenti] = useState<Klijent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const brojPonudeFilter = sp.get("broj_ponude") ?? "";
  const klijentIdFilter = sp.get("klijent_id") ?? "";

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (brojPonudeFilter) qs.set("broj_ponude", brojPonudeFilter);
        if (klijentIdFilter) qs.set("klijent_id", klijentIdFilter);
        qs.set("_", String(Date.now()));
        const res = await fetch(`/api/ponude/list?${qs.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || t("ponude.loadError"));
        }
        setPonude(data.ponude ?? []);
        setKlijenti(data.klijenti ?? []);
      } catch (err: any) {
        setError(err?.message ?? t("common.error"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [brojPonudeFilter, klijentIdFilter]);

  function handleFilter() {
    const qs = new URLSearchParams();
    const brojInput = (document.getElementById("broj_ponude") as HTMLInputElement)?.value.trim();
    const klijentSelect = (document.getElementById("klijent_id") as HTMLSelectElement)?.value;
    if (brojInput) qs.set("broj_ponude", brojInput);
    if (klijentSelect) qs.set("klijent_id", klijentSelect);
    router.push(`/ponude?${qs.toString()}`);
  }

  function handleReset() {
    router.push("/ponude");
  }

  return (
    <div className="container">
      <style>{`
        .tableCard { overflow-x: auto; }
        .table { table-layout: auto; min-width: 900px; }
        .table th, .table td { white-space: nowrap; }
        .table td:nth-child(5) { white-space: normal; min-width: 150px; }
      `}</style>
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow" style={{ justifyContent: "space-between" }}>
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">📋 {t("ponude.title")}</div>
                  <div className="brandSub">{t("ponude.subtitle")}</div>
                </div>
              </div>
              <Link href="/dashboard" className="btn" style={{ minWidth: 130 }} title={t("ponude.backToDashboard")}>
                🏠 {t("common.dashboard")}
              </Link>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "nowrap", overflowX: "auto" }}>
              <label className="label" style={{ whiteSpace: "nowrap" }}>{t("ponude.brojPonude")}:</label>
              <input
                id="broj_ponude"
                type="text"
                defaultValue={brojPonudeFilter}
                placeholder="P001/2026..."
                className="input small"
                style={{ width: 150 }}
              />
              <label className="label" style={{ whiteSpace: "nowrap" }}>{t("ponude.klijent")}:</label>
              <select id="klijent_id" defaultValue={klijentIdFilter} className="input" style={{ minWidth: 200 }}>
                <option value="">{t("ponude.svi")}</option>
                {klijenti.map((k) => (
                  <option key={k.klijent_id} value={String(k.klijent_id)}>{k.naziv_klijenta}</option>
                ))}
              </select>
              <button type="button" className="btn" onClick={handleFilter}>🔎 {t("ponude.filtriraj")}</button>
              <button type="button" className="btn" onClick={handleReset}>🔄 {t("ponude.reset")}</button>
              {ponude.length > 0 && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const headers = ["Broj ponude", "Datum izdavanja", "Važi do", "Naručioc", "Ukupno", "Valuta"];
                    const rows = ponude.map((p) => [
                      p.broj_ponude ?? "",
                      fmtDDMMYYYY(p.datum_izdavanja),
                      fmtDDMMYYYY(p.datum_vazenja),
                      p.narucilac_naziv ?? "",
                      p.ukupno ?? "",
                      (p.valuta === "BAM" || p.valuta === "KM") ? "KM" : (p.valuta ?? ""),
                    ]);
                    downloadExcel({ filename: "ponude_lista", sheetName: "Ponude", headers, rows });
                  }}
                  title={t("ponude.exportExcel")}
                >
                  {t("ponude.exportExcel")}
                </button>
              )}
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="listWrap">
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", opacity: 0.7 }}>{t("common.loading")}</div>
          ) : error ? (
            <div style={{ padding: 20, background: "rgba(255, 59, 48, 0.1)", borderRadius: 8, color: "#ff3b30" }}>
              ⚠️ {error}
            </div>
          ) : (
            <div className="tableCard">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: "120px" }}>Broj ponude</th>
                    <th style={{ width: "120px" }}>Datum izdavanja</th>
                    <th style={{ width: "120px" }}>Važi do</th>
                    <th style={{ minWidth: "150px" }}>Naručioc</th>
                    <th className="num" style={{ width: "120px" }}>Ukupno</th>
                    <th style={{ width: "80px" }}>Valuta</th>
                  </tr>
                </thead>
                <tbody>
                  {ponude.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ opacity: 0.7, padding: 20 }}>
                        {t("ponude.noPonude")}
                      </td>
                    </tr>
                  ) : (
                    ponude.map((p) => (
                      <tr
                        key={p.ponuda_id}
                        onClick={() => router.push(`/ponuda/${p.ponuda_id}/preview`)}
                        style={{ cursor: "pointer" }}
                        className="clickable-row"
                      >
                        <td style={{ fontWeight: 600, width: "120px" }}>{p.broj_ponude}</td>
                        <td style={{ width: "120px" }}>{fmtDDMMYYYY(p.datum_izdavanja)}</td>
                        <td style={{ width: "120px" }}>{fmtDDMMYYYY(p.datum_vazenja)}</td>
                        <td style={{ minWidth: "150px" }}>{p.narucilac_naziv ?? "—"}</td>
                        <td className="num" style={{ width: "120px" }}>{fmtMoney(p.ukupno, p.valuta)}</td>
                        <td style={{ width: "80px" }}>{(p.valuta === "BAM" || p.valuta === "KM") ? "KM" : p.valuta}</td>
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
