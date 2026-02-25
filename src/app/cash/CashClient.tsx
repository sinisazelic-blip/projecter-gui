"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function fmtMoney(amount: number, currency: string) {
  return `${Number(amount).toFixed(2)} ${currency}`;
}

export default function CashClient() {
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
  const [currency, setCurrency] = useState<string>("KM");
  const [note, setNote] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");

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
      setErr(e?.message || "Greška pri učitavanju.");
    } finally {
      setLoading(false);
    }
  }

  async function createDraft() {
    console.log("createDraft called", { amount, note, entityType, selectedEntityId, projectId });
    
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      console.log("Validation failed: amount");
      setErr("Iznos mora biti broj > 0.");
      return;
    }
    if (!note.trim()) {
      console.log("Validation failed: note");
      setErr("Bilješka je obavezna.");
      return;
    }

    if (entityType === "talent" && !selectedEntityId) {
      console.log("Validation failed: talent not selected");
      setErr("Izaberite talenta.");
      return;
    }

    if (entityType === "dobavljac" && !selectedEntityId) {
      console.log("Validation failed: dobavljac not selected");
      setErr("Izaberite dobavljača.");
      return;
    }

    console.log("Validation passed, setting loading...");
    setLoading(true);
    setErr(null);

    try {
      const payload: any = {
        amount: n,
        direction,
        currency: currency.trim() || "KM",
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
        throw new Error("Neispravan odgovor od servera");
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
        throw new Error(json?.error || "Nepoznata greška");
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
      setErr(e?.message || "Greška pri upisu.");
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
        const msg = json?.error || json?.message || (res.ok ? "Neočekivan odgovor API-ja." : `Greška ${res.status}`);
        console.error("API error:", json && Object.keys(json).length ? json : { status: res.status, statusText: res.statusText });
        setErr(msg);
      }
    } catch (e) {
      console.error("Greška pri učitavanju projekata:", e);
      setErr("Greška pri učitavanju projekata");
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
      setErr("Greška pri učitavanju: " + (e as Error).message);
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
                <img
                  src="/fluxa/logo-light.png"
                  alt="FLUXA"
                  className="brandLogo"
                />
                <span className="brandSlogan">Project & Finance Engine</span>
              </div>
              <div>
                <div className="brandTitle">Cash (Blagajna)</div>
                <div className="brandSub">
                  Signalni sloj (append-only, DRAFT). Ne utiče na banku/ledger.
                </div>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="btn"
              style={{ minWidth: 130 }}
              title="Povratak na Dashboard"
            >
              🏠 Dashboard
            </Link>
          </div>
          <div className="divider" />
        </div>
      </div>

      <div className="bodyWrap">
      {err ? <div className={styles.error}>{err}</div> : null}

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.label}>Saldo (DRAFT)</div>
          <div className={styles.big}>
            {data ? fmtMoney(data.balance ?? 0, "KM") : "—"}
          </div>
          <div className={styles.muted}>
            Unosa: <b>{data?.items?.length ?? 0}</b>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>Quick add (DRAFT)</div>

          <div className={styles.formGrid}>
            <div>
              <div className={styles.label}>Tip</div>
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
                <option value="project">Projekat</option>
                <option value="talent">Talent</option>
                <option value="dobavljac">Dobavljač</option>
              </select>
            </div>

            <div>
              <div className={styles.label}>Iznos</div>
              <input
                className={styles.input}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="npr. 50"
              />
            </div>

            <div>
              <div className={styles.label}>Smjer</div>
              <select
                className={styles.input}
                value={direction}
                onChange={(e) => setDirection(e.target.value as CashDirection)}
              >
                <option value="OUT">OUT (trošak)</option>
                <option value="IN">IN (priliv)</option>
              </select>
            </div>

            <div>
              <div className={styles.label}>Valuta</div>
              <input
                className={styles.input}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="KM"
                style={{ maxWidth: 80 }}
              />
            </div>

            <div>
              <div className={styles.label}>Bilješka (obavezno)</div>
              <input
                className={styles.input}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="npr. gorivo"
              />
            </div>
          </div>

          {entityType === "project" && (
            <div style={{ marginTop: 20 }}>
              <div className={styles.label} style={{ marginBottom: 10 }}>Project ID</div>
              {projectsLoading ? (
                <div className={styles.muted}>Učitavanje projekata...</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: "40px" }}></th>
                        <th>#</th>
                        <th>Naziv projekta</th>
                        <th style={{ textAlign: "right" }}>Budžet projekta</th>
                        <th style={{ textAlign: "right" }}>Troškovi</th>
                        <th style={{ textAlign: "right" }}>Zarada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: 20, opacity: 0.7 }}>
                            Učitavanje projekata...
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
                            <td style={{ textAlign: "right" }}>{fmtMoney(p.budzet_planirani || 0, "KM")}</td>
                            <td style={{ textAlign: "right" }}>{fmtMoney(p.troskovi_ukupno || 0, "KM")}</td>
                            <td style={{ textAlign: "right" }}>{fmtMoney(p.planirana_zarada || 0, "KM")}</td>
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
              <div className={styles.label} style={{ marginBottom: 10 }}>Talent</div>
              {entitiesLoading ? (
                <div className={styles.muted}>Učitavanje talenata...</div>
              ) : talents.length === 0 ? (
                <div className={styles.muted} style={{ color: "rgba(239, 68, 68, 0.8)" }}>
                  Nema dostupnih talenata. Provjerite da li su talenti aktivni u sistemu.
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
                  <option value="">— Izaberi talenta —</option>
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
              <div className={styles.label} style={{ marginBottom: 10 }}>Dobavljač</div>
              {entitiesLoading ? (
                <div className={styles.muted}>Učitavanje dobavljača...</div>
              ) : suppliers.length === 0 ? (
                <div className={styles.muted} style={{ color: "rgba(239, 68, 68, 0.8)" }}>
                  Nema dostupnih dobavljača. Provjerite da li su dobavljači aktivni u sistemu.
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
                  <option value="">— Izaberi dobavljača —</option>
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
              {loading ? "..." : "Dodaj DRAFT"}
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>Pretraga istorije</div>
          <div className={styles.formGrid} style={{ marginBottom: 16 }}>
            <div>
              <div className={styles.label}>Datum od</div>
              <input
                type="date"
                className={styles.input}
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>
            <div>
              <div className={styles.label}>Datum do</div>
              <input
                type="date"
                className={styles.input}
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
            <div>
              <div className={styles.label}>Entitet</div>
              <select
                className={styles.input}
                value={filterEntityType}
                onChange={(e) => {
                  setFilterEntityType(e.target.value);
                  setFilterEntityId("");
                }}
              >
                <option value="">— Svi —</option>
                <option value="talent">Talent</option>
                <option value="vendor">Dobavljač</option>
                <option value="klijent">Klijent</option>
              </select>
            </div>
            {filterEntityType === "talent" && (
              <div>
                <div className={styles.label}>Talent</div>
                <select
                  className={styles.input}
                  value={filterEntityId}
                  onChange={(e) => setFilterEntityId(e.target.value)}
                >
                  <option value="">— Svi talenti —</option>
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
                <div className={styles.label}>Dobavljač</div>
                <select
                  className={styles.input}
                  value={filterEntityId}
                  onChange={(e) => setFilterEntityId(e.target.value)}
                >
                  <option value="">— Svi dobavljači —</option>
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
                <div className={styles.label}>Klijent</div>
                <select
                  className={styles.input}
                  value={filterEntityId}
                  onChange={(e) => setFilterEntityId(e.target.value)}
                >
                  <option value="">— Svi klijenti —</option>
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
                Uključi stornirane
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => fetchCash()}
              >
                Osvježi
              </button>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>Unosi</div>

          {!data?.items?.length ? (
            <div className={styles.muted}>Nema unosa.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Smjer</th>
                    <th>Iznos</th>
                    <th>Bilješka</th>
                    <th>Projekat / Entitet</th>
                    <th>Akcija</th>
                    <th>Status</th>
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
                        {it.projectId ? `Projekat #${it.projectId}` : null}
                        {it.entityType && it.entityId
                          ? `${it.projectId ? " · " : ""}${
                              it.entityType === "talent" ? "Talent" : it.entityType === "vendor" ? "Dobavljač" : it.entityType === "klijent" ? "Klijent" : it.entityType
                            } #${it.entityId}`
                          : null}
                        {!it.projectId && !(it.entityType && it.entityId) ? "—" : null}
                      </td>
                      <td style={{ fontSize: 12, opacity: 0.85 }}>
                        {it.transactionDetails || "—"}
                      </td>
                      <td>{it.status}</td>
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
