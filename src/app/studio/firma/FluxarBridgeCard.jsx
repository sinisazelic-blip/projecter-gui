"use client";

import { useState } from "react";

export default function FluxarBridgeCard({ firma }) {
  const [copied, setCopied] = useState(false);

  const token = "FLXR-061000-7C91E8B2";
  const tunnelUrl = "https://app.studiotaf.xyz/api/fluxar";

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      style={{
        marginTop: 20,
        padding: "16px 18px",
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(79, 70, 229, 0.04))",
        border: "1px solid rgba(139, 92, 246, 0.3)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              color: "#fff",
              fontWeight: "bold",
              boxShadow: "0 2px 8px rgba(124, 58, 237, 0.35)",
            }}
          >
            FX
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: "bold", display: "flex", alignItems: "center", gap: 8 }}>
              <span>FluxaR // Knjigovodstveni Most</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  padding: "2px 8px",
                  borderRadius: 9999,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10b981",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  textTransform: "uppercase",
                }}
              >
                🟢 Aktivan & Spreman
              </span>
            </div>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 1 }}>
              Direktni izvoz podataka za <strong>Računovodstvo Lolić</strong> (Fakture, KIF & Bankovni Izvodi)
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
          background: "rgba(15, 23, 42, 0.4)",
          padding: 12,
          borderRadius: 10,
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: "bold", opacity: 0.7 }}>
            Autorizacioni Token (Računovodstvo Lolić)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span
              style={{
                fontFamily: "monospace",
                fontWeight: "bold",
                fontSize: 13,
                color: "#c084fc",
                background: "rgba(124, 58, 237, 0.15)",
                padding: "3px 8px",
                borderRadius: 6,
                border: "1px solid rgba(139, 92, 246, 0.3)",
              }}
            >
              {token}
            </span>
            <button
              type="button"
              onClick={copyToken}
              style={{
                fontSize: 11,
                fontWeight: "bold",
                padding: "4px 10px",
                borderRadius: 6,
                cursor: "pointer",
                background: copied ? "#059669" : "#334155",
                color: "#fff",
                border: "none",
                transition: "all 0.15s ease",
              }}
            >
              {copied ? "✓ Kopirano!" : "📋 Kopiraj"}
            </button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: "bold", opacity: 0.7 }}>
            Tunel & Host Endpoint
          </div>
          <div style={{ fontSize: 12, fontFamily: "monospace", color: "#38bdf8", marginTop: 6 }}>
            {tunnelUrl}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.4, display: "flex", gap: 6, alignItems: "flex-start" }}>
        <span>💡</span>
        <span>
          U <strong>FluxaR desktop aplikaciji</strong> odaberite komitenta <em>Studio TAF sp Banja Luka</em> i kliknite na <strong>"Učitaj Podatke"</strong> za automatsko generisanje KIF rekapitulacije, Excel pazara i <strong>Bankovnih Izvoda</strong>.
        </span>
      </div>
    </div>
  );
}
