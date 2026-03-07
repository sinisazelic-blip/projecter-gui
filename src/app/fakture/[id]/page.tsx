// src/app/fakture/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import FluxaLogo from "@/components/FluxaLogo";

function fmtDDMMYYYYFromISO(iso: string | null): string {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "—";
  return `${d}.${m}.${y}`;
}

function fmtMoney(n: number, ccy: string) {
  const v = Number.isFinite(n) ? n : 0;
  const s = v.toFixed(2);
  const label = (ccy === "BAM" || ccy === "KM") ? "KM" : ccy;
  return `${s} ${label}`;
}

type FakturaData = {
  faktura_id: number;
  broj_fakture: string;
  broj_fiskalni: number | null;
  datum_izdavanja: string;
  datum_dospijeca: string | null;
  narucilac_id: number;
  narucilac_naziv: string | null;
  iznos_bez_pdv: number;
  pdv_iznos: number | null;
  iznos_sa_pdv: number;
  valuta: string;
  status: string;
  projekti_ids: number[];
};

export default function FakturaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const fakturaId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faktura, setFaktura] = useState<FakturaData | null>(null);
  const [stornoLoading, setStornoLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [buyer, setBuyer] = useState<any>(null);
  const [firma, setFirma] = useState<any>(null);

  useEffect(() => {
    if (!Number.isFinite(fakturaId) || fakturaId <= 0) {
      setError("Neispravan ID fakture");
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Učitaj fakturu
        const fakturaRes = await fetch(`/api/fakture/${fakturaId}`, {
          cache: "no-store",
        });
        const fakturaData = await fakturaRes.json();

        if (!fakturaRes.ok || !fakturaData.ok) {
          const errorMsg = fakturaData.error || "Greška pri učitavanju fakture";
          console.error("Greška pri učitavanju fakture:", fakturaData);
          throw new Error(errorMsg);
        }

        setFaktura(fakturaData.faktura);

        // Učitaj podatke za preview (projekti, buyer, firma)
        if (fakturaData.faktura.projekti_ids?.length > 0) {
          const qs = new URLSearchParams();
          qs.set("ids", fakturaData.faktura.projekti_ids.join(","));
          const previewRes = await fetch(
            `/api/fakture/wizard/preview-data?${qs.toString()}`,
            { cache: "no-store" },
          );
          const previewData = await previewRes.json();

          if (previewRes.ok && previewData.ok) {
            setProjects(previewData.projects || []);
            setBuyer(previewData.buyer);
            setFirma(previewData.firma);
          }
        }
      } catch (err: any) {
        setError(err?.message || "Greška");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [fakturaId]);

  if (loading) {
    return (
      <div className="container">
        <div style={{ padding: 40, textAlign: "center", opacity: 0.7 }}>
          Učitavanje...
        </div>
      </div>
    );
  }

  if (error || !faktura) {
    return (
      <div className="container">
        <div
          style={{
            padding: 20,
            background: "rgba(255, 59, 48, 0.1)",
            borderRadius: 8,
            color: "#ff3b30",
          }}
        >
          ⚠️ {error || "Faktura nije pronađena"}
        </div>
        <div style={{ marginTop: 20 }}>
          <Link href="/fakture" className="btn">
            ← Nazad na listu faktura
          </Link>
        </div>
      </div>
    );
  }

  const isStorno = faktura?.status === "STORNIRAN" || Number(faktura?.iznos_sa_pdv ?? 0) < 0;

  async function handleStorno() {
    if (stornoLoading || isStorno) return;
    if (!window.confirm("Da li ste sigurni da želite stornirati ovu fakturu? Kreiraće se storno račun (negativni iznosi), a projekti će se vratiti u status Zatvoren."))
      return;
    setStornoLoading(true);
    try {
      const res = await fetch(`/api/fakture/${fakturaId}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Greška");
      window.location.href = `/fakture/${data.storno_faktura_id}`;
    } catch (e: any) {
      alert(e?.message ?? "Greška pri storniranju");
    } finally {
      setStornoLoading(false);
    }
  }

  // Redirect na preview sa podacima iz fakture
  const goToPreview = () => {
    if (!faktura.projekti_ids || faktura.projekti_ids.length === 0) {
      alert(`Faktura nema povezanih projekata. Faktura ID: ${faktura.faktura_id}`);
      console.error("Faktura bez projekata:", faktura);
      return;
    }

    const qs = new URLSearchParams();
    qs.set("ids", faktura.projekti_ids.join(","));
    qs.set("date", faktura.datum_izdavanja);
    if (faktura.datum_dospijeca) {
      qs.set("due", faktura.datum_dospijeca);
    }
    qs.set("ccy", faktura.valuta);
    qs.set("vat", faktura.pdv_iznos && faktura.pdv_iznos > 0 ? "BH_17" : "INO_0");
    if (faktura.broj_fiskalni) {
      qs.set("pfr", String(faktura.broj_fiskalni));
    }
    // Dodaj broj fakture u URL da se prikaže u preview-u
    if (faktura.broj_fakture) {
      qs.set("invoice_number", faktura.broj_fakture);
    }

    // Otvori novu preview stranicu umesto wizard preview-a
    router.push(`/fakture/${faktura.faktura_id}/preview`);
  };

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow" style={{ justifyContent: "space-between" }}>
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">📄 Faktura #{faktura.broj_fakture}</div>
                  <div className="brandSub">Pregled fakture</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <Link
                  href="/fakture"
                  className="btn"
                  style={{ minWidth: 130 }}
                  title="Nazad na listu faktura"
                >
                  ← Nazad
                </Link>
                <button
                  type="button"
                  className="btn"
                  onClick={goToPreview}
                  style={{
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.1))",
                    borderColor: "rgba(59, 130, 246, 0.4)",
                    fontWeight: 700,
                  }}
                  title="Pregled fakture"
                >
                  👁️ Pregled
                </button>
                {!isStorno && (
                  <button
                    type="button"
                    className="btn"
                    onClick={handleStorno}
                    disabled={stornoLoading}
                    style={{
                      background: "#9ca3af",
                      color: "#111827",
                      border: "1px solid #6b7280",
                      fontWeight: 700,
                      opacity: stornoLoading ? 0.6 : 1,
                    }}
                    title="Storniraj fakturu — kreira storno račun, projekti u status Zatvoren"
                  >
                    {stornoLoading ? "…" : "STORNO"}
                  </button>
                )}
              </div>
            </div>
            <div className="divider" />
          </div>
        </div>

        <div className="listWrap">
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>Broj fakture</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{faktura.broj_fakture}</div>
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>PFR broj</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{faktura.broj_fiskalni || "—"}</div>
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>Datum izdavanja</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtDDMMYYYYFromISO(faktura.datum_izdavanja)}</div>
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>Datum dospijeća</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtDDMMYYYYFromISO(faktura.datum_dospijeca)}</div>
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>Naručioc</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{faktura.narucilac_naziv || "—"}</div>
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>Status</div>
                <div>
                  <span
                    className="status-badge"
                    style={{
                      background:
                        faktura.status === "Fakturisan" || faktura.status === "KREIRANA"
                          ? "rgba(80, 170, 255, 0.15)"
                          : faktura.status === "PLACENA"
                            ? "rgba(52, 199, 89, 0.15)"
                            : "rgba(255, 193, 7, 0.15)",
                      borderColor:
                        faktura.status === "Fakturisan" || faktura.status === "KREIRANA"
                          ? "rgba(80, 170, 255, 0.3)"
                          : faktura.status === "PLACENA"
                            ? "rgba(52, 199, 89, 0.3)"
                            : "rgba(255, 193, 7, 0.3)",
                    }}
                  >
                    {faktura.status}
                  </span>
                </div>
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>Iznos bez PDV-a</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtMoney(faktura.iznos_bez_pdv, faktura.valuta)}</div>
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>PDV iznos</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtMoney(faktura.pdv_iznos || 0, faktura.valuta)}</div>
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>Ukupno sa PDV-om</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtMoney(faktura.iznos_sa_pdv, faktura.valuta)}</div>
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>Valuta</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{(faktura.valuta === "BAM" || faktura.valuta === "KM") ? "KM" : faktura.valuta}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
