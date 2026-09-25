"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import FluxaLogo from "@/components/FluxaLogo";
import { ExportExcelButton } from "@/components/ExportExcelButton";

type MaliRacun = {
  id: number;
  broj_racuna: string;
  datum_racuna: string;
  dobavljac: string;
  kategorija: string;
  iznos_ukupno: number;
  iznos_osnovica: number | null;
  iznos_pdv: number | null;
  valuta: string;
  svrha: string | null;
  status_pravdanja: string;
  godina_obracuna: number;
  created_at: string;
};

const KATEGORIJE = [
  { id: "GORIVO", label: "⛽ Gorivo i prevoz", color: "#f59e0b" },
  { id: "POSTARINA", label: "📦 Poštarina i kuriri", color: "#38bdf8" },
  { id: "KANCELARIJA", label: "📎 Kancelarijski materijal", color: "#a855f7" },
  { id: "OPREMA", label: "🖥️ Oprema i sitan inventar", color: "#10b981" },
  { id: "REPREZENTACIJA", label: "☕ Reprezentacija & Sastanci", color: "#ec4899" },
  { id: "ODRZAVANJE", label: "🔧 Održavanje i sitne nabavke", color: "#6366f1" },
  { id: "TAKSE", label: "🏛️ Takse i administrativni troškovi", color: "#e2e8f0" },
  { id: "OSTALO", label: "📄 Ostali gotovinski troškovi", color: "#94a3b8" },
];

function getKatLabel(id: string): string {
  const found = KATEGORIJE.find((k) => k.id === id);
  return found ? found.label : id;
}

