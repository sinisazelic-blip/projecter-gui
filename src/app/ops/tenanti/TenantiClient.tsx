"use client";

import { useMemo, useState } from "react";
import {
  ENTERSYS_BASE_PACKAGES,
  ENTERSYS_MODULE_KEYS,
} from "@/lib/entersys-activation";
import type { EnterTenantAuditRow, EnterTenantRow } from "@/lib/ops/tenanti";

type EnterPackageId = (typeof ENTERSYS_BASE_PACKAGES)[number]["id"];

const ERR: Record<string, string> = {
  TENANT_NOT_FOUND: "Objekat nije pronađen ili nije Enter licence.",
  INVALID_DATE: "Datum produženja nije ispravan.",
  INVALID_PACKAGE: "Paket nije ispravan.",
  INVALID_USERNAME: "Korisničko ime je obavezno.",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return String(iso);
  return `${d}.${m}.${y}`;
}

function statusTone(status: string, days: number) {
  const s = status.toUpperCase();
  if (s === "SUSPENDOVAN" || s === "ISTEKLO" || days < 0) return "#ef4444";
  if (s === "PILOT" || days <= 14) return "#f59e0b";
  return "#22c55e";
}

function actionLabel(action: string) {
  if (action === "EXTEND") return "Produženje";
  if (action === "MODULES") return "Moduli";
  if (action === "PORTAL_CREDENTIALS") return "Pristup Portalu";
  return action;
}

function auditDetail(raw: string | null) {
  if (!raw) return "—";
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (d.to && d.from) return `${String(d.from)} → ${String(d.to)}`;
    if (d.package_to) {
      return `${String(d.package_from || "—")} → ${String(d.package_to)}`;
    }
    return raw;
  } catch {
    return raw;
  }
}

