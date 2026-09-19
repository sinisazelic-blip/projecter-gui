"use client";

import { useState } from "react";
import Link from "next/link";
import { formatAmount } from "@/lib/format";

type HonorarRow = {
  trosak_id: number;
  projekat_id: number;
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

  const totalHonorar = rows.reduce((s, r) => s + r.iznos, 0);
  const totalSpremno = rows.filter((r) => r.statusType === "READY").reduce((s, r) => s + r.preostalo, 0);
  const totalCeka = rows.filter((r) => r.statusType === "WAITING").reduce((s, r) => s + r.preostalo, 0);
  const totalIsplaceno = rows.reduce((s, r) => s + r.isplaceno, 0);

  return (
    <div>
      {/* SUMMARY KARTICE */}
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
            🎙️ Ukupno ugovoreni honorari
          </div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {formatAmount(totalHonorar, locale)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Svi evidentirani angažmani
          </div>
        </div>

        <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: 12, borderRadius: 8 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4, color: "#34d399" }}>
            🟢 Spremno za isplatu (Klijent platio!)
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#34d399" }}>
            {formatAmount(totalSpremno, locale)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Može se odmah isplatiti saradniku
          </div>
        </div>

        <div style={{ background: "rgba(245, 158, 11, 0.08)", padding: 12, borderRadius: 8 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4, color: "#fbbf24" }}>
            ⏳ Čeka naplatu fakture od klijenta
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24" }}>
            {formatAmount(totalCeka, locale)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Isplata nakon uplate klijenta
          </div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            ✅ Ukupno isplaćeno do sada
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#94a3b8" }}>
            {formatAmount(totalIsplaceno, locale)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Zatvorene obaveze
          </div>
        </div>
      </div>

      {/* FILTERI */}
      <div className="card tableCard" style={{ marginBottom: 16 }}>
        <div style={{ padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`btn ${filter === "ALL" ? "btn--active" : ""}`}
              onClick={() => setFilter("ALL")}
            >
              Svi honorari ({rows.length})
            </button>
            <button
              type="button"
              className={`btn ${filter === "READY" ? "btn--active" : ""}`}
              onClick={() => setFilter("READY")}
              style={filter === "READY" ? { background: "#10b981", borderColor: "#10b981" } : {}}
            >
              🟢 Spremno za isplatu ({rows.filter((r) => r.statusType === "READY").length})
            </button>
            <button
              type="button"
              className={`btn ${filter === "WAITING" ? "btn--active" : ""}`}
              onClick={() => setFilter("WAITING")}
              style={filter === "WAITING" ? { background: "#f59e0b", borderColor: "#f59e0b" } : {}}
            >
              ⏳ Čeka klijenta ({rows.filter((r) => r.statusType === "WAITING").length})
            </button>
            <button
              type="button"
              className={`btn ${filter === "PAID" ? "btn--active" : ""}`}
              onClick={() => setFilter("PAID")}
            >
              ✅ Isplaćeno ({rows.filter((r) => r.statusType === "PAID").length})
            </button>
          </div>

          <div style={{ minWidth: 240 }}>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraži saradnika, projekat ili opis..."
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* TABELA */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Datum</th>
                <th style={{ width: 220 }}>Saradnik / Spiker</th>
                <th style={{ width: 220 }}>Projekat & Klijent</th>
                <th>Opis angažmana</th>
                <th style={{ width: 150, textAlign: "right" }}>Iznos honorara</th>
                <th style={{ width: 150, textAlign: "right" }}>Preostalo</th>
                <th style={{ width: 180, textAlign: "center" }}>Status isplate</th>
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
                      <Link href={`/projects/${r.projekat_id}`} style={{ fontWeight: 600, color: "inherit" }}>
                        {r.naziv_projekta || `Projekat #${r.projekat_id}`}
                      </Link>
                      <div className="subtle" style={{ fontSize: 12 }}>{r.naziv_klijenta || "—"}</div>
                    </td>
                    <td>
                      <div>{r.honorar_opis || "Honorarni angažman"}</div>
                      {r.broj_fakture && (
                        <div className="subtle" style={{ fontSize: 11 }}>
                          Faktura: <b>{r.broj_fakture}</b> ({r.faktura_status_naplate === "PLACENO" ? "🟢 Naplaćena" : "⏳ Čeka naplatu"})
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {formatAmount(r.iznos, locale)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: r.preostalo > 0 ? "#fbbf24" : "#94a3b8" }}>
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
                          ⏳ Čeka naplatu klijenta
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="subtle" style={{ padding: 24, textAlign: "center" }}>
                    Nema pronađenih honorara za odabrani filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
