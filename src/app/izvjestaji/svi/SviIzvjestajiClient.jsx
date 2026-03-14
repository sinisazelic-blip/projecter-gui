"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import { downloadExcel, reportFilename } from "@/lib/exportExcel";
import { ColumnPicker } from "@/components/ColumnPicker";
import { formatReportNum, getCurrencySuffix } from "@/lib/format";

const TIP_OPCIJE_KEYS = [
  { value: "potrazivanja", labelKey: "izvjestajiSvi.report_potrazivanja_label", descKey: "izvjestajiSvi.report_potrazivanja_desc" },
  { value: "lista_faktura", labelKey: "izvjestajiSvi.report_lista_faktura_label", descKey: "izvjestajiSvi.report_lista_faktura_desc" },
  { value: "knjiga_prihoda", labelKey: "izvjestajiSvi.report_knjiga_prihoda_label", descKey: "izvjestajiSvi.report_knjiga_prihoda_desc" },
  { value: "pdv", labelKey: "izvjestajiSvi.report_pdv_label", descKey: "izvjestajiSvi.report_pdv_desc" },
  { value: "talenti", labelKey: "izvjestajiSvi.report_talenti_label", descKey: "izvjestajiSvi.report_talenti_desc" },
  { value: "dobavljaci", labelKey: "izvjestajiSvi.report_dobavljaci_label", descKey: "izvjestajiSvi.report_dobavljaci_desc" },
  { value: "klijenti", labelKey: "izvjestajiSvi.report_klijenti_label", descKey: "izvjestajiSvi.report_klijenti_desc" },
  { value: "banka", labelKey: "izvjestajiSvi.report_banka_label", descKey: "izvjestajiSvi.report_banka_desc" },
  { value: "fakture", labelKey: "izvjestajiSvi.report_fakture_label", descKey: "izvjestajiSvi.report_fakture_desc" },
  { value: "fiksni", labelKey: "izvjestajiSvi.report_fiksni_label", descKey: "izvjestajiSvi.report_fiksni_desc" },
  { value: "projekti", labelKey: "izvjestajiSvi.report_projekti_label", descKey: "izvjestajiSvi.report_projekti_desc" },
];

const API_MAP = {
  potrazivanja: "/api/izvjestaji/potrazivanja",
  lista_faktura: "/api/izvjestaji/fakture-period",
  knjiga_prihoda: "/api/izvjestaji/knjiga-prihoda",
  pdv: "/api/izvjestaji/pdv",
  projekti: "/api/izvjestaji/projekti",
  talenti: "/api/izvjestaji/talenti",
  dobavljaci: "/api/izvjestaji/dobavljaci",
  klijenti: "/api/izvjestaji/klijenti",
  banka: "/api/izvjestaji/banka",
  fakture: "/api/izvjestaji/fakture-naplate",
  fiksni: "/api/izvjestaji/fiksni-troskovi",
};

