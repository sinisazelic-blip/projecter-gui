"use client";

import { useState } from "react";
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
  const [projects] = useState<MeetProject[]>(initialProjects);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nazivTakmicenja, setNazivTakmicenja] = useState("");
  const [narucilacId, setNarucilacId] = useState("");
  const [datumPocetka, setDatumPocetka] = useState("");
  const [datumZavrsetka, setDatumZavrsetka] = useState("");
  const [budzetKm, setBudzetKm] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmtDate = (d?: string | null) => {
    if (!d) return "—";
    const s = String(d).slice(0, 10);
    const parts = s.split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return s;
  };

  const filtered = projects.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const matchNaziv = p.naziv_projekta?.toLowerCase().includes(q);
    const matchKlub = p.naziv_klijenta?.toLowerCase().includes(q);
    const matchOpis = p.napomena?.toLowerCase().includes(q);
    return matchNaziv || matchKlub || matchOpis;
  });

  const totalTakmicenja = projects.length;
  const totalUgovoreno = projects.reduce((s, p) => s + (Number(p.budzet_km) || 0), 0);
  const totalTroskovi = projects.reduce((s, p) => s + (Number(p.ukupno_troskovi_km) || 0), 0);
  const totalNeto = totalUgovoreno - totalTroskovi;

  const handleCreateMeet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nazivTakmicenja.trim() || !narucilacId) {
      setError("Naziv takmičenja i naručilac (klub/savez) su obavezni.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      // 1) Kreiraj inicijaciju / projekat
      const res = await fetch("/api/inicijacije", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narucilac_id: Number(narucilacId),
          radni_naziv: `🏊 ${nazivTakmicenja.trim()}`,
          napomena: `Plivačko takmičenje i mjerenje vremena. Period: ${datumPocetka || "—"} do ${datumZavrsetka || "—"}`,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Greška pri kreiranju takmičenja.");

      window.location.href = `/inicijacije/${data.inicijacija_id}`;
    } catch (err: any) {
      setError(err?.message || "Došlo je do greške.");
      setCreating(false);
    }
  };

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
            🏊 Evidentirana takmičenja
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#38bdf8" }}>
            {totalTakmicenja}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Mitinzi, prvenstva & kupovi
          </div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            📄 Ugovoreni iznos mjerenja
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#4ade80" }}>
            {formatAmount(totalUgovoreno, locale)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Paušali & obrada rezultata
          </div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            🚗 Troškovi & Dnevnice
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f87171" }}>
            {formatAmount(totalTroskovi, locale)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Dnevnice mjerioca, put i oprema
          </div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            💰 Neto zarada od mjerenja
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24" }}>
            {formatAmount(totalNeto, locale)}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Realizovana čista dobit
          </div>
        </div>
      </div>

      {/* FILTERI & NOVO TAKMICENJE */}
      <div className="card tableCard" style={{ marginBottom: 16 }}>
        <div style={{ padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn--active"
              onClick={() => setIsModalOpen(true)}
              style={{
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                borderColor: "#0284c7",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              + Novo plivačko takmičenje
            </button>
          </div>

          <div style={{ minWidth: 260 }}>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraži takmičenje, klub ili savez..."
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* TABELA */}
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
              {filtered.length ? (
                filtered.map((p) => (
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
                      {p.napomena && (
                        <div className="subtle" style={{ fontSize: 12, marginTop: 2 }}>{p.napomena}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.naziv_klijenta || "—"}</div>
                    </td>
                    <td>
                      <div>{fmtDate(p.datum_pocetka)}</div>
                      {p.datum_zavrsetka && p.datum_zavrsetka !== p.datum_pocetka && (
                        <div className="subtle" style={{ fontSize: 11 }}>do {fmtDate(p.datum_zavrsetka)}</div>
                      )}
                    </td>
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
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="subtle" style={{ padding: 24, textAlign: "center" }}>
                    Nema pronađenih takmičenja. Kliknite na "+ Novo plivačko takmičenje" za unos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL ZA NOVO TAKMICENJE */}
      {isModalOpen && (
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
          onClick={() => !creating && setIsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "var(--panel, #18181b)",
              border: "1px solid var(--border, #27272a)",
              borderRadius: 16,
              maxWidth: 520,
              width: "100%",
              padding: 24,
              color: "var(--text, #f4f4f5)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🏊</span>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Novo plivačko takmičenje / Mjerenje
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted, #a1a1aa)",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMeet} style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 4 }}>
                  Naziv takmičenja / Mitinga:
                </label>
                <input
                  className="input"
                  value={nazivTakmicenja}
                  onChange={(e) => setNazivTakmicenja(e.target.value)}
                  placeholder="npr. Međunarodni plivački miting Mladost 2026"
                  required
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label className="label" style={{ display: "block", marginBottom: 4 }}>
                  Klub ili Savez (Naručilac):
                </label>
                <select
                  className="input"
                  value={narucilacId}
                  onChange={(e) => setNarucilacId(e.target.value)}
                  required
                  style={{ width: "100%" }}
                >
                  <option value="" disabled>— Odaberi klub / savez —</option>
                  {klijenti.map((k) => (
                    <option key={k.klijent_id} value={k.klijent_id}>
                      {k.naziv_klijenta}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 4 }}>
                    Datum početka:
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={datumPocetka}
                    onChange={(e) => setDatumPocetka(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 4 }}>
                    Datum završetka:
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={datumZavrsetka}
                    onChange={(e) => setDatumZavrsetka(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {error && (
                <div
                  style={{
                    padding: 10,
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    borderRadius: 8,
                    color: "#fca5a5",
                    fontSize: 13,
                  }}
                >
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={creating}
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="btn btn--active"
                  disabled={creating}
                  style={{
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    borderColor: "#0284c7",
                    color: "#fff",
                  }}
                >
                  {creating ? "Kreiranje..." : "Otvori takmičenje"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
