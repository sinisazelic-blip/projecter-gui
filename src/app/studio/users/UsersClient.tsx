"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import type { UserRow, RoleOption, RadnikOption } from "./page";
import { createUser, setUserActive, updateUser } from "./actions";

type FormState = {
  user_id?: number;
  username: string;
  password: string;
  role_id: string;
  radnik_id: string;
  aktivan: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

const emptyForm = (): FormState => ({
  username: "",
  password: "",
  role_id: "",
  radnik_id: "",
  aktivan: true,
});

const fmtDateTime = (dt: string | null | undefined) => {
  if (!dt) return "—";
  const s = String(dt).replace("T", " ");
  const date = s.slice(0, 10);
  const time = s.slice(11, 16);
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return "—";
  return time && time !== "00:00" ? `${d}.${m}.${y} ${time}` : `${d}.${m}.${y}`;
};

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

function modalStyle(maxWidth = 640): React.CSSProperties {
  return {
    width: "min(100%, " + maxWidth + "px)",
    border: "1px solid var(--border)",
    borderRadius: "16px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    boxShadow: "var(--shadow)",
    overflow: "hidden",
    fontSize: 16,
  };
}

function topbarStyle(): React.CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: "16px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    boxShadow: "var(--shadow)",
    padding: 16,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  };
}

function subtleRowStyle(selected: boolean): React.CSSProperties {
  if (!selected) return {};
  return { background: "rgba(125, 211, 252, 0.10)" };
}

const tableScrollWrapStyle: React.CSSProperties = {
  marginTop: 14,
  flex: 1,
  overflow: "auto",
  borderRadius: 16,
};

