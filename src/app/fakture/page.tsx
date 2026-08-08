// src/app/fakture/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { downloadExcel } from "@/lib/exportExcel";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";

function fmtDDMMYYYY(iso: string | null): string {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "—";
  return `${d}.${m}.${y}`;
}

function fmtMoney(n: number, ccy: string): string {
  const v = Number.isFinite(n) ? n : 0;
  const label = (ccy === "BAM" || ccy === "KM") ? "KM" : ccy;
  return `${v.toFixed(2)} ${label}`;
}

function isStornoFaktura(
  status: string | null | undefined,
  iznosSaPdv?: number | null,
): boolean {
  const s = String(status ?? "")
    .trim()
    .toUpperCase();
  if (s === "STORNIRAN" || s === "STORNO") return true;
  return Number(iznosSaPdv) < 0;
}

function statusLabel(
  status: string | null,
  t: (k: string) => string,
  iznosSaPdv?: number | null,
): string {
  if (isStornoFaktura(status, iznosSaPdv)) return t("fakture.statusStorno");
  if (!status) return t("fakture.statusOther");
  const s = status.trim().toUpperCase();
  if (s === "PLACENA" || s === "PAID" || s === "PLACENO" || s === "DJELIMICNO")
    return t("fakture.statusPaid");
  if (s === "FAKTURISAN" || s === "KREIRANA" || s === "CREATED")
    return t("fakture.statusCreated");
  return t("fakture.statusOther");
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
  const { t } = useTranslation();

  const [fakture, setFakture] = useState<Faktura[]>([]);
  const [narucioci, setNarucioci] = useState<Narucioc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Owner-only brisanje posljednje fakture
  const [isOwner, setIsOwner] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Faktura | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const token = window.localStorage.getItem("FLUXA_OWNER_TOKEN");
      setIsOwner(Boolean(token && token.trim().length > 0));
    } catch {
      setIsOwner(false);
    }
  }, []);

  /** ID posljednje fakture (najveća godina pa najveći broj) — samo ona se smije obrisati. */
  const lastFakturaId = useMemo(() => {
    let best: { id: number; y: number; n: number } | null = null;
    for (const f of fakture) {
      const m = String(f.broj_fakture ?? "").match(/^(\d+)\s*\/\s*(\d{4})$/);
      if (!m) continue;
      const n = Number(m[1]);
      const y = Number(m[2]);
      if (!best || y > best.y || (y === best.y && n > best.n)) {
        best = { id: f.faktura_id, y, n };
      }
    }
    return best?.id ?? null;
  }, [fakture]);

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const token = window.localStorage.getItem("FLUXA_OWNER_TOKEN") ?? "";
      const res = await fetch(`/api/fakture/${deleteTarget.faktura_id}`, {
        method: "DELETE",
        headers: { "x-owner-token": token },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || t("common.error"));
      }
      setDeleteTarget(null);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      setDeleteError(e?.message || t("common.error"));
    } finally {
      setDeleting(false);
    }
  }

  const brojFaktureFilter = sp.get("broj_fakture") || "";
  const narucilacIdFilter = sp.get("narucilac_id") || "";
  const neplaceneOnly = sp.get("neplacene") === "1";

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams();
        if (brojFaktureFilter) qs.set("broj_fakture", brojFaktureFilter);
        if (narucilacIdFilter)
          qs.set("narucilac_id", narucilacIdFilter);
        if (neplaceneOnly) qs.set("neplacene", "1");

        qs.set("_", String(Date.now())); // cache bust — svaki load dobija novi URL
        const res = await fetch(`/api/fakture/list?${qs.toString()}`, {
          cache: "no-store",
        });
        const text = await res.text();
        let data: { ok?: boolean; error?: string; fakture?: Faktura[]; narucioci?: Narucioc[] };
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(res.ok ? t("common.error") : `API ${res.status}`);
        }

        if (!res.ok || !data.ok) {
          throw new Error(data.error || t("fakture.loadError"));
        }

        setFakture(data.fakture ?? []);
        setNarucioci(data.narucioci ?? []);
      } catch (err: any) {
        setError(err?.message || t("common.error"));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [brojFaktureFilter, narucilacIdFilter, neplaceneOnly, reloadKey]);

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
    const onlyUnpaid = (document.getElementById("neplacene_only") as HTMLInputElement)?.checked;
    if (onlyUnpaid) qs.set("neplacene", "1");

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
                <div className="brandLogoBlock">
                  <FluxaLogo />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">📄 {t("fakture.title")}</div>
                  <div className="brandSub">{t("fakture.subtitle")}</div>
                </div>
              </div>

              <Link
                href="/dashboard"
                className="btn"
                style={{ minWidth: 130 }}
                title={t("fakture.backToDashboard")}
              >
                <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("common.dashboard")}
              </Link>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "nowrap", overflowX: "auto" }}>
              <label className="label" style={{ whiteSpace: "nowrap" }}>{t("fakture.brojFakture")}:</label>
              <input
                id="broj_fakture"
                type="text"
                defaultValue={brojFaktureFilter}
                placeholder={t("fakture.placeholderBrojFakture")}
                className="input small"
                style={{ width: 150 }}
              />
              <label className="label" style={{ whiteSpace: "nowrap" }}>{t("fakture.narucilac")}:</label>
              <select
                id="narucilac_id"
                defaultValue={narucilacIdFilter}
                className="input"
                style={{ minWidth: 200 }}
              >
                <option value="">{t("fakture.svi")}</option>
                {narucioci.map((n) => (
                  <option key={n.klijent_id} value={String(n.klijent_id)}>
                    {n.naziv_klijenta}
                  </option>
                ))}
              </select>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                <input id="neplacene_only" type="checkbox" defaultChecked={neplaceneOnly} />
                {t("fakture.neplaceneOnly")}
              </label>
              <button type="button" className="btn" onClick={handleFilter}>
                🔎 {t("fakture.filtriraj")}
              </button>
              <button type="button" className="btn" onClick={handleReset}>
                🔄 {t("fakture.reset")}
              </button>
              {fakture.length > 0 && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
const headers = [
                        t("fakture.brojFakture"),
                        t("fakture.colPfr"),
                        t("fakture.colDatumIzdavanja"),
                        t("fakture.colDatumDospijeca"),
                        t("fakture.narucilac"),
                        t("fakture.colIznos"),
                        t("fakture.colValuta"),
                        t("fakture.colPdv"),
                        t("fakture.colStatus"),
                      ];
                      const rows = fakture.map((f) => [
                        f.broj_fakture ?? "",
                        f.broj_fiskalni ?? "",
                        fmtDDMMYYYY(f.datum_izdavanja),
                        fmtDDMMYYYY(f.datum_dospijeca),
                        f.narucilac_naziv ?? "",
                        f.iznos_sa_pdv ?? "",
                        (f.valuta === "BAM" || f.valuta === "KM") ? "KM" : (f.valuta ?? ""),
                      f.pdv_iznos ?? "",
                      statusLabel(f.status, t, f.iznos_sa_pdv),
                    ]);
                    downloadExcel({
                      filename: "fakture_lista",
                      sheetName: t("fakture.excelSheetName"),
                      headers,
                      rows,
                    });
                  }}
                  title={t("fakture.exportExcel")}
                >
                  {t("fakture.exportExcel")}
                </button>
              )}
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="listWrap">
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", opacity: 0.7 }}>
              {t("common.loading")}
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
                    <th style={{ width: "120px" }}>{t("fakture.brojFakture")}</th>
                    <th style={{ width: "80px" }}>{t("fakture.colPfr")}</th>
                    <th style={{ width: "120px" }}>{t("fakture.colDatumIzdavanja")}</th>
                    <th style={{ width: "120px" }}>{t("fakture.colDatumDospijeca")}</th>
                    <th style={{ minWidth: "150px" }}>{t("fakture.narucilac")}</th>
                    <th className="num" style={{ width: "120px" }}>{t("fakture.colIznos")}</th>
                    <th style={{ width: "80px" }}>{t("fakture.colValuta")}</th>
                    <th className="num" style={{ width: "100px" }}>{t("fakture.colPdv")}</th>
                    <th style={{ width: "100px" }}>{t("fakture.colStatus")}</th>
                    {isOwner && <th style={{ width: "60px" }} />}
                  </tr>
                </thead>
                <tbody>
                  {fakture.length === 0 ? (
                    <tr>
                      <td colSpan={isOwner ? 10 : 9} style={{ opacity: 0.7, padding: 20 }}>
                        {t("fakture.noFakture")}
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
                            const raw = await res.text();
                            let data: { ok?: boolean; faktura?: { projekti_ids?: number[]; datum_izdavanja?: string; datum_dospijeca?: string; valuta?: string; pdv_iznos?: number; broj_fiskalni?: string; broj_fakture?: string } };
                            try {
                              data = raw ? JSON.parse(raw) : {};
                            } catch {
                              return;
                            }
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
                              alert(t("fakture.noProjectsAlert"));
                            }
                          } catch (err) {
                            alert(t("fakture.loadInvoiceError"));
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
                        <td style={{ width: "80px" }}>{(f.valuta === "BAM" || f.valuta === "KM") ? "KM" : f.valuta}</td>
                        <td className="num" style={{ width: "100px" }}>
                          {f.pdv_iznos
                            ? fmtMoney(f.pdv_iznos, f.valuta)
                            : "—"}
                        </td>
                        <td style={{ width: "100px" }}>
                          <span
                            className="status-badge"
                            style={{
                              background: isStornoFaktura(f.status, f.iznos_sa_pdv)
                                ? "rgba(239, 68, 68, 0.15)"
                                : f.status === "Fakturisan" || f.status === "KREIRANA"
                                  ? "rgba(80, 170, 255, 0.15)"
                                  : ["PLACENA", "DJELIMICNO", "PAID", "PLACENO"].includes(
                                        String(f.status ?? "").trim().toUpperCase(),
                                      )
                                    ? "rgba(52, 199, 89, 0.15)"
                                    : "rgba(255, 193, 7, 0.15)",
                              borderColor: isStornoFaktura(f.status, f.iznos_sa_pdv)
                                ? "rgba(239, 68, 68, 0.35)"
                                : f.status === "Fakturisan" || f.status === "KREIRANA"
                                  ? "rgba(80, 170, 255, 0.3)"
                                  : ["PLACENA", "DJELIMICNO", "PAID", "PLACENO"].includes(
                                        String(f.status ?? "").trim().toUpperCase(),
                                      )
                                    ? "rgba(52, 199, 89, 0.3)"
                                    : "rgba(255, 193, 7, 0.3)",
                            }}
                          >
                            {statusLabel(f.status, t, f.iznos_sa_pdv)}
                          </span>
                        </td>
                        {isOwner && (
                          <td style={{ width: "60px", textAlign: "center" }}>
                            {f.faktura_id === lastFakturaId && (
                              <button
                                type="button"
                                className="btn"
                                title={t("fakture.deleteLastTitle")}
                                style={{
                                  padding: "4px 10px",
                                  fontSize: 13,
                                  borderColor: "rgba(239, 68, 68, 0.4)",
                                  background: "rgba(239, 68, 68, 0.08)",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteError(null);
                                  setDeleteTarget(f);
                                }}
                              >
                                🗑
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="card"
            style={{
              padding: 22,
              maxWidth: 460,
              width: "100%",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              boxShadow: "var(--shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: 18 }}>
              {t("fakture.deleteModalTitle")}
            </h3>
            <p style={{ margin: "0 0 6px", fontSize: 14 }}>
              <strong>{deleteTarget.broj_fakture}</strong>
              {deleteTarget.broj_fiskalni ? ` · PFR ${deleteTarget.broj_fiskalni}` : ""}
              {deleteTarget.narucilac_naziv ? ` · ${deleteTarget.narucilac_naziv}` : ""}
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)" }}>
              {t("fakture.deleteModalBody")}
            </p>
            {deleteError && (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#f87171" }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn"
                disabled={deleting}
                style={{
                  borderColor: "rgba(239, 68, 68, 0.5)",
                  background: "rgba(239, 68, 68, 0.15)",
                  fontWeight: 700,
                }}
                onClick={handleDeleteConfirmed}
              >
                {deleting ? t("fakture.deleteWorking") : t("fakture.deleteConfirm")}
              </button>
              <button
                type="button"
                className="btn"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                {t("fakture.deleteCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
