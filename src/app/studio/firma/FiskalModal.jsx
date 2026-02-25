"use client";

import { useState, useCallback } from "react";

const inputStyle = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
  width: "100%",
  fontSize: "1rem",
};
const labelStyle = { fontSize: 14, opacity: 0.85, marginBottom: 8 };

const defaultSettings = {
  base_url: "",
  api_key: "",
  pin: "",
  use_external_printer: false,
  external_printer_name: "",
  external_printer_width: "",
};

export default function FiskalModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(defaultSettings);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/firma/fiskal");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Greška učitavanja");
      setForm(
        data?.settings
          ? { ...defaultSettings, ...data.settings }
          : defaultSettings,
      );
    } catch (e) {
      setError(e?.message || "Nije moguće učitati postavke");
      setForm(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  const openModal = () => {
    setOpen(true);
    setError("");
    loadSettings();
  };

  const closeModal = () => {
    setOpen(false);
    setError("");
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/firma/fiskal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: form.base_url.trim() || null,
          api_key: form.api_key.trim() || null,
          pin: form.pin.trim() || null,
          use_external_printer: form.use_external_printer,
          external_printer_name: form.external_printer_name.trim() || null,
          external_printer_width:
            form.external_printer_width === ""
              ? null
              : Number(form.external_printer_width),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Greška snimanja");
      closeModal();
    } catch (e) {
      setError(e?.message || "Nije moguće snimiti");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={openModal}
        title="Postavke fiskalnog uređaja (L-PFR / Esir)"
        style={{
          border: "1px solid rgba(255,200,100,.25)",
          background: "rgba(255,200,100,.08)",
        }}
      >
        🧾 Postavke fiskalnog uređaja
      </button>

      {open && (
        <div
          className="fiskalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fiskal-title"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <style>{`
            .fiskalOverlay {
              position: fixed;
              inset: 0;
              z-index: 100;
              display: flex;
              align-items: center;
              justify-content: center;
              background: rgba(0,0,0,.65);
              backdrop-filter: blur(6px);
            }
            .fiskalModal {
              width: 100%;
              max-width: 560px;
              max-height: 90vh;
              overflow: auto;
              background: rgba(18,18,22,.97);
              border: 1px solid rgba(255,255,255,.12);
              border-radius: 18px;
              box-shadow: 0 20px 60px rgba(0,0,0,.4);
              padding: 24px;
              font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", sans-serif;
              font-size: 1rem;
              line-height: 1.5;
            }
            .fiskalModal h2 { margin: 0 0 18px 0; font-size: 1.35rem; font-weight: 800; }
            .fiskalModal .hint { font-size: 0.9rem; opacity: .75; margin-top: 8px; }
            .fiskalModal .btnRow { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
            .fiskalModal .btn {
              display: inline-flex; align-items: center; justify-content: center;
              padding: 12px 18px; min-width: 140px; font-size: 1rem; border-radius: 14px; cursor: pointer;
              border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.08);
            }
            .fiskalModal .btnPrimary { background: rgba(80,220,140,.2); border-color: rgba(80,220,140,.4); }
            .fiskalModal .err { color: #f88; font-size: 0.95rem; margin-bottom: 12px; }
          `}</style>
          <div className="fiskalModal">
            <h2 id="fiskal-title">Postavke fiskalnog uređaja</h2>
            <p className="hint" style={{ marginBottom: 14 }}>
              Postavke su po aktivnoj firmi. Kad budete imali uređaj, ovdje unesite URL, API ključ i PIN; povezivanje prema dokumentaciji testirat ćete kasnije.
            </p>

            {error && <div className="err">{error}</div>}
            {loading ? (
              <div className="hint">Učitavanje…</div>
            ) : (
              <div
                role="form"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") e.preventDefault();
                }}
              >
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Base URL uređaja (obavezno za slanje)</label>
                  <input
                    type="url"
                    value={form.base_url}
                    onChange={(e) => handleChange("base_url", e.target.value)}
                    style={inputStyle}
                    placeholder="http://192.168.x.x:3566/"
                  />
                  <div className="hint">npr. http://IP:3566/ — WiFi/LAN</div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>API ključ (EsirKey)</label>
                  <input
                    type="text"
                    value={form.api_key}
                    onChange={(e) => handleChange("api_key", e.target.value)}
                    style={inputStyle}
                    placeholder="hex string, opciono"
                    autoComplete="off"
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>PIN</label>
                  <input
                    type="password"
                    value={form.pin}
                    onChange={(e) => handleChange("pin", e.target.value)}
                    style={inputStyle}
                    placeholder="prazno = ručni unos na uređaju"
                    autoComplete="off"
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.use_external_printer}
                      onChange={(e) =>
                        handleChange("use_external_printer", e.target.checked)
                      }
                    />
                    <span style={labelStyle}>Koristi eksterni štampač</span>
                  </label>
                </div>

                {form.use_external_printer && (
                  <>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Naziv eksternog štampača</label>
                      <input
                        type="text"
                        value={form.external_printer_name}
                        onChange={(e) =>
                          handleChange("external_printer_name", e.target.value)
                        }
                        style={inputStyle}
                        placeholder="EsirExtStampac"
                      />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Širina (znakova)</label>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={form.external_printer_width}
                        onChange={(e) =>
                          handleChange("external_printer_width", e.target.value)
                        }
                        style={inputStyle}
                        placeholder="EsirExtSirina"
                      />
                    </div>
                  </>
                )}

                <div className="btnRow">
                  <button
                    type="button"
                    className="btn btnPrimary"
                    disabled={saving}
                    onClick={(e) => {
                      e.preventDefault();
                      handleSubmit(e);
                    }}
                  >
                    {saving ? "Snimanje…" : "Snimi postavke"}
                  </button>
                  <button type="button" className="btn" onClick={closeModal}>
                    Odustani
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
