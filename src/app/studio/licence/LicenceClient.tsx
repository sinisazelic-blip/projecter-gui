"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "@/components/LocaleProvider";

const USER_LIMIT_OPTIONS = [1, 3, 5, 10, 50, 101] as const; // 101 = 100+
const CURRENCY_OPTIONS = ["EUR", "KM"];

const SOCCS_TIER_OPTIONS = [
  "BASIC",
  "BASIC_PLUS",
  "PROFESSIONAL",
  "ENTERPRISE",
  "SWIMVOICE",
] as const;

type TenantRow = {
  tenant_id: number;
  tenant_public_id?: string | null;
  naziv: string;
  plan_id: number;
  plan_naziv: string;
  max_users: number;
  monthly_price?: number | string | null;
  currency?: string | null;
  soccs_tier?: string | null;
  soccs_federation_parent_tenant_id?: number | null;
  federation_naziv?: string | null;
  subscription_starts_at: string;
  subscription_ends_at: string;
  status: string;
  days_until_end: number;
  meet_remaining?: number;
  licence_token?: string | null;
  /** 1 ako je FIRST_INSTALL kod potrošen (SOCCS aktiviran). */
  soccs_first_install_consumed?: number;
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
  const [planModalTenantId, setPlanModalTenantId] = useState<number | null>(
    null,
  );
  const [planId, setPlanId] = useState<number | null>(null);
  const [planMaxUsers, setPlanMaxUsers] = useState<number>(5);
  const [planSaving, setPlanSaving] = useState(false);
  const [newTenantOpen, setNewTenantOpen] = useState(false);
  const [newTenantNaziv, setNewTenantNaziv] = useState("");
  const [newTenantPlanId, setNewTenantPlanId] = useState<number>(1);
  const [newTenantMaxUsers, setNewTenantMaxUsers] = useState<number>(5);
  const [newTenantStart, setNewTenantStart] = useState("");
  const [newTenantEnd, setNewTenantEnd] = useState("");
  const [newTenantPrice, setNewTenantPrice] = useState("");
  const [newTenantCurrency, setNewTenantCurrency] = useState("EUR");
  const [newTenantSaving, setNewTenantSaving] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<number | null>(null);
  const [tokenModalRow, setTokenModalRow] = useState<TenantRow | null>(null);
  const [tokenRegenerating, setTokenRegenerating] = useState(false);
  const [newTenantToken, setNewTenantToken] = useState<string | null>(null);
  const [newTenantSoccsTier, setNewTenantSoccsTier] = useState<string>("");

  const [soccsModal, setSoccsModal] = useState<TenantRow | null>(null);
  const [soccsTierDraft, setSoccsTierDraft] = useState("");
  const [soccsFedDraft, setSoccsFedDraft] = useState<number | "">("");
  const [soccsSaving, setSoccsSaving] = useState(false);
  const [soccsGenCode, setSoccsGenCode] = useState<string | null>(null);
  const [soccsGenCodes, setSoccsGenCodes] = useState<string[]>([]);
  /** Polje 1 na SOCCS aktivaciji (FIRST_INSTALL); kod MEET_SESSION dolazi iz API odgovora. */
  const [soccsGenFirstInstallCode, setSoccsGenFirstInstallCode] = useState<
    string | null
  >(null);
  const [soccsLastGenPurpose, setSoccsLastGenPurpose] = useState<
    "FIRST_INSTALL" | "MEET_SESSION" | null
  >(null);
  const [soccsMeetCountDraft, setSoccsMeetCountDraft] = useState<string>("1");
  const [soccsMeetTargetDraft, setSoccsMeetTargetDraft] = useState<string>("");
  const [soccsMeetSponsor, setSoccsMeetSponsor] = useState<number | "">("");
  const [soccsMeetNote, setSoccsMeetNote] = useState("");
  const [soccsGenBusy, setSoccsGenBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tr, pr] = await Promise.all([
        fetch("/api/tenant-admin/tenants").then((r) => r.json()),
        fetch("/api/tenant-admin/plans").then((r) => r.json()),
      ]);
      if (tr.ok) setTenants(tr.tenants ?? []);
      else setError(tr.error ?? t("common.errorLoad"));
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
        setError(data.error ?? t("common.error"));
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
      const res = await fetch(
        `/api/tenant-admin/tenants/${planModalTenantId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan_id: planId, max_users: planMaxUsers }),
        },
      );
      const data = await res.json();
      if (data.ok) {
        setPlanModalTenantId(null);
        setPlanId(null);
        await load();
      } else {
        setError(data.error ?? t("common.error"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanSaving(false);
    }
  };

  const openPlanModal = (tenantId: number) => {
    const row = tenants.find((t) => t.tenant_id === tenantId);
    setPlanModalTenantId(tenantId);
    setPlanId(row?.plan_id ?? null);
    setPlanMaxUsers(row?.max_users ?? 5);
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
        setTokenModalRow((prev) =>
          prev ? { ...prev, licence_token: data.licence_token } : null,
        );
        await load();
      } else setError(data.error ?? t("common.error"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTokenRegenerating(false);
    }
  };

  const handleSetStatus = async (
    tenantId: number,
    status: "SUSPENDOVAN" | "AKTIVAN",
  ) => {
    setStatusSavingId(tenantId);
    try {
      const res = await fetch(`/api/tenant-admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.ok) await load();
      else setError(data.error ?? t("common.error"));
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
          max_users: newTenantMaxUsers,
          subscription_starts_at: newTenantStart,
          subscription_ends_at: newTenantEnd,
          monthly_price: newTenantPrice.trim() ? Number(newTenantPrice) : null,
          currency: newTenantPrice.trim() ? newTenantCurrency : null,
          soccs_tier: newTenantSoccsTier,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewTenantOpen(false);
        setNewTenantNaziv("");
        setNewTenantPlanId(plans[0]?.plan_id ?? 1);
        setNewTenantMaxUsers(5);
        setNewTenantStart("");
        setNewTenantEnd("");
        setNewTenantPrice("");
        setNewTenantCurrency("EUR");
        setNewTenantSoccsTier("");
        setNewTenantToken(data.licence_token ?? null);
        await load();
      } else {
        setError(data.error ?? t("common.error"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setNewTenantSaving(false);
    }
  };

  const formatMaxUsers = (n: number) =>
    n >= 101 ? t("studioLicence.users100Plus") : String(n);
  const formatSoccsTier = (row: TenantRow) => {
    const raw = String(row.soccs_tier ?? "")
      .trim()
      .toUpperCase();
    if (!raw) return "—";
    return SOCCS_TIER_OPTIONS.includes(
      raw as (typeof SOCCS_TIER_OPTIONS)[number],
    )
      ? raw
      : "—";
  };

  const openSoccsModal = (row: TenantRow) => {
    setSoccsModal(row);
    const rawTier = String(row.soccs_tier ?? "")
      .trim()
      .toUpperCase();
    setSoccsTierDraft(
      SOCCS_TIER_OPTIONS.includes(
        rawTier as (typeof SOCCS_TIER_OPTIONS)[number],
      )
        ? rawTier
        : "",
    );
    setSoccsFedDraft(row.soccs_federation_parent_tenant_id ?? "");
    setSoccsGenCode(null);
    setSoccsGenCodes([]);
    setSoccsGenFirstInstallCode(null);
    setSoccsLastGenPurpose(null);
    setSoccsMeetCountDraft("1");
    setSoccsMeetTargetDraft(
      Number.isFinite(Number(row.meet_remaining ?? NaN))
        ? String(Number(row.meet_remaining))
        : "",
    );
    setSoccsMeetSponsor("");
    setSoccsMeetNote("");
  };

  const handleSoccsSave = async () => {
    if (!soccsModal) return;
    setSoccsSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        soccs_tier: soccsTierDraft || null,
      };
      if (soccsFedDraft === "") {
        body.soccs_federation_parent_tenant_id = null;
      } else if (typeof soccsFedDraft === "number") {
        body.soccs_federation_parent_tenant_id = soccsFedDraft;
      }
      if (soccsMeetTargetDraft.trim() !== "") {
        body.meet_session_target = Number(soccsMeetTargetDraft);
      }
      const res = await fetch(
        `/api/tenant-admin/tenants/${soccsModal.tenant_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (data.ok) {
        await load();
        setSoccsModal((prev) => {
          if (!prev) return null;
          const nextMeetRemaining =
            data?.meet_remaining != null
              ? Number(data.meet_remaining)
              : Number(prev.meet_remaining ?? NaN);
          return {
            ...prev,
            soccs_tier: soccsTierDraft,
            meet_remaining: Number.isFinite(nextMeetRemaining)
              ? nextMeetRemaining
              : prev.meet_remaining,
            soccs_federation_parent_tenant_id:
              soccsFedDraft === ""
                ? null
                : typeof soccsFedDraft === "number"
                  ? soccsFedDraft
                  : null,
          };
        });
      } else setError(data.error ?? t("common.error"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSoccsSaving(false);
    }
  };

  const handleGenerateSoccsCode = async (
    purpose: "FIRST_INSTALL" | "MEET_SESSION",
  ) => {
    if (!soccsModal) return;
    setSoccsGenBusy(true);
    setError(null);
    try {
      const requestedCount = Math.max(
        1,
        Math.min(200, Number.parseInt(soccsMeetCountDraft || "1", 10) || 1),
      );
      const body: Record<string, unknown> = {
        tenant_id: soccsModal.tenant_id,
        purpose,
        valid_days: 365 * 5,
        count: requestedCount,
      };
      if (purpose === "MEET_SESSION") {
        if (typeof soccsMeetSponsor === "number") {
          body.sponsor_tenant_id = soccsMeetSponsor;
        }
        body.meet_note = soccsMeetNote.trim() || null;
      }
      const res = await fetch("/api/tenant-admin/activation-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok && (data.code || (Array.isArray(data.codes) && data.codes.length > 0))) {
        const list = Array.isArray(data.codes)
          ? data.codes.filter((x: unknown) => typeof x === "string")
          : (data.code ? [String(data.code)] : []);
        setSoccsLastGenPurpose(purpose);
        if (purpose === "FIRST_INSTALL") {
          setSoccsGenFirstInstallCode(list[0] ?? null);
          setSoccsGenCode(null);
          setSoccsGenCodes(list);
        } else {
          const fiRaw = data.first_install_code;
          const fi =
            typeof fiRaw === "string" && fiRaw.trim() ? fiRaw.trim() : null;
          setSoccsGenFirstInstallCode(fi);
          setSoccsGenCode(list[0] ?? null);
          setSoccsGenCodes(list);
        }
        await load();
      } else setError(data.error ?? t("common.error"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSoccsGenBusy(false);
    }
  };

  const formatPrice = (row: TenantRow) => {
    if (row.monthly_price == null || row.monthly_price === "") return "—";
    const curr = row.currency || "EUR";
    return `${Number(row.monthly_price)} ${curr}`;
  };

  /** Zeleno: aktivan i (nema čekanja SOCCS aktivacije). Žuto: čeka prvu SOCCS aktivaciju. Crveno: suspend / isteklo. */
  const tenantStatusLamp = (row: TenantRow) => {
    const st = String(row.status).toUpperCase();
    if (st === "SUSPENDOVAN" || st === "ISTEKLO") {
      return {
        color: "#ef4444",
        title: t("studioLicence.lampTitleRed"),
      };
    }
    if (Number(row.days_until_end) < 0) {
      return {
        color: "#dc2626",
        title: t("studioLicence.lampTitleExpired"),
      };
    }
    const soccs = String(row.soccs_tier ?? "").trim().toUpperCase();
    const needsSoccsNode =
      soccs !== "" &&
      soccs !== "SWIMVOICE" &&
      SOCCS_TIER_OPTIONS.includes(soccs as (typeof SOCCS_TIER_OPTIONS)[number]);
    const consumed = Number(row.soccs_first_install_consumed ?? 0) === 1;
    if (
      st === "AKTIVAN" &&
      needsSoccsNode &&
      !consumed
    ) {
      return {
        color: "#eab308",
        title: t("studioLicence.lampTitleYellow"),
      };
    }
    return {
      color: "#22c55e",
      title: t("studioLicence.lampTitleGreen"),
    };
  };

  if (loading) {
    return <p style={{ padding: 24 }}>{t("common.loading")}</p>;
  }

  if (error) {
    return <p style={{ padding: 24, color: "var(--danger)" }}>{error}</p>;
  }

  const tableStyle: CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    background: "var(--panel)",
    borderRadius: 12,
    overflow: "hidden",
    fontSize: 13,
  };
  const thTd: CSSProperties = {
    padding: "6px 8px",
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "top",
  };
  const thFlux: CSSProperties = {
    ...thTd,
    background: "rgba(59, 130, 246, 0.1)",
    borderLeft: "2px solid rgba(59, 130, 246, 0.35)",
  };
  const thFluxCont: CSSProperties = {
    ...thTd,
    background: "rgba(59, 130, 246, 0.08)",
  };
  const thSoccs: CSSProperties = {
    ...thTd,
    background: "rgba(239, 68, 68, 0.1)",
    borderLeft: "2px solid rgba(239, 68, 68, 0.35)",
  };
  const tdFlux: CSSProperties = {
    ...thTd,
    background: "rgba(59, 130, 246, 0.06)",
    borderLeft: "2px solid rgba(59, 130, 246, 0.25)",
  };
  const tdFluxCont: CSSProperties = {
    ...thTd,
    background: "rgba(59, 130, 246, 0.04)",
  };
  const tdSoccs: CSSProperties = {
    ...thTd,
    background: "rgba(239, 68, 68, 0.06)",
    borderLeft: "2px solid rgba(239, 68, 68, 0.25)",
  };

  return (
    <>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <button
          type="button"
          className="btn"
          onClick={() => setNewTenantOpen(true)}
        >
          {t("studioLicence.newTenant")}
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th
                colSpan={6}
                style={{
                  ...thTd,
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  opacity: 0.9,
                  letterSpacing: "0.02em",
                }}
              >
                {t("studioLicence.groupCommon")}
              </th>
              <th
                colSpan={3}
                style={{
                  ...thFlux,
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(96, 165, 250, 0.95)",
                }}
              >
                {t("studioLicence.groupFluxa")}
              </th>
              <th
                colSpan={1}
                style={{
                  ...thSoccs,
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(248, 113, 113, 0.95)",
                }}
              >
                {t("studioLicence.groupSoccsSv")}
              </th>
              <th
                rowSpan={2}
                style={{
                  ...thTd,
                  textAlign: "center",
                  fontSize: 11,
                  verticalAlign: "middle",
                }}
              >
                {t("studioLicence.colAkcije")}
              </th>
            </tr>
            <tr>
              <th style={thTd}>{t("studioLicence.colNaziv")}</th>
              <th style={thTd}>{t("studioLicence.colCijena")}</th>
              <th style={thTd}>{t("studioLicence.colIstice")}</th>
              <th style={thTd}>{t("studioLicence.colDana")}</th>
              <th style={thTd}>{t("studioLicence.colMeetRemaining")}</th>
              <th style={thTd}>{t("studioLicence.colStatusLamp")}</th>
              <th style={thFlux}>{t("studioLicence.colFluxaVersion")}</th>
              <th style={thFluxCont}>{t("studioLicence.colKorisnici")}</th>
              <th style={thFluxCont}>{t("studioLicence.colToken")}</th>
              <th style={thSoccs}>{t("studioLicence.colSoccsVersion")}</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={11} style={thTd}>
                  {t("studioLicence.noTenants")}
                </td>
              </tr>
            ) : (
              tenants.map((row) => {
                const lamp = tenantStatusLamp(row);
                return (
                  <tr key={row.tenant_id}>
                    <td style={thTd}>{row.naziv}</td>
                    <td style={thTd}>{formatPrice(row)}</td>
                    <td style={thTd}>{row.subscription_ends_at}</td>
                    <td style={thTd}>
                      {row.days_until_end > 0
                        ? row.days_until_end
                        : row.days_until_end === 0
                          ? "0"
                          : t("studioLicence.expired")}
                    </td>
                    <td style={thTd}>
                      {Number.isFinite(Number(row.meet_remaining ?? NaN))
                        ? Number(row.meet_remaining)
                        : "—"}
                    </td>
                    <td style={thTd}>
                      <span
                        role="img"
                        aria-label={lamp.title}
                        title={`${lamp.title} (${row.status})`}
                        style={{
                          display: "inline-block",
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          background: lamp.color,
                          boxShadow: `0 0 0 2px rgba(255,255,255,0.2)`,
                          verticalAlign: "middle",
                        }}
                      />
                    </td>
                    <td style={tdFlux}>{row.plan_naziv}</td>
                    <td style={tdFluxCont}>
                      {formatMaxUsers(row.max_users)}
                    </td>
                    <td style={tdFluxCont}>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 11, padding: "4px 8px" }}
                        onClick={() => setTokenModalRow(row)}
                        title={t("studioLicence.tokenTooltip")}
                      >
                        {row.licence_token
                          ? "🔑 Token"
                          : t("studioLicence.noToken")}
                      </button>
                    </td>
                    <td style={tdSoccs}>{formatSoccsTier(row)}</td>
                    <td style={thTd}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="button"
                          className="btn"
                          style={{
                            fontSize: 11,
                            padding: "4px 8px",
                            color: "#60a5fa",
                            borderColor: "rgba(96, 165, 250, 0.45)",
                            background: "rgba(59, 130, 246, 0.12)",
                          }}
                          onClick={() => openExtendModal(row)}
                        >
                          {t("studioLicence.extend")}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            fontSize: 11,
                            padding: "4px 8px",
                            color: "#60a5fa",
                            borderColor: "rgba(96, 165, 250, 0.45)",
                            background: "rgba(59, 130, 246, 0.12)",
                          }}
                          onClick={() => openPlanModal(row.tenant_id)}
                        >
                          {t("studioLicence.changePlan")}
                        </button>
                        {String(row.status).toUpperCase() === "SUSPENDOVAN" ? (
                          <button
                            type="button"
                            className="btn"
                            style={{
                              fontSize: 11,
                              padding: "4px 8px",
                              color: "#f8fafc",
                              borderColor: "rgba(248, 250, 252, 0.35)",
                              background: "rgba(148, 163, 184, 0.2)",
                            }}
                            disabled={statusSavingId === row.tenant_id}
                            onClick={() =>
                              handleSetStatus(row.tenant_id, "AKTIVAN")
                            }
                            title={t("studioLicence.restoreAccess")}
                          >
                            {statusSavingId === row.tenant_id
                              ? t("common.loading")
                              : t("studioLicence.restoreAccess")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn"
                            style={{
                              fontSize: 11,
                              padding: "4px 8px",
                              color: "#f8fafc",
                              borderColor: "rgba(248, 250, 252, 0.35)",
                              background: "rgba(148, 163, 184, 0.2)",
                            }}
                            disabled={statusSavingId === row.tenant_id}
                            onClick={() =>
                              handleSetStatus(row.tenant_id, "SUSPENDOVAN")
                            }
                            title={`${t("studioLicence.suspendAccess")} (${t("studioLicence.suspendAppliesToAll")})`}
                          >
                            {statusSavingId === row.tenant_id
                              ? t("common.loading")
                              : t("studioLicence.suspend")}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn"
                          style={{
                            fontSize: 11,
                            padding: "4px 8px",
                            color: "#f87171",
                            borderColor: "rgba(248, 113, 113, 0.45)",
                            background: "rgba(239, 68, 68, 0.12)",
                          }}
                          onClick={() => openSoccsModal(row)}
                          title={t("studioLicence.soccsModalTitle")}
                        >
                          {t("studioLicence.soccsButton")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Produži */}
      {extendId != null && (
        <div
          className="studio-modal"
          style={overlayStyle()}
          onClick={() => !extendSaving && setExtendId(null)}
        >
          <div style={modalStyle(420)} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>{t("studioLicence.extendTitle")}</h3>
              <label style={{ display: "block", marginBottom: 8 }}>
                {t("studioLicence.newEndDate")}
              </label>
              <input
                type="date"
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
                style={{
                  padding: 8,
                  marginBottom: 16,
                  width: "100%",
                  maxWidth: 200,
                }}
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
        <div
          className="studio-modal"
          style={overlayStyle()}
          onClick={() => !tokenRegenerating && setTokenModalRow(null)}
        >
          <div style={modalStyle(480)} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>
                {t("studioLicence.tokenTitle")} – {tokenModalRow.naziv}
              </h3>
              {tokenModalRow.licence_token ? (
                <>
                  <p style={{ fontSize: 13, marginBottom: 8 }}>
                    {t("studioLicence.tokenHint")}
                  </p>
                  <code
                    style={{
                      display: "block",
                      padding: 12,
                      background: "var(--panel)",
                      borderRadius: 8,
                      marginBottom: 12,
                      wordBreak: "break-all",
                      fontSize: 12,
                    }}
                  >
                    {tokenModalRow.licence_token}
                  </code>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        copyToClipboard(tokenModalRow.licence_token!)
                      }
                    >
                      {t("studioLicence.copyToken")}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={tokenRegenerating}
                      onClick={() =>
                        handleRegenerateToken(tokenModalRow.tenant_id)
                      }
                    >
                      {tokenRegenerating
                        ? t("common.loading")
                        : t("studioLicence.regenerateToken")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ marginBottom: 12, opacity: 0.9 }}>
                    {t("studioLicence.tokenMissing")}
                  </p>
                  <button
                    type="button"
                    className="btn"
                    disabled={tokenRegenerating}
                    onClick={() =>
                      handleRegenerateToken(tokenModalRow.tenant_id)
                    }
                  >
                    {tokenRegenerating
                      ? t("common.loading")
                      : t("studioLicence.regenerateToken")}
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn"
                style={{ marginTop: 16 }}
                onClick={() => setTokenModalRow(null)}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novi tenant – prikaz tokena nakon kreiranja */}
      {newTenantToken && (
        <div
          className="studio-modal"
          style={overlayStyle()}
          onClick={() => setNewTenantToken(null)}
        >
          <div style={modalStyle(520)} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>
                {t("studioLicence.newTenantTokenTitle")}
              </h3>
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                {t("studioLicence.newTenantTokenHint")}
              </p>
              <code
                style={{
                  display: "block",
                  padding: 12,
                  background: "var(--panel)",
                  borderRadius: 8,
                  marginBottom: 12,
                  wordBreak: "break-all",
                  fontSize: 12,
                }}
              >
                {newTenantToken}
              </code>
              <button
                type="button"
                className="btn"
                onClick={() => copyToClipboard(newTenantToken)}
              >
                {t("studioLicence.copyToken")}
              </button>
              <button
                type="button"
                className="btn"
                style={{ marginLeft: 8 }}
                onClick={() => setNewTenantToken(null)}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novi tenant */}
      {newTenantOpen && (
        <div
          className="studio-modal"
          style={overlayStyle()}
          onClick={() => !newTenantSaving && setNewTenantOpen(false)}
        >
          <div style={modalStyle(480)} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>
                {t("studioLicence.newTenantTitle")}
              </h3>
              <label style={{ display: "block", marginBottom: 4 }}>
                {t("studioLicence.labelNaziv")}
              </label>
              <input
                type="text"
                value={newTenantNaziv}
                onChange={(e) => setNewTenantNaziv(e.target.value)}
                placeholder={t("studioLicence.placeholderNaziv")}
                style={{
                  padding: 8,
                  marginBottom: 12,
                  width: "100%",
                  maxWidth: 320,
                }}
              />
              <label style={{ display: "block", marginBottom: 4 }}>
                {t("studioLicence.verzijaFluxe")}
              </label>
              <select
                value={newTenantPlanId}
                onChange={(e) => setNewTenantPlanId(Number(e.target.value))}
                style={{
                  padding: 8,
                  marginBottom: 12,
                  width: "100%",
                  maxWidth: 200,
                }}
              >
                {plans.map((p) => (
                  <option key={p.plan_id} value={p.plan_id}>
                    {p.naziv}
                  </option>
                ))}
              </select>
              <label style={{ display: "block", marginBottom: 4 }}>
                {t("studioLicence.brojKorisnika")}
              </label>
              <select
                value={newTenantMaxUsers}
                onChange={(e) => setNewTenantMaxUsers(Number(e.target.value))}
                style={{
                  padding: 8,
                  marginBottom: 12,
                  width: "100%",
                  maxWidth: 200,
                }}
              >
                {USER_LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n >= 101 ? t("studioLicence.users100Plus") : n}
                  </option>
                ))}
              </select>
              <label style={{ display: "block", marginBottom: 4 }}>
                {t("studioLicence.soccsNewTenantTier")}
              </label>
              <select
                value={newTenantSoccsTier}
                onChange={(e) => setNewTenantSoccsTier(e.target.value)}
                style={{
                  padding: 8,
                  marginBottom: 12,
                  width: "100%",
                  maxWidth: 280,
                }}
              >
                <option value="">—</option>
                {SOCCS_TIER_OPTIONS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
              <label style={{ display: "block", marginBottom: 4 }}>
                {t("studioLicence.labelStart")}
              </label>
              <input
                type="date"
                value={newTenantStart}
                onChange={(e) => setNewTenantStart(e.target.value)}
                style={{
                  padding: 8,
                  marginBottom: 12,
                  width: "100%",
                  maxWidth: 200,
                }}
              />
              <label style={{ display: "block", marginBottom: 4 }}>
                {t("studioLicence.labelEnd")}
              </label>
              <input
                type="date"
                value={newTenantEnd}
                onChange={(e) => setNewTenantEnd(e.target.value)}
                style={{
                  padding: 8,
                  marginBottom: 12,
                  width: "100%",
                  maxWidth: 200,
                }}
              />
              <label style={{ display: "block", marginBottom: 4 }}>
                {t("studioLicence.cijenaMjesečno")}
              </label>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={newTenantPrice}
                  onChange={(e) => setNewTenantPrice(e.target.value)}
                  placeholder="—"
                  style={{ padding: 8, width: 120 }}
                />
                <select
                  value={newTenantCurrency}
                  onChange={(e) => setNewTenantCurrency(e.target.value)}
                  style={{ padding: 8 }}
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={
                    newTenantSaving ||
                    !newTenantNaziv.trim() ||
                    !newTenantStart ||
                    !newTenantEnd
                  }
                  onClick={handleCreateTenant}
                >
                  {newTenantSaving ? t("common.loading") : t("common.save")}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={newTenantSaving}
                  onClick={() => setNewTenantOpen(false)}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal SOCCS / aktivacija */}
      {soccsModal && (
        <div
          className="studio-modal"
          style={overlayStyle()}
          onClick={() => !soccsSaving && !soccsGenBusy && setSoccsModal(null)}
        >
          <div style={modalStyle(560)} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24, maxHeight: "90vh", overflow: "auto" }}>
              <h3 style={{ marginTop: 0 }}>
                {t("studioLicence.soccsModalTitle")}
              </h3>
              <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>
                {soccsModal.naziv}
              </p>
              <label style={{ display: "block", marginBottom: 4 }}>
                {t("studioLicence.soccsPublicId")}
              </label>
              <code
                style={{
                  display: "block",
                  padding: 10,
                  background: "var(--panel)",
                  borderRadius: 8,
                  marginBottom: 12,
                  wordBreak: "break-all",
                  fontSize: 11,
                }}
              >
                {soccsModal.tenant_public_id || "—"}
              </code>
              <label style={{ display: "block", marginBottom: 4 }}>
                {t("studioLicence.soccsTierLabel")}
              </label>
              <select
                value={soccsTierDraft}
                onChange={(e) => setSoccsTierDraft(e.target.value)}
                style={{
                  padding: 8,
                  marginBottom: 12,
                  width: "100%",
                  maxWidth: 280,
                }}
              >
                <option value="">—</option>
                {SOCCS_TIER_OPTIONS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
              <label style={{ display: "block", marginBottom: 4 }}>
                {t("studioLicence.soccsFederationLabel")}
              </label>
              <p style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
                {t("studioLicence.soccsFederationHint")}
              </p>
              <select
                value={soccsFedDraft === "" ? "" : String(soccsFedDraft)}
                onChange={(e) => {
                  const v = e.target.value;
                  setSoccsFedDraft(v === "" ? "" : Number(v));
                }}
                style={{
                  padding: 8,
                  marginBottom: 12,
                  width: "100%",
                  maxWidth: 360,
                }}
              >
                <option value="">
                  {t("studioLicence.soccsFederationNone")}
                </option>
                {tenants
                  .filter((x) => x.tenant_id !== soccsModal.tenant_id)
                  .map((x) => (
                    <option key={x.tenant_id} value={x.tenant_id}>
                      {x.naziv} (#{x.tenant_id})
                    </option>
                  ))}
              </select>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <button
                  type="button"
                  className="btn"
                  disabled={soccsSaving}
                  onClick={handleSoccsSave}
                >
                  {soccsSaving
                    ? t("common.loading")
                    : t("studioLicence.soccsSaveTier")}
                </button>
              </div>
              <label style={{ display: "block", marginBottom: 4 }}>
                {t("studioLicence.soccsMeetRemainingSetLabel")}
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={soccsMeetTargetDraft}
                onChange={(e) => setSoccsMeetTargetDraft(e.target.value)}
                style={{
                  padding: 8,
                  marginBottom: 12,
                  width: "100%",
                  maxWidth: 220,
                }}
              />
              <p style={{ fontSize: 12, opacity: 0.85, marginTop: -4, marginBottom: 12 }}>
                {t("studioLicence.soccsMeetRemainingSetHint")}
              </p>
              <hr style={{ borderColor: "var(--border)", margin: "16px 0" }} />
              <label style={{ display: "block", marginBottom: 8 }}>
                {t("studioLicence.soccsGenerateFirst")}
              </label>
              <button
                type="button"
                className="btn"
                disabled={soccsGenBusy}
                style={{ marginBottom: 16 }}
                onClick={() => handleGenerateSoccsCode("FIRST_INSTALL")}
              >
                {soccsGenBusy
                  ? t("common.loading")
                  : t("studioLicence.soccsGenerateFirst")}
              </button>
              <label style={{ display: "block", marginBottom: 4 }}>
                {t("studioLicence.soccsGenerateMeet")}
              </label>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, opacity: 0.9 }}>
                {t("studioLicence.soccsMeetCountLabel")}
              </label>
              <input
                type="number"
                min={1}
                max={200}
                step={1}
                value={soccsMeetCountDraft}
                onChange={(e) => setSoccsMeetCountDraft(e.target.value)}
                style={{
                  padding: 8,
                  marginBottom: 8,
                  width: "100%",
                  maxWidth: 180,
                }}
              />
              <select
                value={soccsMeetSponsor === "" ? "" : String(soccsMeetSponsor)}
                onChange={(e) => {
                  const v = e.target.value;
                  setSoccsMeetSponsor(v === "" ? "" : Number(v));
                }}
                style={{
                  padding: 8,
                  marginBottom: 8,
                  width: "100%",
                  maxWidth: 360,
                }}
              >
                <option value="">{t("studioLicence.soccsMeetSponsor")}</option>
                {tenants
                  .filter((x) => x.tenant_id !== soccsModal.tenant_id)
                  .map((x) => (
                    <option key={x.tenant_id} value={x.tenant_id}>
                      {x.naziv} (#{x.tenant_id})
                    </option>
                  ))}
              </select>
              <input
                type="text"
                value={soccsMeetNote}
                onChange={(e) => setSoccsMeetNote(e.target.value)}
                placeholder={t("studioLicence.soccsMeetNote")}
                style={{
                  padding: 8,
                  marginBottom: 8,
                  width: "100%",
                  maxWidth: 400,
                }}
              />
              <button
                type="button"
                className="btn"
                disabled={soccsGenBusy}
                style={{ marginBottom: 16 }}
                onClick={() => handleGenerateSoccsCode("MEET_SESSION")}
              >
                {soccsGenBusy
                  ? t("common.loading")
                  : t("studioLicence.soccsGenerateMeet")}
              </button>
              {(soccsGenFirstInstallCode || soccsGenCode) && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 13, marginBottom: 10 }}>
                    {t("studioLicence.soccsCodeGenerated")}
                  </p>
                  {soccsGenFirstInstallCode ? (
                    <div style={{ marginBottom: soccsGenCode ? 14 : 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                        {t("studioLicence.soccsField1Label")}
                      </p>
                      <p style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
                        {t("studioLicence.soccsField1Hint")}
                      </p>
                      <code
                        style={{
                          display: "block",
                          padding: 12,
                          background: "var(--panel)",
                          borderRadius: 8,
                          marginBottom: 8,
                          wordBreak: "break-all",
                          fontSize: 12,
                        }}
                      >
                        {soccsGenFirstInstallCode}
                      </code>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => copyToClipboard(soccsGenFirstInstallCode)}
                      >
                        {t("studioLicence.copyToken")}
                      </button>
                    </div>
                  ) : null}
                  {soccsLastGenPurpose === "MEET_SESSION" &&
                  soccsGenCode &&
                  !soccsGenFirstInstallCode ? (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--destructive, #b91c1c)",
                        marginBottom: 10,
                      }}
                    >
                      {t("studioLicence.soccsMeetFirstInstallMissing")}
                    </p>
                  ) : null}
                  {soccsGenCode ? (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                        {t("studioLicence.soccsField2Label")}
                      </p>
                      <p style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
                        {t("studioLicence.soccsField2Hint")}
                      </p>
                      <code
                        style={{
                          display: "block",
                          padding: 12,
                          background: "var(--panel)",
                          borderRadius: 8,
                          marginBottom: 8,
                          wordBreak: "break-all",
                          fontSize: 12,
                        }}
                      >
                        {soccsGenCode}
                      </code>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => copyToClipboard(soccsGenCode)}
                      >
                        {t("studioLicence.copyToken")}
                      </button>
                      {soccsGenCodes.length > 1 && (
                        <button
                          type="button"
                          className="btn"
                          style={{ marginLeft: 8 }}
                          onClick={() =>
                            copyToClipboard(soccsGenCodes.join("\n"))
                          }
                        >
                          {t("studioLicence.soccsCopyAllGenerated")}
                        </button>
                      )}
                    </div>
                  ) : null}
                  {soccsGenFirstInstallCode && soccsGenCode ? (
                    <button
                      type="button"
                      className="btn"
                      style={{ marginTop: 12, display: "block" }}
                      onClick={() =>
                        copyToClipboard(
                          `${soccsGenFirstInstallCode}\n${soccsGenCode}`,
                        )
                      }
                    >
                      {t("studioLicence.soccsCopyBothFields")}
                    </button>
                  ) : null}
                </div>
              )}
              <p
                style={{
                  fontSize: 12,
                  opacity: 0.85,
                  marginTop: 16,
                  lineHeight: 1.45,
                }}
              >
                {t("studioLicence.soccsVerifyUrlHint")}
              </p>
              <button
                type="button"
                className="btn"
                style={{ marginTop: 12 }}
                onClick={() => setSoccsModal(null)}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Promijeni plan */}
      {planModalTenantId != null && planId !== null && (
        <div
          className="studio-modal"
          style={overlayStyle()}
          onClick={() =>
            !planSaving && (setPlanModalTenantId(null), setPlanId(null))
          }
        >
          <div style={modalStyle(420)} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>
                {t("studioLicence.changePlanTitle")}
              </h3>
              <label style={{ display: "block", marginBottom: 8 }}>
                {t("studioLicence.verzijaFluxe")}
              </label>
              <select
                value={planId ?? ""}
                onChange={(e) => setPlanId(Number(e.target.value))}
                style={{
                  padding: 8,
                  marginBottom: 12,
                  width: "100%",
                  maxWidth: 200,
                }}
              >
                {plans.map((p) => (
                  <option key={p.plan_id} value={p.plan_id}>
                    {p.naziv}
                  </option>
                ))}
              </select>
              <label style={{ display: "block", marginBottom: 8 }}>
                {t("studioLicence.brojKorisnika")}
              </label>
              <select
                value={planMaxUsers}
                onChange={(e) => setPlanMaxUsers(Number(e.target.value))}
                style={{
                  padding: 8,
                  marginBottom: 16,
                  width: "100%",
                  maxWidth: 200,
                }}
              >
                {USER_LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n >= 101 ? t("studioLicence.users100Plus") : n}
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
                  onClick={() => {
                    setPlanModalTenantId(null);
                    setPlanId(null);
                  }}
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

function overlayStyle(): CSSProperties {
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

function modalStyle(maxW = 420): CSSProperties {
  return {
    width: "min(100%, " + maxW + "px)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    boxShadow: "var(--shadow)",
    overflow: "hidden",
  };
}
