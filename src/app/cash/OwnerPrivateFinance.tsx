"use client";

import React, { useEffect, useState } from "react";

type PretplateItem = {
  id: number;
  naziv: string;
  kategorija: string;
  iznos: number;
  valuta: string;
  frekvencija: string;
  dan_u_mjesecu: number;
  nacin_placanja: string;
  status: string;
  napomena: string | null;
  zadnje_placeno: string | null;
};

type KreditItem = {
  id: number;
  naziv: string;
  banka: string;
  ukupan_iznos: number;
  iznos_rate: number;
  valuta: string;
  broj_rata: number;
  uplaceno_rata: number;
  dan_u_mjesecu: number;
  datum_pocetka: string | null;
  datum_kraja: string | null;
  status: string;
  napomena: string | null;
};

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = String(iso).trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}.${match[2]}.${match[1]}.`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}.`;
  }
  return s;
}

export default function OwnerPrivateFinance() {
  const [subTab, setSubTab] = useState<"pretplate" | "krediti" | "kalendar">("pretplate");
  const [pretplate, setPretplate] = useState<PretplateItem[]>([]);
  const [krediti, setKrediti] = useState<KreditItem[]>([]);
  const [cashBalance, setCashBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  // Modal pretplata
  const [showPretplataModal, setShowPretplataModal] = useState(false);
  const [editPretplata, setEditPretplata] = useState<Partial<PretplateItem> | null>(null);

  // Modal kredit
  const [showKreditModal, setShowKreditModal] = useState(false);
  const [editKredit, setEditKredit] = useState<Partial<KreditItem> | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [resP, resK, resCash] = await Promise.all([
        fetch("/api/owner/pretplate").then((r) => r.json()),
        fetch("/api/owner/krediti").then((r) => r.json()),
        fetch("/api/cash").then((r) => r.json()),
      ]);
      if (resP.ok) setPretplate(resP.items || []);
      if (resK.ok) setKrediti(resK.items || []);
      if (resCash.ok && resCash.balance !== undefined) setCashBalance(Number(resCash.balance));
    } catch (e: any) {
      showNotice("Greška pri učitavanju: " + e.message, "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function showNotice(text: string, type: "ok" | "err" = "ok") {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  }

  // Izračun zbirnih mjesečnih privatnih obaveza (aproksimativno u BAM: 1 USD ~ 1.8 BAM, 1 EUR ~ 1.95583 BAM)
  const totalMonthlyBAM = pretplate
    .filter((p) => p.status === "AKTIVAN")
    .reduce((sum, p) => {
      const rate = p.valuta === "EUR" ? 1.95583 : p.valuta === "USD" ? 1.8 : 1.0;
      const monthlyAmount = p.frekvencija === "GODISNJE" ? Number(p.iznos) / 12 : Number(p.iznos);
      return sum + monthlyAmount * rate;
    }, 0);

  const totalKreditiRateBAM = krediti
    .filter((k) => k.status === "AKTIVAN")
    .reduce((sum, k) => {
      const rate = k.valuta === "EUR" ? 1.95583 : 1.0;
      return sum + Number(k.iznos_rate) * rate;
    }, 0);

  const totalSveZajednoBAM = totalMonthlyBAM + totalKreditiRateBAM;
  const saldoNakonObaveza = cashBalance !== null ? cashBalance - totalSveZajednoBAM : null;

  // Akcija: Plati pretplatu (evidentiraj izlaz iz blagajne)
  async function handlePayPretplata(p: PretplateItem) {
    const fx = p.valuta === "EUR" ? 1.95583 : p.valuta === "USD" ? 1.8 : 1.0;
    const estKM = (Number(p.iznos) * fx).toFixed(2);
    const ok = window.confirm(`Evidentirati plaćanje za pretplatu "${p.naziv}" (${Number(p.iznos).toFixed(2)} ${p.valuta} ~ ${estKM} KM) i umanjiti saldo blagajne?`);
    if (!ok) return;

    setActionLoading(`pretplata-${p.id}`);
    try {
      const res = await fetch("/api/owner/pretplate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, action: "pay" }),
      });
      const data = await res.json();
      if (data.ok) {
        showNotice(`✅ Pretplata "${p.naziv}" plaćena! Saldo blagajne umanjen za ${data.iznosBAM} KM.`);
        await loadData();
      } else {
        showNotice(`Greška: ${data.error}`, "err");
      }
    } catch (e: any) {
      showNotice(e.message, "err");
    } finally {
      setActionLoading(null);
    }
  }

  // Akcija: Toggle status pretplate (Otkaži / Aktiviraj)
  async function handleToggleStatusPretplata(p: PretplateItem) {
    const isNowActive = p.status === "AKTIVAN";
    const ok = window.confirm(isNowActive ? `Da li želite otkazati pretplatu "${p.naziv}"? Više se neće računati u mjesečne obaveze.` : `Ponovo aktivirati pretplatu "${p.naziv}"?`);
    if (!ok) return;

    setActionLoading(`pretplata-status-${p.id}`);
    try {
      const res = await fetch("/api/owner/pretplate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, action: "toggle_status" }),
      });
      const data = await res.json();
      if (data.ok) {
        showNotice(`Status pretplate "${p.naziv}" promijenjen u: ${data.status}`);
        await loadData();
      } else {
        showNotice(`Greška: ${data.error}`, "err");
      }
    } catch (e: any) {
      showNotice(e.message, "err");
    } finally {
      setActionLoading(null);
    }
  }

  // Akcija: Plati ratu privatnog kredita
  async function handlePayKreditRata(k: KreditItem) {
    const novaRata = k.uplaceno_rata + 1;
    const ok = window.confirm(`Evidentirati uplatu rate ${novaRata} od ${k.broj_rata} za kredit "${k.naziv}" u iznosu od ${Number(k.iznos_rate).toFixed(2)} ${k.valuta} i automatski umanjiti saldo blagajne?`);
    if (!ok) return;

    setActionLoading(`kredit-${k.id}`);
    try {
      const res = await fetch("/api/owner/krediti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: k.id, action: "pay_installment" }),
      });
      const data = await res.json();
      if (data.ok) {
        showNotice(`✅ Plaćena rata ${data.uplaceno_rata}/${data.broj_rata} za "${k.naziv}"! Saldo blagajne umanjen za ${data.iznosBAM} KM.`);
        await loadData();
      } else {
        showNotice(`Greška: ${data.error}`, "err");
      }
    } catch (e: any) {
      showNotice(e.message, "err");
    } finally {
      setActionLoading(null);
    }
  }

  // Akcija: Toggle status kredita
  async function handleToggleStatusKredit(k: KreditItem) {
    setActionLoading(`kredit-status-${k.id}`);
    try {
      const res = await fetch("/api/owner/krediti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: k.id, action: "toggle_status" }),
      });
      const data = await res.json();
      if (data.ok) {
        showNotice(`Status kredita "${k.naziv}" promijenjen u: ${data.status}`);
        await loadData();
      } else {
        showNotice(`Greška: ${data.error}`, "err");
      }
    } catch (e: any) {
      showNotice(e.message, "err");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSavePretplata(e: React.FormEvent) {
    e.preventDefault();
    if (!editPretplata?.naziv || !editPretplata?.iznos) return;

    try {
      const isEdit = !!editPretplata.id;
      const payload = {
        ...editPretplata,
        zadnje_placeno: editPretplata.zadnje_placeno ? editPretplata.zadnje_placeno.slice(0, 10) : null,
      };
      const res = await fetch("/api/owner/pretplate", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setShowPretplataModal(false);
        setEditPretplata(null);
        showNotice("Pretplata uspješno sačuvana!");
        loadData();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDeletePretplata(id: number) {
    if (!confirm("Da li ste sigurni da želite obrisati ovu pretplatu?")) return;
    try {
      await fetch(`/api/owner/pretplate?id=${id}`, { method: "DELETE" });
      showNotice("Pretplata obrisana.");
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleSaveKredit(e: React.FormEvent) {
    e.preventDefault();
    if (!editKredit?.naziv || !editKredit?.iznos_rate) return;

    try {
      const isEdit = !!editKredit.id;
      const payload = {
        ...editKredit,
        datum_pocetka: editKredit.datum_pocetka ? editKredit.datum_pocetka.slice(0, 10) : null,
        datum_kraja: editKredit.datum_kraja ? editKredit.datum_kraja.slice(0, 10) : null,
      };
      const res = await fetch("/api/owner/krediti", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setShowKreditModal(false);
        setEditKredit(null);
        showNotice("Kredit uspješno sačuvan!");
        loadData();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDeleteKredit(id: number) {
    if (!confirm("Da li ste sigurni da želite obrisati ovaj privatni kredit?")) return;
    try {
      await fetch(`/api/owner/krediti?id=${id}`, { method: "DELETE" });
      showNotice("Kredit obrisan.");
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: 12, border: "1px solid rgba(148, 163, 184, 0.15)", padding: 20, marginTop: 20 }}>
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{notification.text}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* HEADER BANNERS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 15, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 15 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🔒</span>
            <h2 style={{ margin: 0, fontSize: 18, color: "#f8fafc", fontWeight: 800 }}>OWNER TREZOR // Privatni Finansijski Registar</h2>
            <span style={{ fontSize: 11, background: "rgba(99, 102, 241, 0.2)", color: "#818cf8", border: "1px solid #6366f1", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
              STROGO ODVOJENO OD BILANSA FIRME
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
            Evidencija ličnih pretplata i potrošačkih kredita. Klikom na <b>"Plaćeno"</b> ili <b>"+ Plati Ratu"</b> direktno umanjujete raspoloživi saldo privatne blagajne!
          </p>
        </div>

        {/* METRIC BADGES SA REALNIM SALDOM */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ background: "rgba(2, 6, 23, 0.9)", padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(34, 197, 94, 0.5)", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase" }}>💵 Saldo u Blagajni / Džepu</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#4ade80" }}>
              {cashBalance !== null ? `${cashBalance.toFixed(2)} KM` : "—"}
            </div>
          </div>
          <div style={{ background: "rgba(2, 6, 23, 0.8)", padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(56, 189, 248, 0.3)", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase" }}>Pretplate</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#38bdf8" }}>~{totalMonthlyBAM.toFixed(2)} KM <span style={{ fontSize: 10, color: "#64748b" }}>/mj</span></div>
          </div>
          <div style={{ background: "rgba(2, 6, 23, 0.8)", padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(168, 85, 247, 0.3)", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase" }}>Krediti Rate</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#c084fc" }}>{totalKreditiRateBAM.toFixed(2)} KM <span style={{ fontSize: 10, color: "#64748b" }}>/mj</span></div>
          </div>
          <div style={{ background: "rgba(2, 6, 23, 0.9)", padding: "8px 14px", borderRadius: 8, border: `1px solid ${saldoNakonObaveza !== null && saldoNakonObaveza >= 0 ? "rgba(56, 189, 248, 0.5)" : "rgba(239, 68, 68, 0.5)"}`, textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase" }}>🎯 Slobodno nakon obaveza</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: saldoNakonObaveza !== null && saldoNakonObaveza >= 0 ? "#38bdf8" : "#f87171" }}>
              {saldoNakonObaveza !== null ? `${saldoNakonObaveza.toFixed(2)} KM` : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* SUB TABS */}
      <div style={{ display: "flex", gap: 10, margin: "18px 0 15px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 10 }}>
        <button
          type="button"
          onClick={() => setSubTab("pretplate")}
          style={{
            background: subTab === "pretplate" ? "rgba(56, 189, 248, 0.2)" : "transparent",
            color: subTab === "pretplate" ? "#38bdf8" : "#94a3b8",
            border: subTab === "pretplate" ? "1px solid #38bdf8" : "1px solid transparent",
            padding: "8px 16px",
            borderRadius: 6,
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          📱 Lične Pretplate & AI Alati ({pretplate.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab("krediti")}
          style={{
            background: subTab === "krediti" ? "rgba(168, 85, 247, 0.2)" : "transparent",
            color: subTab === "krediti" ? "#c084fc" : "#94a3b8",
            border: subTab === "krediti" ? "1px solid #c084fc" : "1px solid transparent",
            padding: "8px 16px",
            borderRadius: 6,
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          💳 Privatni Potrošački Krediti ({krediti.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab("kalendar")}
          style={{
            background: subTab === "kalendar" ? "rgba(16, 185, 129, 0.2)" : "transparent",
            color: subTab === "kalendar" ? "#10b981" : "#94a3b8",
            border: subTab === "kalendar" ? "1px solid #10b981" : "1px solid transparent",
            padding: "8px 16px",
            borderRadius: 6,
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          📅 Mjesečni Kalendar Dospijeća
        </button>
      </div>

      {/* TAB 1: PRETPLATE */}
      {subTab === "pretplate" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>Kliknite <b>"✓ Plaćeno"</b> kada se pretplata skine sa kartice kako bi se blagajna automatski umanjila.</span>
            <button
              type="button"
              onClick={() => {
                setEditPretplata({
                  naziv: "",
                  kategorija: "SOFTWARE",
                  iznos: 10,
                  valuta: "USD",
                  frekvencija: "MJESECNO",
                  dan_u_mjesecu: 1,
                  nacin_placanja: "Privatna kartica",
                  status: "AKTIVAN",
                });
                setShowPretplataModal(true);
              }}
              style={{
                background: "#0284c7",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              + Dodaj Ličnu Pretplatu
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "rgba(30, 41, 59, 0.7)", color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <th style={{ padding: "10px 12px" }}>Naziv Servisa</th>
                  <th style={{ padding: "10px 12px" }}>Kategorija</th>
                  <th style={{ padding: "10px 12px" }}>Iznos & Valuta</th>
                  <th style={{ padding: "10px 12px" }}>Dan Naplate</th>
                  <th style={{ padding: "10px 12px" }}>Zadnje Plaćeno</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Brze Akcije</th>
                </tr>
              </thead>
              <tbody>
                {pretplate.map((p) => {
                  const katBadgeColor =
                    p.kategorija === "AI" ? "#c084fc" : p.kategorija === "STREAMING" ? "#f43f5e" : p.kategorija === "INFRASTRUCTURE" ? "#38bdf8" : "#94a3b8";
                  const isPendingThis = actionLoading === `pretplata-${p.id}`;

                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: p.status !== "AKTIVAN" ? "rgba(0,0,0,0.2)" : "transparent" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#f8fafc" }}>
                        {p.naziv}
                        {p.napomena && <div style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>{p.napomena}</div>}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.05)", color: katBadgeColor, border: `1px solid ${katBadgeColor}44`, fontWeight: 700 }}>
                          {p.kategorija}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 800, color: "#38bdf8" }}>
                        {Number(p.iznos).toFixed(2)} {p.valuta}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#e2e8f0" }}>
                        {p.dan_u_mjesecu}. u mjesecu
                      </td>
                      <td style={{ padding: "10px 12px", color: p.zadnje_placeno ? "#34d399" : "#64748b", fontSize: 12 }}>
                        {p.zadnje_placeno ? `🟢 ${formatDisplayDate(p.zadnje_placeno)}` : "⚪ Nije evidentirano"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: p.status === "AKTIVAN" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)", color: p.status === "AKTIVAN" ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center" }}>
                          {p.status === "AKTIVAN" && (
                            <button
                              type="button"
                              onClick={() => handlePayPretplata(p)}
                              disabled={isPendingThis || loading}
                              style={{
                                background: "rgba(16, 185, 129, 0.2)",
                                border: "1px solid #10b981",
                                color: "#34d399",
                                padding: "4px 10px",
                                borderRadius: 4,
                                fontWeight: 700,
                                cursor: "pointer",
                                fontSize: 12,
                              }}
                              title="Evidentiraj plaćanje i umanji blagajnu"
                            >
                              {isPendingThis ? "..." : "✓ Plaćeno"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleStatusPretplata(p)}
                            style={{
                              background: "transparent",
                              border: "1px solid rgba(255,255,255,0.2)",
                              color: p.status === "AKTIVAN" ? "#f59e0b" : "#34d399",
                              padding: "4px 8px",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                            title={p.status === "AKTIVAN" ? "Pauziraj / Otkaži" : "Aktiviraj"}
                          >
                            {p.status === "AKTIVAN" ? "⏸ Otkaži" : "▶ Aktiviraj"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditPretplata(p);
                              setShowPretplataModal(true);
                            }}
                            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#cbd5e1", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                          >
                            Uredi
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePretplata(p.id)}
                            style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PRIVATNI KREDITI */}
      {subTab === "krediti" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>Klikom na <b>"+ Plati Ratu"</b> automatski se bilježi otplata rate i iznos se skida sa stanja privatne blagajne.</span>
            <button
              type="button"
              onClick={() => {
                setEditKredit({
                  naziv: "",
                  banka: "Robni kredit / Kupovina na rate",
                  ukupan_iznos: 545,
                  iznos_rate: 109,
                  valuta: "BAM",
                  broj_rata: 5,
                  uplaceno_rata: 0,
                  dan_u_mjesecu: 20,
                  status: "AKTIVAN",
                });
                setShowKreditModal(true);
              }}
              style={{
                background: "#9333ea",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              + Dodaj Privatni Kredit
            </button>
          </div>

          {krediti.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: "#64748b", background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
              Trenutno nemate unesenih privatnih potrošačkih kredita. Kliknite na dugme iznad za unos.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 15 }}>
              {krediti.map((k) => {
                const preostaloRata = Math.max(0, k.broj_rata - k.uplaceno_rata);
                const preostaliIznos = preostaloRata * Number(k.iznos_rate);
                const procenat = Math.min(100, Math.round((k.uplaceno_rata / k.broj_rata) * 100));
                const isPendingThis = actionLoading === `kredit-${k.id}`;

                return (
                  <div key={k.id} style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(168, 85, 247, 0.3)", borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 16, color: "#f8fafc", fontWeight: 800 }}>{k.naziv}</h4>
                        <div style={{ fontSize: 12, color: "#c084fc", marginTop: 2 }}>{k.banka || "Lični kredit"}</div>
                      </div>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: k.status === "AKTIVAN" ? "rgba(16, 185, 129, 0.2)" : k.status === "OTPLACENO" ? "rgba(56, 189, 248, 0.2)" : "rgba(239, 68, 68, 0.2)", color: k.status === "AKTIVAN" ? "#10b981" : k.status === "OTPLACENO" ? "#38bdf8" : "#ef4444", fontWeight: 700 }}>
                        {k.status}
                      </span>
                    </div>

                    <div style={{ margin: "14px 0", background: "rgba(0,0,0,0.3)", padding: "10px 12px", borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: "#94a3b8" }}>Mjesečna Rata:</span>
                        <span style={{ fontWeight: 800, color: "#38bdf8" }}>{Number(k.iznos_rate).toFixed(2)} {k.valuta}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: "#94a3b8" }}>Dan naplate:</span>
                        <span style={{ color: "#f8fafc", fontWeight: 700 }}>{k.dan_u_mjesecu}. u mjesecu</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: "#94a3b8" }}>Preostalo duga:</span>
                        <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{preostaliIznos.toFixed(2)} {k.valuta} ({preostaloRata} rata)</span>
                      </div>
                    </div>

                    {/* PROGRESS BAR */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                        <span>Otplata ({k.uplaceno_rata}/{k.broj_rata} rata)</span>
                        <span>{procenat}%</span>
                      </div>
                      <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${procenat}%`, height: "100%", background: "#a855f7" }} />
                      </div>
                    </div>

                    {/* AKCIJSKO DUGME ZA RATA */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                      <div>
                        {k.status === "AKTIVAN" && preostaloRata > 0 ? (
                          <button
                            type="button"
                            onClick={() => handlePayKreditRata(k)}
                            disabled={isPendingThis || loading}
                            style={{
                              background: "linear-gradient(135deg, #9333ea, #7c3aed)",
                              color: "#fff",
                              border: "none",
                              padding: "6px 14px",
                              borderRadius: 6,
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span>💵</span> {isPendingThis ? "Knjiženje..." : `+ Plati Ratu (${Number(k.iznos_rate).toFixed(2)} KM)`}
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700 }}>🎉 Kredit u potpunosti otplaćen!</span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatusKredit(k)}
                          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: k.status === "AKTIVAN" ? "#f59e0b" : "#34d399", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                          title={k.status === "AKTIVAN" ? "Pauziraj kredit" : "Aktiviraj kredit"}
                        >
                          {k.status === "AKTIVAN" ? "⏸" : "▶"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditKredit(k);
                            setShowKreditModal(true);
                          }}
                          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#cbd5e1", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                        >
                          Uredi
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteKredit(k.id)}
                          style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: KALENDAR DOSPIJEĆA */}
      {subTab === "kalendar" && (
        <div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 14 }}>
            Hronološki raspored kada koje lične obaveze dospijevaju na naplatu tokom mjeseca:
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((dan) => {
              const matchesPretplate = pretplate.filter((p) => p.status === "AKTIVAN" && Number(p.dan_u_mjesecu) === dan);
              const matchesKrediti = krediti.filter((k) => k.status === "AKTIVAN" && Number(k.dan_u_mjesecu) === dan);

              if (matchesPretplate.length === 0 && matchesKrediti.length === 0) return null;

              return (
                <div key={dan} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(30, 41, 59, 0.4)", padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ width: 45, height: 45, borderRadius: 8, background: "rgba(56, 189, 248, 0.15)", border: "1px solid #38bdf8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>DAN</span>
                    <span style={{ fontSize: 17, fontWeight: 900, color: "#38bdf8", lineHeight: 1 }}>{dan}</span>
                  </div>

                  <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {matchesPretplate.map((p) => (
                      <div key={p.id} style={{ background: "rgba(2, 6, 23, 0.6)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(56, 189, 248, 0.3)", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{p.naziv}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#38bdf8" }}>{Number(p.iznos).toFixed(2)} {p.valuta}</span>
                      </div>
                    ))}
                    {matchesKrediti.map((k) => (
                      <div key={k.id} style={{ background: "rgba(2, 6, 23, 0.6)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(168, 85, 247, 0.3)", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#c084fc" }}>💳 {k.naziv}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#c084fc" }}>{Number(k.iznos_rate).toFixed(2)} {k.valuta}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL ZA PRETPALTE */}
      {showPretplataModal && editPretplata && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#0f172a", border: "1px solid #38bdf8", borderRadius: 12, padding: 24, width: 450, maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 16px", color: "#f8fafc" }}>{editPretplata.id ? "Izmijeni Ličnu Pretplatu" : "Nova Lična Pretplata"}</h3>
            <form onSubmit={handleSavePretplata} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Naziv Servisa</label>
                <input
                  type="text"
                  required
                  value={editPretplata.naziv || ""}
                  onChange={(e) => setEditPretplata({ ...editPretplata, naziv: e.target.value })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Iznos</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPretplata.iznos ?? ""}
                    onChange={(e) => setEditPretplata({ ...editPretplata, iznos: Number(e.target.value) })}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Valuta</label>
                  <select
                    value={editPretplata.valuta || "USD"}
                    onChange={(e) => setEditPretplata({ ...editPretplata, valuta: e.target.value })}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="BAM">BAM (KM)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Kategorija</label>
                  <select
                    value={editPretplata.kategorija || "SOFTWARE"}
                    onChange={(e) => setEditPretplata({ ...editPretplata, kategorija: e.target.value })}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                  >
                    <option value="AI">AI Alati</option>
                    <option value="SOFTWARE">Softver / Alati</option>
                    <option value="STREAMING">Streaming / Muzika</option>
                    <option value="INFRASTRUCTURE">Infrastruktura / Cloud</option>
                    <option value="OTHER">Ostalo</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Dan naplate</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={editPretplata.dan_u_mjesecu || 1}
                    onChange={(e) => setEditPretplata({ ...editPretplata, dan_u_mjesecu: Number(e.target.value) })}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Način plaćanja</label>
                <input
                  type="text"
                  value={editPretplata.nacin_placanja || "Privatna kartica"}
                  onChange={(e) => setEditPretplata({ ...editPretplata, nacin_placanja: e.target.value })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPretplataModal(false);
                    setEditPretplata(null);
                  }}
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

      {/* MODAL ZA KREDITE */}
      {showKreditModal && editKredit && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#0f172a", border: "1px solid #c084fc", borderRadius: 12, padding: 24, width: 450, maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 16px", color: "#f8fafc" }}>{editKredit.id ? "Izmijeni Privatni Kredit" : "Novi Privatni Potrošački Kredit"}</h3>
            <form onSubmit={handleSaveKredit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Naziv Kredita / Svrha</label>
                <input
                  type="text"
                  required
                  value={editKredit.naziv || ""}
                  onChange={(e) => setEditKredit({ ...editKredit, naziv: e.target.value })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Banka / Finansijska Ustanova</label>
                <input
                  type="text"
                  value={editKredit.banka || ""}
                  onChange={(e) => setEditKredit({ ...editKredit, banka: e.target.value })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Mjesečna Rata</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editKredit.iznos_rate ?? ""}
                    onChange={(e) => setEditKredit({ ...editKredit, iznos_rate: Number(e.target.value) })}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Dan u mjesecu</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={editKredit.dan_u_mjesecu || 20}
                    onChange={(e) => setEditKredit({ ...editKredit, dan_u_mjesecu: Number(e.target.value) })}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Ukupno Rata</label>
                  <input
                    type="number"
                    min="1"
                    value={editKredit.broj_rata || 12}
                    onChange={(e) => setEditKredit({ ...editKredit, broj_rata: Number(e.target.value) })}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>Uplaćeno Rata</label>
                  <input
                    type="number"
                    min="0"
                    value={editKredit.uplaceno_rata ?? 0}
                    onChange={(e) => setEditKredit({ ...editKredit, uplaceno_rata: Number(e.target.value) })}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 6, color: "#fff", marginTop: 4 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowKreditModal(false);
                    setEditKredit(null);
                  }}
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#cbd5e1", padding: "8px 16px", borderRadius: 6, cursor: "pointer" }}
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  style={{ background: "#9333ea", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}
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
