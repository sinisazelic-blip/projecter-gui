// src/app/fakture/wizard/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";

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

export default function InvoiceWizard() {
  const sp = useSearchParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const isEu = locale === "en";

  useEffect(() => {
    if (isEu) setCurrency("EUR");
  }, [isEu]);

  useEffect(() => {
    if (!isEu) return;
    let alive = true;
    fetch("/api/firma/active", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: any) => {
        if (!alive || !j?.ok) return;
        const v = j.firma?.vat_rate_local;
        const n = v != null ? Number(v) : null;
        if (Number.isFinite(n) && n >= 0) setFirmaVatRate(n);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [isEu]);

  // ✅ čitamo ids (novo) + pid (fallback)
  const ids = useMemo(() => {
    const idsRaw = String(sp.get("ids") ?? "").trim();
    if (idsRaw) {
      return idsRaw
        .split(",")
        .map((x) => Number(String(x).trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
    }

    const pid = sp.get("pid");
    const n = Number(pid);
    return Number.isFinite(n) && n > 0 ? [n] : [];
  }, [sp]);

  // Datum u UI je dd.mm.yyyy (kao što tražiš)
  const [invoiceDateDD, setInvoiceDateDD] = useState<string>(todayDDMMYYYY());

  // Osnovno (ostavljam kako je bilo)
  const [currency, setCurrency] = useState<string>("KM");
  const [vatMode, setVatMode] = useState<"BH_17" | "INO_0">("BH_17");
  const [isInoDetected, setIsInoDetected] = useState<boolean>(false);

  // Fiskalizacija: ručni PFR ili automatski (Fiskalizuj). Podrazumijevano ručno dok automatski ne radi.
  const [lastPfrNumber, setLastPfrNumber] = useState<string>("");
  const [useAutoFiscal, setUseAutoFiscal] = useState<boolean>(false);

  // Popust prije PDV-a (KM) — prikaz samo kad postoji
  const [popustKm, setPopustKm] = useState<string>("");

  // Oslobođen od PDV-a (član 24) — auto 0%
  const [pdvOslobodjenDetected, setPdvOslobodjenDetected] = useState<boolean>(false);

  // ✅ Poziv na broj: AUTO, read-only
  const [pozivNaBroj, setPozivNaBroj] = useState<string>("");
  const [pnbLoading, setPnbLoading] = useState<boolean>(false);
  const [pnbErr, setPnbErr] = useState<string>("");

  // ✅ Override nazivi projekata (projekat_id -> naziv_override)
  const [projectNameOverrides, setProjectNameOverrides] = useState<Record<number, string>>({});
  const [projectsData, setProjectsData] = useState<Array<{ projekat_id: number; radni_naziv: string | null }>>([]);

  // ✅ EU: lokalna stopa PDV iz Company Settings (za label u dropdownu)
  const [firmaVatRate, setFirmaVatRate] = useState<number | null>(null);

  // ✅ Opisne stavke po projektu (projekat_id -> { enabled, items: string[] })
  const [projectSubItems, setProjectSubItems] = useState<
    Record<number, { enabled: boolean; items: string[] }>
  >({});

  // ✅ Grupisanje projekata u jednu stavku (group_id -> { name: string, projectIds: number[] })
  const [projectGroups, setProjectGroups] = useState<
    Record<string, { name: string; projectIds: number[] }>
  >({});
  const [selectedForGrouping, setSelectedForGrouping] = useState<Set<number>>(new Set());
  const [groupName, setGroupName] = useState<string>("");

  // ✅ Učitaj poziv na broj + detektuj INO klijenta
  useEffect(() => {
    let alive = true;

    async function run() {
      setPnbErr("");
      if (ids.length === 0) {
        setPozivNaBroj("");
        setIsInoDetected(false);
        setPdvOslobodjenDetected(false);
        return;
      }

      setPnbLoading(true);
      try {
        // 1) Poziv na broj
        const qs = new URLSearchParams();
        qs.set("ids", ids.join(","));
        const res = await fetch(`/api/fakture/wizard/seed?${qs.toString()}`, {
          cache: "no-store",
        });
        const text = await res.text();
        let j: Record<string, unknown>;
        try {
          j = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(
            res.ok
              ? "Neispravan odgovor API-ja (očekivan JSON)."
              : `API greška (${res.status}). Provjeri mrežu ili konzolu.`,
          );
        }

        if (!res.ok || j?.ok === false) {
          throw new Error((j?.error as string) ?? "Seed API error");
        }

        const p = String(j?.poziv_na_broj ?? "");
        if (!/^\d{8}$/.test(p)) {
          throw new Error("Poziv na broj nije validan (mora biti 8 cifara).");
        }

        if (alive) setPozivNaBroj(p);

        // 2) Detektuj INO klijenta + učitaj projekte za override nazive
        const previewRes = await fetch(`/api/fakture/wizard/preview-data?${qs.toString()}`, {
          cache: "no-store",
        });
        const previewText = await previewRes.text();
        let previewData: Record<string, unknown>;
        try {
          previewData = previewText ? JSON.parse(previewText) : {};
        } catch {
          throw new Error(
            previewRes.ok
              ? "Neispravan odgovor API-ja (očekivan JSON)."
              : `API greška (${previewRes.status}). Provjeri mrežu ili konzolu.`,
          );
        }

        if (previewData?.ok) {
          // Učitaj projekte
          if (Array.isArray(previewData.projects)) {
            if (alive) {
              setProjectsData(previewData.projects);
            }
          }

          // Detektuj INO ili oslobođen od PDV-a
          if (previewData?.buyer) {
            const buyer = previewData.buyer as { drzava?: string; is_ino?: boolean | number | string; pdv_oslobodjen?: number };
            const drz = String(buyer.drzava ?? "").trim();
            const isIno = drz !== "" && drz.toLowerCase() !== "bih";
            const isInoFlag = buyer.is_ino === 1 || buyer.is_ino === true || buyer.is_ino === "1";
            const pdvOslobodjen = Number(buyer.pdv_oslobodjen ?? 0) === 1;

            if (alive && (isIno || isInoFlag)) {
              setIsInoDetected(true);
              setCurrency("EUR");
              setVatMode("INO_0");
            } else if (alive && pdvOslobodjen) {
              setIsInoDetected(false);
              setPdvOslobodjenDetected(true);
              setVatMode("INO_0"); // 0% PDV — isto kao INO za stopu
            } else if (alive) {
              setPdvOslobodjenDetected(false);
              setIsInoDetected(false);
            }
          }
        }
      } catch (e: any) {
        if (alive) {
          setPozivNaBroj("");
          setPnbErr(e?.message ?? "Greška kod generisanja poziva na broj");
        }
      } finally {
        if (alive) setPnbLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [ids]);

  function goPreview() {
    if (ids.length === 0) return;

    const iso = ddmmyyyyToISO(invoiceDateDD);
    if (!iso) {
      alert(t("fakture.invoiceDateInvalid"));
      return;
    }

    if (!/^\d{8}$/.test(pozivNaBroj)) {
      alert(t("fakture.pozivNaBrojInvalid"));
      return;
    }

    const qs = new URLSearchParams();
    qs.set("ids", ids.join(","));
    qs.set("date", iso);
    qs.set("ccy", currency);
    qs.set("vat", vatMode);

    // ✅ AUTO poziv na broj ide uvijek
    qs.set("pnb", pozivNaBroj);

    // ✅ Override nazivi projekata (ako postoje)
    const overrides = Object.entries(projectNameOverrides)
      .filter(([_, val]) => val && String(val).trim())
      .map(([id, naziv]) => `${id}:${encodeURIComponent(String(naziv).trim())}`)
      .join(",");
    if (overrides) {
      qs.set("project_names", overrides);
    }

    // ✅ Opisne stavke (samo non-empty) — format: id:item1|item2|item3
    const subItemsEntries = Object.entries(projectSubItems)
      .filter(([_, v]) => v?.enabled && Array.isArray(v.items))
      .map(([id, v]) => {
        const nonEmpty = (v.items || []).map((s) => String(s).trim()).filter(Boolean);
        return [id, nonEmpty.join("|")];
      })
      .filter(([_, s]) => (s as string).length > 0);
    if (subItemsEntries.length > 0) {
      qs.set(
        "project_sub_items",
        subItemsEntries.map(([id, s]) => `${id}:${encodeURIComponent(s as string)}`).join(","),
      );
    }

    // ✅ Grupisanje projekata — format: group_id:name:projectId1,projectId2,...
    const groupEntries = Object.entries(projectGroups)
      .filter(([_, g]) => g.name.trim() && g.projectIds.length > 0)
      .map(([groupId, g]) => `${groupId}:${encodeURIComponent(g.name.trim())}:${g.projectIds.join(",")}`);
    if (groupEntries.length > 0) {
      qs.set("project_groups", groupEntries.join(";"));
    }

    // Popust prije PDV-a (KM)
    const popustNum = parseFloat(String(popustKm || "0").trim());
    if (Number.isFinite(popustNum) && popustNum > 0) {
      qs.set("popust", String(popustNum));
    }

    // Ručni PFR i automatska fiskalizacija samo za BiH (sr). Van BiH (en) ne šaljemo.
    if (!isEu) {
      const pfrLastTrim = String(lastPfrNumber || "").trim();
      if (pfrLastTrim) qs.set("pfr_last", pfrLastTrim);
      qs.set("auto_fiscal", useAutoFiscal ? "1" : "0");
    }

    router.push(`/fakture/wizard/preview?${qs.toString()}`);
  }

  return (
    <div className="container">
      <style>{`
        .scrollWrap { flex:1; overflow:auto; padding: 14px 0 18px; }
        .cardLike { border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.05); border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.14); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); padding: 14px; margin-top: 12px; }
        .grid2 { display:grid; grid-template-columns:220px 1fr; gap:10px; align-items:center; }
        @media (max-width: 860px) { .grid2 { grid-template-columns: 1fr; } }
        .hint { margin-top: 10px; opacity: .8; font-size: 12px; }
        .err {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,80,80,.35);
          background: rgba(255,80,80,.10);
          color: rgba(255,220,220,.92);
          font-size: 12px;
          line-height: 1.35;
        }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">{t("wizard.fakturaWizardStep")}</div>
                  <div className="brandSub">
                    {t("wizard.wizardStepSubtitle")}
                  </div>
                </div>
              </div>
              <Link href="/dashboard" className="btn" title={t("wizard.backToDashboard")}>
                🏠 {t("common.dashboard")}
              </Link>
            </div>
            <div className="topRow" style={{ marginTop: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }} />
              <div className="actions">
                <Link
                  href={`/fakture/za-fakturisanje`}
                  className="btn"
                  title={t("wizard.nazadNaListu")}
                >
                  ← {t("wizard.nazad")}
                </Link>
                <button
                  className="btn"
                  type="button"
                  onClick={goPreview}
                  disabled={
                    ids.length === 0 ||
                    pnbLoading ||
                    !/^\d{8}$/.test(pozivNaBroj)
                  }
                  style={{
                    opacity: ids.length === 0 || pnbLoading ? 0.55 : 1,
                    background: ids.length === 0 || pnbLoading || !/^\d{8}$/.test(pozivNaBroj)
                      ? undefined
                      : "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.1))",
                    borderColor: ids.length === 0 || pnbLoading || !/^\d{8}$/.test(pozivNaBroj)
                      ? undefined
                      : "rgba(59, 130, 246, 0.4)",
                    fontWeight: ids.length === 0 || pnbLoading || !/^\d{8}$/.test(pozivNaBroj) ? undefined : 700,
                  }}
                  title={
                    ids.length === 0
                      ? t("wizard.nemaSelekcije")
                      : pnbLoading
                        ? t("wizard.generisemPnb")
                        : t("wizard.previewBtn")
                  }
                >
                  ➜ {t("wizard.preview33")}
                </button>
              </div>
            </div>

            <div className="muted" style={{ marginTop: 10 }}>
              {t("wizard.projektiUFakturi")}: <b>{ids.length}</b> (
              {ids.slice(0, 12).join(", ")}
              {ids.length > 12 ? "…" : ""})
            </div>
            <div className="divider" />
          </div>
        </div>

        <div className="scrollWrap">
          <div className="container">
            <div className="cardLike">
              <div style={{ fontWeight: 850, fontSize: 16 }}>{t("wizard.osnovno")}</div>

              <div className="grid2" style={{ marginTop: 10 }}>
                <div className="label">{t("wizard.datumFakture")}</div>
                <input
                  className="input"
                  value={invoiceDateDD}
                  onChange={(e) => setInvoiceDateDD(e.target.value)}
                  placeholder={t("wizard.placeholderDatum")}
                />

                <div className="label">
                  {t("wizard.valutaPlacanja")}
                  {isInoDetected && !isEu && (
                    <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.8, fontWeight: 600, color: "rgba(59, 130, 246, 0.9)" }}>
                      {t("wizard.autoInoKlijent")}
                    </span>
                  )}
                </div>
                {isEu ? (
                  <input
                    className="input"
                    value={t("wizard.valutaEurOnly")}
                    readOnly
                    disabled
                    style={{ opacity: 0.9 }}
                  />
                ) : (
                  <select
                    className="input"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="KM">KM (BAM)</option>
                    <option value="EUR">EUR</option>
                  </select>
                )}

                <div className="label">
                  {t("wizard.pdvRezim")}
                  {isInoDetected && (
                    <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.8, fontWeight: 600, color: "rgba(59, 130, 246, 0.9)" }}>
                      {t("wizard.autoInoKlijent")}
                    </span>
                  )}
                  {pdvOslobodjenDetected && !isInoDetected && (
                    <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.8, fontWeight: 600, color: "rgba(59, 130, 246, 0.9)" }}>
                      {t("wizard.autoOslobodjen")}
                    </span>
                  )}
                </div>
                <select
                  className="input"
                  value={vatMode}
                  onChange={(e) => setVatMode(e.target.value as any)}
                >
                  <option value="BH_17">
                    {isEu
                      ? `${t("wizard.pdvDomesticEu")}${firmaVatRate != null ? ` (${firmaVatRate}%)` : ""}`
                      : t("wizard.pdvBiH17")}
                  </option>
                  <option value="INO_0">
                    {isEu ? t("wizard.pdvReverseChargeEu") : t("wizard.pdvIno0")}
                  </option>
                </select>

                <div className="label">{t("wizard.pozivNaBroj")}</div>
                <input
                  className="input"
                  value={pnbLoading ? t("wizard.generisem") : pozivNaBroj}
                  readOnly
                  disabled
                  style={{ opacity: 0.9 }}
                />

                <div className="label">{isEu ? t("wizard.popustPrijePdvEur") : t("wizard.popustPrijePdv")}</div>
                <input
                  type="number"
                  className="input"
                  value={popustKm}
                  onChange={(e) => setPopustKm(e.target.value)}
                  placeholder={t("wizard.popustPlaceholder")}
                  min="0"
                  step="0.01"
                  title={t("wizard.popustTitle")}
                />

                {!isEu && (
                  <>
                    <div className="label">{t("wizard.lastPfrBroj")}</div>
                    <input
                      type="number"
                      className="input"
                      value={lastPfrNumber}
                      onChange={(e) => setLastPfrNumber(e.target.value)}
                      placeholder={t("wizard.lastPfrPlaceholder")}
                      min="0"
                      step="1"
                      title={t("wizard.lastPfrTitle")}
                    />
                    <div className="label">{t("wizard.fiskalizacijaDropbox")}</div>
                    <select
                      className="input"
                      value={useAutoFiscal ? "1" : "0"}
                      onChange={(e) => setUseAutoFiscal(e.target.value === "1")}
                      title={t("wizard.fiskalizacijaDropboxTitle")}
                    >
                      <option value="0">{t("wizard.ne")}</option>
                      <option value="1">{t("wizard.da")}</option>
                    </select>
                  </>
                )}
              </div>

              {!isEu && (
                <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>
                  {t("wizard.lastPfrHint")}
                </div>
              )}

              {pnbErr ? <div className="err">{pnbErr}</div> : null}

              <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>
                {t("wizard.hintPnb")}
              </div>
            </div>

            {/* ✅ Grupisanje projekata u jednu stavku */}
            {projectsData.length > 1 && (
              <div className="cardLike" style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 10 }}>
                  {t("wizard.kombinujProjekte")}
                </div>
                <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 12 }}>
                  {t("wizard.kombinujHint")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                  {projectsData.map((proj) => (
                    <label
                      key={proj.projekat_id}
                      style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedForGrouping.has(proj.projekat_id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedForGrouping);
                          if (e.target.checked) {
                            newSelected.add(proj.projekat_id);
                          } else {
                            newSelected.delete(proj.projekat_id);
                          }
                          setSelectedForGrouping(newSelected);
                        }}
                      />
                      <span style={{ opacity: 0.9 }}>
                        #{proj.projekat_id}: {proj.radni_naziv || "—"}
                      </span>
                    </label>
                  ))}
                </div>
                {selectedForGrouping.size > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="label" style={{ marginBottom: 6 }}>
                      {t("wizard.zajednickiNaziv")}
                    </div>
                    <input
                      className="input"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder={t("wizard.placeholderGrupa")}
                      style={{ width: "100%" }}
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        if (groupName.trim() && selectedForGrouping.size > 0) {
                          const groupId = `group_${Date.now()}`;
                          setProjectGroups((prev) => ({
                            ...prev,
                            [groupId]: {
                              name: groupName.trim(),
                              projectIds: Array.from(selectedForGrouping),
                            },
                          }));
                          // Takođe postavi override nazive za sve projekte u grupi
                          const overrides = { ...projectNameOverrides };
                          selectedForGrouping.forEach((pid) => {
                            overrides[pid] = groupName.trim();
                          });
                          setProjectNameOverrides(overrides);
                          // Resetuj selektovane i naziv
                          setSelectedForGrouping(new Set());
                          setGroupName("");
                        }
                      }}
                      disabled={!groupName.trim() || selectedForGrouping.size === 0}
                      style={{
                        marginTop: 8,
                        opacity: !groupName.trim() || selectedForGrouping.size === 0 ? 0.5 : 1,
                      }}
                    >
                      {t("wizard.kreirajGrupu")}
                    </button>
                  </div>
                )}
                {Object.keys(projectGroups).length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.1)" }}>
                    <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>{t("wizard.kreiraneGrupe")}</div>
                    {Object.entries(projectGroups).map(([groupId, group]) => (
                      <div
                        key={groupId}
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
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{group.name}</div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>
                            {t("wizard.projekti")}: {group.projectIds.map((id) => `#${id}`).join(", ")}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newGroups = { ...projectGroups };
                            delete newGroups[groupId];
                            setProjectGroups(newGroups);
                            // Ukloni override nazive za projekte iz ove grupe
                            const newOverrides = { ...projectNameOverrides };
                            group.projectIds.forEach((pid) => {
                              delete newOverrides[pid];
                            });
                            setProjectNameOverrides(newOverrides);
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
                          {t("wizard.ukloni")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ✅ Override nazivi projekata */}
            {projectsData.length > 0 && (
              <div className="cardLike" style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 10 }}>
                  {t("wizard.naziviProjekata")}
                </div>
                <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 12 }}>
                  {t("wizard.naziviHint")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {projectsData.map((proj) => {
                    const pid = proj.projekat_id;
                    const subState = projectSubItems[pid] ?? { enabled: false, items: ["", "", "", "", ""] };
                    const items = subState.items ?? ["", "", "", "", ""];
                    return (
                      <div key={pid} style={{ border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: 12, background: "rgba(0,0,0,.08)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, alignItems: "center" }}>
                          <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 600 }}>
                            #{pid}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
                              {t("wizard.original")}: {proj.radni_naziv || "—"}
                            </div>
                            <input
                              className="input"
                              value={projectNameOverrides[pid] ?? ""}
                              onChange={(e) => {
                                setProjectNameOverrides((prev) => ({
                                  ...prev,
                                  [pid]: e.target.value,
                                }));
                              }}
                              placeholder={t("wizard.nazivZaFakturuPlaceholder")}
                              style={{ width: "100%" }}
                            />
                          </div>
                        </div>
                        {!isEu && (
                        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <label className="label" style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={subState.enabled}
                              onChange={(e) => {
                                setProjectSubItems((prev) => ({
                                  ...prev,
                                  [pid]: {
                                    enabled: e.target.checked,
                                    items: prev[pid]?.items ?? ["", "", "", "", ""],
                                  },
                                }));
                              }}
                            />
                            {t("wizard.dodajOpisneStavke")}
                          </label>
                        </div>
                        )}
                        {!isEu && subState.enabled && (
                          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ fontSize: 11, opacity: 0.75 }}>{t("wizard.stavkeNaFakturi")}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {items.map((val, i) => (
                                <input
                                  key={i}
                                  className="input"
                                  value={val}
                                  onChange={(e) => {
                                    const next = [...items];
                                    next[i] = e.target.value;
                                    setProjectSubItems((prev) => ({
                                      ...prev,
                                      [pid]: { enabled: true, items: next },
                                    }));
                                  }}
                                  placeholder={`${t("wizard.stavka")} ${i + 1}`}
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
    </div>
  );
}
