// Wizard za ponudu – priprema stavki (popust, nazivi, grupisanje, opisne stavke) prije snimanja
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayDDMMYYYY() {
  const d = new Date();
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function ddmmyyyyToISO(ddmmyyyy: string): string | null {
  const s = String(ddmmyyyy || "").trim();
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!(yyyy >= 2000 && yyyy <= 2100)) return null;
  if (!(mm >= 1 && mm <= 12)) return null;
  const maxDay = new Date(yyyy, mm, 0).getDate();
  if (!(dd >= 1 && dd <= maxDay)) return null;
  return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
}

type StavkaRow = {
  inicijacija_stavka_id: number;
  naziv_snapshot: string;
  jedinica_snapshot: string | null;
  kolicina: number;
  cijena_jedinicna: number;
  valuta: string;
  opis: string | null;
  line_total: number;
};

export default function PonudaWizardPage() {
  const params = useParams();
  const router = useRouter();
  const id = useMemo(() => {
    const v = params?.id;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [params?.id]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deal, setDeal] = useState<{ valuta: string; naziv_klijenta?: string } | null>(null);
  const [stavke, setStavke] = useState<StavkaRow[]>([]);

  const [datumIzdavanjaDD, setDatumIzdavanjaDD] = useState<string>(todayDDMMYYYY());
  const [datumVazenjaDD, setDatumVazenjaDD] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  });
  const [valuta, setValuta] = useState<string>("KM");
  const [popustKm, setPopustKm] = useState<string>("");

  const [nameOverrides, setNameOverrides] = useState<Record<number, string>>({});
  const [subItems, setSubItems] = useState<Record<number, { enabled: boolean; items: string[] }>>({});
  const [projectGroups, setProjectGroups] = useState<Record<string, { name: string; stavkaIds: number[] }>>({});
  const [selectedForGrouping, setSelectedForGrouping] = useState<Set<number>>(new Set());
  const [groupName, setGroupName] = useState<string>("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Neispravan ID deal-a.");
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/ponude/wizard-data?inicijacija_id=${id}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? "Greška učitavanja.");
        }
        if (alive) {
          setDeal(data.deal ?? null);
          setStavke(Array.isArray(data.stavke) ? data.stavke : []);
          const ccy = data.deal?.valuta ?? "KM";
          setValuta(ccy);
        }
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Greška");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const stavkeById = useMemo(() => {
    const m = new Map<number, StavkaRow>();
    stavke.forEach((s) => m.set(s.inicijacija_stavka_id, s));
    return m;
  }, [stavke]);

  const groupedIds = useMemo(() => {
    const set = new Set<number>();
    Object.values(projectGroups).forEach((g) => g.stavkaIds.forEach((sid) => set.add(sid)));
    return set;
  }, [projectGroups]);

  function buildFinalStavke(): Array<{ naziv_snapshot: string; jedinica_snapshot: string; kolicina: number; cijena_jedinicna: number; valuta: string; opis: string | null; line_total: number }> {
    const ccy = valuta === "BAM" ? "KM" : (valuta || "KM").slice(0, 3);
    const out: Array<{ naziv_snapshot: string; jedinica_snapshot: string; kolicina: number; cijena_jedinicna: number; valuta: string; opis: string | null; line_total: number }> = [];

    Object.values(projectGroups).forEach((g) => {
      if (!g.name.trim() || g.stavkaIds.length === 0) return;
      let total = 0;
      g.stavkaIds.forEach((sid) => {
        const s = stavkeById.get(sid);
        if (s) total += Number(s.line_total ?? 0);
      });
      out.push({
        naziv_snapshot: g.name.trim().slice(0, 500),
        jedinica_snapshot: "kom",
        kolicina: 1,
        cijena_jedinicna: Math.round(total * 100) / 100,
        valuta: ccy,
        opis: null,
        line_total: Math.round(total * 100) / 100,
      });
    });

    stavke.forEach((s) => {
      if (groupedIds.has(s.inicijacija_stavka_id)) return;
      const naziv = (nameOverrides[s.inicijacija_stavka_id] ?? "").trim() || (s.naziv_snapshot ?? "");
      const sub = subItems[s.inicijacija_stavka_id];
      let opis: string | null = (s.opis ?? null) && String(s.opis).trim() ? String(s.opis).slice(0, 500) : null;
      if (sub?.enabled && Array.isArray(sub.items)) {
        const parts = sub.items.map((x) => String(x).trim()).filter(Boolean);
        if (parts.length > 0) {
          const extra = parts.join(", ");
          opis = opis ? `${opis}\n${extra}` : extra;
          if (opis.length > 500) opis = opis.slice(0, 500);
        }
      }
      const lineTotal = Number(s.line_total ?? 0);
      out.push({
        naziv_snapshot: (naziv || "Stavka").slice(0, 500),
        jedinica_snapshot: String(s.jedinica_snapshot ?? "kom").slice(0, 50),
        kolicina: Number(s.kolicina ?? 0),
        cijena_jedinicna: Number(s.cijena_jedinicna ?? 0),
        valuta: ccy,
        opis,
        line_total: lineTotal,
      });
    });

    return out;
  }

  async function handleSnimi() {
    if (!id) return;
    const isoIzdavanja = ddmmyyyyToISO(datumIzdavanjaDD);
    const isoVazenja = ddmmyyyyToISO(datumVazenjaDD);
    if (!isoIzdavanja) {
      alert("Datum izdavanja mora biti dd.mm.yyyy");
      return;
    }
    if (!isoVazenja) {
      alert("Datum važenja mora biti dd.mm.yyyy");
      return;
    }
    const finalStavke = buildFinalStavke();
    if (finalStavke.length === 0) {
      alert("Nema stavki za ponudu.");
      return;
    }
    const popustNum = parseFloat(String(popustKm || "0").trim());
    const popust_km = Number.isFinite(popustNum) && popustNum > 0 ? popustNum : 0;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ponude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inicijacija_id: id,
          datum_izdavanja: isoIzdavanja,
          datum_vazenja: isoVazenja,
          valuta: valuta === "BAM" ? "KM" : valuta,
          popust_km: popust_km > 0 ? popust_km : undefined,
          stavke: finalStavke,
        }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error ?? "Greška pri snimanju ponude.");
      const ponudaId = data?.ponuda_id;
      if (ponudaId) router.push(`/ponuda/${ponudaId}/preview`);
    } catch (e: any) {
      setError(e?.message ?? "Greška");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div style={{ padding: 40, textAlign: "center", opacity: 0.8 }}>Učitavanje…</div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="container">
        <div style={{ padding: 20, background: "rgba(255,80,80,.1)", borderRadius: 12, color: "#f88" }}>
          {error ?? "Deal nije pronađen."}
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href={`/inicijacije/${id}`} className="btn">
            ← Nazad na Deal
          </Link>
        </div>
      </div>
    );
  }

  const displayCcy = valuta === "BAM" ? "KM" : valuta;

  return (
    <div className="container">
      <style>{`
        .scrollWrap { flex:1; overflow:auto; padding: 14px 0 18px; }
        .cardLike { border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.05); border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.14); padding: 14px; margin-top: 12px; }
        .grid2 { display:grid; grid-template-columns:220px 1fr; gap:10px; align-items:center; }
        @media (max-width: 860px) { .grid2 { grid-template-columns: 1fr; } }
        .err { margin-top: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(255,80,80,.35); background: rgba(255,80,80,.1); color: rgba(255,220,220,.92); font-size: 12px; }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">Ponuda — Priprema (wizard)</div>
                  <div className="brandSub">
                    Popust, nazivi stavki, grupisanje. Snimi ponudu i pregledaj.
                  </div>
                </div>
              </div>
              <Link href={`/inicijacije/${id}`} className="btn" title="Nazad na deal">
                ← Nazad
              </Link>
            </div>
            <div className="topRow" style={{ marginTop: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }} />
              <button
                type="button"
                className="btn"
                onClick={handleSnimi}
                disabled={saving || stavke.length === 0}
                style={{
                  opacity: saving || stavke.length === 0 ? 0.6 : 1,
                  fontWeight: 700,
                  background: saving || stavke.length === 0 ? undefined : "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.12))",
                  borderColor: saving || stavke.length === 0 ? undefined : "rgba(59, 130, 246, 0.5)",
                }}
              >
                {saving ? "Snimanje…" : "Snimi ponudu i pregledaj"}
              </button>
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              Deal #{id} · Stavki: <b>{stavke.length}</b>
            </div>
            <div className="divider" />
          </div>
        </div>

        <div className="scrollWrap">
          <div className="container">
            <div className="cardLike">
              <div style={{ fontWeight: 850, fontSize: 16 }}>Osnovno</div>
              <div className="grid2" style={{ marginTop: 10 }}>
                <div className="label">Datum izdavanja (dd.mm.yyyy)</div>
                <input
                  className="input"
                  value={datumIzdavanjaDD}
                  onChange={(e) => setDatumIzdavanjaDD(e.target.value)}
                  placeholder="dd.mm.yyyy"
                />
                <div className="label">Važi do (dd.mm.yyyy)</div>
                <input
                  className="input"
                  value={datumVazenjaDD}
                  onChange={(e) => setDatumVazenjaDD(e.target.value)}
                  placeholder="dd.mm.yyyy"
                />
                <div className="label">Valuta</div>
                <select className="input" value={valuta} onChange={(e) => setValuta(e.target.value)}>
                  <option value="KM">KM (BAM)</option>
                  <option value="EUR">EUR</option>
                </select>
                <div className="label">Popust prije PDV-a ({displayCcy})</div>
                <input
                  type="number"
                  className="input"
                  value={popustKm}
                  onChange={(e) => setPopustKm(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  title="Opciono — umanjenje osnovice prije PDV-a"
                />
              </div>
            </div>

            {stavke.length > 1 && (
              <div className="cardLike" style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 10 }}>
                  Kombinuj stavke u jednu liniju
                </div>
                <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 12 }}>
                  Označi stavke koje želiš objediniti u jednu stavku na ponudi (iznosi će se zbrojiti).
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                  {stavke.map((s) => (
                    <label
                      key={s.inicijacija_stavka_id}
                      style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedForGrouping.has(s.inicijacija_stavka_id)}
                        onChange={(e) => {
                          const next = new Set(selectedForGrouping);
                          if (e.target.checked) next.add(s.inicijacija_stavka_id);
                          else next.delete(s.inicijacija_stavka_id);
                          setSelectedForGrouping(next);
                        }}
                      />
                      <span style={{ opacity: 0.9 }}>
                        #{s.inicijacija_stavka_id}: {s.naziv_snapshot || "—"}
                      </span>
                    </label>
                  ))}
                </div>
                {selectedForGrouping.size > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="label" style={{ marginBottom: 6 }}>Zajednički naziv za kombinovane stavke:</div>
                    <input
                      className="input"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Npr. Komplet usluga"
                      style={{ width: "100%" }}
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        if (groupName.trim() && selectedForGrouping.size > 0) {
                          const gid = `g_${Date.now()}`;
                          setProjectGroups((prev) => ({
                            ...prev,
                            [gid]: { name: groupName.trim(), stavkaIds: Array.from(selectedForGrouping) },
                          }));
                          const overrides = { ...nameOverrides };
                          selectedForGrouping.forEach((sid) => {
                            overrides[sid] = groupName.trim();
                          });
                          setNameOverrides(overrides);
                          setSelectedForGrouping(new Set());
                          setGroupName("");
                        }
                      }}
                      disabled={!groupName.trim() || selectedForGrouping.size === 0}
                      style={{ marginTop: 8, opacity: !groupName.trim() || selectedForGrouping.size === 0 ? 0.5 : 1 }}
                    >
                      Kreiraj grupu
                    </button>
                  </div>
                )}
                {Object.keys(projectGroups).length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.1)" }}>
                    <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>Kreirane grupe:</div>
                    {Object.entries(projectGroups).map(([gid, g]) => (
                      <div
                        key={gid}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: 8,
                          background: "rgba(0,0,0,.1)",
                          borderRadius: 6,
                          marginBottom: 6,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>
                            Stavke: {g.stavkaIds.map((sid) => `#${sid}`).join(", ")}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...projectGroups };
                            delete next[gid];
                            setProjectGroups(next);
                            const no = { ...nameOverrides };
                            g.stavkaIds.forEach((sid) => delete no[sid]);
                            setNameOverrides(no);
                          }}
                          style={{
                            background: "rgba(255,80,80,.15)",
                            border: "1px solid rgba(255,80,80,.3)",
                            color: "rgba(255,200,200,.9)",
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          Ukloni
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {stavke.length > 0 && (
              <div className="cardLike" style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 10 }}>
                  Nazivi stavki na ponudi
                </div>
                <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 12 }}>
                  Možeš promijeniti naziv stavke samo za ovu ponudu. Dodaj opisne stavke (šta paket sadrži).
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {stavke.map((s) => {
                    const sid = s.inicijacija_stavka_id;
                    const subState = subItems[sid] ?? { enabled: false, items: ["", "", "", "", ""] };
                    const items = subState.items ?? ["", "", "", "", ""];
                    return (
                      <div
                        key={sid}
                        style={{
                          border: "1px solid rgba(255,255,255,.12)",
                          borderRadius: 10,
                          padding: 12,
                          background: "rgba(0,0,0,.08)",
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, alignItems: "center" }}>
                          <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 600 }}>#{sid}</div>
                          <div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
                              Original: {s.naziv_snapshot || "—"}
                            </div>
                            <input
                              className="input"
                              value={nameOverrides[sid] ?? ""}
                              onChange={(e) => setNameOverrides((prev) => ({ ...prev, [sid]: e.target.value }))}
                              placeholder={`Naziv na ponudi (prazno = "${(s.naziv_snapshot || "").slice(0, 40)}…")`}
                              style={{ width: "100%" }}
                            />
                          </div>
                        </div>
                        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <label className="label" style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={subState.enabled}
                              onChange={(e) => {
                                setSubItems((prev) => ({
                                  ...prev,
                                  [sid]: {
                                    enabled: e.target.checked,
                                    items: prev[sid]?.items ?? ["", "", "", "", ""],
                                  },
                                }));
                              }}
                            />
                            Dodaj opisne stavke (šta paket sadrži)
                          </label>
                        </div>
                        {subState.enabled && (
                          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ fontSize: 11, opacity: 0.75 }}>Stavke koje će se prikazati (samo ne-prazne):</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {items.map((val, i) => (
                                <input
                                  key={i}
                                  className="input"
                                  value={val}
                                  onChange={(e) => {
                                    const next = [...items];
                                    next[i] = e.target.value;
                                    setSubItems((prev) => ({
                                      ...prev,
                                      [sid]: { enabled: true, items: next },
                                    }));
                                  }}
                                  placeholder={`Stavka ${i + 1}`}
                                  style={{ flex: "1 1 180px", minWidth: 140 }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="err" style={{ marginTop: 16 }}>{error}</div>}
    </div>
  );
}
