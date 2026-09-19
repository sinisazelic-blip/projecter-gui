"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatAmount } from "@/lib/format";
import { 
  FileText, 
  Printer, 
  Download, 
  CheckCircle2, 
  TrendingDown, 
  DollarSign, 
  ShieldAlert, 
  Layers, 
  Receipt,
  FileCheck
} from "lucide-react";

export default function GodisnjiIzvjestajClient() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [licniOdbitak, setLicniOdbitak] = useState<number>(12000.00);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"KALKULACIJA" | "OBRAZAC_1004" | "OBRAZAC_1006">("KALKULACIJA");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/finance/godisnji-izvjestaj?year=${year}&licni_odbitak=${licniOdbitak}`);
      const json = await res.json();
      if (json.ok) {
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [year, licniOdbitak]);

  const kalk = data?.kalkulacija;
  const tab8 = data?.obrazac_1006_tabela_8;
  const obv = data?.obveznik;

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", paddingBottom: 50 }}>
      {/* Top Controls & Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            📋 Godišnja Poreska Prijava (PURS 1004 / 1006)
          </h1>
          <p className="subtle" style={{ margin: "4px 0 0 0", fontSize: 14 }}>
            Automatsko sravnjivanje KIF faktura, KUF troškova, bankarskih provizija i amortizacije za s.p. „Studio TAF”.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: 8 }}>
            <span className="subtle" style={{ fontSize: 13 }}>Fiskalna godina:</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="input"
              style={{ width: 100, fontWeight: 700 }}
            >
              <option value={2026}>2026. g</option>
              <option value={2025}>2025. g</option>
              <option value={2024}>2024. g</option>
              <option value={2023}>2023. g</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: 8 }}>
            <span className="subtle" style={{ fontSize: 13 }}>Lični odbitak (Kartica):</span>
            <input
              type="number"
              value={licniOdbitak}
              onChange={(e) => setLicniOdbitak(Number(e.target.value))}
              className="input"
              style={{ width: 110, textAlign: "right", fontWeight: 700 }}
            />
            <span style={{ fontSize: 12 }}>KM</span>
          </div>

          <button
            onClick={() => window.print()}
            className="btn btn--active"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Printer className="w-4 h-4" /> Štampaj / PDF za knjigovođu
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16, borderLeft: "4px solid #3b82f6" }}>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 2 }}>Ukupni Prihodi (KIF)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#93c5fd" }}>
            {formatAmount(kalk?.prihodi_ukupno_km || 0, "sr")}
          </div>
          <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
            {kalk?.fakture_broj || 0} izdatih faktura
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: "4px solid #ef4444" }}>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 2 }}>Priznati Rashodi (KUF + OS)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fca5a5" }}>
            {formatAmount(kalk?.rashodi_ukupno_km || 0, "sr")}
          </div>
          <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
            KUF troškovi + Amortizacija
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: "4px solid #8b5cf6" }}>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 2 }}>Dohodak (Prihodi − Rashodi)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#c4b5fd" }}>
            {formatAmount(kalk?.dohodak_km || 0, "sr")}
          </div>
          <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
            Neto poslovni dobitak
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: "4px solid #f59e0b" }}>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 2 }}>Poreska Osnovica</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fcd34d" }}>
            {formatAmount(kalk?.poreska_osnovica_km || 0, "sr")}
          </div>
          <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
            Dohodak − Lični odbitak ({formatAmount(licniOdbitak, "sr")})
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: "4px solid #10b981", background: "rgba(16,185,129,0.06)" }}>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 2 }}>Porez na dohodak (10%)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#34d399" }}>
            {formatAmount(kalk?.porez_na_dohodak_km || 0, "sr")}
          </div>
          <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
            Konačna poreska obaveza
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
        <button
          onClick={() => setActiveTab("KALKULACIJA")}
          className={`btn ${activeTab === "KALKULACIJA" ? "btn--active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Receipt className="w-4 h-4" /> Detaljna kalkulacija i specifikacija
        </button>
        <button
          onClick={() => setActiveTab("OBRAZAC_1004")}
          className={`btn ${activeTab === "OBRAZAC_1004" ? "btn--active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <FileText className="w-4 h-4" /> Obrazac 1004 (Zbirna prijava)
        </button>
        <button
          onClick={() => setActiveTab("OBRAZAC_1006")}
          className={`btn ${activeTab === "OBRAZAC_1006" ? "btn--active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <FileCheck className="w-4 h-4" /> Obrazac 1006 (Prihodi i Rashodi)
        </button>
      </div>

      {/* TAB 1: DETALJNA KALKULACIJA */}
      {activeTab === "KALKULACIJA" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Prihodi Breakdown */}
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 800, marginTop: 0, marginBottom: 12, color: "#93c5fd" }}>
              1. Zvanični Prihodi (KIF - Realizacija)
            </h3>
            <table className="table" style={{ margin: 0, fontSize: 13 }}>
              <tbody>
                <tr>
                  <td>Ukupan promet faktura bez PDV-a</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {formatAmount(kalk?.prihodi_ukupno_km || 0, "sr")}
                  </td>
                </tr>
                <tr>
                  <td>Broj realizovanih faktura u godini</td>
                  <td style={{ textAlign: "right" }}>{kalk?.fakture_broj || 0}</td>
                </tr>
                <tr style={{ background: "rgba(255,255,255,0.03)", fontWeight: 800 }}>
                  <td>UKUPAN PRIHOD ZA PORESKU OSNOVICU:</td>
                  <td style={{ textAlign: "right", color: "#93c5fd" }}>
                    {formatAmount(kalk?.prihodi_ukupno_km || 0, "sr")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Rashodi Breakdown (Tabela 8) */}
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 800, marginTop: 0, marginBottom: 12, color: "#fca5a5" }}>
              2. Priznati Rashodi Poslovanja (Obrazac 1006, Tab. 8)
            </h3>
            <table className="table" style={{ margin: 0, fontSize: 13 }}>
              <tbody>
                <tr>
                  <td>Red 2: Proizvodne usluge & PTT (slanje u inostranstvo)</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {formatAmount(tab8?.red_2_proizvodne_usluge_ptt || 0, "sr")}
                  </td>
                </tr>
                <tr>
                  <td>Red 3: Gorivo i energija (prevoz na takmičenja / teren)</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {formatAmount(tab8?.red_3_gorivo_energija || 0, "sr")}
                  </td>
                </tr>
                <tr>
                  <td>Red 4: Nematerijalni troškovi (knjigovodstvo, licence, IT)</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {formatAmount(tab8?.red_4_nematerijalni_troskovi || 0, "sr")}
                  </td>
                </tr>
                <tr>
                  <td>Red 5: Finansijski rashodi (bankarske provizije iz izvoda)</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {formatAmount(tab8?.red_5_finansijski_rashodi || 0, "sr")}
                  </td>
                </tr>
                <tr>
                  <td>Red 6: Ostali rashodi & tekuće održavanje</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {formatAmount(tab8?.red_6_ostali_rashodi || 0, "sr")}
                  </td>
                </tr>
                <tr style={{ background: "rgba(16,185,129,0.08)" }}>
                  <td style={{ fontWeight: 700, color: "#6ee7b7" }}>
                    Red 8: Troškovi amortizacije osnovnih sredstava (20%)
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "#6ee7b7" }}>
                    {formatAmount(tab8?.red_8_amortizacija || 0, "sr")}
                  </td>
                </tr>
                <tr style={{ background: "rgba(255,255,255,0.04)", fontWeight: 800 }}>
                  <td>RED 17: UKUPNI PRIZNATI RASHODI:</td>
                  <td style={{ textAlign: "right", color: "#fca5a5" }}>
                    {formatAmount(tab8?.red_17_ukupan_iznos || 0, "sr")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amortizacija List */}
          <div className="card" style={{ gridColumn: "span 2" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#c4b5fd" }}>
                3. Specifikacija Amortizacije Osnovnih Sredstava za {year}. godinu
              </h3>
              <Link href="/finance/osnovna-sredstva" className="btn" style={{ fontSize: 12 }}>
                Upravljanje opremom →
              </Link>
            </div>
            <table className="table" style={{ margin: 0, fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Naziv opreme / radne stanice</th>
                  <th>Kategorija</th>
                  <th style={{ textAlign: "right" }}>Nabavna Vrijednost</th>
                  <th style={{ textAlign: "center" }}>Stopa</th>
                  <th style={{ textAlign: "right" }}>Priznati rashod ({year})</th>
                </tr>
              </thead>
              <tbody>
                {data?.osnovna_sredstva_detalji?.length ? (
                  data.osnovna_sredstva_detalji.map((os: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{os.naziv}</td>
                      <td><span className="badge" style={{ fontSize: 11 }}>{os.kategorija}</span></td>
                      <td style={{ textAlign: "right" }}>{formatAmount(os.nabavna_vrijednost_km, "sr")}</td>
                      <td style={{ textAlign: "center" }}>{os.stopa}%</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#6ee7b7" }}>
                        {formatAmount(os.amortizacija_km, "sr")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="subtle" style={{ textAlign: "center", padding: 16 }}>
                      Nema evidentiranih osnovnih sredstava za ovu godinu.
                    </td>
                  </tr>
                )}
                <tr style={{ background: "rgba(255,255,255,0.04)", fontWeight: 800 }}>
                  <td colSpan={4} style={{ textAlign: "right" }}>UKUPNA AMORTIZACIJA:</td>
                  <td style={{ textAlign: "right", color: "#6ee7b7" }}>
                    {formatAmount(tab8?.red_8_amortizacija || 0, "sr")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: OBRAZAC 1004 (Zvanični PURS Format) */}
      {activeTab === "OBRAZAC_1004" && (
        <div className="card" style={{ background: "#fff", color: "#111", padding: 30, fontFamily: "serif" }}>
          <div style={{ textAlign: "center", borderBottom: "2px solid #111", paddingBottom: 15, marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 4px 0", fontSize: 18 }}>РЕПУБЛИКА СРПСКА — ПОРЕСКА УПРАВА</h2>
            <h3 style={{ margin: "0 0 4px 0", fontSize: 16, textTransform: "uppercase" }}>Образац 1004</h3>
            <div style={{ fontSize: 14 }}>ГОДИШЊА ПОРЕСКА ПРИЈАВА ЗА ПОРЕЗ НА ДОХОДАК ЗА {year}. ГОДИНУ</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20, fontSize: 13 }}>
            <div>
              <strong>1) ЈИБ предузетника:</strong> 4509750610000<br />
              <strong>2) ЈМБГ власника:</strong> 1408964100023<br />
              <strong>3) Назив радње:</strong> „Studio TAF” - Zelić Siniša s.p.<br />
            </div>
            <div>
              <strong>4) Шифра општине:</strong> 002 (Бања Лука)<br />
              <strong>5) Дјелатност:</strong> Услуге звучног снимања, емитовања и мјерења<br />
              <strong>6) Порески период:</strong> 01.01.{year} — 31.12.{year}
            </div>
          </div>

          <h4 style={{ margin: "16px 0 8px 0", fontSize: 15, textTransform: "uppercase", background: "#f3f4f6", padding: "6px 10px" }}>
            Одјељак 2 — Доходак од самосталне дјелатности
          </h4>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, margin: "10px 0" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ border: "1px solid #9ca3af", padding: "6px" }}>Опис ставке</th>
                <th style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right" }}>Приход (KM)</th>
                <th style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right" }}>Расход (KM)</th>
                <th style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right" }}>Доходак (KM)</th>
                <th style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right" }}>Лични одбитак</th>
                <th style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right" }}>Основица за порез</th>
                <th style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right" }}>Порез (10%)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: "1px solid #9ca3af", padding: "8px" }}>
                  <strong>Самостална дјелатност („Studio TAF”)</strong><br />
                  <span style={{ fontSize: 11, color: "#4b5563" }}>Шифра општине: 002</span>
                </td>
                <td style={{ border: "1px solid #9ca3af", padding: "8px", textAlign: "right" }}>
                  {formatAmount(kalk?.prihodi_ukupno_km || 0, "sr")}
                </td>
                <td style={{ border: "1px solid #9ca3af", padding: "8px", textAlign: "right" }}>
                  {formatAmount(kalk?.rashodi_ukupno_km || 0, "sr")}
                </td>
                <td style={{ border: "1px solid #9ca3af", padding: "8px", textAlign: "right", fontWeight: "bold" }}>
                  {formatAmount(kalk?.dohodak_km || 0, "sr")}
                </td>
                <td style={{ border: "1px solid #9ca3af", padding: "8px", textAlign: "right" }}>
                  {formatAmount(licniOdbitak, "sr")}
                </td>
                <td style={{ border: "1px solid #9ca3af", padding: "8px", textAlign: "right", fontWeight: "bold" }}>
                  {formatAmount(kalk?.poreska_osnovica_km || 0, "sr")}
                </td>
                <td style={{ border: "1px solid #9ca3af", padding: "8px", textAlign: "right", fontWeight: "bold", color: "#b91c1c" }}>
                  {formatAmount(kalk?.porez_na_dohodak_km || 0, "sr")}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, fontSize: 12 }}>
            <div>
              Датум попуњавања: 25.02.{year + 1}. године<br />
              М.П.
            </div>
            <div style={{ textAlign: "center" }}>
              Потпис пореског обвезника / овлаштеног лица:<br /><br />
              _____________________________________<br />
              <strong>Синиша Зелић</strong>, с.п.
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OBRAZAC 1006 (Pregled prihoda i rashoda) */}
      {activeTab === "OBRAZAC_1006" && (
        <div className="card" style={{ background: "#fff", color: "#111", padding: 30, fontFamily: "serif" }}>
          <div style={{ textAlign: "center", borderBottom: "2px solid #111", paddingBottom: 15, marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 4px 0", fontSize: 18 }}>РЕПУБЛИКА СРПСКА — ПОРЕСКА УПРАВА</h2>
            <h3 style={{ margin: "0 0 4px 0", fontSize: 16, textTransform: "uppercase" }}>Образац 1006</h3>
            <div style={{ fontSize: 14 }}>ПРЕГЛЕД ПРИХОДА И РАСХОДА ОД САМОСТАЛНЕ ДЈЕЛАТНОСТИ ЗА {year}. ГОДИНУ</div>
          </div>

          <div style={{ marginBottom: 15, fontSize: 13 }}>
            <strong>ЈИБ:</strong> 4509750610000 | <strong>Назив радње:</strong> „Studio TAF” - Zelić Siniša s.p. Banja Luka
          </div>

          <h4 style={{ margin: "16px 0 8px 0", fontSize: 14, textTransform: "uppercase", background: "#f3f4f6", padding: "6px 10px" }}>
            Табела 8 — Плаћени трошкови који терете расходе периода
          </h4>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, margin: "10px 0" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ border: "1px solid #9ca3af", padding: "6px", width: 60 }}>Р. бр.</th>
                <th style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "left" }}>Врста плаћених трошкова</th>
                <th style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right", width: 160 }}>Износ (KM)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "center" }}>1</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px" }}>Трошкови зарада и накнада зарада</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right" }}>0,00</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "center" }}>2</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px" }}>Трошкови производних услуга (ПТТ, курирске услуге, извоз)</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right" }}>
                  {formatAmount(tab8?.red_2_proizvodne_usluge_ptt || 0, "sr")}
                </td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "center" }}>3</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px" }}>Трошкови горива и енергије (службена путовања, терен)</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right" }}>
                  {formatAmount(tab8?.red_3_gorivo_energija || 0, "sr")}
                </td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "center" }}>4</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px" }}>Нематеријални трошкови (књиговодство, софтверске лиценце, IT претплате)</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right" }}>
                  {formatAmount(tab8?.red_4_nematerijalni_troskovi || 0, "sr")}
                </td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "center" }}>5</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px" }}>Финансијски расходи (банкарске провизије са извода)</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right" }}>
                  {formatAmount(tab8?.red_5_finansijski_rashodi || 0, "sr")}
                </td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "center" }}>6</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px" }}>Остали расходи и текуће одржавање опреме</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right" }}>
                  {formatAmount(tab8?.red_6_ostali_rashodi || 0, "sr")}
                </td>
              </tr>
              <tr style={{ background: "#f0fdf4" }}>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "center", fontWeight: "bold" }}>8</td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", fontWeight: "bold" }}>
                  Трошкови амортизације основних средстава (20%)
                </td>
                <td style={{ border: "1px solid #9ca3af", padding: "6px", textAlign: "right", fontWeight: "bold", color: "#166534" }}>
                  {formatAmount(tab8?.red_8_amortizacija || 0, "sr")}
                </td>
              </tr>
              <tr style={{ background: "#f9fafb", fontWeight: "bold" }}>
                <td style={{ border: "1px solid #9ca3af", padding: "8px", textAlign: "center" }}>17</td>
                <td style={{ border: "1px solid #9ca3af", padding: "8px" }}>
                  УКУПАН ИЗНОС ПРИЗНАТИХ РАСХОДА (Сабрати тачке од 1 до 16):
                </td>
                <td style={{ border: "1px solid #9ca3af", padding: "8px", textAlign: "right" }}>
                  {formatAmount(tab8?.red_17_ukupan_iznos || 0, "sr")}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, fontSize: 12 }}>
            <div>
              Датум попуњавања: 25.02.{year + 1}. године<br />
              М.П.
            </div>
            <div style={{ textAlign: "center" }}>
              Потпис овлаштеног лица:<br /><br />
              _____________________________________<br />
              <strong>Синиша Зелић</strong>, с.п.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
