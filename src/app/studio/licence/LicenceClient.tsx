"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";

type TenantRow = {
  tenant_id: number;
  naziv: string;
  plan_id: number;
  plan_naziv: string;
  max_users: number;
  subscription_starts_at: string;
  subscription_ends_at: string;
  status: string;
  days_until_end: number;
  licence_token?: string | null;
};

type PlanRow = { plan_id: number; naziv: string; max_users: number };

export default function LicenceClient() {
  const { t } = useTranslation();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extendId, setExtendId] = useState<number | null>(null);
  const [extendDate, setExtendDate] = useState("");
  const [extendSaving, setExtendSaving] = useState(false);
  const [planModalTenantId, setPlanModalTenantId] = useState<number | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [newTenantOpen, setNewTenantOpen] = useState(false);
  const [newTenantNaziv, setNewTenantNaziv] = useState("");
  const [newTenantPlanId, setNewTenantPlanId] = useState<number>(1);
  const [newTenantStart, setNewTenantStart] = useState("");
  const [newTenantEnd, setNewTenantEnd] = useState("");
  const [newTenantSaving, setNewTenantSaving] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<number | null>(null);
  const [tokenModalRow, setTokenModalRow] = useState<TenantRow | null>(null);
  const [tokenRegenerating, setTokenRegenerating] = useState(false);
  const [newTenantToken, setNewTenantToken] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tr, pr] = await Promise.all([
        fetch("/api/tenant-admin/tenants").then((r) => r.json()),
        fetch("/api/tenant-admin/plans").then((r) => r.json()),
      ]);
      if (tr.ok) setTenants(tr.tenants ?? []);
      else setError(tr.error ?? "Greška učitavanja tenanata");
      if (pr.ok) setPlans(pr.plans ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleExtend = async () => {
    if (extendId == null || !extendDate) return;
    setExtendSaving(true);
    try {
      const res = await fetch(`/api/tenant-admin/tenants/${extendId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription_ends_at: extendDate }),
      });
      const data = await res.json();
      if (data.ok) {
        setExtendId(null);
        setExtendDate("");
        await load();
      } else {
        setError(data.error ?? "Greška");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExtendSaving(false);
    }
  };

  const handleChangePlan = async () => {
    if (planId == null || planModalTenantId == null) return;
    setPlanSaving(true);
    try {
      const res = await fetch(`/api/tenant-admin/tenants/${planModalTenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });
      const data = await res.json();
      if (data.ok) {
        setPlanModalTenantId(null);
        setPlanId(null);
        await load();
      } else {
        setError(data.error ?? "Greška");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanSaving(false);
    }
  };

  const openPlanModal = (tenantId: number) => {
    setPlanModalTenantId(tenantId);
    setPlanId(tenants.find((t) => t.tenant_id === tenantId)?.plan_id ?? null);
  };

  const openExtendModal = (row: TenantRow) => {
    setExtendId(row.tenant_id);
    setExtendDate(row.subscription_ends_at || "");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleRegenerateToken = async (tenantId: number) => {
    setTokenRegenerating(true);
    try {
      const res = await fetch(`/api/tenant-admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate_licence_token: true }),
      });
      const data = await res.json();
      if (data.ok && data.licence_token) {
        setTokenModalRow((prev) => (prev ? { ...prev, licence_token: data.licence_token } : null));
        await load();
      } else setError(data.error ?? "Greška");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTokenRegenerating(false);
    }
  };

  const handleSetStatus = async (tenantId: number, status: "SUSPENDOVAN" | "AKTIVAN") => {
    setStatusSavingId(tenantId);
    try {
      const res = await fetch(`/api/tenant-admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.ok) await load();
      else setError(data.error ?? "Greška");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatusSavingId(null);
    }
  };

  const handleCreateTenant = async () => {
    if (!newTenantNaziv.trim() || !newTenantStart || !newTenantEnd) return;
    setNewTenantSaving(true);
    try {
      const res = await fetch("/api/tenant-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naziv: newTenantNaziv.trim(),
          plan_id: newTenantPlanId,
          subscription_starts_at: newTenantStart,
          subscription_ends_at: newTenantEnd,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewTenantOpen(false);
        setNewTenantNaziv("");
        setNewTenantPlanId(plans[0]?.plan_id ?? 1);
        setNewTenantStart("");
        setNewTenantEnd("");
        setNewTenantToken(data.licence_token ?? null);
        await load();
      } else {
        setError(data.error ?? "Greška");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setNewTenantSaving(false);
    }
  };

  if (loading) {
    return <p style={{ padding: 24 }}>{t("common.loading")}</p>;
  }

  if (error) {
    return (
      <p style={{ padding: 24, color: "var(--danger)" }}>
        {error}
      </p>
    );
  }

  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    background: "var(--panel)",
    borderRadius: 12,
    overflow: "hidden",
  };
  const thTd = {
    padding: "12px 16px",
    textAlign: "left" as const,
    borderBottom: "1px solid var(--border)",
  };

  return (
    <>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <button type="button" className="btn" onClick={() => setNewTenantOpen(true)}>
          {t("studioLicence.newTenant")}
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thTd}>{t("studioLicence.colNaziv")}</th>
              <th style={thTd}>{t("studioLicence.colPlan")}</th>
              <th style={thTd}>{t("studioLicence.colIstice")}</th>
              <th style={thTd}>{t("studioLicence.colDana")}</th>
              <th style={thTd}>{t("studioLicence.colStatus")}</th>
              <th style={thTd}>{t("studioLicence.colToken")}</th>
              <th style={thTd}>{t("studioLicence.colAkcije")}</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={7} style={thTd}>
                  {t("studioLicence.noTenants")}
                </td>
              </tr>
            ) : (
              tenants.map((row) => (
                <tr key={row.tenant_id}>
                  <td style={thTd}>{row.naziv}</td>
                  <td style={thTd}>{row.plan_naziv}</td>
                  <td style={thTd}>{row.subscription_ends_at}</td>
                  <td style={thTd}>
                    {row.days_until_end > 0
                      ? row.days_until_end
                      : row.days_until_end === 0
                        ? "0"
                        : t("studioLicence.expired")}
                  </td>
                  <td style={thTd}>{row.status}</td>
                  <td style={thTd}>
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: 12 }}
                      onClick={() => setTokenModalRow(row)}
                      title={t("studioLicence.tokenTooltip")}
                    >
                      {row.licence_token ? "🔑 Token" : t("studioLicence.noToken")}
                    </button>
                  </td>
                  <td style={thTd}>
                    <button
                      type="button"
                      className="btn"
                      style={{ marginRight: 8 }}
                      onClick={() => openExtendModal(row)}
                    >
                      {t("studioLicence.extend")}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => openPlanModal(row.tenant_id)}
                    >
                      {t("studioLicence.changePlan")}
                    </button>
                    {String(row.status).toUpperCase() === "SUSPENDOVAN" ? (
                      <button
                        type="button"
                        className="btn"
                        style={{ marginLeft: 8 }}
                        disabled={statusSavingId === row.tenant_id}
                        onClick={() => handleSetStatus(row.tenant_id, "AKTIVAN")}
                        title={t("studioLicence.restoreAccess")}
                      >
                        {statusSavingId === row.tenant_id ? t("common.loading") : t("studioLicence.restoreAccess")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        style={{ marginLeft: 8 }}
                        disabled={statusSavingId === row.tenant_id}
                        onClick={() => handleSetStatus(row.tenant_id, "SUSPENDOVAN")}
                        title={t("studioLicence.suspendAccess")}
                      >
                        {statusSavingId === row.tenant_id ? t("common.loading") : t("studioLicence.suspend")}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Produži */}
      {extendId != null && (
        <div style={overlayStyle()} onClick={() => !extendSaving && setExtendId(null)}>
          <div
            style={modalStyle(420)}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>{t("studioLicence.extendTitle")}</h3>
              <label style={{ display: "block", marginBottom: 8 }}>
                {t("studioLicence.newEndDate")}
              </label>
              <input
                type="date"
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
                style={{ padding: 8, marginBottom: 16, width: "100%", maxWidth: 200 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={extendSaving || !extendDate}
                  onClick={handleExtend}
                >
                  {extendSaving ? t("common.loading") : t("common.save")}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={extendSaving}
                  onClick={() => setExtendId(null)}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Token (prikaz / kopiraj / regeneriši) */}
      {tokenModalRow && (
        <div style={overlayStyle()} onClick={() => !tokenRegenerating && setTokenModalRow(null)}>
          <div style={modalStyle(480)} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>{t("studioLicence.tokenTitle")} – {tokenModalRow.naziv}</h3>
              {tokenModalRow.licence_token ? (
                <>
                  <p style={{ fontSize: 13, marginBottom: 8 }}>{t("studioLicence.tokenHint")}</p>
                  <code style={{ display: "block", padding: 12, background: "var(--panel)", borderRadius: 8, marginBottom: 12, wordBreak: "break-all", fontSize: 12 }}>
                    {tokenModalRow.licence_token}
                  </code>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn" onClick={() => copyToClipboard(tokenModalRow.licence_token!)}>
                      {t("studioLicence.copyToken")}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={tokenRegenerating}
                      onClick={() => handleRegenerateToken(tokenModalRow.tenant_id)}
                    >
                      {tokenRegenerating ? t("common.loading") : t("studioLicence.regenerateToken")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ marginBottom: 12, opacity: 0.9 }}>{t("studioLicence.tokenMissing")}</p>
                  <button
                    type="button"
                    className="btn"
                    disabled={tokenRegenerating}
                    onClick={() => handleRegenerateToken(tokenModalRow.tenant_id)}
                  >
                    {tokenRegenerating ? t("common.loading") : t("studioLicence.regenerateToken")}
                  </button>
                </>
              )}
              <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => setTokenModalRow(null)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novi tenant – prikaz tokena nakon kreiranja */}
      {newTenantToken && (
        <div style={overlayStyle()} onClick={() => setNewTenantToken(null)}>
          <div style={modalStyle(520)} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>{t("studioLicence.newTenantTokenTitle")}</h3>
              <p style={{ fontSize: 13, marginBottom: 12 }}>{t("studioLicence.newTenantTokenHint")}</p>
              <code style={{ display: "block", padding: 12, background: "var(--panel)", borderRadius: 8, marginBottom: 12, wordBreak: "break-all", fontSize: 12 }}>
                {newTenantToken}
              </code>
              <button type="button" className="btn" onClick={() => copyToClipboard(newTenantToken)}>
                {t("studioLicence.copyToken")}
              </button>
              <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => setNewTenantToken(null)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novi tenant */}
      {newTenantOpen && (
        <div style={overlayStyle()} onClick={() => !newTenantSaving && setNewTenantOpen(false)}>
          <div style={modalStyle(480)} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>{t("studioLicence.newTenantTitle")}</h3>
              <label style={{ display: "block", marginBottom: 4 }}>{t("studioLicence.labelNaziv")}</label>
              <input
                type="text"
                value={newTenantNaziv}
                onChange={(e) => setNewTenantNaziv(e.target.value)}
                placeholder={t("studioLicence.placeholderNaziv")}
                style={{ padding: 8, marginBottom: 12, width: "100%", maxWidth: 320 }}
              />
              <label style={{ display: "block", marginBottom: 4 }}>{t("studioLicence.plan")}</label>
              <select
                value={newTenantPlanId}
                onChange={(e) => setNewTenantPlanId(Number(e.target.value))}
                style={{ padding: 8, marginBottom: 12, width: "100%", maxWidth: 200 }}
              >
                {plans.map((p) => (
                  <option key={p.plan_id} value={p.plan_id}>
                    {p.naziv} (max {p.max_users})
                  </option>
                ))}
              </select>
              <label style={{ display: "block", marginBottom: 4 }}>{t("studioLicence.labelStart")}</label>
              <input
                type="date"
                value={newTenantStart}
                onChange={(e) => setNewTenantStart(e.target.value)}
                style={{ padding: 8, marginBottom: 12, width: "100%", maxWidth: 200 }}
              />
              <label style={{ display: "block", marginBottom: 4 }}>{t("studioLicence.labelEnd")}</label>
              <input
                type="date"
                value={newTenantEnd}
                onChange={(e) => setNewTenantEnd(e.target.value)}
                style={{ padding: 8, marginBottom: 16, width: "100%", maxWidth: 200 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={newTenantSaving || !newTenantNaziv.trim() || !newTenantStart || !newTenantEnd}
                  onClick={handleCreateTenant}
                >
                  {newTenantSaving ? t("common.loading") : t("common.save")}
                </button>
                <button type="button" className="btn" disabled={newTenantSaving} onClick={() => setNewTenantOpen(false)}>
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Promijeni plan */}
      {planModalTenantId != null && planId !== null && (
        <div
          style={overlayStyle()}
          onClick={() => !planSaving && (setPlanModalTenantId(null), setPlanId(null))}
        >
          <div
            style={modalStyle(420)}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>{t("studioLicence.changePlanTitle")}</h3>
              <label style={{ display: "block", marginBottom: 8 }}>
                {t("studioLicence.plan")}
              </label>
              <select
                value={planId}
                onChange={(e) => setPlanId(Number(e.target.value))}
                style={{ padding: 8, marginBottom: 16, width: "100%", maxWidth: 200 }}
              >
                {plans.map((p) => (
                  <option key={p.plan_id} value={p.plan_id}>
                    {p.naziv} (max {p.max_users} korisnika)
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={planSaving}
                  onClick={handleChangePlan}
                >
                  {planSaving ? t("common.loading") : t("common.save")}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={planSaving}
                  onClick={() => { setPlanModalTenantId(null); setPlanId(null); }}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function overlayStyle(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    backdropFilter: "blur(8px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };
}

function modalStyle(maxW = 420): React.CSSProperties {
  return {
    width: "min(100%, " + maxW + "px)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    boxShadow: "var(--shadow)",
    overflow: "hidden",
  };
}
