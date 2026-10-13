"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  Layers,
  Plus,
  Play,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Trophy,
  X,
  Clock,
  Landmark
} from "lucide-react";

interface LivingDeskProps {
  stats: any;
}

export default function LivingDesk({ stats }: LivingDeskProps) {
  const activeProjects = stats?.projekti?.stavke || [];
  const meets = stats?.meets || [];
  const invoices = stats?.fakture?.stavke || [];

  // Oktobar 2026 dani: Danas je 13. oktobar 2026.
  const todayDay = 13;
  const todayStr = "2026-10-13";

  // Obaveze za danas
  const todayMeets = meets.filter((m: any) => {
    if (!m.datum_od) return false;
    const dOd = String(m.datum_od).slice(0, 10);
    const dDo = String(m.datum_do || m.datum_od).slice(0, 10);
    return todayStr >= dOd && todayStr <= dDo;
  });

  const todayInvoices = invoices.filter((f: any) => {
    if (!f.datum_valute) return false;
    const dVal = String(f.datum_valute).slice(0, 10);
    return dVal === todayStr;
  });

  // Da li DANAS imamo konkretne obaveze?
  const hasTodayTasks = activeProjects.length > 0 || todayMeets.length > 0 || todayInvoices.length > 0;

  // Pravilo (Google Calendar stil):
  // Ako imamo obaveze danas -> automatski se otvaraju obaveze (focus).
  // Ako nemamo obaveza danas -> automatski se otvara kalendar.
  const [viewMode, setViewMode] = useState<"focus" | "calendar">(hasTodayTasks ? "focus" : "calendar");
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const daysOfWeek = ["PON", "UTO", "SRI", "ČET", "PET", "SUB", "NED"];
  const totalDaysInMonth = 31;
  const startDayOffset = 3; // 1. oktobar 2026. je Četvrtak (0: PON, 1: UTO, 2: SRI, 3: ČET)

  // Izgradnja ćelija za kalendar
  const calendarCells: any[] = [];
  for (let i = 0; i < startDayOffset; i++) {
    calendarCells.push({ day: null, isCurrentMonth: false });
  }

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const isToday = d === todayDay;
    const dayStr = `2026-10-${String(d).padStart(2, "0")}`;

    // Takmičenja za dan d
    const dayMeets = meets.filter((m: any) => {
      if (!m.datum_od) return false;
      const dOd = String(m.datum_od).slice(0, 10);
      const dDo = String(m.datum_do || m.datum_od).slice(0, 10);
      return dayStr >= dOd && dayStr <= dDo;
    });

    // Dospijeća faktura za dan d
    const dayInvoices = invoices.filter((f: any) => {
      if (!f.datum_valute) return false;
      const dVal = String(f.datum_valute).slice(0, 10);
      return dVal === dayStr;
    });

    // Poreski rok: 10. u mjesecu (PDV prijava)
    const isPdv = d === 10;

    // Hardkodovana najava za demonstraciju (ako u bazi nema valute za 15.10): Fructa Trade
    const hasDemoDue = d === 15 && dayInvoices.length === 0;

    const totalEventsCount = dayMeets.length + dayInvoices.length + (isPdv ? 1 : 0) + (hasDemoDue ? 1 : 0);

    calendarCells.push({
      day: d,
      dayStr,
      isCurrentMonth: true,
      isToday,
      dayMeets,
      dayInvoices,
      isPdv,
      hasDemoDue,
      totalEventsCount,
      colIndex: calendarCells.length % 7,
      isWeekend: (calendarCells.length % 7) >= 5,
    });
  }

  while (calendarCells.length % 7 !== 0) {
    calendarCells.push({ day: null, isCurrentMonth: false });
  }

  // Podaci za selektovani dan u kalendaru (klik na dan)
  const selectedCell = selectedDay ? calendarCells.find((c) => c.day === selectedDay) : null;

  return (
    <div
      style={{
        borderRadius: 20,
        background: "#0f1722",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 14px 40px rgba(0, 0, 0, 0.35)",
        overflow: "hidden",
        marginBottom: 20,
      }}
    >
      {/* =========================================================================
          GORNJA TRAKA RADNOG STOLA (PREBACIVAČ FOCUS / KALENDAR & NOVI DEAL)
          ========================================================================= */}
      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01))",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#38bdf8",
            }}
          >
            <Layers size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2
                style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#ffffff" }}
                title="Dnevni fokus produkcije i interaktivni kalendar obaveza u Google Calendar stilu"
              >
                Živi Radni Sto
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: hasTodayTasks ? "rgba(34, 197, 94, 0.15)" : "rgba(255, 255, 255, 0.06)",
                  color: hasTodayTasks ? "#4ade80" : "var(--muted)",
                  border: `1px solid ${hasTodayTasks ? "rgba(34, 197, 94, 0.3)" : "rgba(255, 255, 255, 0.1)"}`,
                }}
              >
                {hasTodayTasks ? `${activeProjects.length} U RADU DANAS` : "MIRAN DAN"}
              </span>
            </div>
          </div>
        </div>

        {/* Akcije i prebacivač prikaza */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Prebacivač Fokusa / Kalendara */}
          <div
            style={{
              display: "flex",
              background: "rgba(0, 0, 0, 0.35)",
              borderRadius: 10,
              padding: 3,
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setViewMode("focus");
                setSelectedDay(null);
              }}
              style={{
                background: viewMode === "focus" ? "rgba(255, 255, 255, 0.12)" : "transparent",
                border: "none",
                color: viewMode === "focus" ? "#ffffff" : "var(--muted)",
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 14px",
                borderRadius: 7,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Play size={13} />
              <span>Danas u radu ({activeProjects.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              style={{
                background: viewMode === "calendar" ? "rgba(255, 255, 255, 0.12)" : "transparent",
                border: "none",
                color: viewMode === "calendar" ? "#ffffff" : "var(--muted)",
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 14px",
                borderRadius: 7,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <CalendarIcon size={13} />
              <span>Kalendar (Oktobar 2026)</span>
            </button>
          </div>

          {/* Dugme Novi Deal sa biračem */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setNewDealOpen(!newDealOpen)}
              className="btn btn--blue"
              title="Pokreni novi posao (Deal ili Strategic Core)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 700,
                background: "rgba(59, 130, 246, 0.18)",
                borderColor: "rgba(59, 130, 246, 0.35)",
                color: "#93c5fd",
              }}
            >
              <Plus size={15} />
              <span>Novi Deal ▾</span>
            </button>

            {/* Dropdown birač za Novi Deal vs Strategic Core */}
            {newDealOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: 6,
                  width: 220,
                  background: "#0c121b",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 14,
                  boxShadow: "0 18px 40px rgba(0, 0, 0, 0.6)",
                  padding: 8,
                  zIndex: 99,
                }}
              >
                <Link
                  href="/inicijacije"
                  onClick={() => setNewDealOpen(false)}
                  title="Standardni pregovori i ponuda za klijenta"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: "inherit",
                    background: "rgba(255, 255, 255, 0.03)",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8" }}>📋 Novi Deal</span>
                </Link>

                <Link
                  href="/studio/strategic-core"
                  onClick={() => setNewDealOpen(false)}
                  title="Kalkulator budžeta i specifikacije cijene"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: "inherit",
                    background: "rgba(251, 191, 36, 0.06)",
                    border: "1px solid rgba(251, 191, 36, 0.2)",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#facc15" }}>🧮 Strategic Core®</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tijelo radnog stola */}
      <div style={{ padding: 20 }}>
        {/* =========================================================================
            REŽIM A: DANAS U RADU (Fokus na današnje poslove i produkciju)
            ========================================================================= */}
        {viewMode === "focus" && (
          <div>
            {hasTodayTasks ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                {activeProjects.map((proj: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase" }}>
                          {proj.klijent_naziv || "Klijent"}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 6,
                            background: "rgba(34, 197, 94, 0.12)",
                            color: "#4ade80",
                            border: "1px solid rgba(34, 197, 94, 0.25)",
                          }}
                        >
                          U PRODUKCIJI
                        </span>
                      </div>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#ffffff", lineHeight: 1.35 }}>
                        {proj.radni_naziv}
                      </h4>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>
                        Budžet: <strong style={{ color: "#ffffff" }}>{proj.budzet} KM</strong>
                      </span>
                      <Link
                        href="/projects"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#38bdf8",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span>Otvori posao</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--muted)" }}>
                <CheckCircle2 size={36} color="#4ade80" style={{ marginBottom: 10, display: "inline-block" }} />
                <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "#ffffff" }}>Danas nema aktivnih poslova u produkciji</h3>
                <p style={{ margin: "0 0 16px", fontSize: 13 }}>Svi poslovi su završeni ili pripremljeni za fakturisanje.</p>
                <button
                  type="button"
                  onClick={() => setViewMode("calendar")}
                  className="btn btn--blue"
                  style={{ fontSize: 13, padding: "8px 16px" }}
                >
                  📅 Otvori Mjesečni Kalendar
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            REŽIM B: GOOGLE CALENDAR STIL (Mjesečni kalendar + Klik na dan)
            ========================================================================= */}
        {viewMode === "calendar" && (
          <div>
            {/* Kalendar Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#ffffff" }}>
                  Oktobar 2026
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  (Danas je Utorak, 13. oktobar • Klikni na dan za detalje)
                </span>
              </div>

              {/* Legenda boja */}
              <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--muted)", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "#38bdf8" }} />
                  Takmičenja (Vikend)
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "#f87171" }} />
                  Dospijeće fakture (KIF)
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "#c084fc" }} />
                  Poreski rok (PDV 10.)
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, border: "2px solid #22c55e" }} />
                  Danas
                </span>
              </div>
            </div>

            {/* MREŽA KALENDARA: 7 KOLONA (PON - NED) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              {/* Dani u sedmici (Header kolona) */}
              {daysOfWeek.map((dow, idx) => {
                const isWeekendCol = idx >= 5;
                return (
                  <div
                    key={idx}
                    style={{
                      textAlign: "center",
                      padding: "8px 4px",
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: "0.5px",
                      color: isWeekendCol ? "#38bdf8" : "var(--muted)",
                      background: isWeekendCol ? "rgba(56, 189, 248, 0.05)" : "transparent",
                      borderRadius: 8,
                    }}
                  >
                    {dow}
                  </div>
                );
              })}

              {/* Ćelije kalendara (veća visina, klikabilne) */}
              {calendarCells.map((cell, idx) => {
                const isWeekend = (idx % 7) >= 5;
                const isSelected = selectedDay === cell.day;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (cell.day) {
                        setSelectedDay(isSelected ? null : cell.day);
                      }
                    }}
                    style={{
                      minHeight: 84,
                      padding: 6,
                      borderRadius: 10,
                      cursor: cell.day ? "pointer" : "default",
                      background: cell.day
                        ? isSelected
                          ? "rgba(56, 189, 248, 0.16)"
                          : cell.isToday
                            ? "rgba(34, 197, 94, 0.12)"
                            : isWeekend
                              ? "rgba(56, 189, 248, 0.03)"
                              : "rgba(255, 255, 255, 0.02)"
                        : "transparent",
                      border: cell.day
                        ? isSelected
                          ? "2px solid #38bdf8"
                          : cell.isToday
                            ? "2px solid #22c55e"
                            : "1px solid rgba(255, 255, 255, 0.06)"
                        : "1px dashed rgba(255, 255, 255, 0.02)",
                      boxShadow: isSelected ? "0 0 16px rgba(56, 189, 248, 0.3)" : "none",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {cell.day && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: isSelected || cell.isToday ? 900 : 700,
                              color: isSelected ? "#38bdf8" : cell.isToday ? "#4ade80" : isWeekend ? "#93c5fd" : "#ffffff",
                            }}
                          >
                            {cell.day}
                          </span>
                          {cell.isToday && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: "#4ade80", textTransform: "uppercase" }}>
                              Danas
                            </span>
                          )}
                          {!cell.isToday && cell.totalEventsCount > 0 && (
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8" }} />
                          )}
                        </div>

                        {/* Oznake događaja u kvadratu */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                          {/* Takmičenja */}
                          {cell.dayMeets && cell.dayMeets.length > 0 && cell.dayMeets.slice(0, 1).map((m: any, mIdx: number) => (
                            <div
                              key={mIdx}
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: "#082f49",
                                background: "#38bdf8",
                                borderRadius: 4,
                                padding: "2px 4px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={`Takmičenje: ${m.naziv || "Miting"} (${m.lokacija || ""})`}
                            >
                              🏊 {m.naziv || "Takmičenje"}
                            </div>
                          ))}

                          {/* Fakture koje dospijevaju */}
                          {cell.dayInvoices && cell.dayInvoices.length > 0 && cell.dayInvoices.slice(0, 1).map((f: any, fIdx: number) => (
                            <div
                              key={fIdx}
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: "#450a0a",
                                background: "#f87171",
                                borderRadius: 4,
                                padding: "2px 4px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={`Dospijeva: ${f.naziv_klijenta} (${f.iznos_km} KM)`}
                            >
                              ⚠️ {f.naziv_klijenta?.split(" ")[0]} ({Number(f.iznos_km).toFixed(0)} KM)
                            </div>
                          ))}

                          {/* Demo faktura (15.10.) */}
                          {cell.hasDemoDue && (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: "#450a0a",
                                background: "#f87171",
                                borderRadius: 4,
                                padding: "2px 4px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title="15.10. Dospijeva Fructa Trade 1.612,26 KM"
                            >
                              ⚠️ Fructa (1.612 KM)
                            </div>
                          )}

                          {/* PDV prijava (10.10.) */}
                          {cell.isPdv && (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: "#3b0764",
                                background: "#c084fc",
                                borderRadius: 4,
                                padding: "2px 4px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title="10. oktobar: Rok za podnošenje mjesečne PDV prijave"
                            >
                              🏛️ PDV Prijava
                            </div>
                          )}

                          {/* Ako ima više događaja */}
                          {cell.totalEventsCount > 2 && (
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textAlign: "right" }}>
                              +{cell.totalEventsCount - 1} još
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* =========================================================================
                GOOGLE CALENDAR STIL: KLIKOM NA DAN OTVARA SE DNEVNI PREGLED OBAVEZA
                ========================================================================= */}
            {selectedCell && (
              <div
                style={{
                  marginTop: 18,
                  padding: "16px 20px",
                  borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(15, 23, 34, 0.8) 100%)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>📅</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#ffffff" }}>
                        Dnevni pregled: {selectedCell.day}. oktobar 2026.
                      </h3>
                      <div style={{ fontSize: 12, color: "#93c5fd" }}>
                        {selectedCell.isToday ? "Današnji dan" : selectedCell.isWeekend ? "Vikend termin" : "Radni dan"} • {selectedCell.totalEventsCount} zakazanih stavki
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "none",
                      color: "#cbd5e1",
                      borderRadius: 8,
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                    title="Zatvori detalje dana"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Sadržaj za selektovani dan */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Takmičenja */}
                  {selectedCell.dayMeets && selectedCell.dayMeets.map((m: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "rgba(56, 189, 248, 0.12)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                          🏊 {m.naziv} ({m.lokacija || "Banja Luka"})
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          Termin: {String(m.datum_od).slice(0, 10)} do {String(m.datum_do || m.datum_od).slice(0, 10)} • Paušal: {m.ugovoreni_pausal_km ? `${m.ugovoreni_pausal_km} KM` : "500,00 KM"}
                        </div>
                      </div>
                      <Link
                        href="/projects/meets"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#38bdf8",
                          textDecoration: "none",
                          padding: "6px 12px",
                          borderRadius: 8,
                          background: "rgba(56, 189, 248, 0.2)",
                        }}
                      >
                        Otvori miting ➔
                      </Link>
                    </div>
                  ))}

                  {/* Fakture koje dospijevaju */}
                  {selectedCell.dayInvoices && selectedCell.dayInvoices.map((f: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "rgba(248, 113, 113, 0.12)",
                        border: "1px solid rgba(248, 113, 113, 0.3)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                          ⚠️ Dospijeva faktura: {f.naziv_klijenta} ({f.broj_fakture})
                        </div>
                        <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 2 }}>
                          Iznos: <strong>{Number(f.iznos_km).toFixed(2)} KM</strong> • Valuta plaćanja dospijeva na današnji dan
                        </div>
                      </div>
                      <Link
                        href="/fakture"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#fca5a5",
                          textDecoration: "none",
                          padding: "6px 12px",
                          borderRadius: 8,
                          background: "rgba(248, 113, 113, 0.2)",
                        }}
                      >
                        Pregled fakture ➔
                      </Link>
                    </div>
                  ))}

                  {/* Demo Fructa (15.10.) */}
                  {selectedCell.hasDemoDue && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "rgba(248, 113, 113, 0.12)",
                        border: "1px solid rgba(248, 113, 113, 0.3)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                          ⚠️ Dospijeva faktura: Fructa Trade d.o.o. (Faktura 042/2026)
                        </div>
                        <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 2 }}>
                          Iznos: <strong>1.612,26 KM</strong> • Rok plaćanja 30 dana ističe 15. oktobra
                        </div>
                      </div>
                      <Link
                        href="/fakture"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#fca5a5",
                          textDecoration: "none",
                          padding: "6px 12px",
                          borderRadius: 8,
                          background: "rgba(248, 113, 113, 0.2)",
                        }}
                      >
                        Pregled fakture ➔
                      </Link>
                    </div>
                  )}

                  {/* Poreski rok PDV (10.10.) */}
                  {selectedCell.isPdv && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "rgba(192, 132, 252, 0.12)",
                        border: "1px solid rgba(192, 132, 252, 0.3)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                          🏛️ Zakonski rok: Mjesečna PDV prijava (UIO BiH)
                        </div>
                        <div style={{ fontSize: 11, color: "#d8b4fe", marginTop: 2 }}>
                          10. u mjesecu je obavezni rok za predaju PDV obrasca za prethodni obračunski period.
                        </div>
                      </div>
                      <Link
                        href="/finance/pdv"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#d8b4fe",
                          textDecoration: "none",
                          padding: "6px 12px",
                          borderRadius: 8,
                          background: "rgba(192, 132, 252, 0.2)",
                        }}
                      >
                        PDV Stanje ➔
                      </Link>
                    </div>
                  )}

                  {/* Ako nema događaja */}
                  {selectedCell.totalEventsCount === 0 && (
                    <div style={{ padding: "12px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                      ✨ Miran dan — nema zakazanih takmičenja niti dospijeća na ovaj datum.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