function getKatColor(id: string): string {
  const found = KATEGORIJE.find((k) => k.id === id);
  return found ? found.color : "#94a3b8";
}

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = String(iso).trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}.${match[2]}.${match[1]}.`;
  }
  return s;
}

export default function MaliRacuniPage() {
  const [items, setItems] = useState<MaliRacun[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    ukupnoIznos: number;
    poreskaUsteda10: number;
    brojRacuna: number;
    kategorijeStats: Record<string, number>;
  }>({
    ukupnoIznos: 0,
    poreskaUsteda10: 0,
    brojRacuna: 0,
    kategorijeStats: {},
  });

  const [selectedGodina, setSelectedGodina] = useState<string>("2026");
  const [selectedKategorija, setSelectedKategorija] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Partial<MaliRacun> | null>(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedGodina) params.set("godina", selectedGodina);
      if (selectedKategorija && selectedKategorija !== "ALL") params.set("kategorija", selectedKategorija);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/finance/mali-racuni?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setItems(data.items || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err: any) {
      showNotice("Greška pri učitavanju: " + err.message, "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedGodina, selectedKategorija]);

  function showNotice(text: string, type: "ok" | "err" = "ok") {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem?.broj_racuna || !editItem?.dobavljac || editItem?.iznos_ukupno === undefined) {
      alert("Molimo popunite obavezna polja (Broj računa, dobavljač, iznos).");
      return;
    }

    setSaving(true);
    try {
      const isEdit = !!editItem.id;
      const res = await fetch("/api/finance/mali-racuni", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editItem),
      });
      const data = await res.json();
      if (data.ok) {
        setShowModal(false);
        setEditItem(null);
        showNotice(isEdit ? "Račun uspješno ažuriran!" : "Mali račun uspješno unesen!");
        loadData();
      } else {
        alert(data.error || "Greška pri snimanju");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Da li ste sigurni da želite obrisati ovaj račun?")) return;
    try {
      const res = await fetch(`/api/finance/mali-racuni?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        showNotice("Račun obrisan.");
        loadData();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  function handlePrintSpecifikacija() {
    window.print();
  }

  return (
    <div className="container" style={{ paddingBottom: 40 }}>
      {/* HEADER */}
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">Mali Računi & Poresko Pravdanje Troškova</div>
                  <div className="brandSub">
                    Evidencija gotovinskih računa plaćenih ličnim novcem za knjigovodstvo i smanjenje poreza na dobit Studio TAF
                  </div>
                </div>
              </div>

              <div className="actions">
                <Link className="btn" href="/finance" title="Nazad na Analitiku">
                  📊 Analitika
                </Link>
                <Link className="btn" href="/dashboard" title="Dashboard">
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> Dashboard
                </Link>
              </div>
            </div>
            <div className="divider" />
          </div>
        </div>

        {/* NOTIFIKACIJA */}
        {notification && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 16px",
              borderRadius: 8,
              background: notification.type === "ok" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
              border: `1px solid ${notification.type === "ok" ? "#10b981" : "#ef4444"}`,
              color: notification.type === "ok" ? "#34d399" : "#f87171",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {notification.text}
          </div>
        )}

        {/* METRICS CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
          <div className="card" style={{ padding: "16px 20px", borderLeft: "4px solid #38bdf8" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
              🧾 Ukupno Prijavljenih Troškova ({selectedGodina})
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#38bdf8", marginTop: 4 }}>
              {stats.ukupnoIznos.toFixed(2)} KM
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              Osnov za pravdanje isplate dobiti sa računa
            </div>
          </div>

          <div className="card" style={{ padding: "16px 20px", borderLeft: "4px solid #10b981" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
              📉 Poreska Ušteda (10% Porez na dobit)
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#34d399", marginTop: 4 }}>
              ~{stats.poreskaUsteda10.toFixed(2)} KM
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              Direktno umanjenje poreske obaveze Studio TAF
            </div>
          </div>

          <div className="card" style={{ padding: "16px 20px", borderLeft: "4px solid #a855f7" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
              📊 Broj Fiskalnih Računa
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#c084fc", marginTop: 4 }}>
              {stats.brojRacuna} <span style={{ fontSize: 14, fontWeight: 500 }}>računa</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              Spremnih za predaju knjigovođi
            </div>
          </div>
        </div>

        {/* CONTROLS BAR */}
        <div className="card" style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setEditItem({
                    broj_racuna: "",
                    datum_racuna: new Date().toISOString().slice(0, 10),
                    dobavljac: "",
                    kategorija: "GORIVO",
                    iznos_ukupno: 50,
                    iznos_osnovica: null,
                    iznos_pdv: null,
                    valuta: "BAM",
                    svrha: "",
                    status_pravdanja: "SPREMNO_ZA_KNJIGOVOĐU",
                    godina_obracuna: Number(selectedGodina) || 2026,
                  });
                  setShowModal(true);
                }}
                className="btn btn--active"
                style={{ background: "#0284c7", color: "#fff", fontWeight: 800, padding: "8px 16px" }}
              >
                + Novi Mali Račun
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Godina:</span>
                <select
                  value={selectedGodina}
                  onChange={(e) => setSelectedGodina(e.target.value)}
                  className="input"
                  style={{ width: 90 }}
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Kategorija:</span>
                <select
                  value={selectedKategorija}
                  onChange={(e) => setSelectedKategorija(e.target.value)}
                  className="input"
                  style={{ minWidth: 160 }}
                >
                  <option value="ALL">Sve kategorije</option>
                  {KATEGORIJE.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                placeholder="Pretraga po broju, dobavljaču..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
                className="input"
                style={{ width: 220 }}
              />
              <button type="button" onClick={loadData} className="btn">
                Traži
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <ExportExcelButton
                filename={`Mali_Racuni_Studio_TAF_${selectedGodina}`}
                sheetName="Mali Računi"
                headers={["RB", "Datum", "Broj fiskalnog računa", "Dobavljač / Prodajno mjesto", "Kategorija", "Iznos KM", "Svrha za Studio TAF", "Status"]}
                rows={items.map((r, idx) => [
                  idx + 1,
                  formatDisplayDate(r.datum_racuna),
                  r.broj_racuna,
                  r.dobavljac,
                  getKatLabel(r.kategorija),
                  Number(r.iznos_ukupno).toFixed(2),
                  r.svrha || "Trošak poslovanja Studio TAF",
                  r.status_pravdanja,
                ])}
              />
              <button
                type="button"
                onClick={handlePrintSpecifikacija}
                className="btn"
                title="Odštampaj specifikaciju računa za knjigovođu"
              >
                🖨️ Štampaj Specifikaciju
              </button>
            </div>
          </div>
        </div>

        {/* TABELA RAČUNA */}
        <div className="card tableCard">
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>
              📋 Specifikacija gotovinskih računa za predaju knjigovođi ({items.length})
            </span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              Ukupno: <b style={{ color: "#38bdf8" }}>{stats.ukupnoIznos.toFixed(2)} KM</b>
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 45 }}>#</th>
                  <th style={{ width: 95 }}>Datum</th>
                  <th style={{ width: 140 }}>Broj Fiskalnog Računa</th>
                  <th>Dobavljač / Prodajno Mjesto</th>
                  <th style={{ width: 180 }}>Kategorija Troška</th>
                  <th>Svrha / Obrazloženje za Firmu</th>
                  <th className="num" style={{ width: 110 }}>Iznos (KM)</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 90, textAlign: "right" }}>Akcije</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: 30, color: "#64748b" }}>
                      {loading ? "Učitavanje..." : "Nema unesenih malih računa za izabrani filter. Kliknite '+ Novi Mali Račun' iznad."}
                    </td>
                  </tr>
                ) : (
                  items.map((r, idx) => {
                    const katColor = getKatColor(r.kategorija);
                    return (
                      <tr key={r.id}>
                        <td style={{ color: "#64748b" }}>{idx + 1}</td>
                        <td style={{ fontWeight: 700 }}>{formatDisplayDate(r.datum_racuna)}</td>
                        <td style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{r.broj_racuna}</td>
                        <td style={{ fontWeight: 700, color: "#f8fafc" }}>{r.dobavljac}</td>
                        <td>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 12,
                              background: `${katColor}18`,
                              color: katColor,
                              border: `1px solid ${katColor}44`,
                              fontWeight: 700,
                            }}
                          >
                            {getKatLabel(r.kategorija)}
                          </span>
                        </td>
                        <td style={{ color: "#cbd5e1" }}>{r.svrha || "—"}</td>
                        <td className="num" style={{ fontWeight: 900, color: "#38bdf8" }}>
                          {Number(r.iznos_ukupno).toFixed(2)} KM
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "#10b981",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              fontWeight: 700,
                            }}
                          >
                            {r.status_pravdanja === "SPREMNO_ZA_KNJIGOVOĐU" ? "Spremno" : r.status_pravdanja}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditItem(r);
                                setShowModal(true);
                              }}
                              className="btn"
                              style={{ padding: "2px 6px", fontSize: 11 }}
                            >
                              Uredi
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(r.id)}
                              className="btn"
                              style={{ padding: "2px 6px", fontSize: 11, color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL ZA UNOS / IZMJENU RAČUNA */}
      {showModal && editItem && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#0f172a", border: "1px solid #38bdf8", borderRadius: 12, padding: 24, width: 500, maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 16px", color: "#f8fafc" }}>
              {editItem.id ? "Izmijeni Mali Račun" : "Novi Gotovinski Račun (za Knjigovodstvo)"}
            </h3>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Broj fiskalnog / BI računa *</label>
                  <input
                    type="text"
                    required
                    placeholder="npr. 1234/26 ili BI: 98765"
                    value={editItem.broj_racuna || ""}
                    onChange={(e) => setEditItem({ ...editItem, broj_racuna: e.target.value })}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Datum računa *</label>
                  <input
                    type="date"
                    required
                    value={editItem.datum_racuna || ""}
                    onChange={(e) => setEditItem({ ...editItem, datum_racuna: e.target.value })}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Dobavljač / Prodajno mjesto *</label>
                <input
                  type="text"
                  required
                  placeholder="npr. Nestro Petrol, Pošte Srpske, OBI, Gigatron..."
                  value={editItem.dobavljac || ""}
                  onChange={(e) => setEditItem({ ...editItem, dobavljac: e.target.value })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Kategorija troška</label>
                  <select
                    value={editItem.kategorija || "GORIVO"}
                    onChange={(e) => setEditItem({ ...editItem, kategorija: e.target.value })}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                  >
                    {KATEGORIJE.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Ukupan Iznos (KM) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={editItem.iznos_ukupno ?? ""}
                    onChange={(e) => setEditItem({ ...editItem, iznos_ukupno: Number(e.target.value) })}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Svrha / Zašto je trošak napravljen za firmu</label>
                <textarea
                  rows={3}
                  placeholder="npr. Gorivo za odlazak na snimanje spota, Poštarina za slanje ugovora, Kancelarijski papir i toneri..."
                  value={editItem.svrha || ""}
                  onChange={(e) => setEditItem({ ...editItem, svrha: e.target.value })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditItem(null);
                  }}
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#cbd5e1", padding: "8px 16px", borderRadius: 6, cursor: "pointer" }}
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ background: "#0284c7", color: "#fff", border: "none", padding: "8px 20px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}
                >
                  {saving ? "Snimanje..." : "Sačuvaj Račun"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
