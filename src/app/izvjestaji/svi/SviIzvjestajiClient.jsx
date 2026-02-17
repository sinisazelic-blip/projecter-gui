"use client";

import { useState } from "react";
import { downloadExcel, reportFilename } from "@/lib/exportExcel";
import { ColumnPicker } from "@/components/ColumnPicker";

const TIP_OPCIJE = [
  { value: "potrazivanja", label: "Potraživanja (starenje)", desc: "Fakture po klijentu, datum dospijeća, dana zakašnjenja, bucketi 0–30, 31–60, 61–90, 90+" },
  { value: "lista_faktura", label: "Lista izdatih faktura", desc: "Sve izdate fakture u periodu – broj, datum, naručilac, osnovica, PDV, ukupno" },
  { value: "knjiga_prihoda", label: "Knjiga prihoda", desc: "Formalni izvještaj: datum, broj fakture, kupac, osnovica, PDV, ukupno" },
  { value: "pdv", label: "Pregled PDV-a", desc: "PDV izlazni (i ulazni kad postoji) po periodu" },
  { value: "talenti", label: "Talenti", desc: "Ukupno po talentu, stanje, naplate po periodu" },
  { value: "dobavljaci", label: "Dobavljači", desc: "Ukupno po dobavljaču, stanje, naplate po periodu" },
  { value: "klijenti", label: "Klijenti (naručioci)", desc: "Projekti, naplate, potraživanja" },
  { value: "banka", label: "Banka", desc: "Troškovi banke – provizije, održavanje, SWIFT" },
  { value: "fakture", label: "Fakture i naplate", desc: "Fakturirano / naplaćeno po periodu" },
  { value: "fiksni", label: "Fiksni troškovi", desc: "Fiksni vs prihod vs ukupni troškovi" },
  { value: "projekti", label: "Projekti", desc: "Pregled projekata po statusu, vrijednosti" },
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

function formatNum(x) {
  if (x == null || x === "") return "—";
  const n = Number(x);
  return Number.isFinite(n) ? n.toLocaleString("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(x);
}

export default function SviIzvjestajiClient() {
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
      if (!res.ok) throw new Error(json?.error || "Greška pri učitavanju");
      setData(json);
    } catch (err) {
      setError(err?.message || "Greška");
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
      const headers = ["Broj fakture", "Datum izd.", "Datum dosp.", "Naručilac", "Iznos (BAM)", "Dana kašnjenja", "Bucket"];
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
        Filter izvještaja
      </div>

      <form onSubmit={handleGenerisi}>
        <div className="field" style={{ marginBottom: 20 }}>
          <label className="label">Šta te interesuje?</label>
          <select
            value={tip}
            onChange={(e) => { setTip(e.target.value); setData(null); setError(""); }}
            className="input"
            style={{ maxWidth: 500 }}
            required
          >
            <option value="">— Izaberi tip izvještaja —</option>
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
            <label className="label">Datum od (opciono)</label>
            <input
              type="date"
              value={datumOd}
              onChange={(e) => setDatumOd(e.target.value)}
              className="input"
            />
          </div>
          <div className="field">
            <label className="label">Datum do (opciono)</label>
            <input
              type="date"
              value={datumDo}
              onChange={(e) => setDatumDo(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 20 }}>
          Ako ne uneseš datume, povući će se svi dostupni podaci za izabrani tip.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" className="btn" style={{ fontWeight: 700 }} disabled={loading}>
            {loading ? "Učitavam…" : "Generiši izvještaj"}
          </button>
        </div>
      </form>

      {data?.ok && hasApi && (
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <button type="button" className="btn" onClick={handleExportExcel} style={{ fontWeight: 600 }}>
            Export u Excel
          </button>
          <span style={{ marginLeft: 12, fontSize: 13, opacity: 0.85 }}>
            Preuzmi trenutni izvještaj kao .xlsx za knjigovođu ili arhivu.
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
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Izvještaj će se ovdje prikazati</div>
          <p style={{ fontSize: 13, opacity: 0.9 }}>
            Tip: <strong>{TIP_OPCIJE.find((o) => o.value === data.tip)?.label ?? data.tip}</strong>
            {(data.datumOd || data.datumDo) ? ` | Period: ${data.datumOd || "—"} do ${data.datumDo || "—"}` : " | Bez filtera datuma (svi podaci)"}
          </p>
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>
            Ovaj tip izvještaja još nije povezan s API-jem. Implementacija slijedi prema planu.
          </p>
        </div>
      )}

      {data?.ok && tip === "potrazivanja" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>Potraživanja (starenje)</div>
          {data.summary?.po_bucketu && (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
              {["0-30", "31-60", "61-90", "90+"].map((b) => (
                <span key={b} style={{ padding: "6px 12px", background: "rgba(0,0,0,0.05)", borderRadius: 6, fontSize: 13 }}>
                  {b} dana: <strong>{formatNum(data.summary.po_bucketu[b])}</strong> BAM
                </span>
              ))}
              <span style={{ padding: "6px 12px", background: "rgba(34,197,94,0.15)", borderRadius: 6, fontSize: 13 }}>
                Ukupno: <strong>{formatNum(data.summary.ukupno)}</strong> BAM
              </span>
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Broj fakture</th>
                  <th>Datum izd.</th>
                  <th>Datum dosp.</th>
                  <th>Naručilac</th>
                  <th>Iznos (BAM)</th>
                  <th>Dana kašnjenja</th>
                  <th>Bucket</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={row.faktura_id ?? i}>
                    <td>{row.broj_fakture ?? "—"}</td>
                    <td>{row.datum_izdavanja ?? "—"}</td>
                    <td>{row.datum_dospijeca ?? "—"}</td>
                    <td>{row.narucilac_naziv ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{formatNum(row.iznos_sa_pdv)}</td>
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
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>Lista izdatih faktura</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              Broj faktura: <strong>{data.summary.broj_faktura ?? 0}</strong>
              {" | "} Ukupno bez PDV: <strong>{formatNum(data.summary.ukupno_bez_pdv)}</strong> BAM
              {" | "} PDV: <strong>{formatNum(data.summary.ukupno_pdv)}</strong> BAM
              {" | "} Ukupno: <strong>{formatNum(data.summary.ukupno_sa_pdv)}</strong> BAM
              {(data.items || []).some((r) => r.iz_arhive) && (
                <span style={{ marginLeft: 12, color: "var(--muted)", fontSize: 12 }}>
                  (uključujući arhivu do 31.12.2025)
                </span>
              )}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Broj</th>
                  <th>Datum</th>
                  <th>Naručilac</th>
                  <th>Osnovica</th>
                  <th>PDV</th>
                  <th>Ukupno</th>
                  <th style={{ width: 72 }}>Izvor</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={row.faktura_id ?? `arhiva-${row.broj_fakture}-${row.datum_izdavanja}-${i}`}>
                    <td>{row.broj_fakture ?? "—"}</td>
                    <td>{row.datum_izdavanja ?? "—"}</td>
                    <td>{row.narucilac_naziv ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{formatNum(row.iznos_bez_pdv)}</td>
                    <td style={{ textAlign: "right" }}>{formatNum(row.pdv_iznos)}</td>
                    <td style={{ textAlign: "right" }}>{formatNum(row.iznos_sa_pdv)}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>
                      {row.iz_arhive ? "Arhiva" : "Live"}
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
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>Knjiga prihoda</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              Broj stavki: <strong>{data.summary.broj_stavki ?? 0}</strong>
              {" | "} Ukupno osnovica: <strong>{formatNum(data.summary.ukupno_osnovica)}</strong> BAM
              {" | "} Ukupno PDV: <strong>{formatNum(data.summary.ukupno_pdv)}</strong> BAM
              {" | "} Ukupno: <strong>{formatNum(data.summary.ukupno_sve)}</strong> BAM
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Broj fakture</th>
                  <th>Kupac</th>
                  <th>Osnovica</th>
                  <th>PDV</th>
                  <th>Ukupno</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={i}>
                    <td>{row.datum ?? "—"}</td>
                    <td>{row.broj_fakture ?? "—"}</td>
                    <td>{row.kupac ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{formatNum(row.osnovica)}</td>
                    <td style={{ textAlign: "right" }}>{formatNum(row.pdv)}</td>
                    <td style={{ textAlign: "right" }}>{formatNum(row.ukupno)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.ok && tip === "pdv" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>Pregled PDV-a</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              PDV izlazni ukupno: <strong>{formatNum(data.summary.pdv_izlazni_ukupno)}</strong> BAM
              {" | "} Osnovica ukupno: <strong>{formatNum(data.summary.osnovica_ukupno)}</strong> BAM
              {(data.items || []).some((r) => r.iz_arhive) && (
                <span style={{ marginLeft: 12, color: "var(--muted)", fontSize: 12 }}>Uključena arhiva (do 31.12.2025).</span>
              )}
              {data.summary.napomena && (
                <p style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>{data.summary.napomena}</p>
              )}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", minWidth: 320 }}>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Osnovica</th>
                  <th>PDV izlazni</th>
                  <th style={{ width: 72 }}>Izvor</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={i}>
                    <td>{row.datum ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{formatNum(row.osnovica)}</td>
                    <td style={{ textAlign: "right" }}>{formatNum(row.pdv_izlazni)}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>
                      {row.iz_arhive ? "Arhiva" : "Live"}
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
          id: "ID",
          po: "PO",
          naziv: "Radni naziv",
          status: "Status",
          narucilac: "Naručilac",
          rok: "Rok",
          budzet: "Budžet",
          troskovi: "Troškovi",
          zarada: "Planirana zarada",
        };
        const currentVisible = visibleColumns.projekti || projektiColumns;
        const columnMap = {
          id: { key: "projekat_id", align: "left" },
          po: { key: "id_po", align: "left" },
          naziv: { key: "radni_naziv", align: "left", wrap: true },
          status: { key: "status_naziv", align: "left" },
          narucilac: { key: "narucilac_naziv", align: "left", wrap: true },
          rok: { key: "rok_glavni", align: "left" },
          budzet: { key: "budzet_planirani", align: "right", format: formatNum },
          troskovi: { key: "troskovi_ukupno", align: "right", format: formatNum },
          zarada: { key: "planirana_zarada", align: "right", format: formatNum },
        };
        return (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Projekti</div>
              <ColumnPicker
                columns={projektiColumns}
                columnLabels={projektiLabels}
                visibleColumns={currentVisible}
                onChange={(cols) => setVisibleColumns({ ...visibleColumns, projekti: cols })}
              />
            </div>
            {data.summary && (
              <div style={{ marginBottom: 16, fontSize: 13 }}>
                Broj projekata: <strong>{data.summary.broj_projekata ?? 0}</strong>
                {" | "} Ukupno budžet: <strong>{formatNum(data.summary.ukupno_budzet)}</strong> BAM
                {" | "} Ukupno troškovi: <strong>{formatNum(data.summary.ukupno_troskovi)}</strong> BAM
                {" | "} Planirana zarada: <strong>{formatNum(data.summary.ukupno_planirana_zarada)}</strong> BAM
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
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatNum(row.budzet_planirani)}</td>
                      )}
                      {currentVisible.includes("troskovi") && (
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatNum(row.troskovi_ukupno)}</td>
                      )}
                      {currentVisible.includes("zarada") && (
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatNum(row.planirana_zarada)}</td>
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
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>Talenti</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              Broj talenata: <strong>{data.summary.broj_talenta ?? 0}</strong>
              {" | "} Ukupno troškova: <strong>{formatNum(data.summary.ukupno_troskova)}</strong> BAM
              {" | "} Ukupno plaćeno: <strong>{formatNum(data.summary.ukupno_placeno)}</strong> BAM
              {" | "} Ukupno stanje: <strong>{formatNum(data.summary.ukupno_stanje)}</strong> BAM
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="report-table" style={{ width: "100%", minWidth: 800 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ime i prezime</th>
                  <th>Vrsta</th>
                  <th>Email</th>
                  <th>Telefon</th>
                  <th style={{ textAlign: "right" }}>Ukupno troškova</th>
                  <th style={{ textAlign: "right" }}>Plaćeno</th>
                  <th style={{ textAlign: "right" }}>Stanje</th>
                  <th style={{ textAlign: "right" }}>Broj projekata</th>
                  <th style={{ textAlign: "right" }}>Broj troškova</th>
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
                      {formatNum(row.ukupno_troskova)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatNum(row.ukupno_placeno)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: row.stanje > 0 ? 700 : 400,
                        color: row.stanje > 0 ? "#b91c1c" : row.stanje < 0 ? "#059669" : "inherit",
                      }}
                    >
                      {formatNum(row.stanje)}
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
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>Dobavljači</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              Broj dobavljača: <strong>{data.summary.broj_dobavljaca ?? 0}</strong>
              {" | "} Ukupno troškova: <strong>{formatNum(data.summary.ukupno_troskova)}</strong> BAM
              {" | "} Ukupno plaćeno: <strong>{formatNum(data.summary.ukupno_placeno)}</strong> BAM
              {" | "} Ukupno stanje: <strong>{formatNum(data.summary.ukupno_stanje)}</strong> BAM
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="report-table" style={{ width: "100%", minWidth: 900 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Naziv</th>
                  <th>Vrsta</th>
                  <th>Email</th>
                  <th>Telefon</th>
                  <th>Grad</th>
                  <th>Država</th>
                  <th style={{ textAlign: "right" }}>Ukupno troškova</th>
                  <th style={{ textAlign: "right" }}>Plaćeno</th>
                  <th style={{ textAlign: "right" }}>Stanje</th>
                  <th style={{ textAlign: "right" }}>Broj projekata</th>
                  <th style={{ textAlign: "right" }}>Broj troškova</th>
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
                      {formatNum(row.ukupno_troskova)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatNum(row.ukupno_placeno)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: row.stanje > 0 ? 700 : 400,
                        color: row.stanje > 0 ? "#b91c1c" : row.stanje < 0 ? "#059669" : "inherit",
                      }}
                    >
                      {formatNum(row.stanje)}
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
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>Klijenti (naručioci)</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              Broj klijenata: <strong>{data.summary.broj_klijenata ?? 0}</strong>
              {" | "} Ukupno projekata: <strong>{data.summary.ukupno_broj_projekata ?? 0}</strong>
              {" | "} Ukupno budžet projekata: <strong>{formatNum(data.summary.ukupno_budzet_projekata)}</strong> BAM
              {" | "} Ukupno faktura: <strong>{data.summary.ukupno_broj_faktura ?? 0}</strong>
              {" | "} Fakturisano: <strong>{formatNum(data.summary.ukupno_fakturisano)}</strong> BAM
              {" | "} Naplaćeno: <strong>{formatNum(data.summary.ukupno_naplaceno)}</strong> BAM
              {" | "} Potraživanja: <strong>{formatNum(data.summary.ukupno_potrazivanja)}</strong> BAM
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
                  <th>ID</th>
                  <th>Naziv</th>
                  <th style={{ textAlign: "right" }}>Broj projekata</th>
                  <th style={{ textAlign: "right" }}>Budžet projekata</th>
                  <th style={{ textAlign: "right" }}>Broj faktura</th>
                  <th style={{ textAlign: "right" }}>Fakturisano</th>
                  <th style={{ textAlign: "right" }}>Naplaćeno</th>
                  <th style={{ textAlign: "right" }}>Potraživanja</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((row, i) => (
                  <tr key={row.klijent_id ?? i}>
                    <td>{row.klijent_id ?? "—"}</td>
                    <td className="wrap">{row.naziv_klijenta ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{row.broj_projekata ?? 0}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatNum(row.ukupno_budzet_projekata)}
                    </td>
                    <td style={{ textAlign: "right" }}>{row.broj_faktura ?? 0}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatNum(row.ukupno_fakturisano)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatNum(row.ukupno_naplaceno)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: row.potrazivanja > 0 ? 700 : 400,
                        color: row.potrazivanja > 0 ? "#b91c1c" : "inherit",
                      }}
                    >
                      {formatNum(row.potrazivanja)}
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
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>Troškovi banke</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              Broj stavki: <strong>{data.summary.broj_stavki ?? 0}</strong>
              {" | "} Ukupno troškova: <strong>{formatNum(data.summary.ukupno_troskova)}</strong> BAM
              {data.summary.po_tipu && Object.keys(data.summary.po_tipu).length > 0 && (
                <>
                  {" | "}
                  {Object.entries(data.summary.po_tipu).map(([tip, iznos], idx) => (
                    <span key={tip}>
                      {idx > 0 ? " | " : ""}
                      {tip}: <strong>{formatNum(iznos)}</strong> BAM
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
                  <th>Datum</th>
                  <th>Opis</th>
                  <th>Kategorija</th>
                  <th>Projekat</th>
                  <th style={{ textAlign: "right" }}>Iznos (BAM)</th>
                  <th>Valuta</th>
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
                      {formatNum(row.iznos_km)}
                    </td>
                    <td>{row.valuta_original ?? "BAM"}</td>
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
              Broj faktura: <strong>{data.summary.broj_faktura ?? 0}</strong>
              {" | "} Ukupno fakturisano: <strong>{formatNum(data.summary.ukupno_fakturisano)}</strong> BAM
              {" | "} Naplaćeno: <strong>{formatNum(data.summary.ukupno_naplaceno)}</strong> BAM
              {" | "} Neplaćeno: <strong>{formatNum(data.summary.ukupno_neplaceno)}</strong> BAM
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
                  <th>Broj fakture</th>
                  <th>Datum izdavanja</th>
                  <th>Datum dospijeća</th>
                  <th>Naručilac</th>
                  <th>Osnovica (bez PDV)</th>
                  <th>PDV</th>
                  <th>Ukupno (sa PDV)</th>
                  <th>Valuta</th>
                  <th>Naplćeno</th>
                  <th>Neplaćeno</th>
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
                      {formatNum(row.iznos_bez_pdv)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatNum(row.pdv_iznos)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {formatNum(row.iznos_sa_pdv)}
                    </td>
                    <td>{row.valuta ?? "BAM"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#059669" }}>
                      {formatNum(row.naplaceno)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#dc2626" }}>
                      {formatNum(row.neplaceno)}
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
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>Fiksni troškovi</div>
          {data.summary && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              Broj fiksnih troškova: <strong>{data.summary.broj_fiksnih_troskova ?? 0}</strong>
              {" | "} Ukupno fiksnih troškova: <strong>{formatNum(data.summary.ukupno_fiksnih_troskova)}</strong> BAM
              {" | "} Ukupno projektnih troškova: <strong>{formatNum(data.summary.ukupno_projektnih_troskova)}</strong> BAM
              {" | "} Ukupno troškova: <strong>{formatNum(data.summary.ukupno_troskova)}</strong> BAM
              {" | "} Ukupno prihoda: <strong>{formatNum(data.summary.ukupno_prihoda)}</strong> BAM
              {" | "} Razlika (Prihodi - Troškovi): <strong style={{ color: data.summary.razlika >= 0 ? "#059669" : "#dc2626" }}>{formatNum(data.summary.razlika)}</strong> BAM
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
                  <th>ID</th>
                  <th>Naziv troška</th>
                  <th>Frekvencija</th>
                  <th>Dan u mjesecu</th>
                  <th>Datum dospijeća</th>
                  <th>Zadnje plaćeno</th>
                  <th>Iznos</th>
                  <th>Iznos (BAM)</th>
                  <th>Valuta</th>
                  <th>Način plaćanja</th>
                  <th>Aktivan</th>
                  <th>Napomena</th>
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
                      {formatNum(row.iznos)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {formatNum(row.iznos_km)}
                    </td>
                    <td>{row.valuta ?? "BAM"}</td>
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
