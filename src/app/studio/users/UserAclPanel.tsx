"use client";

import { useEffect, useState } from "react";
import {
  ACL_MODULES,
  ACL_TEMPLATE_RACUNOVODSTVO,
  type AclAccess,
  type UserAclMap,
} from "@/lib/auth/acl-catalog";
import { useTranslation } from "@/components/LocaleProvider";

const ACCESS_OPTS: AclAccess[] = ["none", "view", "edit"];

function emptyAcl(): UserAclMap {
  const m: UserAclMap = {};
  for (const mod of ACL_MODULES) m[mod.key] = "none";
  return m;
}

export default function UserAclPanel({
  userId,
  locale = "sr",
}: {
  userId: number;
  locale?: string;
}) {
  const { t } = useTranslation();
  const [acl, setAcl] = useState<UserAclMap>(emptyAcl);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMsg(null);
    fetch(`/api/studio/users/${userId}/acl`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && data.acl && Object.keys(data.acl).length) {
          const next = emptyAcl();
          for (const [k, v] of Object.entries(data.acl)) {
            if (v === "view" || v === "edit" || v === "none") next[k] = v;
          }
          setAcl(next);
          setConfigured(true);
        } else {
          setAcl(emptyAcl());
          setConfigured(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAcl(emptyAcl());
          setConfigured(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/studio/users/${userId}/acl`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acl }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Save failed");
      setConfigured(true);
      setMsg(t("studioUsers.aclSaved"));
    } catch (e: any) {
      setMsg(e?.message || t("studioUsers.aclSaveError"));
    } finally {
      setSaving(false);
    }
  }

  async function clearAcl() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/studio/users/${userId}/acl`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acl: {} }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Clear failed");
      setAcl(emptyAcl());
      setConfigured(false);
      setMsg(t("studioUsers.aclCleared"));
    } catch (e: any) {
      setMsg(e?.message || t("studioUsers.aclSaveError"));
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate() {
    const next = emptyAcl();
    for (const [k, v] of Object.entries(ACL_TEMPLATE_RACUNOVODSTVO)) {
      next[k] = v;
    }
    setAcl(next);
  }

  const groups = [
    { id: "desk", label: t("studioUsers.aclGroupDesk") },
    { id: "finance", label: t("studioUsers.aclGroupFinance") },
    { id: "reports", label: t("studioUsers.aclGroupReports") },
    { id: "master", label: t("studioUsers.aclGroupMaster") },
    { id: "system", label: t("studioUsers.aclGroupSystem") },
  ] as const;

  if (loading) {
    return (
      <div style={{ padding: 12, color: "var(--muted)" }}>…</div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              color: "var(--muted)",
              fontSize: 13,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {t("studioUsers.aclTitle")}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.4 }}>
            {configured
              ? t("studioUsers.aclConfiguredHint")
              : t("studioUsers.aclNotConfiguredHint")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={applyTemplate} disabled={saving}>
            {t("studioUsers.aclTemplateAccounting")}
          </button>
          <button type="button" className="btn" onClick={clearAcl} disabled={saving}>
            {t("studioUsers.aclUseRoleMatrix")}
          </button>
          <button
            type="button"
            className="btn"
            onClick={save}
            disabled={saving}
            style={{ fontWeight: 700 }}
          >
            {saving ? "…" : t("studioUsers.aclSave")}
          </button>
        </div>
      </div>

      {msg ? (
        <div style={{ marginBottom: 10, fontSize: 13, color: "var(--muted)" }}>{msg}</div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {groups.map((g) => {
          const mods = ACL_MODULES.filter((m) => m.group === g.id);
          if (!mods.length) return null;
          return (
            <div key={g.id}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--muted)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {g.label}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "6px 12px",
                  alignItems: "center",
                }}
              >
                {mods.map((m) => (
                  <div key={m.key} style={{ display: "contents" }}>
                    <div style={{ fontSize: 14 }}>
                      {locale === "en" ? m.labelEn : m.labelSr}
                      {m.ownerOnlyDefault ? (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "var(--muted)" }}>
                          ({t("studioUsers.aclOwnerOnlyHint")})
                        </span>
                      ) : null}
                    </div>
                    <select
                      className="input"
                      value={acl[m.key] ?? "none"}
                      onChange={(e) =>
                        setAcl((s) => ({
                          ...s,
                          [m.key]: e.target.value as AclAccess,
                        }))
                      }
                      style={{ padding: "6px 10px", fontSize: 13, minWidth: 120 }}
                    >
                      {ACCESS_OPTS.map((a) => (
                        <option key={a} value={a}>
                          {t(`studioUsers.aclAccess.${a}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
