"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Tip = "klijent" | "dobavljac" | "talent";

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function EvidentirajUplatuButton({
  tip,
  refId,
  defaultAmountKm,
  disabled,
  children = "Uplata",
}: {
  tip: Tip;
  refId: number;
  defaultAmountKm?: number;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [datum, setDatum] = useState(todayIso());
  const [amount, setAmount] = useState<string>("");
  const [postingId, setPostingId] = useState<string>("");
  const [napomena, setNapomena] = useState<string>("");

  const amountDefault = useMemo(() => {
    const n = Number(defaultAmountKm);
    return Number.isFinite(n) && n > 0 ? n.toFixed(2) : "";
  }, [defaultAmountKm]);

  const openModal = () => {
    setError(null);
    setDatum(todayIso());
    setAmount(amountDefault);
    setPostingId("");
    setNapomena("");
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const amount_km = Number(String(amount).replace(",", "."));
      const posting_id = postingId.trim() ? Number(postingId.trim()) : null;
      const res = await fetch("/api/finance/pocetna-stanja/uplate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tip,
          ref_id: refId,
          datum,
          amount_km,
          posting_id,
          napomena: napomena.trim() || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Greška pri evidentiranju uplate");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn"
        style={{ fontSize: 12 }}
        disabled={disabled}
        onClick={openModal}
      >
        {children}
      </button>
      {open && (
        <form
          onSubmit={submit}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            className="card"
            style={{
              padding: 20,
              minWidth: 340,
              maxWidth: 460,
              background: "var(--panel)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, marginBottom: 12 }}>
              Evidentiraj uplatu (zatvaranje početnog stanja)
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Ovo je formalna evidencija zatvaranja početnog stanja. Možeš unijeti i
              `posting_id` iz banke (ako je već importovan).
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 4 }}>
                  Datum
                </label>
                <input
                  className="input"
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                />
              </div>

              <div>
                <label className="label" style={{ display: "block", marginBottom: 4 }}>
                  Iznos (KM)
                </label>
                <input
                  className="input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="npr. 1500.00"
                />
              </div>

              <div>
                <label className="label" style={{ display: "block", marginBottom: 4 }}>
                  Bank posting_id (opciono)
                </label>
                <input
                  className="input"
                  value={postingId}
                  onChange={(e) => setPostingId(e.target.value)}
                  placeholder="npr. 12345"
                />
              </div>

              <div>
                <label className="label" style={{ display: "block", marginBottom: 4 }}>
                  Napomena (opciono)
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={napomena}
                  onChange={(e) => setNapomena(e.target.value)}
                  placeholder="npr. zatvoreno po izvodu X"
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>
            </div>

            {error && (
              <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Odustani
              </button>
              <button type="submit" className="btn btn--active" disabled={loading}>
                {loading ? "Snima se…" : "Evidentiraj"}
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}

