"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatAmount } from "@/lib/format";

type MeetProject = {
  projekat_id: number;
  naziv_projekta: string;
  status_id?: number | null;
  status_name?: string | null;
  narucilac_id?: number | null;
  naziv_klijenta?: string | null;
  datum_pocetka?: string | null;
  datum_zavrsetka?: string | null;
  budzet_km?: number | null;
  napomena?: string | null;
  ukupno_troskovi_km?: number | null;
  faktura_id?: number | null;
  broj_fakture?: string | null;
  faktura_status_naplate?: string | null;
};

type CalendarItem = {
  kalendar_id: number;
  godina: number;
  naziv_takmicenja: string;
  klub_savez_id?: number | null;
  klub_savez_naziv?: string | null;
  lokacija_grad: string;
  bazen_naziv?: string | null;
  tip_lokacije: "DOMACI" | "TEREN_BLIZU" | "TEREN_DALEKO";
  datum_od: string;
  datum_do: string;
  datum_polaska?: string | null;
  datum_povratka?: string | null;
  broj_takmicarskih_dana: number;
  ukupno_blokiranih_dana: number;
  nocenja_broj: number;
  nocenje_pokriva: "ORGANIZATOR" | "STUDIO_TAF" | "BEZ_NOCENJA";
  nocenje_cijena_km: number;
  kilometraza_km: number;
  trosak_goriva_km: number;
  putarine_km: number;
  dnevnice_mjerioca_km: number;
  ugovoreni_pausal_km: number;
  neto_zarada_km: number;
  status: "PLANIRANO" | "POTVRDJENO" | "U_TOKU" | "ODRZANO" | "OBRADJENO" | "FAKTURISANO" | "NAPLACENO";
  napomena?: string | null;
  projekat_id?: number | null;
  broj_fakture?: string | null;
  faktura_status_naplate?: string | null;
};

type KlijentOption = {
  klijent_id: number;
  naziv_klijenta: string;
};

