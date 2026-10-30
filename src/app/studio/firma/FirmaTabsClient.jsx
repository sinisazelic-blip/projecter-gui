"use client";

import { useState } from "react";
import FirmaSaveForm from "./FirmaSaveForm";
import FiskalModal from "./FiskalModal";
import BrojacFakturaCard from "./BrojacFakturaCard";
import FluxarBridgeCard from "./FluxarBridgeCard";
import LogoUpload from "./LogoUpload";

export default function FirmaTabsClient({
  firma,
  accs,
  t,
  locale,
  pick,
  labelStyle,
  inputStyle,
  row2,
  row3,
}) {
  const [activeTab, setActiveTab] = useState("osnovno");
  const f = firma;

  const tabs = [
    { id: "osnovno", label: "Osnovno & Registri", icon: "🏢" },
    { id: "banke", label: "Banke & Računi", icon: "💳" },
    { id: "fiskal", label: "Fiskal & Brojač faktura", icon: "🖨️" },
    { id: "fluxar", label: "FluxaR // Knjigovodstvo", icon: "🌉" },
  ];

  return (
    <div>
      {/* Tab Navigacija u stilu Tenant Centra */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          paddingBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                border: isActive
                  ? "1px solid #38bdf8"
                  : "1px solid rgba(255, 255, 255, 0.12)",
                background: isActive
                  ? "rgba(56, 189, 248, 0.15)"
                  : "rgba(255, 255, 255, 0.04)",
                color: isActive ? "#38bdf8" : "#cbd5e1",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* GLAVNA FORMA ZA Tremove 1 & 2 (Oba taba ostaju u DOM-u radi čuvanja) */}
      <div style={{ display: activeTab === "osnovno" || activeTab === "banke" ? "block" : "none" }}>
        <FirmaSaveForm
          saveLabel={t("firma.save")}
          savingLabel={t("firma.saving")}
          cancelLabel={t("firma.cancel")}
          cancelHref="/dashboard"
          savedTitle={t("firma.savedTitle")}
          savedMessage={t("firma.savedOk")}
          errorGeneric={t("firma.saveError")}
        >
          {/* TAB 1: OSNOVNO, KONTAKT, POREZI I REGISTRI */}
          <div style={{ display: activeTab === "osnovno" ? "block" : "none" }}>
            <div className="sectionTitle" style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: "#38bdf8" }}>
              🏢 Osnovni Podaci o Firmi & Sjedište
            </div>

            <div className="twoCol" style={row2}>
              <div>
                <div style={labelStyle}>{t("firma.labelNaziv")}</div>
                <input
                  name="naziv"
                  defaultValue={pick(f?.naziv) || "Studio TAF"}
                  style={inputStyle}
                  required
                />
                <div className="hint">{t("firma.hintNaziv")}</div>
              </div>

              <div>
                <div style={labelStyle}>{t("firma.labelPravniNaziv")}</div>
                <input
                  name="pravni_naziv"
                  defaultValue={pick(f?.pravni_naziv)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="threeCol" style={row3}>
              <div>
                <div style={labelStyle}>{t("firma.labelEmail")}</div>
                <input
                  name="email"
                  defaultValue={pick(f?.email)}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={labelStyle}>{t("firma.labelTelefon")}</div>
                <input
                  name="telefon"
                  defaultValue={pick(f?.telefon)}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={labelStyle}>{t("firma.labelWeb")}</div>
                <input
                  name="web"
                  defaultValue={pick(f?.web)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ height: 14 }} />

            <LogoUpload
              initialLogoUrl={pick(f?.logo_url)}
              uploadLabel={t("firma.logoUpload")}
              removeLabel={t("firma.logoRemove")}
              hintText={t("firma.logoHint")}
              activeIdText={t("firma.activeId")}
            />

            <div style={{ height: 18 }} />
            <div className="sectionTitle" style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: "#cbd5e1" }}>
              📍 Adresa i Sjedište
            </div>

            <div className="twoCol" style={row2}>
              <div>
                <div style={labelStyle}>{t("firma.labelAdresa")}</div>
                <input
                  name="adresa"
                  defaultValue={pick(f?.adresa)}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={labelStyle}>{t("firma.labelGrad")}</div>
                <input
                  name="grad"
                  defaultValue={pick(f?.grad)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="twoCol" style={row2}>
              <div>
                <div style={labelStyle}>{t("firma.labelPostanskiBroj")}</div>
                <input
                  name="postanski_broj"
                  defaultValue={pick(f?.postanski_broj)}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={labelStyle}>{t("firma.labelDrzava")}</div>
                <input
                  name="drzava"
                  defaultValue={pick(f?.drzava) || "Bosna i Hercegovina"}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ height: 20 }} />
            <div className="sectionTitle" style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: "#cbd5e1" }}>
              📋 Poreski i Registarski Podaci
            </div>

            <div className="threeCol" style={row3}>
              <div>
                <div style={labelStyle}>{t("firma.labelJib")}</div>
                <input
                  name="jib"
                  defaultValue={pick(f?.jib)}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <div style={labelStyle}>{t("firma.labelPib")}</div>
                <input
                  name="pib"
                  defaultValue={pick(f?.pib)}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={labelStyle}>{t("firma.labelPdvBroj")}</div>
                <input
                  name="pdv_broj"
                  defaultValue={pick(f?.pdv_broj)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="twoCol" style={row2}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 18 }}>
                <input
                  type="checkbox"
                  name="pdv_obveznik"
                  defaultChecked={Boolean(f?.pdv_obveznik)}
                  id="pdv_obveznik"
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                <label htmlFor="pdv_obveznik" style={{ fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#f8fafc" }}>
                  {t("firma.labelPdvObveznik")}
                </label>
              </div>

              <div>
                <div style={labelStyle}>{t("firma.labelSudskiRegistar")}</div>
                <input
                  name="sudski_registar"
                  defaultValue={pick(f?.sudski_registar)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="threeCol" style={row3}>
              <div>
                <div style={labelStyle}>{t("firma.labelRegBroj")}</div>
                <input
                  name="registarski_broj"
                  defaultValue={pick(f?.registarski_broj)}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={labelStyle}>{t("firma.labelDjelatnost")}</div>
                <input
                  name="djelatnost"
                  defaultValue={pick(f?.djelatnost)}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={labelStyle}>{t("firma.labelSifraDjelatnosti")}</div>
                <input
                  name="sifra_djelatnosti"
                  defaultValue={pick(f?.sifra_djelatnosti)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div style={{ maxWidth: 300 }}>
              <div style={labelStyle}>{t("firma.labelOsnovniKapital")}</div>
              <input
                name="osnovni_kapital"
                defaultValue={pick(f?.osnovni_kapital)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* TAB 2: BANKE I RAČUNI */}
          <div style={{ display: activeTab === "banke" ? "block" : "none" }}>
            <div className="sectionTitle" style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: "#38bdf8" }}>
              💳 Transakcijski i Bankovni Računi
            </div>

            {[1, 2, 3].map((i) => {
              const a = accs[i - 1] || {};
              return (
                <div key={i} className="bankCard" style={{ marginBottom: 16 }}>
                  <div className="bankHead">
                    <span className="pill" style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                      Račun #{i}
                    </span>
                  </div>

                  <div className="twoCol" style={row2}>
                    <div>
                      <div style={labelStyle}>{t("firma.labelBanka")}</div>
                      <input
                        name={`bank_naziv_${i}`}
                        defaultValue={pick(a.bank_naziv)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <div style={labelStyle}>{t("firma.labelRacun")}</div>
                      <input
                        name={`bank_racun_${i}`}
                        defaultValue={pick(a.bank_racun)}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ height: 10 }} />

                  <div className="twoCol" style={row2}>
                    <div>
                      <div style={labelStyle}>{t("firma.labelIban")}</div>
                      <input
                        name={`iban_${i}`}
                        defaultValue={pick(a.iban)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <div style={labelStyle}>{t("firma.labelSwift")}</div>
                      <input
                        name={`swift_${i}`}
                        defaultValue={pick(a.swift)}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <label className="pill" style={{ marginTop: 10, cursor: "pointer", display: "inline-flex" }}>
                    <input
                      type="checkbox"
                      name={`show_on_invoice_${i}`}
                      defaultChecked={Number(a.show_on_invoice ?? 1) === 1}
                      style={{ marginRight: 8 }}
                    />
                    {t("firma.showOnInvoice")}
                  </label>
                </div>
              );
            })}
          </div>
        </FirmaSaveForm>
      </div>

      {/* TAB 3: POSTAVKE FISKALNOG UREĐAJA & BROJAČ FAKTURA */}
      {activeTab === "fiskal" && (
        <div className="settingsModule" style={{ marginTop: 0 }}>
          <div className="sectionTitle" style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: "#38bdf8" }}>
            🖨️ Postavke Fiskalnog Uređaja & Brojač Faktura
          </div>

          {locale === "sr" && (
            <div className="btnRow" style={{ marginBottom: 16 }}>
              <FiskalModal />
              <span className="muted" style={{ marginLeft: 10 }}>
                {t("firma.activeId")}{" "}
                <span className="mono">{pick(f?.firma_id) || "—"}</span>
              </span>
            </div>
          )}

          <div style={{ height: 10 }} />
          <BrojacFakturaCard />
        </div>
      )}

      {/* TAB 4: FLUXAR KNJIGOVODSTVENI MOST */}
      {activeTab === "fluxar" && (
        <div className="settingsModule" style={{ marginTop: 0 }}>
          <div className="sectionTitle" style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: "#38bdf8" }}>
            🌉 FluxaR // Knjigovodstveni Most
          </div>
          {locale === "sr" ? (
            <FluxarBridgeCard firma={f} />
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              Modul je dostupan za primarno tržište.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
