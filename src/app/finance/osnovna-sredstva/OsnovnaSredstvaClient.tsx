"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatAmount } from "@/lib/format";
import { 
  Laptop, 
  Monitor, 
  Headphones, 
  Car, 
  Plus, 
  Printer, 
  Trash2, 
  Edit, 
  CheckCircle, 
  AlertCircle,
  TrendingDown,
  ShieldCheck
} from "lucide-react";

interface OsnovnoSredstvo {
  id: number;
  naziv: string;
  kategorija: "IT_RACUNARI" | "AUDIO_STUDIO" | "TERENSKA_MJERENJE" | "VOZILO" | "OSTALO";
  serijski_broj: string | null;
  datum_nabavke: string;
  nabavna_vrijednost_km: number;
  stopa_amortizacije: number;
  godisnji_otpis_km: number;
  amortizacija_za_godinu_km: number;
  akumulirana_amortizacija_km: number;
  sadasnja_vrijednost_km: number;
  porijeklo: "LICNA_IMOVINA_UNOS" | "FAKTURA_DOBAVLJAC" | "UGOVOR_FIZICKO_LICE";
  opis_namjene: string | null;
  status: "U_UPOTREBI" | "RASHODOVANO" | "PRODATO";
}

interface Summary {
  ukupno_nabavna_km: number;
  ukupno_godisnja_amortizacija_km: number;
  ukupno_sadasnja_vrijednost_km: number;
  broj_sredstava: number;
}

