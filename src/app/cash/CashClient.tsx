"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";
import { getCurrencyForLocale, getLocaleFromDocument } from "@/lib/i18n";
import styles from "./CashClient.module.css";

type CashDirection = "IN" | "OUT";

type CashEntry = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  direction: CashDirection;
  note: string;
  projectId: string | null;
  entityType: string | null;
  entityId: number | null;
  status: "AKTIVAN" | "STORNIRAN";
  createdAt: string;
  transactionDetails?: string | null;
};

type CashResponse = {
  ok: boolean;
  balance: number;
  items: CashEntry[];
  error?: string;
};

type Project = {
  projekat_id: number;
  id_po: string | null;
  radni_naziv: string | null;
  budzet_planirani: number;
  troskovi_ukupno: number;
  planirana_zarada: number;
};

type Talent = {
  talent_id: number;
  ime_prezime: string;
  vrsta: string;
};

type Dobavljac = {
  dobavljac_id: number;
  naziv: string;
  vrsta: string;
};

type Klijent = {
  klijent_id: number;
  naziv_klijenta: string;
};

function fmtDate(iso: string) {
  let d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const ymd = iso.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) d = new Date(Number(ymd[1]), Number(ymd[2]!) - 1, Number(ymd[3]!));
    if (Number.isNaN(d.getTime())) return iso;
  }
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year}. ${hours}:${minutes}`;
}

function fmtMoney(amount: number, currency: string) {
  return `${Number(amount).toFixed(2)} ${currency}`;
}

export default function CashClient() {
  const { t, locale } = useTranslation();
  const [data, setData] = useState<CashResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Filteri pretrage istorije
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [filterEntityType, setFilterEntityType] = useState<string>(""); // "" | "talent" | "vendor"
  const [filterEntityId, setFilterEntityId] = useState<string>("");
  const [includeStorno, setIncludeStorno] = useState(false);

  // projects (status 8 - Zatvoren)
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // talents, suppliers, klijenti
  const [talents, setTalents] = useState<Talent[]>([]);
  const [suppliers, setSuppliers] = useState<Dobavljac[]>([]);
  const [clients, setClients] = useState<Klijent[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [entityType, setEntityType] = useState<"talent" | "dobavljac" | "project" | "">("project");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");

  // form
  const [amount, setAmount] = useState<string>("");
  const [direction, setDirection] = useState<CashDirection>("OUT");
  const [currency, setCurrency] = useState<string>(() =>
    typeof window !== "undefined" ? getCurrencyForLocale(getLocaleFromDocument()) : "KM"
  );
  const [note, setNote] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");

  const localeCurrency = getCurrencyForLocale(locale);

  useEffect(() => {
    setCurrency(localeCurrency);
  }, [localeCurrency]);

  async function fetchCash() {
    setLoading(true);
    setErr(null);

    try {
      const params = new URLSearchParams();
      if (filterDateFrom) params.set("date_from", filterDateFrom);
      if (filterDateTo) params.set("date_to", filterDateTo);
      if (filterEntityType) params.set("entity_type", filterEntityType);
      if (filterEntityId) params.set("entity_id", filterEntityId);
      if (includeStorno) params.set("include_storno", "1");
      const qs = params.toString();

      const res = await fetch(`/api/cash${qs ? `?${qs}` : ""}`, {
        method: "GET",
        cache: "no-store",
      });

      const text = await res.text();
      const json = text ? (JSON.parse(text) as CashResponse) : null;

      if (!res.ok) {
        const msg =
          (json && typeof json === "object" && (json as any).error) ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }

      setData(json);
    } catch (e: any) {
      setData(null);
      setErr(e?.message || t("cash.loadError"));
    } finally {
      setLoading(false);
    }
  }

  async function createDraft() {
    console.log("createDraft called", { amount, note, entityType, selectedEntityId, projectId });
    
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      console.log("Validation failed: amount");
      setErr(t("cash.errAmountPositive"));
      return;
    }
    if (!note.trim()) {
      console.log("Validation failed: note");
      setErr(t("cash.errNoteRequired"));
      return;
    }

    if (entityType === "talent" && !selectedEntityId) {
      console.log("Validation failed: talent not selected");
      setErr(t("cash.errSelectTalent"));
      return;
    }

    if (entityType === "dobavljac" && !selectedEntityId) {
      console.log("Validation failed: dobavljac not selected");
      setErr(t("cash.errSelectSupplier"));
      return;
    }

    console.log("Validation passed, setting loading...");
    setLoading(true);
    setErr(null);

    try {
      const payload: any = {
        amount: n,
        direction,
        currency: currency.trim() || localeCurrency,
        note: note.trim(),
        projectId: entityType === "project" ? (projectId.trim() ? projectId.trim() : null) : null,
        entityType: entityType === "talent" ? "talent" : entityType === "dobavljac" ? "vendor" : null,
        entityId: entityType === "talent" || entityType === "dobavljac" ? Number(selectedEntityId) : null,
      };

      console.log("Sending payload:", payload);

      const res = await fetch("/api/cash", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("Response status:", res.status, res.statusText);

      const text = await res.text();
      console.log("Response text:", text);
      
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
        console.log("Response json:", json);
      } catch (parseError) {
        console.error("Failed to parse JSON:", parseError);
        throw new Error(t("cash.errInvalidResponse"));
      }

      if (!res.ok) {
        const msg =
          (json && typeof json === "object" && json.error) ||
          `HTTP ${res.status}`;
        console.error("API error:", msg);
        throw new Error(msg);
      }

      if (!json || !json.ok) {
        console.error("Response not ok:", json);
        throw new Error(json?.error || t("cash.errUnknown"));
      }

      console.log("Success! Resetting form...");
      setAmount("");
      setNote("");
      setProjectId("");
      setSelectedProjectId(null);
      setSelectedEntityId("");
      setEntityType("project");
      await fetchCash();
      // Ažuriraj listu projekata ako je projekat arhiviran
      if (json.projectArchived) {
        await fetchProjects();
      }
      console.log("Done!");
    } catch (e: any) {
      console.error("Error in createDraft:", e);
      setErr(e?.message || t("cash.errSave"));
    } finally {
      console.log("Finally: setting loading to false");
      setLoading(false);
    }
  }

  async function fetchProjects() {
    setProjectsLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/projects?status_id=8&limit=200", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (json && json.ok) {
        setProjects(json.rows || []);
      } else {
        const msg = json?.error || json?.message || (res.ok ? t("cash.errUnexpectedResponse") : `HTTP ${res.status}`);
        console.error("API error:", json && Object.keys(json).length ? json : { status: res.status, statusText: res.statusText });
        setErr(msg);
      }
    } catch (e) {
      console.error("Greška pri učitavanju projekata:", e);
      setErr(t("cash.errLoadProjects"));
    } finally {
      setProjectsLoading(false);
    }
  }

  function handleProjectSelect(project: Project) {
    if (selectedProjectId === project.projekat_id) {
      // Deselect
      setSelectedProjectId(null);
      setAmount("");
      setProjectId("");
    } else {
      // Select
      setSelectedProjectId(project.projekat_id);
      setAmount(String(project.budzet_planirani || ""));
      setProjectId(String(project.projekat_id));
    }
  }

  async function fetchTalentsAndSuppliers() {
    setEntitiesLoading(true);
    try {
      const [talentsRes, suppliersRes, klijentiRes] = await Promise.all([
        fetch("/api/izvjestaji/talenti?limit=1000", { cache: "no-store" }),
        fetch("/api/izvjestaji/dobavljaci?limit=1000", { cache: "no-store" }),
        fetch("/api/klijenti", { cache: "no-store" }),
      ]);

      const talentsJson = await talentsRes.json();
      const suppliersJson = await suppliersRes.json();
      const klijentiJson = await klijentiRes.json();

      if (talentsJson.ok && talentsJson.items) {
        const filteredTalents = talentsJson.items.filter((t: any) => t.talent_id != null).map((t: any) => ({
          talent_id: t.talent_id,
          ime_prezime: t.talent_naziv || "",
          vrsta: t.talent_vrsta || "",
        }));
        setTalents(filteredTalents);
      }

      if (suppliersJson.ok && suppliersJson.items) {
        const filteredSuppliers = suppliersJson.items.filter((d: any) => d.dobavljac_id != null).map((d: any) => ({
          dobavljac_id: d.dobavljac_id,
          naziv: d.dobavljac_naziv || "",
          vrsta: d.dobavljac_vrsta || "",
        }));
        setSuppliers(filteredSuppliers);
      }

      if (klijentiJson.ok && Array.isArray(klijentiJson.rows)) {
        const list = (klijentiJson.rows as any[])
          .filter((k: any) => k.klijent_id != null)
          .map((k: any) => ({
            klijent_id: Number(k.klijent_id),
            naziv_klijenta: String(k.naziv_klijenta ?? "").trim(),
          }));
        setClients(list);
      }
    } catch (e) {
      console.error("Greška pri učitavanju talenata/dobavljača/klijenata:", e);
      setErr(t("cash.errLoadEntities") + ": " + (e as Error).message);
    } finally {
      setEntitiesLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
    fetchTalentsAndSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDateFrom, filterDateTo, filterEntityType, filterEntityId, includeStorno]);

  return (
    <div className="pageWrap">
      <div className="topBlock">
        <div className="topInner">
          <div className="topRow">
            <div className="brandWrap">
              <div className="brandLogoBlock">
                <FluxaLogo style={{}} /><span className="brandSlogan">Project & Finance Engine</span>
              </div>
              <div>
                <div className="brandTitle">{t("cash.title")}</div>
                <div className="brandSub">
                  {t("cash.subtitle")}
                </div>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="btn"
              style={{ minWidth: 130 }}
              title={t("cash.backToDashboard")}
            >
              🏠 {t("common.dashboard")}
            </Link>
          </div>
          <div className="divider" />
        </div>
      </div>

      <div className="bodyWrap">
      {err ? <div className={styles.error}>{err}</div> : null}

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.label}>{t("cash.balanceDraft")}</div>
          <div className={styles.big}>
            {data ? fmtMoney(data.balance ?? 0, localeCurrency) : "—"}
          </div>
          <div className={styles.muted}>
            {t("cash.entriesCount")} <b>{data?.items?.length ?? 0}</b>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>{t("cash.quickAddTitle")}</div>

          <div className={styles.formGrid}>
            <div>
              <div className={styles.label}>{t("cash.type")}</div>
              <select
                className={styles.input}
                value={entityType}
                onChange={(e) => {
                  const newType = e.target.value as "talent" | "dobavljac" | "project" | "";
                  setEntityType(newType);
                  setSelectedEntityId("");
                  setSelectedProjectId(null);
                  setProjectId("");
                  setAmount("");
                }}
              >
                <option value="project">{t("cash.typeProject")}</option>
                <option value="talent">{t("cash.typeTalent")}</option>
                <option value="dobavljac">{t("cash.typeSupplier")}</option>
              </select>
            </div>

            <div>
              <div className={styles.label}>{t("cash.amount")}</div>
              <input
                className={styles.input}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t("cash.amountPlaceholder")}
              />
            </div>

            <div>
              <div className={styles.label}>{t("cash.direction")}</div>
              <select
                className={styles.input}
                value={direction}
                onChange={(e) => setDirection(e.target.value as CashDirection)}
              >
                <option value="OUT">{t("cash.directionOut")}</option>
                <option value="IN">{t("cash.directionIn")}</option>
              </select>
            </div>

            <div>
              <div className={styles.label}>{t("cash.currency")}</div>
              <input
                className={styles.input}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder={localeCurrency}
                style={{ maxWidth: 80 }}
              />
            </div>

            <div>
              <div className={styles.label}>{t("cash.noteRequired")}</div>
              <input
                className={styles.input}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("cash.notePlaceholder")}
              />
            </div>
          </div>

          {entityType === "project" && (
            <div style={{ marginTop: 20 }}>
              <div className={styles.label} style={{ marginBottom: 10 }}>{t("cash.projectId")}</div>
              {projectsLoading ? (
                <div className={styles.muted}>{t("cash.loadingProjects")}</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: "40px" }}></th>
                        <th>{t("cash.colId")}</th>
                        <th>{t("cash.colProjectName")}</th>
                        <th style={{ textAlign: "right" }}>{t("cash.colBudget")}</th>
                        <th style={{ textAlign: "right" }}>{t("cash.colCosts")}</th>
                        <th style={{ textAlign: "right" }}>{t("cash.colRevenue")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: 20, opacity: 0.7 }}>
                            {t("cash.loadingProjects")}
                          </td>
                        </tr>
                      ) : (
                        projects.map((p) => (
                          <tr
                            key={p.projekat_id}
                            style={{
                              cursor: "pointer",
                              backgroundColor: selectedProjectId === p.projekat_id ? "rgba(125, 211, 252, 0.1)" : undefined,
                            }}
                            onClick={() => handleProjectSelect(p)}
                          >
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedProjectId === p.projekat_id}
                                onChange={() => handleProjectSelect(p)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td>#{p.id_po || p.projekat_id}</td>
                            <td>{p.radni_naziv || "—"}</td>
                            <td style={{ textAlign: "right" }}>{fmtMoney(p.budzet_planirani || 0, localeCurrency)}</td>
                            <td style={{ textAlign: "right" }}>{fmtMoney(p.troskovi_ukupno || 0, localeCurrency)}</td>
                            <td style={{ textAlign: "right" }}>{fmtMoney(p.planirana_zarada || 0, localeCurrency)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {entityType === "talent" && (
            <div style={{ marginTop: 20 }}>
              <div className={styles.label} style={{ marginBottom: 10 }}>{t("cash.talent")}</div>
              {entitiesLoading ? (
                <div className={styles.muted}>{t("cash.loadingTalents")}</div>
              ) : talents.length === 0 ? (
                <div className={styles.muted} style={{ color: "rgba(239, 68, 68, 0.8)" }}>
                  {t("cash.noTalents")}
                </div>
              ) : (
                <select
                  className={styles.input}
                  value={selectedEntityId}
                  onChange={(e) => {
                    setSelectedEntityId(e.target.value);
                    const talentId = e.target.value;
                    if (talentId) {
                      setProjectId("");
                      setSelectedProjectId(null);
                    }
                  }}
                >
                  <option value="">{t("cash.selectTalent")}</option>
                  {talents.map((t) => (
                    <option key={t.talent_id} value={String(t.talent_id)}>
                      {t.ime_prezime} {t.vrsta ? `(${t.vrsta})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {entityType === "dobavljac" && (
            <div style={{ marginTop: 20 }}>
              <div className={styles.label} style={{ marginBottom: 10 }}>{t("cash.supplier")}</div>
              {entitiesLoading ? (
                <div className={styles.muted}>{t("cash.loadingSuppliers")}</div>
              ) : suppliers.length === 0 ? (
                <div className={styles.muted} style={{ color: "rgba(239, 68, 68, 0.8)" }}>
                  {t("cash.noSuppliers")}
                </div>
              ) : (
                <select
                  className={styles.input}
                  value={selectedEntityId}
                  onChange={(e) => {
                    setSelectedEntityId(e.target.value);
                    const dobavljacId = e.target.value;
                    if (dobavljacId) {
                      setProjectId("");
                      setSelectedProjectId(null);
                    }
                  }}
                >
                  <option value="">{t("cash.selectSupplier")}</option>
                  {suppliers.map((d) => (
                    <option key={d.dobavljac_id} value={String(d.dobavljac_id)}>
                      {d.naziv} {d.vrsta ? `(${d.vrsta})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className={styles.actions} style={{ marginTop: 20 }}>
            <button
              className={styles.btnPrimary}
              onClick={createDraft}
              disabled={loading}
            >
              {loading ? "..." : t("cash.addDraft")}
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>{t("cash.searchHistory")}</div>
          <div className={styles.formGrid} style={{ marginBottom: 16 }}>
            <div>
              <div className={styles.label}>{t("cash.dateFrom")}</div>
              <input
                type="date"
                className={styles.input}
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>
            <div>
              <div className={styles.label}>{t("cash.dateTo")}</div>
              <input
                type="date"
                className={styles.input}
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
            <div>
              <div className={styles.label}>{t("cash.entity")}</div>
              <select
                className={styles.input}
                value={filterEntityType}
                onChange={(e) => {
                  setFilterEntityType(e.target.value);
                  setFilterEntityId("");
                }}
              >
                <option value="">{t("cash.all")}</option>
                <option value="talent">{t("cash.typeTalent")}</option>
                <option value="vendor">{t("cash.typeSupplier")}</option>
                <option value="klijent">{t("cash.client")}</option>
              </select>
            </div>
            {filterEntityType === "talent" && (
              <div>
                <div className={styles.label}>{t("cash.talent")}</div>
                <select
                  className={styles.input}
                  value={filterEntityId}
                  onChange={(e) => setFilterEntityId(e.target.value)}
                >
                  <option value="">{t("cash.allTalents")}</option>
                  {talents.map((t) => (
                    <option key={t.talent_id} value={String(t.talent_id)}>
                      {t.ime_prezime}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {filterEntityType === "vendor" && (
              <div>
                <div className={styles.label}>{t("cash.supplier")}</div>
                <select
                  className={styles.input}
                  value={filterEntityId}
                  onChange={(e) => setFilterEntityId(e.target.value)}
                >
                  <option value="">{t("cash.allSuppliers")}</option>
                  {suppliers.map((d) => (
                    <option key={d.dobavljac_id} value={String(d.dobavljac_id)}>
                      {d.naziv}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {filterEntityType === "klijent" && (
              <div>
                <div className={styles.label}>{t("cash.client")}</div>
                <select
                  className={styles.input}
                  value={filterEntityId}
                  onChange={(e) => setFilterEntityId(e.target.value)}
                >
                  <option value="">{t("cash.allClients")}</option>
                  {clients.map((k) => (
                    <option key={k.klijent_id} value={String(k.klijent_id)}>
                      {k.naziv_klijenta || `#${k.klijent_id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <label className={styles.label} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={includeStorno}
                  onChange={(e) => setIncludeStorno(e.target.checked)}
                />
                {t("cash.includeStorno")}
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => fetchCash()}
              >
                {t("cash.refresh")}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>{t("cash.entries")}</div>

          {!data?.items?.length ? (
            <div className={styles.muted}>{t("cash.noEntries")}</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("cash.colDate")}</th>
                    <th>{t("cash.colDirection")}</th>
                    <th>{t("cash.colAmount")}</th>
                    <th>{t("cash.colNote")}</th>
                    <th>{t("cash.colProjectEntity")}</th>
                    <th>{t("cash.colAction")}</th>
                    <th>{t("cash.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id}>
                      <td>{fmtDate(it.date)}</td>
                      <td className={styles.bold}>{it.direction}</td>
                      <td>{fmtMoney(it.amount, it.currency)}</td>
                      <td>{it.note}</td>
                      <td>
                        {it.projectId ? `${t("cash.projectLabel")} #${it.projectId}` : null}
                        {it.entityType && it.entityId
                          ? `${it.projectId ? " · " : ""}${
                              it.entityType === "talent" ? t("cash.talent") : it.entityType === "vendor" ? t("cash.supplier") : it.entityType === "klijent" ? t("cash.client") : it.entityType
                            } #${it.entityId}`
                          : null}
                        {!it.projectId && !(it.entityType && it.entityId) ? "—" : null}
                      </td>
                      <td style={{ fontSize: 12, opacity: 0.85 }}>
                        {it.transactionDetails || "—"}
                      </td>
                      <td>
                        {it.transactionDetails?.toLowerCase().includes("arhiviran")
                          ? t("cash.statusArchived")
                          : it.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