export default function MeetsClient({
  initialProjects,
  klijenti,
  locale = "sr",
}: {
  initialProjects: MeetProject[];
  klijenti: KlijentOption[];
  locale?: string;
}) {
  const [activeTab, setActiveTab] = useState<"KALENDAR" | "PROJEKTI">("KALENDAR");
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [loadingCal, setLoadingCal] = useState(false);

  const [search, setSearch] = useState("");
  const [isCalModalOpen, setIsCalModalOpen] = useState(false);

  // Modal Form State
  const [nazivTakmicenja, setNazivTakmicenja] = useState("");
  const [klubId, setKlubId] = useState("");
  const [lokacijaGrad, setLokacijaGrad] = useState("Trebinje");
  const [tipLokacije, setTipLokacije] = useState<"DOMACI" | "TEREN_BLIZU" | "TEREN_DALEKO">("TEREN_DALEKO");
  const [datumOd, setDatumOd] = useState("");
  const [datumDo, setDatumDo] = useState("");
  const [takmicarskihDana, setTakmicarskihDana] = useState(2);
  const [nocenjaBroj, setNocenjaBroj] = useState(2);
  const [nocenjePokriva, setNocenjePokriva] = useState<"ORGANIZATOR" | "STUDIO_TAF" | "BEZ_NOCENJA">("ORGANIZATOR");
  const [nocenjeCijena, setNocenjeCijena] = useState(0);
  const [km, setKm] = useState(720);
  const [gorivoKm, setGorivoKm] = useState(160);
  const [putarineKm, setPutarineKm] = useState(20);
  const [dnevniceKm, setDnevniceKm] = useState(200);
  const [pausalKm, setPausalKm] = useState(1200);
  const [napomenaCal, setNapomenaCal] = useState("Polazak dan prije u 11h. Spavanje poslije takmičenja radi sigurnosti u vožnji.");
  const [savingCal, setSavingCal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmtDate = (d?: string | null) => {
    if (!d) return "—";
    const s = String(d).slice(0, 10);
    const parts = s.split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return s;
  };

  const loadCalendar = async () => {
    setLoadingCal(true);
    try {
      const res = await fetch(`/api/meets/kalendar?godina=${selectedYear}`);
      const data = await res.json();
      if (data.ok) {
        setCalendarItems(data.rows ?? []);
      }
    } catch (e) {
      console.error("Greška pri učitavanju kalendara:", e);
    } finally {
      setLoadingCal(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [selectedYear]);

  // Brzi preset za lokacije
  const applyPreset = (preset: "TREBINJE" | "SARAJEVO" | "BANJALUKA" | "MOSTAR") => {
    if (preset === "BANJALUKA") {
      setLokacijaGrad("Banja Luka");
      setTipLokacije("DOMACI");
      setKm(0);
      setGorivoKm(0);
      setPutarineKm(0);
      setNocenjaBroj(0);
      setNocenjePokriva("BEZ_NOCENJA");
      setNapomenaCal("Domaći bazen GOB. Nema troškova puta i noćenja.");
    } else if (preset === "TREBINJE") {
      setLokacijaGrad("Trebinje");
      setTipLokacije("TEREN_DALEKO");
      setKm(720);
      setGorivoKm(160);
      setPutarineKm(20);
      setNocenjaBroj(2);
      setNocenjePokriva("ORGANIZATOR");
      setNapomenaCal("Polazak dan ranije u 11h poslije posla u Aquani. Noćna priprema na bazenu. Spavanje poslije takmičenja.");
    } else if (preset === "SARAJEVO") {
      setLokacijaGrad("Sarajevo (Otoka)");
      setTipLokacije("TEREN_DALEKO");
      setKm(400);
      setGorivoKm(100);
      setPutarineKm(15);
      setNocenjaBroj(2);
      setNocenjePokriva("ORGANIZATOR");
      setNapomenaCal("Polazak dan ranije popodne. Postavljanje opreme na Otoci.");
    } else if (preset === "MOSTAR") {
      setLokacijaGrad("Mostar");
      setTipLokacije("TEREN_DALEKO");
      setKm(480);
      setGorivoKm(120);
      setPutarineKm(15);
      setNocenjaBroj(2);
      setNocenjePokriva("ORGANIZATOR");
      setNapomenaCal("Polazak dan ranije. Noćenje poslije takmičenja.");
    }
  };

  const handleSaveCalendarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nazivTakmicenja.trim() || !datumOd || !datumDo) {
      setError("Naziv takmičenja i datumi (od/do) su obavezni.");
      return;
    }

    setSavingCal(true);
    setError(null);

    try {
      const selectedKlub = klijenti.find((k) => String(k.klijent_id) === String(klubId));
      const res = await fetch("/api/meets/kalendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          godina: selectedYear,
          naziv_takmicenja: nazivTakmicenja.trim(),
          klub_savez_id: klubId ? Number(klubId) : null,
          klub_savez_naziv: selectedKlub?.naziv_klijenta || null,
          lokacija_grad: lokacijaGrad.trim(),
          tip_lokacije: tipLokacije,
          datum_od: datumOd,
          datum_do: datumDo,
          broj_takmicarskih_dana: Number(takmicarskihDana),
          nocenja_broj: Number(nocenjaBroj),
          nocenje_pokriva: nocenjePokriva,
          nocenje_cijena_km: Number(nocenjeCijena),
          kilometraza_km: Number(km),
          trosak_goriva_km: Number(gorivoKm),
          putarine_km: Number(putarineKm),
          dnevnice_mjerioca_km: Number(dnevniceKm),
          ugovoreni_pausal_km: Number(pausalKm),
          napomena: napomenaCal.trim() || null,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Greška pri čuvanju.");

      setIsCalModalOpen(false);
      setNazivTakmicenja("");
      await loadCalendar();
    } catch (err: any) {
      setError(err?.message || "Došlo je do greške.");
    } finally {
      setSavingCal(false);
    }
  };

  const totalTakmicenjaCal = calendarItems.length;
  const totalUgovorenoCal = calendarItems.reduce((s, c) => s + (Number(c.ugovoreni_pausal_km) || 0), 0);
  const totalTroskoviCal = calendarItems.reduce(
    (s, c) =>
      s +
      (Number(c.trosak_goriva_km) || 0) +
      (Number(c.putarine_km) || 0) +
      (c.nocenje_pokriva === "STUDIO_TAF" ? Number(c.nocenja_broj) * Number(c.nocenje_cijena_km) : 0) +
      (Number(c.dnevnice_mjerioca_km) || 0),
    0,
  );
  const totalNetoCal = totalUgovorenoCal - totalTroskoviCal;
  const totalBlokiranihDana = calendarItems.reduce((s, c) => s + (Number(c.ukupno_blokiranih_dana) || 0), 0);

  return (
    <div>
      {/* TABS HEADER */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={`btn ${activeTab === "KALENDAR" ? "btn--active" : ""}`}
            onClick={() => setActiveTab("KALENDAR")}
            style={activeTab === "KALENDAR" ? { background: "#0284c7", borderColor: "#0284c7", fontWeight: 700 } : {}}
          >
            📅 Kalendar sezone & Logistički planer ({calendarItems.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "PROJEKTI" ? "btn--active" : ""}`}
            onClick={() => setActiveTab("PROJEKTI")}
          >
            🏊 Projekti & Poslovi mjerenja ({initialProjects.length})
          </button>
        </div>

        {activeTab === "KALENDAR" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              className="input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ minWidth: 130, padding: "6px 12px", fontWeight: 700 }}
            >
              <option value={2025}>Sezona 2025.</option>
              <option value={2026}>Sezona 2026.</option>
              <option value={2027}>Sezona 2027.</option>
            </select>
            <button
              type="button"
              className="btn btn--active"
              onClick={() => {
                applyPreset("TREBINJE");
                setIsCalModalOpen(true);
              }}
              style={{
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                borderColor: "#0284c7",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              + Dodaj u kalendar sezone
            </button>
          </div>
        )}
      </div>

      {activeTab === "KALENDAR" ? (
        <div>
          {/* SUMMARY KARTICE ZA KALENDAR SEZONE */}
          <div
            className="card"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                📅 Takmičenja u {selectedYear}. sezoni
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#38bdf8" }}>
                {totalTakmicenjaCal} mitinga
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Blokirano ukupno: <b style={{ color: "#fbbf24" }}>{totalBlokiranihDana} dana</b> (put + bazen)
              </div>
            </div>

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                📄 Planirani prihodi sezone
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#4ade80" }}>
                {formatAmount(totalUgovorenoCal, locale)}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Ugovoreni paušali za mjerenje
              </div>
            </div>

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                🚗 Putni troškovi, gorivo & smještaj
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f87171" }}>
                {formatAmount(totalTroskoviCal, locale)}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Gorivo, putarine, dnevnice mjerioca
              </div>
            </div>

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                💰 Čista neto dobit sezone
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24" }}>
                {formatAmount(totalNetoCal, locale)}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Nakon odbitka svih putnih troškova
              </div>
            </div>
          </div>

          {/* TABELA KALENDARA */}
          <div className="card tableCard">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Termin & Dani</th>
                    <th style={{ width: 260 }}>Takmičenje & Naručilac</th>
                    <th style={{ width: 160 }}>Lokacija & Tip</th>
                    <th>Logistika, Put & Noćenja</th>
                    <th style={{ width: 130, textAlign: "right" }}>Paušal</th>
                    <th style={{ width: 130, textAlign: "right" }}>Trošak puta</th>
                    <th style={{ width: 130, textAlign: "right" }}>Neto dobit</th>
                    <th style={{ width: 140, textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calendarItems.length ? (
                    calendarItems.map((c) => {
                      const trosakPuta =
                        (Number(c.trosak_goriva_km) || 0) +
                        (Number(c.putarine_km) || 0) +
                        (c.nocenje_pokriva === "STUDIO_TAF" ? Number(c.nocenja_broj) * Number(c.nocenje_cijena_km) : 0) +
                        (Number(c.dnevnice_mjerioca_km) || 0);
                      const neto = (Number(c.ugovoreni_pausal_km) || 0) - trosakPuta;

                      return (
                        <tr key={c.kalendar_id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{fmtDate(c.datum_od)}</div>
                            {c.datum_do !== c.datum_od && (
                              <div className="subtle" style={{ fontSize: 11 }}>do {fmtDate(c.datum_do)}</div>
                            )}
                            <div style={{ marginTop: 4 }}>
                              <span className="badge badge-orange" style={{ fontSize: 10 }} title="Ukupno blokiranih dana sa putem i pripremom">
                                🛑 {c.ukupno_blokiranih_dana} dana blokirano
                              </span>
                            </div>
                          </td>

                          <td>
                            <div style={{ fontWeight: 800, fontSize: 14 }}>{c.naziv_takmicenja}</div>
                            <div className="subtle" style={{ fontSize: 12 }}>{c.klub_savez_naziv || "Plivački savez / Klub"}</div>
                          </td>

                          <td>
                            <div style={{ fontWeight: 700 }}>📍 {c.lokacija_grad}</div>
                            <div style={{ marginTop: 2 }}>
                              {c.tip_lokacije === "DOMACI" && (
                                <span className="badge badge-green" style={{ fontSize: 11 }}>🏠 Domaći (GOB)</span>
                              )}
                              {c.tip_lokacije === "TEREN_DALEKO" && (
                                <span className="badge badge-red" style={{ fontSize: 11 }}>🚗 Daleki put</span>
                              )}
                              {c.tip_lokacije === "TEREN_BLIZU" && (
                                <span className="badge badge-orange" style={{ fontSize: 11 }}>🚗 Teren</span>
                              )}
                            </div>
                          </td>

                          <td>
                            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                              {c.tip_lokacije !== "DOMACI" ? (
                                <>
                                  <div>⛽ <b>{c.kilometraza_km} km</b> (~{formatAmount(c.trosak_goriva_km, locale)} gorivo) · 🛣️ Putarine: {formatAmount(c.putarine_km, locale)}</div>
                                  <div>🛌 <b>{c.nocenja_broj} noći</b> ({c.nocenje_pokriva === "ORGANIZATOR" ? "Plaća organizator" : "Trošak Studija"})</div>
                                </>
                              ) : (
                                <div className="subtle">0 km putovanja · Priprema na domaćem bazenu</div>
                              )}
                              {c.napomena && (
                                <div className="subtle" style={{ marginTop: 4, fontStyle: "italic" }}>
                                  💬 {c.napomena}
                                </div>
                              )}
                            </div>
                          </td>

                          <td style={{ textAlign: "right", fontWeight: 700, color: "#4ade80" }}>
                            {formatAmount(c.ugovoreni_pausal_km, locale)}
                          </td>

                          <td style={{ textAlign: "right", fontWeight: 600, color: "#f87171" }}>
                            {formatAmount(trosakPuta, locale)}
                          </td>

                          <td style={{ textAlign: "right", fontWeight: 800, color: "#fbbf24" }}>
                            {formatAmount(neto, locale)}
                          </td>

                          <td style={{ textAlign: "center" }}>
                            <span className="badge badge-green" style={{ fontSize: 11 }}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="subtle" style={{ padding: 24, textAlign: "center" }}>
                        Nema unesenih takmičenja za {selectedYear}. godinu. Kliknite na <b>"+ Dodaj u kalendar sezone"</b> za unos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* PROJEKTI LISTA */
        <div className="card tableCard">
          <div style={{ padding: 16 }}>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraži otvorene poslove i projekte mjerenja..."
              style={{ maxWidth: 360 }}
            />
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>ID</th>
                  <th style={{ width: 280 }}>Naziv takmičenja</th>
                  <th style={{ width: 220 }}>Klub / Savez (Naručilac)</th>
                  <th style={{ width: 140 }}>Datum</th>
                  <th style={{ width: 140, textAlign: "right" }}>Ugovoreno</th>
                  <th style={{ width: 140, textAlign: "right" }}>Troškovi</th>
                  <th style={{ width: 150, textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {initialProjects.map((p) => (
                  <tr key={p.projekat_id}>
                    <td>
                      <Link href={`/projects/${p.projekat_id}`} className="link">
                        #{p.projekat_id}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/projects/${p.projekat_id}`} style={{ fontWeight: 700, color: "inherit" }}>
                        {p.naziv_projekta}
                      </Link>
                    </td>
                    <td>{p.naziv_klijenta || "—"}</td>
                    <td>{fmtDate(p.datum_pocetka)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {p.budzet_km != null ? formatAmount(p.budzet_km, locale) : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#f87171" }}>
                      {formatAmount(p.ukupno_troskovi_km ?? 0, locale)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="badge badge-green" style={{ fontSize: 11 }}>
                        {p.status_name || "Aktivno"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL ZA UNOS U KALENDAR SEZONE */}
      {isCalModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => !savingCal && setIsCalModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "var(--panel, #18181b)",
              border: "1px solid var(--border, #27272a)",
              borderRadius: 16,
              maxWidth: 620,
              width: "100%",
              padding: 24,
              color: "var(--text, #f4f4f5)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>📅</span>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Dodaj takmičenje u kalendar ({selectedYear}. godina)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCalModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--muted, #a1a1aa)", fontSize: 20, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* BRZI PRESETOVI */}
            <div style={{ marginBottom: 14 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Brzi predložak lokacije & logistike:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" className="btn" onClick={() => applyPreset("TREBINJE")}>📍 Trebinje (Mrdić / Srđan)</button>
                <button type="button" className="btn" onClick={() => applyPreset("BANJALUKA")}>🏠 Banja Luka (GOB / BL Open)</button>
                <button type="button" className="btn" onClick={() => applyPreset("SARAJEVO")}>📍 Sarajevo (Otoka)</button>
                <button type="button" className="btn" onClick={() => applyPreset("MOSTAR")}>📍 Mostar</button>
              </div>
            </div>

            <form onSubmit={handleSaveCalendarItem} style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 4 }}>Naziv takmičenja / Mitinga:</label>
                <input
                  className="input"
                  value={nazivTakmicenja}
                  onChange={(e) => setNazivTakmicenja(e.target.value)}
                  placeholder="npr. Međunarodni plivački miting Trebinje 2026"
                  required
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 4 }}>Klub / Savez (Naručilac):</label>
                  <select className="input" value={klubId} onChange={(e) => setKlubId(e.target.value)} style={{ width: "100%" }}>
                    <option value="">— Odaberi iz šifarnika —</option>
                    {klijenti.map((k) => (
                      <option key={k.klijent_id} value={k.klijent_id}>{k.naziv_klijenta}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 4 }}>Grad / Lokacija:</label>
                  <input className="input" value={lokacijaGrad} onChange={(e) => setLokacijaGrad(e.target.value)} required style={{ width: "100%" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 4 }}>Datum od:</label>
                  <input type="date" className="input" value={datumOd} onChange={(e) => setDatumOd(e.target.value)} required style={{ width: "100%" }} />
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 4 }}>Datum do:</label>
                  <input type="date" className="input" value={datumDo} onChange={(e) => setDatumDo(e.target.value)} required style={{ width: "100%" }} />
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 4 }}>Dana na bazenu:</label>
                  <input type="number" className="input" min={1} max={7} value={takmicarskihDana} onChange={(e) => setTakmicarskihDana(Number(e.target.value))} style={{ width: "100%" }} />
                </div>
              </div>

              {/* LOGISTIKA I TROSKOVI */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#38bdf8" }}>🚗 Logistika, Put & Smještaj</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Tip lokacije:</label>
                    <select className="input" value={tipLokacije} onChange={(e) => setTipLokacije(e.target.value as any)} style={{ width: "100%" }}>
                      <option value="DOMACI">🏠 Domaći (Banja Luka)</option>
                      <option value="TEREN_DALEKO">🚗 Daleki put (Trebinje...)</option>
                      <option value="TEREN_BLIZU">🚗 Teren u blizini</option>
                    </select>
                  </div>
                  <div>
                    <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Kilometraža (ukupno):</label>
                    <input type="number" className="input" value={km} onChange={(e) => setKm(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Gorivo (KM):</label>
                    <input type="number" className="input" value={gorivoKm} onChange={(e) => setGorivoKm(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Noćenja (broj noći):</label>
                    <input type="number" className="input" min={0} value={nocenjaBroj} onChange={(e) => setNocenjaBroj(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Trošak noćenja:</label>
                    <select className="input" value={nocenjePokriva} onChange={(e) => setNocenjePokriva(e.target.value as any)} style={{ width: "100%" }}>
                      <option value="ORGANIZATOR">Plaća organizator</option>
                      <option value="STUDIO_TAF">Trošak Studija</option>
                      <option value="BEZ_NOCENJA">Bez noćenja</option>
                    </select>
                  </div>
                  <div>
                    <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Putarine (KM):</label>
                    <input type="number" className="input" value={putarineKm} onChange={(e) => setPutarineKm(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>
                </div>
              </div>

              {/* FINANSIJE */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 4 }}>Ugovoreni paušal mjerenja (KM):</label>
                  <input type="number" className="input" value={pausalKm} onChange={(e) => setPausalKm(Number(e.target.value))} required style={{ width: "100%", fontWeight: 700, fontSize: 15 }} />
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 4 }}>Dnevnice mjerioca (KM):</label>
                  <input type="number" className="input" value={dnevniceKm} onChange={(e) => setDnevniceKm(Number(e.target.value))} style={{ width: "100%" }} />
                </div>
              </div>

              <div>
                <label className="label" style={{ display: "block", marginBottom: 4 }}>Logistička napomena (plan puta & pripreme):</label>
                <textarea className="input" rows={2} value={napomenaCal} onChange={(e) => setNapomenaCal(e.target.value)} style={{ width: "100%" }} />
              </div>

              {error && (
                <div style={{ padding: 10, backgroundColor: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: 8, color: "#fca5a5", fontSize: 13 }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" className="btn" onClick={() => setIsCalModalOpen(false)} disabled={savingCal}>
                  Odustani
                </button>
                <button
                  type="submit"
                  className="btn btn--active"
                  disabled={savingCal}
                  style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", borderColor: "#0284c7", color: "#fff" }}
                >
                  {savingCal ? "Čuvanje..." : "Upiši u kalendar sezone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
