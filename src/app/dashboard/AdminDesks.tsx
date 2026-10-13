"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Receipt,
  Landmark,
  BarChart3,
  ArrowUpRight,
  X
} from "lucide-react";

interface AdminDesksProps {
  stats: any;
}

export default function AdminDesks({ stats }: AdminDesksProps) {
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const zaFakturisanje = stats?.zaFakturisanje || { broj: 12, budzet: 2216.7 };
  const fakture = stats?.fakture || { broj: 7, potrazivanja: 9200.89, vanValuteBroj: 3, vanValuteIznos: 2581.7 };
  const likvidnost = stats?.likvidnost || { totalZiroFirma: 45, totalKartice: 406, totalPrivatni: 106, totalSviRacuni: 557 };

  const deskCardStyle: React.CSSProperties = {
    borderRadius: 18,
    background: "#0f1722",
    border: "1px solid rgba(255, 255, 255, 0.07)",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  const subLinkStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(255, 255, 255, 0.02)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    textDecoration: "none",
    color: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    transition: "background 0.15s ease",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
        gap: 16,
        marginBottom: 20,
      }}
    >
      {/* =========================================
          STO 1: FAKTURISANJE & RAČUNI
          ========================================= */}
      <div style={deskCardStyle}>
        <div>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "rgba(34, 197, 94, 0.12)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#4ade80",
                }}
              >
                <Receipt size={16} />
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#ffffff" }}>
                Sto 1: Fakturisanje & Računi
              </h3>
            </div>

            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.5px",
                color: "#86efac",
                padding: "2px 7px",
                borderRadius: 6,
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
              }}
            >
              FAKTURE
            </span>
          </div>

          {/* Glavna akcija: Wizard fakturisanja - Blago tonirano */}
          <Link
            href="/fakture/za-fakturisanje"
            title="Čeka izdavanje faktura - pokreni čarobnjak"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 15px",
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(34, 197, 94, 0.14) 0%, rgba(34, 197, 94, 0.04) 100%)",
              border: "1px solid rgba(34, 197, 94, 0.32)",
              textDecoration: "none",
              color: "#ffffff",
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff" }}>
                {zaFakturisanje.broj} završenih poslova
              </div>
              <div style={{ fontSize: 12, color: "#86efac", marginTop: 3, fontWeight: 700 }}>
                {zaFakturisanje.budzet} KM za fakturisanje
              </div>
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "6px 11px",
                borderRadius: 8,
                background: "rgba(34, 197, 94, 0.2)",
                border: "1px solid rgba(34, 197, 94, 0.4)",
                color: "#bbf7d0",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>Wizard</span>
              <ArrowUpRight size={13} />
            </span>
          </Link>

          {/* Pod-akcije (čiste linije bez suvišnih opisa) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Link
              href="/fakture"
              title="KIF - Sve izlazne fakture i praćenje valuta plaćanja"
              style={subLinkStyle}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>📑 KIF Fakture</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: fakture.vanValuteBroj > 0 ? "#fca5a5" : "var(--muted)" }}>
                {fakture.broj} {fakture.vanValuteBroj > 0 ? `(${fakture.vanValuteBroj} kasne)` : ""}
              </span>
            </Link>

            <Link
              href="/finance/kuf"
              title="KUF - Knjiga ulaznih računa i troškovi dobavljača"
              style={subLinkStyle}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>📥 KUF Računi</span>
            </Link>

            <Link
              href="/ponude"
              title="Komercijalne ponude i narudžbenice"
              style={subLinkStyle}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>📝 Ponude</span>
            </Link>

            <Link
              href="/finance/mali-racuni"
              title="Mali računi i poresko pravdanje keš troškova"
              style={subLinkStyle}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>🧾 Mali Računi</span>
            </Link>
          </div>
        </div>
      </div>

      {/* =========================================
          STO 2: BANKA & NOVAC
          ========================================= */}
      <div style={deskCardStyle}>
        <div>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "rgba(56, 189, 248, 0.12)",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#38bdf8",
                }}
              >
                <Landmark size={16} />
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#ffffff" }}>
                Sto 2: Banka & Novac
              </h3>
            </div>

            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.5px",
                color: "#7dd3fc",
                padding: "2px 7px",
                borderRadius: 6,
                background: "rgba(56, 189, 248, 0.1)",
                border: "1px solid rgba(56, 189, 248, 0.2)",
              }}
            >
              BANKA
            </span>
          </div>

          {/* Glavna akcija: Izvodi - Blago tonirano */}
          <Link
            href="/izvodi"
            title="Uvoz i rasknjižavanje bankovnih izvoda"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 15px",
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(56, 189, 248, 0.14) 0%, rgba(56, 189, 248, 0.04) 100%)",
              border: "1px solid rgba(56, 189, 248, 0.32)",
              textDecoration: "none",
              color: "#ffffff",
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff" }}>
                Bankovni Izvodi
              </div>
              <div style={{ fontSize: 12, color: "#93c5fd", marginTop: 3, fontWeight: 700 }}>
                Žiro račun: {likvidnost.totalZiroFirma.toFixed(2)} KM
              </div>
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "6px 11px",
                borderRadius: 8,
                background: "rgba(56, 189, 248, 0.2)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                color: "#bae6fd",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>Izvodi</span>
              <ArrowUpRight size={13} />
            </span>
          </Link>

          {/* Pod-akcije */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Link
              href="/naplate"
              title="Naplata kupaca i IOS otvorene stavke"
              style={subLinkStyle}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>💵 Naplata & IOS</span>
            </Link>

            <Link
              href="/izvodi"
              title="Kartice i računi firme"
              style={subLinkStyle}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>💳 Kartice</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#93c5fd" }}>
                {(likvidnost.totalZiroFirma + likvidnost.totalKartice).toFixed(0)} KM
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* =========================================
          STO 3: PDV & ANALITIKA
          ========================================= */}
      <div style={deskCardStyle}>
        <div>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f59e0b",
                }}
              >
                <BarChart3 size={16} />
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#ffffff" }}>
                Sto 3: PDV & Analitika
              </h3>
            </div>

            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.5px",
                color: "#fcd34d",
                padding: "2px 7px",
                borderRadius: 6,
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.2)",
              }}
            >
              ANALITIKA
            </span>
          </div>

          {/* Glavna akcija: PDV Prijava - Blago tonirano */}
          <Link
            href="/finance/pdv"
            title="Mjesečni PDV obračun KIF vs KUF odbitak"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 15px",
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(245, 158, 11, 0.04) 100%)",
              border: "1px solid rgba(245, 158, 11, 0.32)",
              textDecoration: "none",
              color: "#ffffff",
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff" }}>
                PDV Prijava & Stanje
              </div>
              <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 3, fontWeight: 700 }}>
                KIF vs KUF obračun
              </div>
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "6px 11px",
                borderRadius: 8,
                background: "rgba(245, 158, 11, 0.2)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                color: "#fde68a",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>PDV</span>
              <ArrowUpRight size={13} />
            </span>
          </Link>

          {/* Pod-akcije */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Link
              href="/izvjestaji/graficki"
              title="Grafikoni uporedne realizacije i trendovi"
              style={subLinkStyle}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>📊 Grafikoni</span>
            </Link>

            <Link
              href="/finance"
              title="Analitika — Puni pregled svih finansijskih i analitičkih alata"
              style={{
                ...subLinkStyle,
                background: "rgba(56, 189, 248, 0.12)",
                borderColor: "rgba(56, 189, 248, 0.3)",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800, color: "#38bdf8" }}>📊 Analitika</span>
              <ArrowUpRight size={13} color="#38bdf8" />
            </Link>
          </div>
        </div>
      </div>

      {/* =========================================
          MODAL: SVI FINANSIJSKI & ANALITIČKI ALATI
          ========================================= */}
      {toolsModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 8, 14, 0.8)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setToolsModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              background: "#0f1722",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 20,
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
              padding: 24,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                🧰 Finansijski & Analitički Alati
              </h3>
              <button
                type="button"
                onClick={() => setToolsModalOpen(false)}
                title="Zatvori"
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "none",
                  color: "var(--muted)",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Grid alata (čiste kartice sa tooltip naslovima) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <Link
                href="/finance/mali-racuni"
                title="Poresko pravdanje i keš troškovi"
                onClick={() => setToolsModalOpen(false)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  textDecoration: "none",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                🧾 Mali Računi
              </Link>

              <Link
                href="/narudzbenice"
                title="Narudžbenice za dobavljače"
                onClick={() => setToolsModalOpen(false)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  textDecoration: "none",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                📋 Narudžbenice
              </Link>

              <Link
                href="/ponude"
                title="Komercijalne ponude kupcima"
                onClick={() => setToolsModalOpen(false)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  textDecoration: "none",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                📝 Ponude
              </Link>

              <Link
                href="/izvjestaji/svi"
                title="Godišnji 1004 & 1006 obrasci"
                onClick={() => setToolsModalOpen(false)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(56, 189, 248, 0.08)",
                  border: "1px solid rgba(56, 189, 248, 0.2)",
                  textDecoration: "none",
                  color: "#38bdf8",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                🏛️ PURS Izvještaji
              </Link>

              <Link
                href="/izvjestaji/graficki"
                title="6-mjesečni grafikoni realizacije"
                onClick={() => setToolsModalOpen(false)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  textDecoration: "none",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                📊 Uporedni Trend
              </Link>

              <Link
                href="/finance"
                title="Mjesečne fiksne obaveze"
                onClick={() => setToolsModalOpen(false)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  textDecoration: "none",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                🏢 Fiksni Troškovi
              </Link>

              <Link
                href="/finance"
                title="Finansijski anuiteti i lizing"
                onClick={() => setToolsModalOpen(false)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  textDecoration: "none",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                🏦 Krediti & Lizing
              </Link>

              <Link
                href="/finance"
                title="Oprema i amortizacija"
                onClick={() => setToolsModalOpen(false)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  textDecoration: "none",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                📦 Osnovna Sredstva
              </Link>

              <Link
                href="/finance/profit"
                title="Profitabilnost po klijentima i marže"
                onClick={() => setToolsModalOpen(false)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  textDecoration: "none",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                📈 Marže & Profit
              </Link>

              <Link
                href="/naplate"
                title="Otvorene stavke i IOS kupaca"
                onClick={() => setToolsModalOpen(false)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  textDecoration: "none",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                ⏳ Dugovanja & IOS
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