export default function SviIzvjestajiClient() {
  const { t, locale } = useTranslation();
  const ccy = getCurrencySuffix(locale).trim();
  const fmt = (x) => formatReportNum(x, locale);

  const TIP_OPCIJE = useMemo(
    () => TIP_OPCIJE_KEYS.map((o) => ({ ...o, label: t(o.labelKey), desc: t(o.descKey) })),
    [t],
  );
  const [tip, setTip] = useState("");
  const [datumOd, setDatumOd] = useState("");
  const [datumDo, setDatumDo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState({});

  const apiUrl = API_MAP[tip];
  const hasApi = Boolean(apiUrl);

  const handleGenerisi = async (e) => {
    e.preventDefault();
    setError("");
    setData(null);
    if (!hasApi) {
      setData({ placeholder: true, tip, datumOd, datumDo });
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (datumOd) params.set("date_from", datumOd);
      if (datumDo) params.set("date_to", datumDo);
      const res = await fetch(`${apiUrl}?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || t("common.errorLoad"));
      setData(json);
    } catch (err) {
      setError(err?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!data?.ok || !data.items) return;
    const fn = reportFilename(
      tip === "potrazivanja" ? "potrazivanja" 
        : tip === "lista_faktura" ? "lista-faktura" 
        : tip === "knjiga_prihoda" ? "knjiga-prihoda" 
        : tip === "pdv" ? "pdv" 
        : tip === "projekti" ? "projekti"
        : tip === "talenti" ? "talenti"
        : tip === "dobavljaci" ? "dobavljaci"
        : tip === "klijenti" ? "klijenti"
        : tip === "banka" ? "banka"
        : tip === "fakture" ? "fakture-naplate"
        : tip === "fiksni" ? "fiksni-troskovi"
        : "izvjestaj",
      datumOd,
      datumDo,
    );
    if (tip === "potrazivanja") {
      const headers = [t("izvjestajiSvi.col_broj_fakture"), t("izvjestajiSvi.col_datum_izd"), t("izvjestajiSvi.col_datum_dosp"), t("izvjestajiSvi.col_narucilac"), `${t("izvjestajiSvi.col_iznos")} (${ccy})`, t("izvjestajiSvi.col_dana_kasnjenja"), t("izvjestajiSvi.col_bucket")];
      const rows = (data.items || []).map((r) => [
        r.broj_fakture ?? "",
        r.datum_izdavanja ?? "",
        r.datum_dospijeca ?? "",
        r.narucilac_naziv ?? "",
        r.iznos_sa_pdv ?? "",
        r.dana_kasnjenja ?? "",
        r.aging_bucket ?? "",
      ]);
      const footer = [];
      if (data.summary?.po_bucketu) {
        footer.push([]);
        footer.push(["", "", "", "Ukupno", data.summary.ukupno ?? "", "", ""]);
        ["0-30", "31-60", "61-90", "90+"].forEach((b) => {
          footer.push(["", "", "", `Bucket ${b} dana`, data.summary.po_bucketu[b] ?? "", "", ""]);
        });
      }
      downloadExcel({ filename: fn, sheetName: "Potraživanja", headers, rows, footerRows: footer });
    } else if (tip === "lista_faktura") {
      const headers = ["Broj", "Datum", "Naručilac", "Osnovica", "PDV", "Ukupno", "Izvor"];
      const rows = (data.items || []).map((r) => [
        r.broj_fakture ?? "",
        r.datum_izdavanja ?? "",
        r.narucilac_naziv ?? "",
        r.iznos_bez_pdv ?? "",
        r.pdv_iznos ?? "",
        r.iznos_sa_pdv ?? "",
        r.iz_arhive ? "Arhiva" : "Live",
      ]);
      const footer = [];
      if (data.summary) {
        footer.push([]);
        footer.push(["", "", "UKUPNO", data.summary.ukupno_bez_pdv ?? "", data.summary.ukupno_pdv ?? "", data.summary.ukupno_sa_pdv ?? "", ""]);
      }
      downloadExcel({ filename: fn, sheetName: "Lista faktura", headers, rows, footerRows: footer });
    } else if (tip === "knjiga_prihoda") {
      const headers = ["Datum", "Broj fakture", "Kupac", "Osnovica", "PDV", "Ukupno"];
      const rows = (data.items || []).map((r) => [r.datum ?? "", r.broj_fakture ?? "", r.kupac ?? "", r.osnovica ?? "", r.pdv ?? "", r.ukupno ?? ""]);
      const footer = [];
      if (data.summary) {
        footer.push([]);
        footer.push(["", "", "UKUPNO", data.summary.ukupno_osnovica ?? "", data.summary.ukupno_pdv ?? "", data.summary.ukupno_sve ?? ""]);
      }
      downloadExcel({ filename: fn, sheetName: "Knjiga prihoda", headers, rows, footerRows: footer });
    } else if (tip === "pdv") {
      const headers = ["Datum", "Osnovica", "PDV izlazni", "Izvor"];
      const rows = (data.items || []).map((r) => [r.datum ?? "", r.osnovica ?? "", r.pdv_izlazni ?? "", r.iz_arhive ? "Arhiva" : "Live"]);
      const footer = [];
      if (data.summary) {
        footer.push([]);
        footer.push(["UKUPNO", data.summary.osnovica_ukupno ?? "", data.summary.pdv_izlazni_ukupno ?? "", ""]);
      }
      downloadExcel({ filename: fn, sheetName: "PDV", headers, rows, footerRows: footer });
    } else if (tip === "projekti") {
      const projektiColumns = ["id", "po", "naziv", "status", "narucilac", "rok", "budzet", "troskovi", "zarada"];
      const projektiLabels = {
        id: "ID",
        po: "PO",
        naziv: "Radni naziv",
        status: "Status",
        narucilac: "Naručilac",
        rok: "Rok",
        budzet: "Budžet (BAM)",
        troskovi: "Troškovi (BAM)",
        zarada: "Planirana zarada (BAM)",
      };
      const currentVisible = visibleColumns.projekti || projektiColumns;
      const headers = currentVisible.map((col) => projektiLabels[col] || col);
      const rows = (data.items || []).map((r) => {
        const row = [];
        if (currentVisible.includes("id")) row.push(r.projekat_id ?? "");
        if (currentVisible.includes("po")) row.push(r.id_po ?? "");
        if (currentVisible.includes("naziv")) row.push(r.radni_naziv ?? "");
        if (currentVisible.includes("status")) row.push(r.status_naziv ?? "");
        if (currentVisible.includes("narucilac")) row.push(r.narucilac_naziv ?? "");
        if (currentVisible.includes("rok")) row.push(r.rok_glavni ?? "");
        if (currentVisible.includes("budzet")) row.push(r.budzet_planirani ?? "");
        if (currentVisible.includes("troskovi")) row.push(r.troskovi_ukupno ?? "");
        if (currentVisible.includes("zarada")) row.push(r.planirana_zarada ?? "");
        return row;
      });
      const footer = [];
      if (data.summary) {
        footer.push([]);
        const footerRow = [];
        const colCount = currentVisible.length;
        let colIdx = 0;
        if (currentVisible.includes("id")) { footerRow.push(""); colIdx++; }
        if (currentVisible.includes("po")) { footerRow.push(""); colIdx++; }
        if (currentVisible.includes("naziv")) { footerRow.push(""); colIdx++; }
        if (currentVisible.includes("status")) { footerRow.push(""); colIdx++; }
        if (currentVisible.includes("narucilac")) { footerRow.push(""); colIdx++; }
        if (currentVisible.includes("rok")) { footerRow.push("UKUPNO"); colIdx++; }
        else if (colIdx < colCount - 3) { footerRow.push("UKUPNO"); colIdx++; }
        if (currentVisible.includes("budzet")) footerRow.push(data.summary.ukupno_budzet ?? "");
        if (currentVisible.includes("troskovi")) footerRow.push(data.summary.ukupno_troskovi ?? "");
        if (currentVisible.includes("zarada")) footerRow.push(data.summary.ukupno_planirana_zarada ?? "");
        footer.push(footerRow);
      }
      downloadExcel({ filename: fn, sheetName: "Projekti", headers, rows, footerRows: footer });
    } else if (tip === "talenti") {
      const headers = ["ID", "Ime i prezime", "Vrsta", "Email", "Telefon", "Ukupno troškova", "Plaćeno", "Stanje", "Broj projekata", "Broj troškova"];
      const rows = (data.items || []).map((r) => [
        r.talent_id ?? "",
        r.talent_naziv ?? "",
        r.talent_vrsta ?? "",
        r.email ?? "",
        r.telefon ?? "",
        r.ukupno_troskova ?? "",
        r.ukupno_placeno ?? "",
        r.stanje ?? "",
        r.broj_projekata ?? "",
        r.broj_troskova ?? "",
      ]);
      const footer = [];
      if (data.summary) {
        footer.push([]);
        footer.push(["", "", "", "", "UKUPNO", data.summary.ukupno_troskova ?? "", data.summary.ukupno_placeno ?? "", data.summary.ukupno_stanje ?? "", "", ""]);
      }
      downloadExcel({ filename: fn, sheetName: "Talenti", headers, rows, footerRows: footer });
    } else if (tip === "dobavljaci") {
      const headers = ["ID", "Naziv", "Vrsta", "Email", "Telefon", "Grad", "Država", "Ukupno troškova", "Plaćeno", "Stanje", "Broj projekata", "Broj troškova"];
      const rows = (data.items || []).map((r) => [
        r.dobavljac_id ?? "",
        r.dobavljac_naziv ?? "",
        r.dobavljac_vrsta ?? "",
        r.email ?? "",
        r.telefon ?? "",
        r.grad ?? "",
        r.drzava_iso2 ?? "",
        r.ukupno_troskova ?? "",
        r.ukupno_placeno ?? "",
        r.stanje ?? "",
        r.broj_projekata ?? "",
        r.broj_troskova ?? "",
      ]);
      const footer = [];
      if (data.summary) {
        footer.push([]);
        footer.push(["", "", "", "", "", "", "UKUPNO", data.summary.ukupno_troskova ?? "", data.summary.ukupno_placeno ?? "", data.summary.ukupno_stanje ?? "", "", ""]);
      }
      downloadExcel({ filename: fn, sheetName: "Dobavljači", headers, rows, footerRows: footer });
    } else if (tip === "klijenti") {
      const headers = ["ID", "Naziv", "Broj projekata", "Budžet projekata", "Broj faktura", "Fakturisano", "Naplaćeno", "Potraživanja"];
      const rows = (data.items || []).map((r) => [
        r.klijent_id ?? "",
        r.naziv_klijenta ?? "",
        r.broj_projekata ?? "",
        r.ukupno_budzet_projekata ?? "",
        r.broj_faktura ?? "",
        r.ukupno_fakturisano ?? "",
        r.ukupno_naplaceno ?? "",
        r.potrazivanja ?? "",
      ]);
      const footer = [];
      if (data.summary) {
        footer.push([]);
        footer.push(["", "UKUPNO", data.summary.ukupno_broj_projekata ?? "", data.summary.ukupno_budzet_projekata ?? "", data.summary.ukupno_broj_faktura ?? "", data.summary.ukupno_fakturisano ?? "", data.summary.ukupno_naplaceno ?? "", data.summary.ukupno_potrazivanja ?? ""]);
      }
      downloadExcel({ filename: fn, sheetName: "Klijenti", headers, rows, footerRows: footer });
    } else if (tip === "banka") {
      const headers = ["Datum", "Opis", "Kategorija", "Projekat", "Iznos (BAM)", "Valuta"];
      const rows = (data.items || []).map((r) => [
        r.datum_troska ?? "",
        r.opis ?? "",
        r.kategorija ?? "",
        r.projekat_naziv ?? "",
        r.iznos_km ?? "",
        r.valuta_original ?? "",
      ]);
      const footer = [];
      if (data.summary) {
        footer.push([]);
        footer.push(["", "", "", "UKUPNO", data.summary.ukupno_troskova ?? "", ""]);
        if (data.summary.po_tipu) {
          Object.entries(data.summary.po_tipu).forEach(([tip, iznos]) => {
            footer.push(["", "", `Tip: ${tip}`, "", iznos ?? "", ""]);
          });
        }
      }
      downloadExcel({ filename: fn, sheetName: "Banka", headers, rows, footerRows: footer });
    } else if (tip === "fakture") {
      const headers = ["Broj fakture", "Datum izdavanja", "Datum dospijeća", "Naručilac", "Osnovica (bez PDV)", "PDV", "Ukupno (sa PDV)", "Valuta", "Naplaćeno", "Neplaćeno"];
      const rows = (data.items || []).map((r) => [
        r.broj_fakture ?? "",
        r.datum_izdavanja ?? "",
        r.datum_dospijeca ?? "",
        r.narucilac_naziv ?? "",
        r.iznos_bez_pdv ?? "",
        r.pdv_iznos ?? "",
        r.iznos_sa_pdv ?? "",
        r.valuta ?? "",
        r.naplaceno ?? "",
        r.neplaceno ?? "",
      ]);
      const footer = [];
      if (data.summary) {
        footer.push([]);
        footer.push(["", "", "", "UKUPNO", data.summary.ukupno_bez_pdv ?? "", data.summary.ukupno_pdv ?? "", data.summary.ukupno_fakturisano ?? "", "", data.summary.ukupno_naplaceno ?? "", data.summary.ukupno_neplaceno ?? ""]);
      }
      downloadExcel({ filename: fn, sheetName: "Fakture i naplate", headers, rows, footerRows: footer });
    } else if (tip === "fiksni") {
      const headers = ["ID", "Naziv troška", "Frekvencija", "Dan u mjesecu", "Datum dospijeća", "Zadnje plaćeno", "Iznos", "Iznos (BAM)", "Valuta", "Način plaćanja", "Aktivan", "Napomena"];
      const rows = (data.items || []).map((r) => [
        r.trosak_id ?? "",
        r.naziv_troska ?? "",
        r.frekvencija ?? "",
        r.dan_u_mjesecu ?? "",
        r.datum_dospijeca ?? "",
        r.zadnje_placeno ?? "",
        r.iznos ?? "",
        r.iznos_km ?? "",
        r.valuta ?? "",
        r.nacin_placanja ?? "",
        r.aktivan ?? "",
        r.napomena ?? "",
      ]);
      const footer = [];
      if (data.summary) {
        footer.push([]);
        footer.push(["", "", "", "", "", "", "UKUPNO FIKSNIH TROŠKOVA", data.summary.ukupno_fiksnih_troskova ?? "", "", "", "", ""]);
        footer.push(["", "", "", "", "", "", "UKUPNO PROJEKTNIH TROŠKOVA", data.summary.ukupno_projektnih_troskova ?? "", "", "", "", ""]);
        footer.push(["", "", "", "", "", "", "UKUPNO TROŠKOVA", data.summary.ukupno_troskova ?? "", "", "", "", ""]);
        footer.push(["", "", "", "", "", "", "UKUPNO PRIHODA", data.summary.ukupno_prihoda ?? "", "", "", "", ""]);
        footer.push(["", "", "", "", "", "", "RAZLIKA (PRIHODI - TROŠKOVI)", data.summary.razlika ?? "", "", "", "", ""]);
      }
      downloadExcel({ filename: fn, sheetName: "Fiksni troškovi", headers, rows, footerRows: footer });
    }
  };

  return (
    <div className="card">
      <style>{`
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .report-table th {
          background: rgba(0,0,0,0.04);
          padding: 10px 8px;
          text-align: left;
          font-weight: 700;
          border-bottom: 2px solid rgba(0,0,0,0.1);
          white-space: nowrap;
        }
        .report-table td {
          padding: 10px 8px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          vertical-align: top;
        }
        .report-table tbody tr:hover {
          background: rgba(0,0,0,0.02);
        }
        .report-table .wrap {
          white-space: normal;
          word-break: break-word;
          max-width: 0;
        }
      `}</style>
      <div style={{ fontWeight: 800, marginBottom: 16, fontSize: 18 }}>
        {t("izvjestajiSvi.filterTitle")}
      </div>

      <form onSubmit={handleGenerisi}>
        <div className="field" style={{ marginBottom: 20 }}>
          <label className="label">{t("izvjestajiSvi.whatInterestsYou")}</label>
          <select
            value={tip}
            onChange={(e) => { setTip(e.target.value); setData(null); setError(""); }}
            className="input"
            style={{ maxWidth: 500 }}
            required
          >
            <option value="">{t("izvjestajiSvi.selectReportType")}</option>
            {TIP_OPCIJE.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} – {opt.desc}
              </option>
            ))}
          </select>
          {tip && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
              {TIP_OPCIJE.find((o) => o.value === tip)?.desc}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div className="field">
            <label className="label">{t("izvjestajiSvi.dateFrom")}</label>
            <input
              type="date"
              value={datumOd}
              onChange={(e) => setDatumOd(e.target.value)}
              className="input"
            />
          </div>
          <div className="field">
            <label className="label">{t("izvjestajiSvi.dateTo")}</label>
            <input
              type="date"
              value={datumDo}
              onChange={(e) => setDatumDo(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 20 }}>
          {t("izvjestajiSvi.noDateHint")}
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" className="btn" style={{ fontWeight: 700 }} disabled={loading}>
            {loading ? t("izvjestajiSvi.loading") : t("izvjestajiSvi.generateBtn")}
          </button>
        </div>
      </form>

      {data?.ok && hasApi && (
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <button type="button" className="btn" onClick={handleExportExcel} style={{ fontWeight: 600 }}>
            {t("izvjestajiSvi.exportExcel")}
          </button>
          <span style={{ marginLeft: 12, fontSize: 13, opacity: 0.85 }}>
            {t("izvjestajiSvi.exportHint")}
          </span>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "rgba(239,68,68,0.1)", borderRadius: 8, color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {data?.placeholder && (
        <div style={{ marginTop: 24, padding: 20, borderLeft: "4px solid rgba(125, 211, 252, 0.5)", background: "rgba(125, 211, 252, 0.06)", borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("izvjestajiSvi.placeholderTitle")}</div>
          <p style={{ fontSize: 13, opacity: 0.9 }}>
            {t("izvjestajiSvi.tip")}: <strong>{TIP_OPCIJE.find((o) => o.value === data.tip)?.label ?? data.tip}</strong>
            {(data.datumOd || data.datumDo) ? ` | ${t("izvjestajiSvi.placeholderPeriod")}: ${data.datumOd || "—"} do ${data.datumDo || "—"}` : ` | ${t("izvjestajiSvi.noDateHint").split(".")[0]}`}
          </p>
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>
            {t("izvjestajiSvi.placeholderNoApi")}
          </p>
        </div>
      )}

      {data?.ok && tip === "potrazivanja" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>{t("izvjestajiSvi.report_potrazivanja_label")}</div>
          {data.summary?.po_bucketu && (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
              {["0-30", "31-60", "61-90", "90+"].map((b) => (
                <span key={b} style={{ padding: "6px 12px", background: "rgba(0,0,0,0.05)", borderRadius: 6, fontSize: 13 }}>
                  {b} {t("izvjestajiSvi.dana")}: <strong>{fmt(data.summary.po_bucketu[b])}</strong> {ccy}
                </span>
              ))}
              <span style={{ padding: "6px 12px", background: "rgba(34,197,94,0.15)", borderRadius: 6, fontSize: 13 }}>
                {t("izvjestajiSvi.summary_ukupno")}: <strong>{fmt(data.summary.ukupno)}</strong> {ccy}
              </span>
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", minWidth: 640 }}>
              <thead>
                <tr>
                  <th>{t("izvjestajiSvi.col_broj_fakture")}</th>
                  <th>{t("izvjestajiSvi.col_datum_izd")}</th>
                  <th>{t("izvjestajiSvi.col_datum_dosp")}</th>
                  <th>{t("izvjestajiSvi.col_narucilac")}</th>
                  <th>{t("izvjestajiSvi.col_iznos")} ({ccy})</th>
                  <th>{t("izvjestajiSvi.col_dana_kasnjenja")}</th>
                  <th>{t("izvjestajiSvi.col_bucket")}</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={row.faktura_id ?? i}>
                    <td>{row.broj_fakture ?? "—"}</td>
                    <td>{row.datum_izdavanja ?? "—"}</td>
                    <td>{row.datum_dospijeca ?? "—"}</td>
                    <td>{row.narucilac_naziv ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{fmt(row.iznos_sa_pdv)}</td>
                    <td style={{ textAlign: "right" }}>{row.dana_kasnjenja ?? "—"}</td>
                    <td>{row.aging_bucket ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.ok && tip === "lista_faktura" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>{t("izvjestajiSvi.report_lista_faktura_label")}</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              {t("izvjestajiSvi.summary_broj_faktura")}: <strong>{data.summary.broj_faktura ?? 0}</strong>
              {" | "} {t("izvjestajiSvi.summary_ukupno_bez_pdv")}: <strong>{fmt(data.summary.ukupno_bez_pdv)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.col_pdv")}: <strong>{fmt(data.summary.ukupno_pdv)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.summary_ukupno_sa_pdv")}: <strong>{fmt(data.summary.ukupno_sa_pdv)}</strong> {ccy}
              {(data.items || []).some((r) => r.iz_arhive) && (
                <span style={{ marginLeft: 12, color: "var(--muted)", fontSize: 12 }}>
                  {t("izvjestajiSvi.uključujući_arhivu")}
                </span>
              )}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", minWidth: 720 }}>
              <thead>
                <tr>
                  <th>{t("izvjestajiSvi.col_broj")}</th>
                  <th>{t("izvjestajiSvi.col_datum")}</th>
                  <th>{t("izvjestajiSvi.col_narucilac")}</th>
                  <th>{t("izvjestajiSvi.col_osnovica")}</th>
                  <th>{t("izvjestajiSvi.col_pdv")}</th>
                  <th>{t("izvjestajiSvi.col_ukupno")}</th>
                  <th style={{ width: 72 }}>{t("izvjestajiSvi.col_izvor")}</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={row.faktura_id ?? `arhiva-${row.broj_fakture}-${row.datum_izdavanja}-${i}`}>
                    <td>{row.broj_fakture ?? "—"}</td>
                    <td>{row.datum_izdavanja ?? "—"}</td>
                    <td>{row.narucilac_naziv ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{fmt(row.iznos_bez_pdv)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(row.pdv_iznos)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(row.iznos_sa_pdv)}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>
                      {row.iz_arhive ? t("izvjestajiSvi.arhiva") : t("izvjestajiSvi.live")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.ok && tip === "knjiga_prihoda" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>{t("izvjestajiSvi.report_knjiga_prihoda_label")}</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              {t("izvjestajiSvi.summary_broj_stavki")}: <strong>{data.summary.broj_stavki ?? 0}</strong>
              {" | "} {t("izvjestajiSvi.summary_ukupno_osnovica")}: <strong>{fmt(data.summary.ukupno_osnovica)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.col_pdv")}: <strong>{fmt(data.summary.ukupno_pdv)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.summary_ukupno_sa_pdv")}: <strong>{fmt(data.summary.ukupno_sve)}</strong> {ccy}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", minWidth: 640 }}>
              <thead>
                <tr>
                  <th>{t("izvjestajiSvi.col_datum")}</th>
                  <th>{t("izvjestajiSvi.col_broj_fakture")}</th>
                  <th>{t("izvjestajiSvi.col_kupac")}</th>
                  <th>{t("izvjestajiSvi.col_osnovica")}</th>
                  <th>{t("izvjestajiSvi.col_pdv")}</th>
                  <th>{t("izvjestajiSvi.col_ukupno")}</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={i}>
                    <td>{row.datum ?? "—"}</td>
                    <td>{row.broj_fakture ?? "—"}</td>
                    <td>{row.kupac ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{fmt(row.osnovica)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(row.pdv)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(row.ukupno)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.ok && tip === "pdv" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>{t("izvjestajiSvi.report_pdv_label")}</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              {t("izvjestajiSvi.summary_pdv_izlazni_ukupno")}: <strong>{fmt(data.summary.pdv_izlazni_ukupno)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.summary_osnovica_ukupno")}: <strong>{fmt(data.summary.osnovica_ukupno)}</strong> {ccy}
              {(data.items || []).some((r) => r.iz_arhive) && (
                <span style={{ marginLeft: 12, color: "var(--muted)", fontSize: 12 }}>{t("izvjestajiSvi.uključena_arhiva")}</span>
              )}
              {data.summary.napomena && (
                <p style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>{t("izvjestajiSvi.pdvInputVatNote")}</p>
              )}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", minWidth: 320 }}>
              <thead>
                <tr>
                  <th>{t("izvjestajiSvi.col_datum")}</th>
                  <th>{t("izvjestajiSvi.col_osnovica")}</th>
                  <th>{t("izvjestajiSvi.col_pdv_izlazni")}</th>
                  <th style={{ width: 72 }}>{t("izvjestajiSvi.col_izvor")}</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={i}>
                    <td>{row.datum ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{fmt(row.osnovica)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(row.pdv_izlazni)}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>
                      {row.iz_arhive ? t("izvjestajiSvi.arhiva") : t("izvjestajiSvi.live")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.ok && tip === "projekti" && (() => {
        const projektiColumns = ["id", "po", "naziv", "status", "narucilac", "rok", "budzet", "troskovi", "zarada"];
        const projektiLabels = {
          id: t("izvjestajiSvi.col_id"),
          po: t("izvjestajiSvi.po"),
          naziv: t("izvjestajiSvi.col_radni_naziv"),
          status: t("izvjestajiSvi.col_status"),
          narucilac: t("izvjestajiSvi.col_narucilac"),
          rok: t("izvjestajiSvi.col_rok"),
          budzet: t("izvjestajiSvi.col_budzet"),
          troskovi: t("izvjestajiSvi.col_troskovi"),
          zarada: t("izvjestajiSvi.col_planirana_zarada"),
        };
        const currentVisible = visibleColumns.projekti || projektiColumns;
        const columnMap = {
          id: { key: "projekat_id", align: "left" },
          po: { key: "id_po", align: "left" },
          naziv: { key: "radni_naziv", align: "left", wrap: true },
          status: { key: "status_naziv", align: "left" },
          narucilac: { key: "narucilac_naziv", align: "left", wrap: true },
          rok: { key: "rok_glavni", align: "left" },
          budzet: { key: "budzet_planirani", align: "right", format: fmt },
          troskovi: { key: "troskovi_ukupno", align: "right", format: fmt },
          zarada: { key: "planirana_zarada", align: "right", format: fmt },
        };
        return (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{t("izvjestajiSvi.report_projekti_label")}</div>
              <ColumnPicker
                columns={projektiColumns}
                columnLabels={projektiLabels}
                visibleColumns={currentVisible}
                onChange={(cols) => setVisibleColumns({ ...visibleColumns, projekti: cols })}
              />
            </div>
            {data.summary && (
              <div style={{ marginBottom: 16, fontSize: 13 }}>
                {t("izvjestajiSvi.summary_broj_projekata")}: <strong>{data.summary.broj_projekata ?? 0}</strong>
                {" | "} {t("izvjestajiSvi.summary_ukupno_budzet")}: <strong>{fmt(data.summary.ukupno_budzet)}</strong> {ccy}
                {" | "} {t("izvjestajiSvi.summary_ukupno_troskova")}: <strong>{fmt(data.summary.ukupno_troskovi)}</strong> {ccy}
                {" | "} {t("izvjestajiSvi.summary_planirana_zarada")}: <strong>{fmt(data.summary.ukupno_planirana_zarada)}</strong> {ccy}
              </div>
            )}
            <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8 }}>
              <table className="report-table" style={{ width: "100%", tableLayout: "fixed", minWidth: 900 }}>
                <colgroup>
                  {currentVisible.includes("id") && <col style={{ width: "52px" }} />}
                  {currentVisible.includes("po") && <col style={{ width: "72px" }} />}
                  {currentVisible.includes("naziv") && <col style={{ width: "320px" }} />}
                  {currentVisible.includes("status") && <col style={{ width: "100px" }} />}
                  {currentVisible.includes("narucilac") && <col style={{ width: "160px" }} />}
                  {currentVisible.includes("rok") && <col style={{ width: "92px" }} />}
                  {currentVisible.includes("budzet") && <col style={{ width: "100px" }} />}
                  {currentVisible.includes("troskovi") && <col style={{ width: "100px" }} />}
                  {currentVisible.includes("zarada") && <col style={{ width: "108px" }} />}
                </colgroup>
                <thead>
                  <tr>
                    {currentVisible.includes("id") && <th>ID</th>}
                    {currentVisible.includes("po") && <th>PO</th>}
                    {currentVisible.includes("naziv") && <th>Radni naziv</th>}
                    {currentVisible.includes("status") && <th>Status</th>}
                    {currentVisible.includes("narucilac") && <th>Naručilac</th>}
                    {currentVisible.includes("rok") && <th>Rok</th>}
                    {currentVisible.includes("budzet") && <th style={{ textAlign: "right" }}>Budžet</th>}
                    {currentVisible.includes("troskovi") && <th style={{ textAlign: "right" }}>Troškovi</th>}
                    {currentVisible.includes("zarada") && <th style={{ textAlign: "right" }}>Planirana zarada</th>}
                  </tr>
                </thead>
                <tbody>
                  {(data.items || []).map((row, i) => (
                    <tr key={row.projekat_id ?? i}>
                      {currentVisible.includes("id") && (
                        <td>{row.projekat_id ?? "—"}</td>
                      )}
                      {currentVisible.includes("po") && (
                        <td>{row.id_po ?? "—"}</td>
                      )}
                      {currentVisible.includes("naziv") && (
                        <td className="wrap">{row.radni_naziv ?? "—"}</td>
                      )}
                      {currentVisible.includes("status") && (
                        <td>{row.status_naziv ?? "—"}</td>
                      )}
                      {currentVisible.includes("narucilac") && (
                        <td className="wrap">{row.narucilac_naziv ?? "—"}</td>
                      )}
                      {currentVisible.includes("rok") && (
                        <td>{row.rok_glavni ?? "—"}</td>
                      )}
                      {currentVisible.includes("budzet") && (
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(row.budzet_planirani)}</td>
                      )}
                      {currentVisible.includes("troskovi") && (
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(row.troskovi_ukupno)}</td>
                      )}
                      {currentVisible.includes("zarada") && (
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(row.planirana_zarada)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {data?.ok && tip === "talenti" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>{t("izvjestajiSvi.report_talenti_label")}</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              {t("izvjestajiSvi.summary_broj_talenta")}: <strong>{data.summary.broj_talenta ?? 0}</strong>
              {" | "} {t("izvjestajiSvi.summary_ukupno_troskova")}: <strong>{fmt(data.summary.ukupno_troskova)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.col_placeno")}: <strong>{fmt(data.summary.ukupno_placeno)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.summary_ukupno_stanje")}: <strong>{fmt(data.summary.ukupno_stanje)}</strong> {ccy}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="report-table" style={{ width: "100%", minWidth: 800 }}>
              <thead>
                <tr>
                  <th>{t("izvjestajiSvi.col_id")}</th>
                  <th>{t("izvjestajiSvi.col_ime_prezime")}</th>
                  <th>{t("izvjestajiSvi.col_vrsta")}</th>
                  <th>{t("izvjestajiSvi.col_email")}</th>
                  <th>{t("izvjestajiSvi.col_telefon")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_ukupno_troskova")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_placeno")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_stanje")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_broj_projekata")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_broj_troskova")}</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={row.talent_id ?? i}>
                    <td>{row.talent_id ?? "—"}</td>
                    <td className="wrap">{row.talent_naziv ?? "—"}</td>
                    <td>{row.talent_vrsta ?? "—"}</td>
                    <td>{row.email ?? "—"}</td>
                    <td>{row.telefon ?? "—"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(row.ukupno_troskova)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(row.ukupno_placeno)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: row.stanje > 0 ? 700 : 400,
                        color: row.stanje > 0 ? "#b91c1c" : row.stanje < 0 ? "#059669" : "inherit",
                      }}
                    >
                      {fmt(row.stanje)}
                    </td>
                    <td style={{ textAlign: "right" }}>{row.broj_projekata ?? 0}</td>
                    <td style={{ textAlign: "right" }}>{row.broj_troskova ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.ok && tip === "dobavljaci" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>{t("izvjestajiSvi.report_dobavljaci_label")}</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              {t("izvjestajiSvi.summary_broj_dobavljaca")}: <strong>{data.summary.broj_dobavljaca ?? 0}</strong>
              {" | "} {t("izvjestajiSvi.summary_ukupno_troskova")}: <strong>{fmt(data.summary.ukupno_troskova)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.col_placeno")}: <strong>{fmt(data.summary.ukupno_placeno)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.summary_ukupno_stanje")}: <strong>{fmt(data.summary.ukupno_stanje)}</strong> {ccy}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="report-table" style={{ width: "100%", minWidth: 900 }}>
              <thead>
                <tr>
                  <th>{t("izvjestajiSvi.col_id")}</th>
                  <th>{t("izvjestajiSvi.col_naziv")}</th>
                  <th>{t("izvjestajiSvi.col_vrsta")}</th>
                  <th>{t("izvjestajiSvi.col_email")}</th>
                  <th>{t("izvjestajiSvi.col_telefon")}</th>
                  <th>{t("izvjestajiSvi.col_grad")}</th>
                  <th>{t("izvjestajiSvi.col_drzava")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_ukupno_troskova")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_placeno")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_stanje")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_broj_projekata")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_broj_troskova")}</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={row.dobavljac_id ?? i}>
                    <td>{row.dobavljac_id ?? "—"}</td>
                    <td className="wrap">{row.dobavljac_naziv ?? "—"}</td>
                    <td>{row.dobavljac_vrsta ?? "—"}</td>
                    <td>{row.email ?? "—"}</td>
                    <td>{row.telefon ?? "—"}</td>
                    <td>{row.grad ?? "—"}</td>
                    <td>{row.drzava_iso2 ?? "—"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(row.ukupno_troskova)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(row.ukupno_placeno)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: row.stanje > 0 ? 700 : 400,
                        color: row.stanje > 0 ? "#b91c1c" : row.stanje < 0 ? "#059669" : "inherit",
                      }}
                    >
                      {fmt(row.stanje)}
                    </td>
                    <td style={{ textAlign: "right" }}>{row.broj_projekata ?? 0}</td>
                    <td style={{ textAlign: "right" }}>{row.broj_troskova ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.ok && tip === "klijenti" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>{t("izvjestajiSvi.report_klijenti_label")}</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              {t("izvjestajiSvi.summary_broj_klijenata")}: <strong>{data.summary.broj_klijenata ?? 0}</strong>
              {" | "} {t("izvjestajiSvi.summary_ukupno_broj_projekata")}: <strong>{data.summary.ukupno_broj_projekata ?? 0}</strong>
              {" | "} {t("izvjestajiSvi.col_budzet_projekata")}: <strong>{fmt(data.summary.ukupno_budzet_projekata)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.summary_ukupno_broj_faktura")}: <strong>{data.summary.ukupno_broj_faktura ?? 0}</strong>
              {" | "} {t("izvjestajiSvi.col_fakturisano")}: <strong>{fmt(data.summary.ukupno_fakturisano)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.col_naplaceno")}: <strong>{fmt(data.summary.ukupno_naplaceno)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.col_potrazivanja")}: <strong>{fmt(data.summary.ukupno_potrazivanja)}</strong> {ccy}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="report-table" style={{ width: "100%", minWidth: 800, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "60px" }} />
                <col style={{ width: "300px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "90px" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "130px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>{t("izvjestajiSvi.col_id")}</th>
                  <th>{t("izvjestajiSvi.col_naziv")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_broj_projekata")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_budzet_projekata")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_broj_faktura")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_fakturisano")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_naplaceno")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_potrazivanja")}</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={row.klijent_id ?? i}>
                    <td>{row.klijent_id ?? "—"}</td>
                    <td className="wrap">{row.naziv_klijenta ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{row.broj_projekata ?? 0}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(row.ukupno_budzet_projekata)}
                    </td>
                    <td style={{ textAlign: "right" }}>{row.broj_faktura ?? 0}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(row.ukupno_fakturisano)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(row.ukupno_naplaceno)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: row.potrazivanja > 0 ? 700 : 400,
                        color: row.potrazivanja > 0 ? "#b91c1c" : "inherit",
                      }}
                    >
                      {fmt(row.potrazivanja)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.ok && tip === "banka" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>{t("izvjestajiSvi.report_banka_label")}</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              {t("izvjestajiSvi.summary_broj_stavki")}: <strong>{data.summary.broj_stavki ?? 0}</strong>
              {" | "} {t("izvjestajiSvi.summary_ukupno_troskova")}: <strong>{fmt(data.summary.ukupno_troskova)}</strong> {ccy}
              {data.summary.po_tipu && Object.keys(data.summary.po_tipu).length > 0 && (
                <>
                  {" | "}
                  {Object.entries(data.summary.po_tipu).map(([tip, iznos], idx) => (
                    <span key={tip}>
                      {idx > 0 ? " | " : ""}
                      {tip}: <strong>{fmt(iznos)}</strong> {ccy}
                    </span>
                  ))}
                </>
              )}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="report-table" style={{ width: "100%", minWidth: 800, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "100px" }} />
                <col style={{ width: "400px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "200px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "80px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>{t("izvjestajiSvi.col_datum")}</th>
                  <th>{t("izvjestajiSvi.col_opis")}</th>
                  <th>{t("izvjestajiSvi.col_kategorija")}</th>
                  <th>{t("izvjestajiSvi.col_projekat")}</th>
                  <th style={{ textAlign: "right" }}>{t("izvjestajiSvi.col_iznos")} ({ccy})</th>
                  <th>{t("izvjestajiSvi.col_valuta")}</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={row.trosak_id ?? i}>
                    <td>{row.datum_troska ?? "—"}</td>
                    <td className="wrap">{row.opis ?? "—"}</td>
                    <td>{row.kategorija ?? "—"}</td>
                    <td className="wrap">{row.projekat_naziv ?? "—"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(row.iznos_km)}
                    </td>
                    <td>{row.valuta_original ?? ccy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.ok && tip === "fakture" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>Fakture i naplate</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              {t("izvjestajiSvi.summary_broj_faktura")}: <strong>{data.summary.broj_faktura ?? 0}</strong>
              {" | "} {t("izvjestajiSvi.col_fakturisano")}: <strong>{fmt(data.summary.ukupno_fakturisano)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.col_naplaceno")}: <strong>{fmt(data.summary.ukupno_naplaceno)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.col_neplaceno")}: <strong>{fmt(data.summary.ukupno_neplaceno)}</strong> {ccy}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="report-table" style={{ width: "100%", minWidth: 1000 }}>
              <colgroup>
                <col style={{ width: "120px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "300px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "120px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>{t("izvjestajiSvi.col_broj_fakture")}</th>
                  <th>{t("izvjestajiSvi.col_datum_izd")}</th>
                  <th>{t("izvjestajiSvi.col_datum_dosp")}</th>
                  <th>{t("izvjestajiSvi.col_narucilac")}</th>
                  <th>{t("izvjestajiSvi.col_osnovica_bez_pdv")}</th>
                  <th>{t("izvjestajiSvi.col_pdv")}</th>
                  <th>{t("izvjestajiSvi.col_ukupno_sa_pdv")}</th>
                  <th>{t("izvjestajiSvi.col_valuta")}</th>
                  <th>{t("izvjestajiSvi.col_naplaceno")}</th>
                  <th>{t("izvjestajiSvi.col_neplaceno")}</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={row.faktura_id != null ? `f-${row.faktura_id}` : `arhiva-${row.broj_fakture}-${row.datum_izdavanja}-${i}`}>
                    <td>{row.broj_fakture ?? "—"}</td>
                    <td>{row.datum_izdavanja ?? "—"}</td>
                    <td>{row.datum_dospijeca ?? "—"}</td>
                    <td className="wrap">{row.narucilac_naziv ?? "—"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(row.iznos_bez_pdv)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(row.pdv_iznos)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {fmt(row.iznos_sa_pdv)}
                    </td>
                    <td>{row.valuta ?? ccy}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#059669" }}>
                      {fmt(row.naplaceno)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#dc2626" }}>
                      {fmt(row.neplaceno)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.ok && tip === "fiksni" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>{t("izvjestajiSvi.report_fiksni_label")}</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              {t("izvjestajiSvi.summary_broj_fiksnih")}: <strong>{data.summary.broj_fiksnih_troskova ?? 0}</strong>
              {" | "} {t("izvjestajiSvi.summary_ukupno_fiksnih")}: <strong>{fmt(data.summary.ukupno_fiksnih_troskova)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.summary_ukupno_projektnih")}: <strong>{fmt(data.summary.ukupno_projektnih_troskova)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.summary_ukupno_troskova")}: <strong>{fmt(data.summary.ukupno_troskova)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.summary_ukupno_prihoda")}: <strong>{fmt(data.summary.ukupno_prihoda)}</strong> {ccy}
              {" | "} {t("izvjestajiSvi.summary_razlika")}: <strong style={{ color: data.summary.razlika >= 0 ? "#059669" : "#dc2626" }}>{fmt(data.summary.razlika)}</strong> {ccy}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="report-table" style={{ width: "100%", minWidth: 1200 }}>
              <colgroup>
                <col style={{ width: "60px" }} />
                <col style={{ width: "250px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "200px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>{t("izvjestajiSvi.col_id")}</th>
                  <th>{t("izvjestajiSvi.col_naziv_troska")}</th>
                  <th>{t("izvjestajiSvi.col_frekvencija")}</th>
                  <th>{t("izvjestajiSvi.col_dan_u_mjesecu")}</th>
                  <th>{t("izvjestajiSvi.col_datum_dospijeca")}</th>
                  <th>{t("izvjestajiSvi.col_zadnje_placeno")}</th>
                  <th>{t("izvjestajiSvi.col_iznos")}</th>
                  <th>{t("izvjestajiSvi.col_iznos")} ({ccy})</th>
                  <th>{t("izvjestajiSvi.col_valuta")}</th>
                  <th>{t("izvjestajiSvi.col_nacin_placanja")}</th>
                  <th>{t("izvjestajiSvi.col_aktivan")}</th>
                  <th>{t("izvjestajiSvi.col_napomena")}</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={row.trosak_id ?? i}>
                    <td>{row.trosak_id ?? "—"}</td>
                    <td className="wrap">{row.naziv_troska ?? "—"}</td>
                    <td>{row.frekvencija ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>{row.dan_u_mjesecu ?? "—"}</td>
                    <td>{row.datum_dospijeca ?? "—"}</td>
                    <td>{row.zadnje_placeno ?? "—"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(row.iznos)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {fmt(row.iznos_km)}
                    </td>
                    <td>{row.valuta ?? ccy}</td>
                    <td>{row.nacin_placanja ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>{row.aktivan ?? "—"}</td>
                    <td className="wrap">{row.napomena ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
