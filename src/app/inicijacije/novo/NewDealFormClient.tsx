"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";

type Klijent = { klijent_id: number; naziv_klijenta: string; is_ino?: number };

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
};

const requiredFieldWrapStyle: React.CSSProperties = {
  background: "rgba(125, 211, 252, 0.06)",
  border: "1px solid rgba(125, 211, 252, 0.2)",
  borderRadius: 12,
  padding: 2,
};

export default function NewDealFormClient({
  initialKlijenti,
}: {
  initialKlijenti: Klijent[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [klijenti, setKlijenti] = useState<Klijent[]>(initialKlijenti);
  const [narucilac_id, setNarucilac_id] = useState("");
  const [krajnji_klijent_id, setKrajnji_klijent_id] = useState("");
  const [radni_naziv, setRadni_naziv] = useState("");
  const [napomena, setNapomena] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalFor, setModalFor] = useState<"narucilac" | "krajnji">("narucilac");
  const [modalNaziv, setModalNaziv] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const openNoviModal = (forField: "narucilac" | "krajnji") => {
    setModalFor(forField);
    setModalNaziv("");
    setModalError(null);
    setModalOpen(true);
  };

  const handleModalSave = async () => {
    const naziv = modalNaziv.trim();
    if (!naziv) {
      setModalError(t("newDealForm.errNazivRequired"));
      return;
    }
    setModalSaving(true);
    setModalError(null);
    try {
      const res = await fetch("/api/klijenti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naziv_klijenta: naziv }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || t("common.error"));
      const newK: Klijent = { klijent_id: j.klijent_id, naziv_klijenta: j.naziv_klijenta, is_ino: 0 };
      setKlijenti((prev) => [...prev, newK].sort((a, b) => a.naziv_klijenta.localeCompare(b.naziv_klijenta)));
      if (modalFor === "narucilac") setNarucilac_id(String(j.klijent_id));
      else setKrajnji_klijent_id(String(j.klijent_id));
      setModalOpen(false);
    } catch (e: any) {
      setModalError(e?.message || t("newDealForm.errCreateClient"));
    } finally {
      setModalSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const nid = Number(narucilac_id);
    const radni = radni_naziv.trim();
    if (!nid || !radni) {
      setError(t("newDealForm.errRequired"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/inicijacije", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narucilac_id: nid,
          krajnji_klijent_id: krajnji_klijent_id ? Number(krajnji_klijent_id) : null,
          radni_naziv: radni,
          napomena: napomena.trim() || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || t("common.error"));
      router.push(`/inicijacije/${j.inicijacija_id}`);
    } catch (e: any) {
      setError(e?.message || t("newDealForm.errCreateDeal"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="card" style={{ padding: 14, maxWidth: 860 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={requiredFieldWrapStyle}>
            <div className="muted" style={{ marginBottom: 6, marginLeft: 4 }}>{t("newDealForm.narucilacRequired")}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <select value={narucilac_id} onChange={(e) => setNarucilac_id(e.target.value)} required style={{ ...inputBaseStyle, flex: 1 }}>
                <option value="" disabled>— {t("newDealForm.select")} —</option>
                {klijenti.map((k) => <option key={k.klijent_id} value={k.klijent_id}>{k.naziv_klijenta}</option>)}
              </select>
              <button type="button" className="btn btn--active" onClick={() => openNoviModal("narucilac")} title={t("newDealForm.addClient")} style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>+ {t("newDealForm.new")}</button>
            </div>
          </div>
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>{t("newDealForm.krajnjiOptional")}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <select value={krajnji_klijent_id} onChange={(e) => setKrajnji_klijent_id(e.target.value)} style={{ ...inputBaseStyle, flex: 1 }}>
                <option value="">(NULL = {t("newDealForm.sameAsNarucilac")})</option>
                {klijenti.map((k) => <option key={k.klijent_id} value={k.klijent_id}>{k.naziv_klijenta}</option>)}
              </select>
              <button type="button" className="btn btn--active" onClick={() => openNoviModal("krajnji")} title={t("newDealForm.addClient")} style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>+ {t("newDealForm.new")}</button>
            </div>
          </div>
          <div style={requiredFieldWrapStyle}>
            <div className="muted" style={{ marginBottom: 6, marginLeft: 4 }}>{t("newDealForm.radniRequired")}</div>
            <input value={radni_naziv} onChange={(e) => setRadni_naziv(e.target.value)} placeholder={t("newDealForm.radniPlaceholder")} required style={inputBaseStyle} />
          </div>
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>{t("newDealForm.noteOptional")}</div>
            <textarea value={napomena} onChange={(e) => setNapomena(e.target.value)} rows={4} placeholder={t("newDealForm.notePlaceholder")} style={inputBaseStyle} />
          </div>
          {error && <div style={{ color: "var(--bad)", fontSize: 14 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="submit" disabled={loading} className="btn btn--active" style={{ padding: "12px 24px", fontSize: 16, fontWeight: 700, borderRadius: 12, border: "2px solid rgba(125, 211, 252, 0.4)", background: "rgba(125, 211, 252, 0.15)" }}>
              {loading ? t("newDealForm.working") : t("newDealForm.createDeal")}
            </button>
            <a href="/inicijacije" className="project-link" style={{ alignSelf: "center" }}>{t("newDealForm.cancel")}</a>
          </div>
        </div>
      </form>
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => !modalSaving && setModalOpen(false)}>
          <div className="card" style={{ padding: 20, maxWidth: 400, width: "100%", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12, fontSize: 18 }}>{t("newDealForm.modalTitle")}</h3>
            <div style={{ marginBottom: 12 }}>
              <label className="muted" style={{ display: "block", marginBottom: 6 }}>{t("newDealForm.clientName")}</label>
              <input value={modalNaziv} onChange={(e) => setModalNaziv(e.target.value)} placeholder={t("newDealForm.clientNamePlaceholder")} className="input" style={{ ...inputBaseStyle, width: "100%" }} autoFocus onKeyDown={(e) => e.key === "Enter" && handleModalSave()} />
            </div>
            {modalError && <div style={{ color: "var(--bad)", fontSize: 13, marginBottom: 12 }}>{modalError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn--active" onClick={handleModalSave} disabled={modalSaving} style={{ padding: "10px 20px" }}>{modalSaving ? t("newDealForm.saving") : t("newDealForm.ok")}</button>
              <button type="button" className="btn" onClick={() => !modalSaving && setModalOpen(false)}>{t("newDealForm.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
