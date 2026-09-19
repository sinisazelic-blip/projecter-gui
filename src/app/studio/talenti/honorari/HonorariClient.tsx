"use client";

import { useState } from "react";
import Link from "next/link";
import { formatAmount } from "@/lib/format";

type HonorarRow = {
  trosak_id: number | string;
  projekat_id?: number | null;
  naziv_projekta?: string | null;
  naziv_klijenta?: string | null;
  talent_id: number;
  talent_naziv: string;
  talent_vrsta?: string | null;
  honorar_iznos_km: number;
  honorar_opis?: string | null;
  datum_angazmana?: string | null;
  faktura_id?: number | null;
  broj_fakture?: string | null;
  faktura_status_naplate: string;
  vec_isplaceno_km: number;
};

export default function HonorariClient({
  initialRows,
  locale = "sr",
}: {
  initialRows: HonorarRow[];
  locale?: string;
}) {
  const [viewMode, setViewMode] = useState<"ITEMS" | "TALENTS">("ITEMS");
  const [filter, setFilter] = useState<"ALL" | "READY" | "WAITING" | "PAID">("ALL");
  const [search, setSearch] = useState("");

  const fmtDate = (d?: string | null) => {
    if (!d) return "—";
    const s = String(d).slice(0, 10);
    const parts = s.split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return s;
  };

  const rows = initialRows.map((r) => {
    const iznos = Number(r.honorar_iznos_km) || 0;
    const isplaceno = Number(r.vec_isplaceno_km) || 0;
    const preostalo = Math.max(0, iznos - isplaceno);

    let statusType: "PAID" | "READY" | "WAITING" = "WAITING";
    if (preostalo <= 0.01) {
      statusType = "PAID";
    } else if (r.faktura_status_naplate === "PLACENO") {
      statusType = "READY";
    } else {
      statusType = "WAITING";
    }

    return {
      ...r,
      iznos,
      isplaceno,
      preostalo,
      statusType,
    };
  });

  const filtered = rows.filter((r) => {
    if (filter === "READY" && r.statusType !== "READY") return false;
    if (filter === "WAITING" && r.statusType !== "WAITING") return false;
    if (filter === "PAID" && r.statusType !== "PAID") return false;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchTalent = r.talent_naziv?.toLowerCase().includes(q);
      const matchProject = r.naziv_projekta?.toLowerCase().includes(q);
      const matchClient = r.naziv_klijenta?.toLowerCase().includes(q);
      const matchOpis = r.honorar_opis?.toLowerCase().includes(q);
      if (!matchTalent && !matchProject && !matchClient && !matchOpis) return false;
    }
    return true;
  });

  // Group by talent for the Talents summary view
  const talentsMap: Record<
    number,
    {
      talent_id: number;
      talent_naziv: string;
      talent_vrsta?: string | null;
      ukupno_ugovoreno: number;
      ukupno_isplaceno: number;
      preostalo: number;
      spremno: number;
      ceka: number;
      broj_stavki: number;
    }
  > = {};

  for (const r of rows) {
    if (!talentsMap[r.talent_id]) {
      talentsMap[r.talent_id] = {
        talent_id: r.talent_id,
        talent_naziv: r.talent_naziv,
        talent_vrsta: r.talent_vrsta,
        ukupno_ugovoreno: 0,
        ukupno_isplaceno: 0,
        preostalo: 0,
        spremno: 0,
        ceka: 0,
        broj_stavki: 0,
      };
    }
    const t = talentsMap[r.talent_id];
    t.ukupno_ugovoreno += r.iznos;
    t.ukupno_isplaceno += r.isplaceno;
    t.preostalo += r.preostalo;
    if (r.statusType === "READY") t.spremno += r.preostalo;
    if (r.statusType === "WAITING") t.ceka += r.preostalo;
    t.broj_stavki += 1;
  }

  const talentList = Object.values(talentsMap).sort((a, b) => b.preostalo - a.preostalo);
  const filteredTalents = talentList.filter((t) => {
    if (filter === "READY" && t.spremno <= 0.01) return false;
    if (filter === "WAITING" && t.ceka <= 0.01) return false;
    if (filter === "PAID" && t.preostalo > 0.01) return false;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return t.talent_naziv.toLowerCase().includes(q) || (t.talent_vrsta && t.talent_vrsta.toLowerCase().includes(q));
    }
    return true;
  });

  const totalHonorar = rows.reduce((s, r) => s + r.iznos, 0);
  const totalIsplaceno = rows.reduce((s, r) => s + r.isplaceno, 0);
  const totalPreostalo = Math.max(0, totalHonorar - totalIsplaceno);
  const totalSpremno = rows.filter((r) => r.statusType === "READY").reduce((s, r) => s + r.preostalo, 0);
  const totalCeka = rows.filter((r) => r.statusType === "WAITING").reduce((s, r) => s + r.preostalo, 0);

  return (
    <div>
      {/* SUMMARY KARTICE */}
      <div
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            🎙️ Ukupno ugovoreno
          </div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {formatAmount(totalHonorar, locale)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Sve obaveze i početna stanja
          </div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4, color: "#38bdf8" }}>
            💵 Isplaćeno (Blagajna)
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#38bdf8" }}>
            {formatAmount(totalIsplaceno, locale)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Gotovinske isplate saradnicima
          </div>
        </div>

        <div style={{ background: "rgba(239, 68, 68, 0.08)", padding: 12, borderRadius: 8 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4, color: "#f87171" }}>
            🔴 Preostali stvarni dug
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f87171" }}>
            {formatAmount(totalPreostalo, locale)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Neto preostalo za isplatu
          </div>
        </div>

        <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: 12, borderRadius: 8 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4, color: "#34d399" }}>
            🟢 Spremno (Klijent platio)
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#34d399" }}>
            {formatAmount(totalSpremno, locale)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Može se odmah isplatiti
          </div>
        </div>

        <div style={{ background: "rgba(245, 158, 11, 0.08)", padding: 12, borderRadius: 8 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4, color: "#fbbf24" }}>
            ⏳ Čeka naplatu fakture
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24" }}>
            {formatAmount(totalCeka, locale)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Isplata nakon uplate klijenta
          </div>
        </div>
      </div>

      {/* FILTERI & TOGGLE PREGLEDA */}
      <div className="card tableCard" style={{ marginBottom: 16 }}>
        <div
          style={{
            padding: 16,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* VIEW MODE TABS */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={`btn ${viewMode === "ITEMS" ? "btn--active" : ""}`}
              onClick={() => setViewMode("ITEMS")}
              style={viewMode === "ITEMS" ? { fontWeight: 700 } : {}}
            >
              📋 Pojedinačni angažmani ({rows.length})
            </button>
            <button
              type="button"
              className={`btn ${viewMode === "TALENTS" ? "btn--active" : ""}`}
              onClick={() => setViewMode("TALENTS")}
              style={viewMode === "TALENTS" ? { fontWeight: 700 } : {}}
            >
              👥 Zbirno po saradnicima ({talentList.length})
            </button>
          </div>

          <div style={{ minWidth: 260 }}>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraži saradnika, projekat ili opis..."
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* STATUS FILTER BUTTONS */}
        <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap", background: "rgba(0,0,0,0.15)" }}>
          <button
            type="button"
            className={`btn btn--sm ${filter === "ALL" ? "btn--active" : ""}`}
            onClick={() => setFilter("ALL")}
          >
            Svi {viewMode === "ITEMS" ? `(${rows.length})` : `(${talentList.length})`}
          </button>
          <button
            type="button"
            className={`btn btn--sm ${filter === "READY" ? "btn--active" : ""}`}
            onClick={() => setFilter("READY")}
            style={filter === "READY" ? { background: "#10b981", borderColor: "#10b981", color: "#fff" } : {}}
          >
            🟢 Spremno za isplatu
          </button>
          <button
            type="button"
            className={`btn btn--sm ${filter === "WAITING" ? "btn--active" : ""}`}
            onClick={() => setFilter("WAITING")}
            style={filter === "WAITING" ? { background: "#f59e0b", borderColor: "#f59e0b", color: "#fff" } : {}}
          >
            ⏳ Čeka klijenta
          </button>
          <button
            type="button"
            className={`btn btn--sm ${filter === "PAID" ? "btn--active" : ""}`}
            onClick={() => setFilter("PAID")}
          >
            ✅ Isplaćeno
          </button>
        </div>

        {/* VIEW 1: POJEDINAČNI ANGAŽMANI */}
        {viewMode === "ITEMS" && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Datum</th>
                  <th style={{ width: 220 }}>Saradnik / Spiker</th>
                  <th style={{ width: 220 }}>Projekat & Klijent</th>
                  <th>Opis angažmana</th>
                  <th style={{ width: 130, textAlign: "right" }}>Ugovoreno</th>
                  <th style={{ width: 130, textAlign: "right" }}>Isplaćeno</th>
                  <th style={{ width: 130, textAlign: "right" }}>Preostalo</th>
                  <th style={{ width: 170, textAlign: "center" }}>Status isplate</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((r) => (
                    <tr key={r.trosak_id}>
                      <td>{fmtDate(r.datum_angazmana)}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{r.talent_naziv}</div>
                        <div className="subtle" style={{ fontSize: 12 }}>{r.talent_vrsta || "Saradnik"}</div>
                      </td>
                      <td>
                        {r.projekat_id ? (
                          <Link href={`/projects/${r.projekat_id}`} style={{ fontWeight: 600, color: "inherit" }}>
                            {r.naziv_projekta || `Projekat #${r.projekat_id}`}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 600, color: "#fbbf24" }}>
                            {r.naziv_projekta || "Istorijsko dugovanje"}
                          </span>
                        )}
                        <div className="subtle" style={{ fontSize: 12 }}>{r.naziv_klijenta || "—"}</div>
                      </td>
                      <td>
                        <div>{r.honorar_opis || "Honorarni angažman"}</div>
                        {r.broj_fakture && (
                          <div className="subtle" style={{ fontSize: 11, marginTop: 2 }}>
                            Faktura: <b>{r.broj_fakture}</b> ({r.faktura_status_naplate === "PLACENO" ? "🟢 Klijent platio" : "⏳ Čeka naplatu"})
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {formatAmount(r.iznos, locale)}
                      </td>
                      <td style={{ textAlign: "right", color: r.isplaceno > 0 ? "#38bdf8" : "#64748b" }}>
                        {formatAmount(r.isplaceno, locale)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: r.preostalo > 0.01 ? "#f87171" : "#94a3b8" }}>
                        {formatAmount(r.preostalo, locale)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {r.statusType === "PAID" && (
                          <span className="badge badge-green" style={{ fontSize: 11 }}>
                            ✅ Isplaćeno
                          </span>
                        )}
                        {r.statusType === "READY" && (
                          <span
                            className="badge"
                            style={{
                              fontSize: 11,
                              backgroundColor: "rgba(16, 185, 129, 0.2)",
                              color: "#34d399",
                              border: "1px solid #10b981",
                              fontWeight: 700,
                            }}
                          >
                            🟢 Spremno za isplatu
                          </span>
                        )}
                        {r.statusType === "WAITING" && (
                          <span className="badge badge-orange" style={{ fontSize: 11 }}>
                            ⏳ Čeka klijenta
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="subtle" style={{ padding: 24, textAlign: "center" }}>
                      Nema pronađenih honorara za odabrani filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 2: ZBIRNO PO SARADNICIMA */}
        {viewMode === "TALENTS" && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 260 }}>Saradnik / Spiker</th>
                  <th style={{ width: 140 }}>Uloga / Vrsta</th>
                  <th style={{ width: 120, textAlign: "center" }}>Broj stavki</th>
                  <th style={{ width: 150, textAlign: "right" }}>Ukupno ugovoreno</th>
                  <th style={{ width: 150, textAlign: "right" }}>Isplaćeno u kešu</th>
                  <th style={{ width: 150, textAlign: "right" }}>Preostali dug</th>
                  <th style={{ width: 180, textAlign: "center" }}>Status saradnika</th>
                </tr>
              </thead>
              <tbody>
                {filteredTalents.length ? (
                  filteredTalents.map((t) => (
                    <tr key={t.talent_id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{t.talent_naziv}</div>
                      </td>
                      <td>
                        <span className="subtle">{t.talent_vrsta || "Saradnik"}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="badge badge-gray">{t.broj_stavki}</span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {formatAmount(t.ukupno_ugovoreno, locale)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: t.ukupno_isplaceno > 0 ? "#38bdf8" : "#64748b" }}>
                        {formatAmount(t.ukupno_isplaceno, locale)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 800,
                          fontSize: 15,
                          color: t.preostalo > 0.01 ? "#f87171" : "#34d399",
                        }}
                      >
                        {formatAmount(t.preostalo, locale)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {t.preostalo <= 0.01 ? (
                          <span className="badge badge-green" style={{ fontSize: 12, padding: "4px 10px" }}>
                            ✅ Sve isplaćeno
                          </span>
                        ) : t.spremno > 0 ? (
                          <span
                            className="badge"
                            style={{
                              fontSize: 12,
                              padding: "4px 10px",
                              backgroundColor: "rgba(16, 185, 129, 0.2)",
                              color: "#34d399",
                              border: "1px solid #10b981",
                              fontWeight: 700,
                            }}
                          >
                            🟢 Spremno ({formatAmount(t.spremno, locale)})
                          </span>
                        ) : (
                          <span className="badge badge-orange" style={{ fontSize: 12, padding: "4px 10px" }}>
                            ⏳ Čeka klijente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="subtle" style={{ padding: 24, textAlign: "center" }}>
                      Nema pronađenih saradnika za odabrani filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