export default function OsnovnaSredstvaClient() {
  const [items, setItems] = useState<OsnovnoSredstvo[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OsnovnoSredstvo | null>(null);
  const [form, setForm] = useState({
    naziv: "",
    kategorija: "IT_RACUNARI",
    serijski_broj: "",
    datum_nabavke: new Date().toISOString().slice(0, 10),
    nabavna_vrijednost_km: "",
    stopa_amortizacije: "20.00",
    porijeklo: "LICNA_IMOVINA_UNOS",
    opis_namjene: "",
    status: "U_UPOTREBI",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/finance/osnovna-sredstva?year=${selectedYear}`);
      const json = await res.json();
      if (json.ok) {
        setItems(json.items || []);
        setSummary(json.summary || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setForm({
      naziv: "",
      kategorija: "IT_RACUNARI",
      serijski_broj: "",
      datum_nabavke: `${selectedYear}-01-15`,
      nabavna_vrijednost_km: "",
      stopa_amortizacije: "20.00",
      porijeklo: "LICNA_IMOVINA_UNOS",
      opis_namjene: "",
      status: "U_UPOTREBI",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: OsnovnoSredstvo) => {
    setEditingItem(item);
    setForm({
      naziv: item.naziv,
      kategorija: item.kategorija,
      serijski_broj: item.serijski_broj || "",
      datum_nabavke: String(item.datum_nabavke).slice(0, 10),
      nabavna_vrijednost_km: String(item.nabavna_vrijednost_km),
      stopa_amortizacije: String(item.stopa_amortizacije),
      porijeklo: item.porijeklo,
      opis_namjene: item.opis_namjene || "",
      status: item.status,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Da li ste sigurni da želite obrisati ovo osnovno sredstvo?")) return;
    try {
      const res = await fetch(`/api/finance/osnovna-sredstva?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        id: editingItem ? editingItem.id : undefined,
      };
      const res = await fetch("/api/finance/osnovna-sredstva", {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        setModalOpen(false);
        fetchData();
      } else {
        alert(json.error || "Greška pri čuvanju.");
      }
    } catch (err: any) {
      alert(err?.message || "Greška.");
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (activeCategory === "ALL") return true;
    return item.kategorija === activeCategory;
  });

  const getKategorijaIcon = (kat: string) => {
    switch (kat) {
      case "IT_RACUNARI": return <Monitor className="w-4 h-4 text-blue-400" />;
      case "AUDIO_STUDIO": return <Headphones className="w-4 h-4 text-purple-400" />;
      case "TERENSKA_MJERENJE": return <Laptop className="w-4 h-4 text-emerald-400" />;
      case "VOZILO": return <Car className="w-4 h-4 text-amber-400" />;
      default: return <Monitor className="w-4 h-4 text-slate-400" />;
    }
  };

  const getKategorijaLabel = (kat: string) => {
    switch (kat) {
      case "IT_RACUNARI": return "IT & Računari";
      case "AUDIO_STUDIO": return "Audio & Studio";
      case "TERENSKA_MJERENJE": return "Terenska & Mjerenje";
      case "VOZILO": return "Vozilo";
      default: return "Ostalo";
    }
  };

  const getPorijekloLabel = (p: string) => {
    switch (p) {
      case "LICNA_IMOVINA_UNOS": return "Unos lične imovine s.p.";
      case "FAKTURA_DOBAVLJAC": return "Faktura dobavljača";
      case "UGOVOR_FIZICKO_LICE": return "Ugovor (fizičko lice/OLX)";
      default: return p;
    }
  };

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", paddingBottom: 40 }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            🖥️ Osnovna Sredstva & Oprema (Knjiga DI-1)
          </h1>
          <p className="subtle" style={{ margin: "4px 0 0 0", fontSize: 14 }}>
            Evidencija profesionalne opreme, računara, mjernih sistema i automatski obračun amortizacije (20%) za PURS.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="input"
            style={{ width: 110, fontWeight: 700 }}
          >
            <option value={2026}>2026. g</option>
            <option value={2025}>2025. g</option>
            <option value={2024}>2024. g</option>
          </select>

          <button 
            onClick={() => setDecisionModalOpen(true)}
            className="btn"
            style={{ display: "flex", alignItems: "center", gap: 6, borderColor: "#38bdf8", color: "#38bdf8" }}
          >
            <Printer className="w-4 h-4" /> Odluka o unošenju imovine
          </button>

          <button 
            onClick={handleOpenAdd}
            className="btn btn--active"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus className="w-4 h-4" /> Novo sredstvo / oprema
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 18, borderLeft: "4px solid #3b82f6" }}>
          <div className="subtle" style={{ fontSize: 13, marginBottom: 4 }}>Ukupna Nabavna Vrijednost</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#93c5fd" }}>
            {formatAmount(summary?.ukupno_nabavna_km || 0, "sr")} KM
          </div>
          <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
            {summary?.broj_sredstava || 0} popisanih stavki opreme
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #10b981" }}>
          <div className="subtle" style={{ fontSize: 13, marginBottom: 4 }}>Godišnja Amortizacija ({selectedYear})</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#6ee7b7" }}>
            {formatAmount(summary?.ukupno_godisnja_amortizacija_km || 0, "sr")} KM
          </div>
          <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
            Priznati poreski rashod u Obrascu 1006 (Tab. 8)
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #8b5cf6" }}>
          <div className="subtle" style={{ fontSize: 13, marginBottom: 4 }}>Knjigovodstvena Vrijednost (Kraj {selectedYear})</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#c4b5fd" }}>
            {formatAmount(summary?.ukupno_sadasnja_vrijednost_km || 0, "sr")} KM
          </div>
          <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
            Preostala neotpisana vrijednost
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #f59e0b" }}>
          <div className="subtle" style={{ fontSize: 13, marginBottom: 4 }}>Poreska Ušteda (10% na amortizaciju)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fcd34d" }}>
            {formatAmount((summary?.ukupno_godisnja_amortizacija_km || 0) * 0.10, "sr")} KM
          </div>
          <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
            Direktno manji porez na dohodak
          </div>
        </div>
      </div>

      {/* Categories Filter Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {[
          { key: "ALL", label: "Sva sredstva" },
          { key: "IT_RACUNARI", label: "IT & Računari" },
          { key: "TERENSKA_MJERENJE", label: "Terenska & Mjerenje" },
          { key: "AUDIO_STUDIO", label: "Audio & Studio" },
          { key: "VOZILO", label: "Vozila" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveCategory(tab.key)}
            className={`btn ${activeCategory === tab.key ? "btn--active" : ""}`}
            style={{ padding: "6px 14px", fontSize: 13 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Assets Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Naziv Sredstva / Opreme</th>
                <th>Kategorija</th>
                <th>Porijeklo</th>
                <th>Datum Nabavke</th>
                <th style={{ textAlign: "right" }}>Nabavna Vrijednost</th>
                <th style={{ textAlign: "center" }}>Stopa</th>
                <th style={{ textAlign: "right" }}>Amortizacija ({selectedYear})</th>
                <th style={{ textAlign: "right" }}>Sadašnja Vrijednost</th>
                <th style={{ width: 100, textAlign: "center" }}>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 30 }} className="subtle">
                    Učitavanje osnovnih sredstava...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 30 }} className="subtle">
                    Nema unijetih osnovnih sredstava u ovoj kategoriji.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="subtle">{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{item.naziv}</div>
                      {item.serijski_broj && (
                        <div className="subtle" style={{ fontSize: 12 }}>
                          S/N: <code>{item.serijski_broj}</code>
                        </div>
                      )}
                      {item.opis_namjene && (
                        <div className="subtle" style={{ fontSize: 11, color: "var(--muted)" }}>
                          {item.opis_namjene}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        {getKategorijaIcon(item.kategorija)}
                        {getKategorijaLabel(item.kategorija)}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ fontSize: 11 }}>
                        {getPorijekloLabel(item.porijeklo)}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {String(item.datum_nabavke).slice(0, 10).split("-").reverse().join(".")}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {formatAmount(item.nabavna_vrijednost_km, "sr")} KM
                    </td>
                    <td style={{ textAlign: "center", fontSize: 12 }}>
                      {item.stopa_amortizacije}%
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#6ee7b7" }}>
                      {formatAmount(item.amortizacija_za_godinu_km, "sr")} KM
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {formatAmount(item.sadasnja_vrijednost_km, "sr")} KM
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="btn"
                          style={{ padding: "4px 8px", fontSize: 11 }}
                          title="Izmijeni"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="btn"
                          style={{ padding: "4px 8px", fontSize: 11, color: "#ef4444" }}
                          title="Obriši"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Unos / Izmjena */}
      {modalOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 600, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                {editingItem ? "Izmjena osnovnog sredstva" : "Unos novog osnovnog sredstva"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="btn" style={{ padding: "4px 8px" }}>✕</button>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="subtle" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Naziv opreme / sredstva *</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={form.naziv}
                  onChange={(e) => setForm({ ...form, naziv: e.target.value })}
                  placeholder="npr. Laptop HP Omen 16, DAW Radna Stanica..."
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="subtle" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Kategorija</label>
                  <select
                    className="input"
                    value={form.kategorija}
                    onChange={(e) => setForm({ ...form, kategorija: e.target.value as any })}
                    style={{ width: "100%" }}
                  >
                    <option value="IT_RACUNARI">IT & Računari</option>
                    <option value="TERENSKA_MJERENJE">Terenska & Mjerenje</option>
                    <option value="AUDIO_STUDIO">Audio & Studio</option>
                    <option value="VOZILO">Vozilo</option>
                    <option value="OSTALO">Ostalo</option>
                  </select>
                </div>

                <div>
                  <label className="subtle" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Serijski broj (S/N)</label>
                  <input
                    type="text"
                    className="input"
                    value={form.serijski_broj}
                    onChange={(e) => setForm({ ...form, serijski_broj: e.target.value })}
                    placeholder="npr. 5CD2341XYZ"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="subtle" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Datum nabavke *</label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={form.datum_nabavke}
                    onChange={(e) => setForm({ ...form, datum_nabavke: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label className="subtle" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Porijeklo / Pravni osnov</label>
                  <select
                    className="input"
                    value={form.porijeklo}
                    onChange={(e) => setForm({ ...form, porijeklo: e.target.value as any })}
                    style={{ width: "100%" }}
                  >
                    <option value="LICNA_IMOVINA_UNOS">Unos lične imovine vlasnika u s.p.</option>
                    <option value="FAKTURA_DOBAVLJAC">Faktura dobavljača na firmu</option>
                    <option value="UGOVOR_FIZICKO_LICE">Ugovor o kupovini (fizičko lice / OLX)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="subtle" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Nabavna vrijednost (KM) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input"
                    value={form.nabavna_vrijednost_km}
                    onChange={(e) => setForm({ ...form, nabavna_vrijednost_km: e.target.value })}
                    placeholder="0.00"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label className="subtle" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Stopa amortizacije (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    value={form.stopa_amortizacije}
                    onChange={(e) => setForm({ ...form, stopa_amortizacije: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div>
                <label className="subtle" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Opis namjene u poslovanju</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.opis_namjene}
                  onChange={(e) => setForm({ ...form, opis_namjene: e.target.value })}
                  placeholder="npr. Glavni računar za višekanalno zvučno snimanje i terensko mjerenje..."
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn">
                  Odustani
                </button>
                <button type="submit" disabled={saving} className="btn btn--active">
                  {saving ? "Čuvanje..." : "Sačuvaj sredstvo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Odluka o unošenju lične opreme (Pravni dokument za štampu) */}
      {decisionModalOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 20
        }}>
          <div className="card" style={{ maxWidth: 850, width: "100%", maxHeight: "95vh", overflowY: "auto", background: "#fff", color: "#111" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#1f2937" }}>
                📄 Zvanični pravni dokument: Odluka o unošenju lične opreme u s.p.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  onClick={() => window.print()} 
                  className="btn btn--active"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Printer className="w-4 h-4" /> Štampaj / Sačuvaj PDF
                </button>
                <button onClick={() => setDecisionModalOpen(false)} className="btn">✕ Zatvori</button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div id="odluka-print" style={{ padding: "20px 30px", fontSize: 14, lineHeight: 1.6, fontFamily: "serif" }}>
              <div style={{ textAlign: "center", marginBottom: 25 }}>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  SAMOSTALNI PREDUZETNIK „STUDIO TAF”
                </h3>
                <div style={{ fontSize: 13 }}>Zelić Siniša s.p. Banja Luka | JIB: 4509750610000 | JMBG: 1408964100023</div>
                <div style={{ fontSize: 12, color: "#4b5563" }}>Djelatnost: Usluge zvučnog snimanja, emitovanja i mjerenja</div>
              </div>

              <div style={{ borderBottom: "2px solid #111", marginBottom: 20 }} />

              <div style={{ textAlign: "right", marginBottom: 20, fontSize: 13 }}>
                Broj: <strong>OD-OS/{selectedYear}-01</strong><br />
                Datum: <strong>31.12.{selectedYear}. godine</strong><br />
                Mjesto: Banja Luka
              </div>

              <p style={{ textAlign: "justify", textIndent: 30 }}>
                Na osnovu člana 15. Zakona o zanatsko-preduzetničkoj djelatnosti Republike Srpske i člana 18. Zakona o porezu na dohodak Republike Srpske, vlasnik samostalne preduzetničke radnje donosi:
              </p>

              <h2 style={{ textAlign: "center", margin: "25px 0", fontSize: 17, textTransform: "uppercase" }}>
                O D L U K U<br />
                <span style={{ fontSize: 14, fontWeight: "normal" }}>o unošenju lične opreme i osnovnih sredstava u funkciju poslovanja radnje</span>
              </h2>

              <p style={{ textAlign: "justify", textIndent: 30 }}>
                <strong>Član 1.</strong><br />
                U poslovanje samostalne preduzetničke radnje <strong>„Studio TAF” – Zelić Siniša s.p. Banja Luka</strong> (JIB: 4509750610000), u svrhu obavljanja registrovane privredne djelatnosti zvučnog snimanja, audio produkcije i automatskog mjerenja sportskih takmičenja, unosi se sljedeća oprema i osnovna sredstva u vlasništvu osnivača:
              </p>

              <table style={{ width: "100%", borderCollapse: "collapse", margin: "16px 0", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th style={{ border: "1px solid #9ca3af", padding: "6px 8px", textAlign: "center" }}>R.br.</th>
                    <th style={{ border: "1px solid #9ca3af", padding: "6px 8px", textAlign: "left" }}>Naziv opreme i specifikacija</th>
                    <th style={{ border: "1px solid #9ca3af", padding: "6px 8px", textAlign: "left" }}>Serijski broj (S/N)</th>
                    <th style={{ border: "1px solid #9ca3af", padding: "6px 8px", textAlign: "right" }}>Procijenjena / Nabavna vr. (KM)</th>
                    <th style={{ border: "1px solid #9ca3af", padding: "6px 8px", textAlign: "center" }}>Amort. %</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.id}>
                      <td style={{ border: "1px solid #9ca3af", padding: "6px 8px", textAlign: "center" }}>{idx + 1}.</td>
                      <td style={{ border: "1px solid #9ca3af", padding: "6px 8px" }}>
                        <strong>{it.naziv}</strong>
                        {it.opis_namjene && <div style={{ fontSize: 11, color: "#4b5563" }}>{it.opis_namjene}</div>}
                      </td>
                      <td style={{ border: "1px solid #9ca3af", padding: "6px 8px" }}>{it.serijski_broj || "—"}</td>
                      <td style={{ border: "1px solid #9ca3af", padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>
                        {formatAmount(it.nabavna_vrijednost_km, "sr")}
                      </td>
                      <td style={{ border: "1px solid #9ca3af", padding: "6px 8px", textAlign: "center" }}>{it.stopa_amortizacije}%</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f9fafb", fontWeight: "bold" }}>
                    <td colSpan={3} style={{ border: "1px solid #9ca3af", padding: "8px", textAlign: "right" }}>
                      UKUPNA VRIJEDNOST UNESENE OPREME:
                    </td>
                    <td style={{ border: "1px solid #9ca3af", padding: "8px", textAlign: "right" }}>
                      {formatAmount(summary?.ukupno_nabavna_km || 0, "sr")} KM
                    </td>
                    <td style={{ border: "1px solid #9ca3af" }} />
                  </tr>
                </tbody>
              </table>

              <p style={{ textAlign: "justify", textIndent: 30 }}>
                <strong>Član 2.</strong><br />
                Sva navedena oprema unosi se u Knjigu osnovnih sredstava i sitnog inventara (Obrazac DI-1) radnje, te podliježe godišnjem obračunu amortizacije u skladu sa Zakonom o porezu na dohodak Republike Srpske po stopi od 20% godišnje.
              </p>

              <p style={{ textAlign: "justify", textIndent: 30 }}>
                <strong>Član 3.</strong><br />
                Ova Odluka stupa na snagu danom donošenja i predstavlja pravni osnov za knjiženje i priznavanje troškova poslovanja pred nadležnim organima Poreske uprave Republike Srpske.
              </p>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, paddingTop: 20 }}>
                <div>
                  M.P.
                </div>
                <div style={{ textAlign: "center" }}>
                  Vlasnik i ovlašteno lice:<br /><br /><br />
                  ___________________________________<br />
                  <strong>Siniša Zelić</strong>, s.p.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