export default function UsersClient({
  initialItems,
  roles = [],
  radnici = [],
}: {
  initialItems: UserRow[];
  roles: RoleOption[];
  radnici: RadnikOption[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"new" | "edit">("new");
  const [form, setForm] = useState<FormState>(emptyForm());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = initialItems ?? [];

  const counts = useMemo(() => {
    const total = items.length;
    const active = items.filter((x) => Number(x.aktivan) === 1).length;
    return { total, active };
  }, [items]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return items.filter((it) => {
      if (!showInactive && Number(it.aktivan) !== 1) return false;
      if (!qq) return true;

      const hay = [
        it.username,
        it.role_naziv ?? "",
        it.radnik_ime_prezime ?? "",
      ].join(" ").toLowerCase();
      return hay.includes(qq);
    });
  }, [items, q, showInactive]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return (
      items.find((x) => Number(x.user_id) === Number(selectedId)) ?? null
    );
  }, [items, selectedId]);

  const selectedIsActive = selectedItem
    ? Number(selectedItem.aktivan) === 1
    : false;

  function badgeStatus(active: boolean) {
    return (
      <span className="badge" data-status={active ? "active" : "closed"}>
        {active ? t("studioUsers.statusActive") : t("studioUsers.statusInactive")}
      </span>
    );
  }

  function loadToForm(it: UserRow) {
    setForm({
      user_id: it.user_id,
      username: it.username ?? "",
      password: "",
      role_id: it.role_id ? String(it.role_id) : "",
      radnik_id: it.radnik_id != null ? String(it.radnik_id) : "",
      aktivan: Number(it.aktivan) === 1,
      created_at: it.created_at,
      updated_at: it.updated_at,
    });
  }

  const editIndex = useMemo(() => {
    if (!selectedId) return -1;
    return filtered.findIndex(
      (x) => Number(x.user_id) === Number(selectedId),
    );
  }, [filtered, selectedId]);

  const canPrev = modalMode === "edit" && editIndex > 0;
  const canNext =
    modalMode === "edit" && editIndex >= 0 && editIndex < filtered.length - 1;

  function goPrev() {
    if (!canPrev) return;
    const it = filtered[editIndex - 1];
    setSelectedId(it.user_id);
    loadToForm(it);
  }

  function goNext() {
    if (!canNext) return;
    const it = filtered[editIndex + 1];
    setSelectedId(it.user_id);
    loadToForm(it);
  }

  function openNew() {
    setError(null);
    setSelectedId(null);
    setModalMode("new");
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit() {
    if (!selectedItem) return;
    setError(null);
    setModalMode("edit");
    loadToForm(selectedItem);
    setModalOpen(true);
  }

  function openEditForItem(it: UserRow) {
    setError(null);
    setSelectedId(it.user_id);
    setModalMode("edit");
    loadToForm(it);
    setModalOpen(true);
  }

  function openConfirmToggle() {
    if (!selectedItem) return;
    setError(null);
    setConfirmOpen(true);
  }

  function closeAllModals() {
    setModalOpen(false);
    setConfirmOpen(false);
  }

  function onClosePage() {
    try {
      if (window.history.length > 1) router.back();
      else router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    }
  }

  const btnDisabled = (cond: boolean) =>
    cond ? { opacity: 0.45, cursor: "not-allowed" as const } : {};

  async function onSave() {
    setError(null);

    startTransition(async () => {
      try {
        if (modalMode === "new") {
          if (!form.password.trim())
            throw new Error(t("studioUsers.errorPasswordRequired"));
          await createUser({
            username: form.username,
            password: form.password,
            role_id: form.role_id ? Number(form.role_id) : null,
            radnik_id: form.radnik_id ? Number(form.radnik_id) : null,
            aktivan: form.aktivan,
          });
        } else {
          if (!form.user_id) throw new Error(t("studioUsers.errorMissingId"));
          await updateUser({
            user_id: form.user_id,
            username: form.username,
            password: form.password.trim() ? form.password : undefined,
            role_id: form.role_id ? Number(form.role_id) : null,
            radnik_id: form.radnik_id ? Number(form.radnik_id) : null,
            aktivan: form.aktivan,
          });
        }
        setModalOpen(false);
        setSelectedId(null);
        router.refresh();
      } catch (e: any) {
        setError(e?.message || t("studioUsers.errorSave"));
      }
    });
  }

  async function onToggleActiveConfirmed() {
    if (!selectedItem) return;
    const nextActive = Number(selectedItem.aktivan) !== 1;

    startTransition(async () => {
      try {
        await setUserActive({
          user_id: selectedItem.user_id,
          aktivan: nextActive,
        });
        setConfirmOpen(false);
        setSelectedId(null);
        router.refresh();
      } catch (e: any) {
        setError(e?.message || t("studioUsers.errorToggle"));
      }
    });
  }

  return (
    <div className="container" style={{ height: "calc(100vh - 24px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={topbarStyle()}>
        <div style={{ minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              {t("studioUsers.title")}
            </h1>
          </div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
            {t("studioUsers.hintClick")} <b>{t("studioUsers.change")}</b> /{" "}
            <b>{t("studioUsers.delete")}</b>.{" "}
            <span style={{ opacity: 0.9 }}>{t("studioUsers.hintDelete")}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <button
            className="btn"
            onClick={openNew}
            disabled={isPending}
            style={btnDisabled(isPending)}
          >
            <span style={{ marginRight: 6 }}>➕</span> {t("studioUsers.new")}
          </button>

          <button
            className="btn"
            onClick={openEdit}
            disabled={!selectedItem || isPending}
            style={btnDisabled(!selectedItem || isPending)}
            title={!selectedItem ? t("studioUsers.selectFirst") : t("studioUsers.change")}
          >
            <span style={{ marginRight: 6 }}>✏️</span> {t("studioUsers.change")}
          </button>

          <button
            className="btn"
            onClick={openConfirmToggle}
            disabled={!selectedItem || isPending}
            style={btnDisabled(!selectedItem || isPending)}
            title={
              !selectedItem
                ? t("studioUsers.selectFirst")
                : selectedIsActive
                  ? t("studioUsers.deactivate")
                  : t("studioUsers.activate")
            }
          >
            <span style={{ marginRight: 6 }}>
              {selectedIsActive ? "🗑️" : "✅"}
            </span>
            {selectedIsActive ? t("studioUsers.delete") : t("studioUsers.activate")}
          </button>

          <button className="btn" onClick={onClosePage}>
            <span style={{ marginRight: 6 }}>✖</span> {t("studioUsers.close")}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("studioUsers.searchPlaceholder")}
              style={{ width: 320, maxWidth: "100%" }}
            />

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "var(--muted)",
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              {t("studioUsers.showInactive")}
            </label>
          </div>

          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            {showInactive ? (
              <>
                {t("studioUsers.activeCount")} <b style={{ color: "var(--text)" }}>{counts.active}</b>{" "}
                / {t("studioUsers.totalCount")} <b style={{ color: "var(--text)" }}>{counts.total}</b>
              </>
            ) : (
              <>
                {t("studioUsers.activeCount")} <b style={{ color: "var(--text)" }}>{counts.active}</b>
              </>
            )}
          </div>
        </div>

        {error ? (
          <div
            style={{
              marginTop: 12,
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.10)",
              borderRadius: 12,
              padding: "10px 12px",
              color: "rgba(254,202,202,.95)",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : null}
      </div>

      <div style={tableScrollWrapStyle}>
        <table className="table">
          <thead>
            <tr>
              <th>{t("studioUsers.colUser")}</th>
              <th>{t("studioUsers.colRole")}</th>
              <th>{t("studioUsers.colRadnik")}</th>
              <th>{t("studioUsers.colStatus")}</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: "var(--muted)", padding: 16 }}>
                  {t("studioUsers.noItems")}
                </td>
              </tr>
            ) : (
              filtered.map((it) => {
                const isSelected = Number(selectedId) === Number(it.user_id);
                const isActive = Number(it.aktivan) === 1;

                return (
                  <tr
                    key={it.user_id}
                    onClick={() => setSelectedId(it.user_id)}
                    onDoubleClick={() => openEditForItem(it)}
                    style={subtleRowStyle(isSelected)}
                    data-closed={isActive ? "0" : "1"}
                    title={t("studioUsers.rowTitle")}
                  >
                    <td className="cell-wrap">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: isSelected
                              ? "var(--accent)"
                              : "rgba(255,255,255,0.12)",
                            boxShadow: isSelected
                              ? "0 0 0 3px rgba(125,211,252,0.12)"
                              : "none",
                          }}
                        />
                        <span style={{ fontWeight: 700 }}>{it.username}</span>
                      </div>
                    </td>

                    <td
                      style={{
                        color: it.role_naziv ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {it.role_naziv || "—"}
                    </td>

                    <td
                      style={{
                        color: it.radnik_ime_prezime
                          ? "var(--text)"
                          : "var(--muted)",
                      }}
                    >
                      {it.radnik_ime_prezime || "—"}
                    </td>

                    <td>{badgeStatus(isActive)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: New/Edit */}
      {modalOpen ? (
        <div style={overlayStyle()} role="dialog" aria-modal="true">
          <div style={modalStyle(640)}>
            <div
              style={{
                padding: 20,
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div
                style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <img
                  src="/fluxa/Ikona%20Siva.png"
                  alt="Fluxa"
                  style={{
                    width: 26,
                    height: 26,
                    objectFit: "contain",
                    opacity: 0.9,
                    marginTop: 2,
                  }}
                />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {modalMode === "new"
                      ? t("studioUsers.modalNew")
                      : t("studioUsers.modalEdit")}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--muted)",
                      fontSize: 15,
                    }}
                  >
                    {modalMode === "edit"
                      ? t("studioUsers.modalSubtitleEdit")
                      : t("studioUsers.modalSubtitleNew")}
                  </div>
                </div>
              </div>
              <button className="btn" onClick={closeAllModals}>
                ✖
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    {t("studioUsers.labelUsername")}
                  </div>
                  <input
                    value={form.username}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, username: e.target.value }))
                    }
                    placeholder={t("studioUsers.placeholderUsername")}
                    autoFocus
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  />
                </div>

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    {t("studioUsers.labelPassword")}
                    {modalMode === "edit" && (
                      <span style={{ marginLeft: 8, fontWeight: 400 }}>
                        {t("studioUsers.passwordLeaveEmpty")}
                      </span>
                    )}
                    {modalMode === "new" && (
                      <span style={{ marginLeft: 8, fontWeight: 400 }}>
                        {t("studioUsers.passwordRequired")}
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, password: e.target.value }))
                    }
                    placeholder={modalMode === "edit" ? t("studioUsers.placeholderPasswordEdit") : t("studioUsers.placeholderPasswordNew")}
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  />
                </div>

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    {t("studioUsers.labelRole")}
                  </div>
                  <select
                    value={form.role_id}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, role_id: e.target.value }))
                    }
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  >
                    <option value="">{t("studioUsers.roleNone")}</option>
                    {roles.map((r) => (
                      <option key={r.role_id} value={r.role_id}>
                        {r.naziv}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    {t("studioUsers.labelRadnik")}
                  </div>
                  <select
                    value={form.radnik_id}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, radnik_id: e.target.value }))
                    }
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                    title={t("studioUsers.radnikTitle")}
                  >
                    <option value="">{t("studioUsers.radnikNone")}</option>
                    {radnici.map((rad) => (
                      <option key={rad.radnik_id} value={rad.radnik_id}>
                        {rad.prezime} {rad.ime}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.aktivan}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, aktivan: e.target.checked }))
                    }
                    style={{ width: 18, height: 18 }}
                  />
                  <span
                    style={{
                      color: "var(--text)",
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    {t("studioUsers.labelActive")}
                  </span>
                </div>
              </div>

              <div className="card" style={{ marginTop: 20 }}>
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: 13,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  {t("studioUsers.system")}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 14,
                  }}
                >
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 14 }}>
                      {t("studioUsers.id")}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {form.user_id ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 14 }}>
                      {t("studioUsers.created")}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {form.created_at ? fmtDateTime(form.created_at) : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 14 }}>
                      {t("studioUsers.updated")}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {form.updated_at ? fmtDateTime(form.updated_at) : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 20,
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
              {modalMode === "edit" ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginRight: 8,
                  }}
                >
                  <button
                    className="btn"
                    onClick={goPrev}
                    disabled={isPending || !canPrev}
                    style={btnDisabled(isPending || !canPrev)}
                    title={t("studioUsers.prev")}
                  >
                    ◀
                  </button>
                  <button
                    className="btn"
                    onClick={goNext}
                    disabled={isPending || !canNext}
                    style={btnDisabled(isPending || !canNext)}
                    title={t("studioUsers.next")}
                  >
                    ▶
                  </button>
                </div>
              ) : null}

              <button
                className="btn"
                onClick={closeAllModals}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {t("studioUsers.cancel")}
              </button>
              <button
                className="btn btn--active"
                onClick={onSave}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {isPending ? t("studioUsers.saving") : t("studioUsers.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm: deactivate/activate */}
      {confirmOpen && selectedItem ? (
        <div style={overlayStyle()} role="dialog" aria-modal="true">
          <div style={modalStyle(640)}>
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {selectedIsActive
                    ? t("studioUsers.confirmDeactivateTitle")
                    : t("studioUsers.confirmActivateTitle")}
                </div>
                <div
                  style={{ marginTop: 4, color: "var(--muted)", fontSize: 14 }}
                >
                  <b style={{ color: "var(--text)" }}>
                    {selectedItem.username}
                  </b>
                </div>
              </div>
              <button className="btn" onClick={closeAllModals}>
                ✖
              </button>
            </div>

            <div
              style={{
                padding: 16,
                color: "var(--text)",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {selectedIsActive
                ? t("studioUsers.confirmDeactivateBody")
                : t("studioUsers.confirmActivateBody")}
            </div>

            <div
              style={{
                padding: 16,
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                className="btn"
                onClick={closeAllModals}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {t("studioUsers.cancel")}
              </button>
              <button
                className="btn btn--active"
                onClick={onToggleActiveConfirmed}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {isPending
                  ? t("studioUsers.confirmWorking")
                  : selectedIsActive
                    ? t("studioUsers.deactivate")
                    : t("studioUsers.activate")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
