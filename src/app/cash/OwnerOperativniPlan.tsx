"use client";

import React, { useEffect, useState } from "react";

type RacunStanje = {
  id: number;
  naziv: string;
  opis: string | null;
  tip: "PRIVATNI_RACUN" | "KARTICA" | "FIRMA_RACUN";
  saldo: number;
  valuta: string;
  sort_order: number;
};

type PlanStavka = {
  id: number;
  vrsta: "PRILIV" | "RASHOD" | "DUGOROCNO" | "WISHLIST";
  kategorija: string;
  naziv: string;
  iznos: number;
  valuta: string;
  rok_datum: string | null;
  status: "PLANIRANO" | "REALIZOVANO" | "HOLD" | "OTKAZANO";
  napomena: string | null;
  sort_order: number;
};

type TafFaktura = {
  faktura_id: number;
  broj_fakture: string;
  datum_izdavanja: string;
  klijent_naziv: string;
  iznos_sa_pdv: number;
  valuta: string;
};

export default function OwnerOperativniPlan() {
  const [racuni, setRacuni] = useState<RacunStanje[]>([]);
  const [planStavke, setPlanStavke] = useState<PlanStavka[]>([]);
  const [tafFakture, setTafFakture] = useState<TafFaktura[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRacunId, setEditingRacunId] = useState<number | null>(null);
  const [editSaldoVal, setEditSaldoVal] = useState<string>("");

  // Modal za novu stavku plana
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemForm, setItemForm] = useState<{
    id?: number;
    vrsta: "PRILIV" | "RASHOD" | "DUGOROCNO" | "WISHLIST";
    kategorija: string;
    naziv: string;
    iznos: number;
    status: "PLANIRANO" | "REALIZOVANO" | "HOLD";
    napomena: string;
  }>({
    vrsta: "RASHOD",
    kategorija: "OSTALO",
    naziv: "",
    iznos: 100,
    status: "PLANIRANO",
    napomena: "",
  });

  // Modal za novi račun
  const [showRacunModal, setShowRacunModal] = useState(false);
  const [racunForm, setRacunForm] = useState({
    naziv: "",
    opis: "",
    tip: "PRIVATNI_RACUN" as "PRIVATNI_RACUN" | "KARTICA" | "FIRMA_RACUN",
    saldo: 0,
  });

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/operativni-plan").then((r) => r.json());
      if (res.ok) {
        setRacuni(res.racuni || []);
        setPlanStavke(res.planStavke || []);
        setTafFakture(res.tafPotrazivanja || []);
      }
    } catch (e: any) {
      console.error("Greška pri učitavanju plana:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const [showPaidRashodi, setShowPaidRashodi] = useState(false);

  // Izračuni
  const totalRacuniPersonal = racuni
    .filter((r) => r.tip !== "FIRMA_RACUN")
    .reduce((sum, r) => sum + Number(r.saldo || 0), 0);

  const totalRacuniFirma = racuni
    .filter((r) => r.tip === "FIRMA_RACUN")
    .reduce((sum, r) => sum + Number(r.saldo || 0), 0);

  const totalSviRacuni = totalRacuniPersonal + totalRacuniFirma;

  const priliviAktivni = planStavke.filter((p) => p.vrsta === "PRILIV" && p.status !== "OTKAZANO");
  const totalPrilivi = priliviAktivni
    .filter((p) => p.status !== "REALIZOVANO")
    .reduce((sum, p) => sum + Number(p.iznos || 0), 0);

  const rashodiAktivni = planStavke.filter((p) => p.vrsta === "RASHOD" && p.status !== "OTKAZANO");
  const rashodiPending = rashodiAktivni.filter((p) => p.status !== "REALIZOVANO");
  const rashodiRealizovani = rashodiAktivni.filter((p) => p.status === "REALIZOVANO");

  const totalRashodi = rashodiPending
    .filter((p) => p.status !== "HOLD")
    .reduce((sum, p) => sum + Number(p.iznos || 0), 0);
  const totalRashodiHold = rashodiPending
    .filter((p) => p.status === "HOLD")
    .reduce((sum, p) => sum + Number(p.iznos || 0), 0);

  const dugorocnoStavke = planStavke.filter((p) => p.vrsta === "DUGOROCNO" && p.status !== "OTKAZANO");
  const totalDugorocno = dugorocnoStavke.reduce((sum, p) => sum + Number(p.iznos || 0), 0);

  const wishlistStavke = planStavke.filter((p) => p.vrsta === "WISHLIST" && p.status !== "OTKAZANO");
  const totalWishlist = wishlistStavke.reduce((sum, p) => sum + Number(p.iznos || 0), 0);

  // Hodogram neto kalkulacija: (Keš na računima + Planirani Prilivi) - Planirani Rashodi
  const operativniNetoHodogram = totalSviRacuni + totalPrilivi - totalRashodi;
  const slobodnoNakonWishlista = operativniNetoHodogram - totalWishlist;

  async function handleUpdateSaldo(id: number) {
    const val = Number(editSaldoVal);
    if (Number.isNaN(val)) return;

    try {
      await fetch("/api/owner/operativni-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "racun", id, action: "update_saldo", value: val }),
      });
      setEditingRacunId(null);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleToggleStatus(item: PlanStavka) {
    try {
      await fetch("/api/owner/operativni-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "toggle_status" }),
      });
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleMarkPaid(item: PlanStavka) {
    try {
      await fetch("/api/owner/operativni-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "mark_paid" }),
      });
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleDeleteItem(id: number, target = "stavka") {
    if (!confirm("Da li ste sigurni da želite obrisati ovu stavku?")) return;
    try {
      await fetch(`/api/owner/operativni-plan?id=${id}&target=${target}`, { method: "DELETE" });
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemForm.naziv || !itemForm.iznos) return;

    try {
      const isEdit = !!itemForm.id;
      const res = await fetch("/api/owner/operativni-plan", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm),
      });
      const data = await res.json();
      if (data.ok) {
        setShowItemModal(false);
        loadData();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSaveRacun(e: React.FormEvent) {
    e.preventDefault();
    if (!racunForm.naziv) return;

    try {
      const res = await fetch("/api/owner/operativni-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "racun", ...racunForm }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowRacunModal(false);
        setRacunForm({ naziv: "", opis: "", tip: "PRIVATNI_RACUN", saldo: 0 });
        loadData();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Brzo ubacivanje fakture iz Studio TAF u prilive
  async function handleAddFakturaToPlan(f: TafFaktura) {
    try {
      await fetch("/api/owner/operativni-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vrsta: "PRILIV",
          kategorija: "STUDIO_TAF",
          naziv: `${f.klijent_naziv || "Faktura"} (${f.broj_fakture})`,
          iznos: f.iznos_sa_pdv,
          status: "PLANIRANO",
        }),
      });
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 15 }}>
      {/* 1. TOP SUMMARY BAR: HODOGRAM & NETO LIKVIDNOST */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.7))",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 15, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>📊</span>
              <h2 style={{ margin: 0, fontSize: 19, color: "#f8fafc", fontWeight: 900 }}>
                OPERATIVNI PLAN & HODOGRAM // Trenutni Finansijski Status
              </h2>
              <span style={{ fontSize: 11, background: "rgba(34, 197, 94, 0.2)", color: "#4ade80", border: "1px solid #22c55e", padding: "2px 8px", borderRadius: 10, fontWeight: 800 }}>
                PLAN F 2026
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
              Balans očekivanih priliva (fakture + plata Aquana), stanja na svim karticama i tekućih obaveza sa projekcijom slobodnog novca.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                setItemForm({
                  vrsta: "PRILIV",
                  kategorija: "POSAO",
                  naziv: "",
                  iznos: 500,
                  status: "PLANIRANO",
                  napomena: "",
                });
                setShowItemModal(true);
              }}
              style={{
                background: "rgba(34, 197, 94, 0.2)",
                color: "#4ade80",
                border: "1px solid #22c55e",
                padding: "8px 14px",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              + Očekivani Priliv (+)
            </button>
            <button
              type="button"
              onClick={() => {
                setItemForm({
                  vrsta: "RASHOD",
                  kategorija: "OBAVEZA",
                  naziv: "",
                  iznos: 200,
                  status: "PLANIRANO",
                  napomena: "",
                });
                setShowItemModal(true);
              }}
              style={{
                background: "rgba(239, 68, 68, 0.2)",
                color: "#f87171",
                border: "1px solid #ef4444",
                padding: "8px 14px",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              - Dodaj Obavezu (-)
            </button>
            <button
              type="button"
              onClick={() => {
                setItemForm({
                  vrsta: "WISHLIST",
                  kategorija: "OPREMA",
                  naziv: "Logitech MX Keys S tastatura",
                  iznos: 250,
                  status: "PLANIRANO",
                  napomena: "Backlight & Silent kucanje",
                });
                setShowItemModal(true);
              }}
              style={{
                background: "rgba(168, 85, 247, 0.2)",
                color: "#c084fc",
                border: "1px solid #a855f7",
                padding: "8px 14px",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              🎁 Wishlist Želja
            </button>
          </div>
        </div>

        {/* METRIC KPI TILES */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
          <div style={{ background: "rgba(2, 6, 23, 0.7)", padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase" }}>💳 Trenutno na Računima</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#38bdf8", marginTop: 2 }}>{totalSviRacuni.toFixed(2)} KM</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Lično: {totalRacuniPersonal.toFixed(2)} | TAF: {totalRacuniFirma.toFixed(2)}</div>
          </div>

          <div style={{ background: "rgba(2, 6, 23, 0.7)", padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(34, 197, 94, 0.3)" }}>
            <div style={{ fontSize: 11, color: "#4ade80", textTransform: "uppercase" }}>🟢 Očekivani Prilivi (+)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#4ade80", marginTop: 2 }}>+{totalPrilivi.toFixed(2)} KM</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{priliviAktivni.length} planiranih uplata</div>
          </div>

          <div style={{ background: "rgba(2, 6, 23, 0.7)", padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.3)" }}>
            <div style={{ fontSize: 11, color: "#f87171", textTransform: "uppercase" }}>🔴 Planirane Obaveze (-)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#f87171", marginTop: 2 }}>-{totalRashodi.toFixed(2)} KM</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>+ {totalRashodiHold.toFixed(2)} KM na HOLD</div>
          </div>

          <div
            style={{
              background: operativniNetoHodogram >= 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
              padding: "12px 16px",
              borderRadius: 8,
              border: `2px solid ${operativniNetoHodogram >= 0 ? "#22c55e" : "#ef4444"}`,
            }}
          >
            <div style={{ fontSize: 11, color: operativniNetoHodogram >= 0 ? "#86efac" : "#fca5a5", textTransform: "uppercase", fontWeight: 800 }}>
              🚀 PROJEKTOVANI SALDO (HODOGRAM)
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: operativniNetoHodogram >= 0 ? "#4ade80" : "#f87171", marginTop: 2 }}>
              {operativniNetoHodogram >= 0 ? `+${operativniNetoHodogram.toFixed(2)} KM` : `${operativniNetoHodogram.toFixed(2)} KM`}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              {operativniNetoHodogram >= 0 ? "✅ Sve trenutne obaveze su pokrivene!" : "⚠️ Deficit: potrebno odgoditi HOLD obaveze."}
            </div>
          </div>
        </div>

        {/* WISHLIST SIMULATOR BANNER (e.g. Logitech MX Keys S) */}
        {wishlistStavke.length > 0 && (
          <div style={{ marginTop: 14, background: "rgba(168, 85, 247, 0.15)", border: "1px solid rgba(168, 85, 247, 0.4)", borderRadius: 8, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>⌨️</span>
              <div>
                <span style={{ fontWeight: 800, color: "#f8fafc", fontSize: 13 }}>
                  Planirana Nagrada / Želja: {wishlistStavke[0].naziv} ({Number(wishlistStavke[0].iznos).toFixed(2)} KM)
                </span>
                <span style={{ fontSize: 12, color: "#c084fc", marginLeft: 8 }}>
                  {wishlistStavke[0].napomena ? `— ${wishlistStavke[0].napomena}` : ""}
                </span>
              </div>
            </div>
            <div>
              {slobodnoNakonWishlista >= 0 ? (
                <span style={{ background: "rgba(34, 197, 94, 0.25)", color: "#4ade80", border: "1px solid #22c55e", padding: "4px 10px", borderRadius: 6, fontWeight: 800, fontSize: 12 }}>
                  🎉 KUPUJ! Nakon kupovine ostaje Vam još +{slobodnoNakonWishlista.toFixed(2)} KM čisto!
                </span>
              ) : (
                <span style={{ background: "rgba(239, 68, 68, 0.25)", color: "#f87171", border: "1px solid #ef4444", padding: "4px 10px", borderRadius: 6, fontWeight: 800, fontSize: 12 }}>
                  ⏳ Pričekaj još {Math.abs(slobodnoNakonWishlista).toFixed(2)} KM priliva prije kupovine.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. DVIJE GLAVNE KOLONE: LIJEVO (PRILIVI & KARTICE), DESNO (OBAVEZE & HODOGRAM) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
        {/* LIJEVA KOLONA: OČEKIVANI PRILIVI (+) & STANJA RAČUNA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* STANJA NA RAČUNIMA I KARTICAMA */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.15)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>💳</span>
                <h3 style={{ margin: 0, fontSize: 15, color: "#f8fafc", fontWeight: 800 }}>Stanja Računa & Kartica</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRacunModal(true)}
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#94a3b8", padding: "3px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
              >
                + Dodaj Račun
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
              {racuni.map((r) => {
                const isEditing = editingRacunId === r.id;
                const isFirma = r.tip === "FIRMA_RACUN";
                return (
                  <div
                    key={r.id}
                    style={{
                      background: isFirma ? "rgba(30, 41, 59, 0.6)" : "rgba(2, 6, 23, 0.6)",
                      border: isFirma ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isFirma ? "#38bdf8" : "#e2e8f0" }}>{r.naziv}</span>
                      <span style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>{r.tip.replace("_RACUN", "")}</span>
                    </div>

                    <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 4, width: "100%" }}>
                          <input
                            type="number"
                            step="0.01"
                            value={editSaldoVal}
                            onChange={(e) => setEditSaldoVal(e.target.value)}
                            style={{ width: "70%", background: "#0f172a", border: "1px solid #38bdf8", color: "#fff", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateSaldo(r.id)}
                            style={{ background: "#0284c7", color: "#fff", border: "none", padding: "2px 6px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRacunId(null)}
                            style={{ background: "transparent", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.2)", padding: "2px 4px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <span
                            onClick={() => {
                              setEditingRacunId(r.id);
                              setEditSaldoVal(String(r.saldo));
                            }}
                            title="Kliknite za izmjenu stanja"
                            style={{ fontSize: 14, fontWeight: 800, color: Number(r.saldo) > 0 ? "#4ade80" : "#94a3b8", cursor: "pointer" }}
                          >
                            {Number(r.saldo).toFixed(2)} {r.valuta}
                          </span>
                          <span style={{ fontSize: 10, color: "#64748b", cursor: "pointer" }} onClick={() => { setEditingRacunId(r.id); setEditSaldoVal(String(r.saldo)); }}>
                            ✎ uredi
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* OČEKIVANI PRILIVI (+) */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: 10, border: "1px solid rgba(34, 197, 94, 0.2)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🟢</span>
                <h3 style={{ margin: 0, fontSize: 15, color: "#4ade80", fontWeight: 800 }}>Očekivani Prilivi (+)</h3>
              </div>
              <span style={{ fontSize: 14, fontWeight: 900, color: "#4ade80" }}>+{totalPrilivi.toFixed(2)} KM</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {priliviAktivni.map((p) => {
                const isRealizovano = p.status === "REALIZOVANO";
                return (
                  <div
                    key={p.id}
                    style={{
                      background: isRealizovano ? "rgba(34, 197, 94, 0.1)" : "rgba(30, 41, 59, 0.4)",
                      border: isRealizovano ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: isRealizovano ? "#86efac" : "#f8fafc", fontSize: 13, textDecoration: isRealizovano ? "line-through" : "none" }}>
                        {p.naziv}
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{p.kategorija} {p.napomena ? `• ${p.napomena}` : ""}</div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 800, color: "#4ade80", fontSize: 14 }}>+{Number(p.iznos).toFixed(2)} KM</span>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(p)}
                        style={{
                          background: isRealizovano ? "rgba(34, 197, 94, 0.3)" : "rgba(255,255,255,0.05)",
                          color: isRealizovano ? "#4ade80" : "#94a3b8",
                          border: "1px solid rgba(255,255,255,0.1)",
                          padding: "3px 8px",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                        title={isRealizovano ? "Označi kao na čekanju" : "Označi kao leglo na račun"}
                      >
                        {isRealizovano ? "✓ Leglo" : "⏳ Čeka se"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(p.id)}
                        style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* NEPLAĆENE FAKTURE STUDIO TAF PREGLED */}
            {tafFakture.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, fontWeight: 700 }}>
                  💡 Neplaćene Fakture u Studio TAF (Kliknite <b>+ Dodaj u plan</b>):
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {tafFakture.slice(0, 4).map((f) => (
                    <div key={f.faktura_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, background: "rgba(0,0,0,0.2)", padding: "4px 8px", borderRadius: 4 }}>
                      <span style={{ color: "#cbd5e1" }}>{f.klijent_naziv || "Klijent"} ({f.broj_fakture})</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#38bdf8" }}>{Number(f.iznos_sa_pdv).toFixed(2)} KM</span>
                        <button
                          type="button"
                          onClick={() => handleAddFakturaToPlan(f)}
                          style={{ background: "#0284c7", color: "#fff", border: "none", padding: "1px 6px", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                        >
                          + Dodaj
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DESNA KOLONA: PLANIRANE OBAVEZE (-) & HOLD */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: 10, border: "1px solid rgba(239, 68, 68, 0.2)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔴</span>
                <h3 style={{ margin: 0, fontSize: 15, color: "#f87171", fontWeight: 800 }}>Planirane Obaveze & Troškovi (-)</h3>
              </div>
              <span style={{ fontSize: 14, fontWeight: 900, color: "#f87171" }}>-{totalRashodi.toFixed(2)} KM</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rashodiPending.length === 0 ? (
                <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "16px 0", background: "rgba(0,0,0,0.2)", borderRadius: 6 }}>
                  ✅ Nema neplaćenih tekućih obaveza. Sve je podmireno!
                </div>
              ) : (
                rashodiPending.map((r) => {
                  const isHold = r.status === "HOLD";
                  const isAuto = r.napomena?.includes("[PRETP:") || r.napomena?.includes("[KRED:");

                  return (
                    <div
                      key={r.id}
                      style={{
                        background: isHold ? "rgba(245, 158, 11, 0.1)" : "rgba(30, 41, 59, 0.4)",
                        border: isHold ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 6,
                        padding: "8px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: isHold ? "#fbbf24" : "#f8fafc", fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span>{r.naziv}</span>
                          {isAuto && (
                            <span style={{ fontSize: 10, background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                              📅 Dospijeće
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                          {r.kategorija} {r.rok_datum ? `• Rok: ${r.rok_datum}` : ""} {r.napomena && !isAuto ? `• ${r.napomena}` : ""}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ fontWeight: 800, color: isHold ? "#fbbf24" : "#f87171", fontSize: 14 }}>
                          {Number(r.iznos).toFixed(2)} KM
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(r)}
                          style={{
                            background: "rgba(34, 197, 94, 0.2)",
                            color: "#4ade80",
                            border: "1px solid #22c55e",
                            padding: "4px 10px",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                          title="Označi kao plaćeno (nestaje iz liste i evidentira se)"
                        >
                          ✓ Plaćeno
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(r)}
                          style={{
                            background: isHold ? "rgba(245, 158, 11, 0.3)" : "rgba(255,255,255,0.05)",
                            color: isHold ? "#fbbf24" : "#cbd5e1",
                            border: "1px solid rgba(255,255,255,0.1)",
                            padding: "4px 8px",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                          title="Prebaci na HOLD ili u aktivno"
                        >
                          {isHold ? "⏸ HOLD" : "HOLD"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(r.id)}
                          style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13, padding: "2px 4px" }}
                          title="Obriši stavku"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* PLAĆENE OBAVEZE ARHIVA PREGLED */}
            {rashodiRealizovani.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                  type="button"
                  onClick={() => setShowPaidRashodi((prev) => !prev)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    fontSize: 11,
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{showPaidRashodi ? "▼" : "▶"}</span>
                  <span>📁 Plaćene obaveze ({rashodiRealizovani.length})</span>
                </button>

                {showPaidRashodi && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    {rashodiRealizovani.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          background: "rgba(34, 197, 94, 0.08)",
                          border: "1px solid rgba(34, 197, 94, 0.2)",
                          borderRadius: 4,
                          padding: "6px 10px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 11,
                        }}
                      >
                        <div>
                          <span style={{ textDecoration: "line-through", color: "#86efac", fontWeight: 600 }}>{r.naziv}</span>
                          <span style={{ color: "#64748b", marginLeft: 6 }}>({r.kategorija})</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#86efac", fontWeight: 700 }}>{Number(r.iznos).toFixed(2)} KM</span>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(r)}
                            style={{
                              background: "transparent",
                              border: "1px solid rgba(255,255,255,0.15)",
                              color: "#94a3b8",
                              padding: "1px 6px",
                              borderRadius: 3,
                              cursor: "pointer",
                              fontSize: 10,
                            }}
                            title="Vrati u neplaćene obaveze"
                          >
                            Vrati
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DUGOROČNI DUGOVI & REPROGRAMI SEKCIJA */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: 10, border: "1px solid rgba(168, 85, 247, 0.25)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🏛</span>
                <h3 style={{ margin: 0, fontSize: 14, color: "#c084fc", fontWeight: 800 }}>Dugoročne Obaveze & Reprogrami</h3>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#c084fc" }}>Ukupno: {totalDugorocno.toFixed(2)} KM</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
              {dugorocnoStavke.map((d) => (
                <div key={d.id} style={{ background: "rgba(2, 6, 23, 0.5)", border: "1px solid rgba(168, 85, 247, 0.2)", padding: "6px 10px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#f8fafc" }}>{d.naziv}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8" }}>{d.kategorija}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#c084fc" }}>{Number(d.iznos).toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(d.id)}
                      style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 11 }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL ZA STAVKU PLANA */}
      {showItemModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#0f172a", border: "1px solid #38bdf8", borderRadius: 12, padding: 24, width: 420, maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 16px", color: "#f8fafc" }}>Nova Stavka u Planu</h3>
            <form onSubmit={handleSaveItem} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Vrsta Stavke</label>
                <select
                  value={itemForm.vrsta}
                  onChange={(e) => setItemForm({ ...itemForm, vrsta: e.target.value as any })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                >
                  <option value="PRILIV">🟢 Očekivani Priliv (+)</option>
                  <option value="RASHOD">🔴 Planirana Obaveza / Rashod (-)</option>
                  <option value="DUGOROCNO">🏛 Dugoročni Dug / Reprogram</option>
                  <option value="WISHLIST">🎁 Wishlist Želja (npr. Tastatura)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Naziv</label>
                <input
                  type="text"
                  required
                  placeholder="npr. Ovation, Plata Aquana, Danka, Garaža..."
                  value={itemForm.naziv}
                  onChange={(e) => setItemForm({ ...itemForm, naziv: e.target.value })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Iznos (KM)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={itemForm.iznos}
                  onChange={(e) => setItemForm({ ...itemForm, iznos: Number(e.target.value) })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Status</label>
                <select
                  value={itemForm.status}
                  onChange={(e) => setItemForm({ ...itemForm, status: e.target.value as any })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                >
                  <option value="PLANIRANO">Planirano / Aktivno</option>
                  <option value="HOLD">⏸ HOLD (Na čekanju)</option>
                  <option value="REALIZOVANO">✓ Realizovano / Plaćeno</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Napomena</label>
                <input
                  type="text"
                  placeholder="Opciona napomena..."
                  value={itemForm.napomena}
                  onChange={(e) => setItemForm({ ...itemForm, napomena: e.target.value })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#cbd5e1", padding: "8px 16px", borderRadius: 6, cursor: "pointer" }}
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  style={{ background: "#0284c7", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}
                >
                  Sačuvaj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ZA NOVI RAČUN */}
      {showRacunModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#0f172a", border: "1px solid #38bdf8", borderRadius: 12, padding: 24, width: 400, maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 16px", color: "#f8fafc" }}>Dodaj Račun / Karticu</h3>
            <form onSubmit={handleSaveRacun} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Naziv Računa / Kartice</label>
                <input
                  type="text"
                  required
                  placeholder="npr. UCB prepaid, Master Std..."
                  value={racunForm.naziv}
                  onChange={(e) => setRacunForm({ ...racunForm, naziv: e.target.value })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Tip Računa</label>
                <select
                  value={racunForm.tip}
                  onChange={(e) => setRacunForm({ ...racunForm, tip: e.target.value as any })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                >
                  <option value="PRIVATNI_RACUN">Privatni Tekući Račun</option>
                  <option value="KARTICA">Kartica (Prepaid / Revolving / Debit)</option>
                  <option value="FIRMA_RACUN">Račun Firme (Studio TAF)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Trenutno Stanje (KM)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={racunForm.saldo}
                  onChange={(e) => setRacunForm({ ...racunForm, saldo: Number(e.target.value) })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowRacunModal(false)}
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#cbd5e1", padding: "8px 16px", borderRadius: 6, cursor: "pointer" }}
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  style={{ background: "#0284c7", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}
                >
                  Sačuvaj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