export default function TenantiClient({
  initialTenants,
  initialAudit,
}: {
  initialTenants: EnterTenantRow[];
  initialAudit: EnterTenantAuditRow[];
}) {
  const [tenants, setTenants] = useState(initialTenants);
  const [audit, setAudit] = useState(initialAudit);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [extendDraft, setExtendDraft] = useState<Record<number, string>>({});
  const [moduleRow, setModuleRow] = useState<EnterTenantRow | null>(null);
  const [packageId, setPackageId] = useState<EnterPackageId>(
    ENTERSYS_BASE_PACKAGES[0].id,
  );
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [blagajni, setBlagajni] = useState(1);
  const [portalRow, setPortalRow] = useState<EnterTenantRow | null>(null);
  const [portalUser, setPortalUser] = useState("");
  const [portalPass, setPortalPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [copied, setCopied] = useState(false);

  const openPortal = (row: EnterTenantRow) => {
    setPortalRow(row);
    setPortalUser(row.portal_username || "");
    setPortalPass(row.portal_password || "");
    setShowPass(false);
    setCopied(false);
  };

  const generatePass = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let gen = "";
    for (let i = 0; i < 10; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPortalPass(gen + "1+");
  };

  const copyCreds = async () => {
    const text = "FLUXA TENANT PORTAL PRISTUP\nLink: https://fluxa.ba/#tenant-portal\nKorisničko ime: " + portalUser + "\nLozinka: " + portalPass;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // fallback
    }
  };

  async function savePortal() {
    if (!portalRow) return;
    setBusyId(portalRow.tenant_id);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/ops/tenanti/${portalRow.tenant_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PORTAL_CREDENTIALS",
          portal_username: portalUser,
          portal_password: portalPass,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(ERR[json.error] || json.error);
      setPortalRow(null);
      await refresh();
      setInfo(`Pristup za portal snimljen: ${portalRow.naziv}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const openModules = (row: EnterTenantRow) => {
    const draft: Record<string, boolean> = {};
    const active = new Set(row.modules);
    for (const item of ENTERSYS_MODULE_KEYS) {
      draft[item.key] =
        active.size === 0
          ? item.key !== "eventManager" && item.key !== "webShop"
          : active.has(item.key);
    }
    draft.enterCore = true;
    setModules(draft);
    setPackageId(
      (row.package_id as (typeof ENTERSYS_BASE_PACKAGES)[number]["id"]) ||
        "ENTER_ARGUS",
    );
    setBlagajni(row.broj_blagajni || 1);
    setModuleRow(row);
  };

  async function refresh() {
    const res = await fetch("/api/ops/tenanti");
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Greška");
    setTenants(json.tenants);
    setAudit(json.audit);
  }

  async function extend(row: EnterTenantRow, months?: number) {
    setBusyId(row.tenant_id);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/ops/tenanti/${row.tenant_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXTEND",
          extend_months: months,
          subscription_ends_at: months
            ? undefined
            : extendDraft[row.tenant_id] || row.subscription_ends_at,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(ERR[json.error] || json.error);
      await refresh();
      setInfo(`Produženo: ${row.naziv}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function saveModules() {
    if (!moduleRow) return;
    setBusyId(moduleRow.tenant_id);
    setError(null);
    setInfo(null);
    try {
      const selected = ENTERSYS_MODULE_KEYS.filter((m) => modules[m.key]).map(
        (m) => m.key,
      );
      const res = await fetch(`/api/ops/tenanti/${moduleRow.tenant_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MODULES",
          package_id: packageId,
          modules: selected,
          broj_blagajni: blagajni,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(ERR[json.error] || json.error);
      setModuleRow(null);
      await refresh();
      setInfo(`Moduli snimljeni: ${moduleRow.naziv}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const sortedAudit = useMemo(() => audit, [audit]);

  return (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.8 }}>
        Pregled Enter objekata, produženje i moduli. Novi tenant otvara samo
        vlasnik na Studiju — ovdje to dugme ne postoji. Svaka izmjena ide u
        dnevnik: ko, kada, šta.
      </p>
      {error ? <p className="opsMsgErr">{error}</p> : null}
      {info ? <p className="opsMsgOk">{info}</p> : null}

      {tenants.length === 0 ? (
        <p style={{ opacity: 0.75 }}>
          Još nema Enter objekata. Kad vlasnik otvori tenanta na Studiju, ovdje
          će se pojaviti.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="opsTable">
            <thead>
              <tr>
                <th>Objekat</th>
                <th>Status</th>
                <th>Važi do</th>
                <th>Paket</th>
                <th>Cijena</th>
                <th>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((row) => (
                <tr key={row.tenant_id}>
                  <td>
                    <strong>{row.naziv}</strong>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {row.modules.length
                        ? `${row.modules.length} modula · ${row.broj_blagajni} kasa`
                        : `${row.broj_blagajni} kasa`}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        color: statusTone(row.status, row.days_until_end),
                        fontWeight: 700,
                      }}
                    >
                      {row.status}
                    </span>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {row.days_until_end < 0
                        ? `isteklo ${Math.abs(row.days_until_end)} d`
                        : `${row.days_until_end} d`}
                    </div>
                  </td>
                  <td>{fmtDate(row.subscription_ends_at)}</td>
                  <td>{row.package_label || "—"}</td>
                  <td>
                    {row.monthly_price == null
                      ? "—"
                      : `${Number(row.monthly_price).toFixed(2)} ${row.currency || "KM"}`}
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="date"
                        value={
                          extendDraft[row.tenant_id] || row.subscription_ends_at
                        }
                        onChange={(e) =>
                          setExtendDraft((prev) => ({
                            ...prev,
                            [row.tenant_id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn"
                        disabled={busyId === row.tenant_id}
                        onClick={() => extend(row)}
                      >
                        Datum
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busyId === row.tenant_id}
                        onClick={() => extend(row, 1)}
                      >
                        +1 mj
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busyId === row.tenant_id}
                        onClick={() => extend(row, 3)}
                      >
                        +3 mj
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busyId === row.tenant_id}
                        onClick={() => openModules(row)}
                      >
                        Moduli
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginTop: 28 }}>Dnevnik</h3>
      {sortedAudit.length === 0 ? (
        <p style={{ opacity: 0.7, fontSize: 13 }}>Još nema izmjena.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="opsTable">
            <thead>
              <tr>
                <th>Kad</th>
                <th>Ko</th>
                <th>Šta</th>
                <th>Objekat</th>
                <th>Detalj</th>
              </tr>
            </thead>
            <tbody>
              {sortedAudit.map((row) => (
                <tr key={row.audit_id}>
                  <td>{row.created_at}</td>
                  <td>
                    {row.actor_username}
                    <div style={{ fontSize: 11, opacity: 0.65 }}>
                      #{row.actor_user_id}
                    </div>
                  </td>
                  <td>{actionLabel(row.action)}</td>
                  <td>{row.tenant_naziv || `#${row.tenant_id}`}</td>
                  <td style={{ fontSize: 12, opacity: 0.8, maxWidth: 360 }}>
                    {auditDetail(row.detail)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      
      {portalRow ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 90,
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="card opsCard"
            style={{ width: "min(480px, 100%)", maxHeight: "90vh", overflow: "auto", border: "1px solid rgba(56, 189, 248, 0.3)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🔑</span>
                <span>Portal Pristup — {portalRow.naziv}</span>
              </h3>
              <button
                type="button"
                onClick={() => setPortalRow(null)}
                style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12, opacity: 0.8, margin: "0 0 16px" }}>
              Pristupni podaci za klijentski Tenant Centar na <strong>https://fluxa.ba/#tenant-portal</strong>. Klijent se ovim podacima prijavljuje i preuzima instalacije, licence i nadogradnje.
            </p>

            <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                <strong>Korisničko ime za portal (Tenant Identifikator)</strong>
                <input
                  type="text"
                  value={portalUser}
                  placeholder="npr. aquana, taf, olymp..."
                  onChange={(e) => setPortalUser(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
                />
              </label>

              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Lozinka za portal</strong>
                  <button
                    type="button"
                    onClick={generatePass}
                    style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}
                  >
                    🎲 Generiši novu
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    value={portalPass}
                    placeholder="Unesite ili promijenite lozinku..."
                    onChange={(e) => setPortalPass(e.target.value)}
                    style={{ width: "100%", padding: "8px 40px 8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13 }}
                  >
                    {showPass ? "Sakrij" : "Vidi"}
                  </button>
                </div>
              </label>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
              <button
                type="button"
                className="btn"
                style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
                onClick={copyCreds}
                disabled={!portalUser || !portalPass}
              >
                <span>{copied ? "✓ Kopirano!" : "📋 Kopiraj za klijenta"}</span>
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn" onClick={() => setPortalRow(null)}>
                  Odustani
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ background: "#0284c7", color: "#fff", borderColor: "#38bdf8", fontWeight: 600 }}
                  disabled={busyId === portalRow.tenant_id || !portalUser.trim()}
                  onClick={savePortal}
                >
                  {busyId === portalRow.tenant_id ? "Snimam..." : "Snimi pristup"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {moduleRow ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 80,
            padding: 16,
          }}
        >
          <div
            className="card opsCard"
            style={{ width: "min(640px, 100%)", maxHeight: "90vh", overflow: "auto" }}
          >
            <h3>Moduli — {moduleRow.naziv}</h3>
            <label style={{ display: "grid", gap: 4, fontSize: 12, marginBottom: 12 }}>
              Osnovni paket
              <select
                value={packageId}
                onChange={(e) => setPackageId(e.target.value as typeof packageId)}
              >
                {ENTERSYS_BASE_PACKAGES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, marginBottom: 12 }}>
              Broj kasa
              <input
                type="number"
                min={1}
                value={blagajni}
                onChange={(e) => setBlagajni(Number(e.target.value) || 1)}
              />
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {ENTERSYS_MODULE_KEYS.map((m) => (
                <label key={m.key} style={{ fontSize: 13, display: "flex", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!modules[m.key]}
                    disabled={m.key === "enterCore"}
                    onChange={(e) =>
                      setModules((prev) => ({
                        ...prev,
                        [m.key]: e.target.checked,
                      }))
                    }
                  />
                  {m.label}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setModuleRow(null)}>
                Odustani
              </button>
              <button
                type="button"
                className="btn"
                disabled={busyId === moduleRow.tenant_id}
                onClick={saveModules}
              >
                Snimi module
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
