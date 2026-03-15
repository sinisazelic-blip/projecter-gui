"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import type { RoleRow } from "./page";
import { createRole, updateRole } from "./actions";

type FormState = {
  role_id?: number;
  naziv: string;
  nivo_ovlastenja: string;
  opis: string;
  created_at?: string | null;
  updated_at?: string | null;
};

const emptyForm = (): FormState => ({
  naziv: "",
  nivo_ovlastenja: "0",
  opis: "",
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

function modalStyle(maxWidth = 720): React.CSSProperties {
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

export default function RolesClient({
  initialItems,
}: {
  initialItems: RoleRow[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"new" | "edit">("new");
  const [form, setForm] = useState<FormState>(emptyForm());

  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<RoleRow[]>(initialItems ?? []);

  useEffect(() => {
    setItems(initialItems ?? []);
  }, [initialItems]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((it) => {
      const hay = [it.naziv, it.opis ?? ""].join(" ").toLowerCase();
      return hay.includes(qq);
    });
  }, [items, q]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return (
      items.find((x) => Number(x.role_id) === Number(selectedId)) ?? null
    );
  }, [items, selectedId]);

  function loadToForm(it: RoleRow) {
    setForm({
      role_id: it.role_id,
      naziv: it.naziv ?? "",
      nivo_ovlastenja: String(it.nivo_ovlastenja ?? 0),
      opis: it.opis ?? "",
      created_at: it.created_at,
      updated_at: it.updated_at,
    });
  }

  const editIndex = useMemo(() => {
    if (!selectedId) return -1;
    return filtered.findIndex(
      (x) => Number(x.role_id) === Number(selectedId),
    );
  }, [filtered, selectedId]);

  const canPrev = modalMode === "edit" && editIndex > 0;
  const canNext =
    modalMode === "edit" && editIndex >= 0 && editIndex < filtered.length - 1;

  function goPrev() {
    if (!canPrev) return;
    const it = filtered[editIndex - 1];
    setSelectedId(it.role_id);
    loadToForm(it);
  }

  function goNext() {
    if (!canNext) return;
    const it = filtered[editIndex + 1];
    setSelectedId(it.role_id);
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

  function openEditForItem(it: RoleRow) {
    setError(null);
    setSelectedId(it.role_id);
    setModalMode("edit");
    loadToForm(it);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
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

    const payload = {
      naziv: form.naziv,
      nivo_ovlastenja: form.nivo_ovlastenja,
      opis: form.opis || null,
    };

    startTransition(async () => {
      try {
        if (modalMode === "new") {
          await createRole(payload);
        } else {
          if (!form.role_id) throw new Error(t("studioRoles.errorMissingId"));
          const result = await updateRole({ role_id: form.role_id, ...payload });
          if (result?.created_at != null || result?.updated_at != null) {
            setForm((prev) => ({
              ...prev,
              created_at: result.created_at ?? prev.created_at,
              updated_at: result.updated_at ?? prev.updated_at,
            }));
            setItems((prev) =>
              prev.map((it) =>
                Number(it.role_id) === Number(form.role_id)
                  ? {
                      ...it,
                      created_at: result.created_at ?? it.created_at,
                      updated_at: result.updated_at ?? it.updated_at,
                    }
                  : it,
              ),
            );
          }
        }
        setModalOpen(false);
        setSelectedId(null);
        router.refresh();
      } catch (e: any) {
        setError(e?.message || t("studioRoles.errorSave"));
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
              {t("studioRoles.title")}
            </h1>
          </div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
            {t("studioRoles.hintClick")} <b>{t("studioRoles.change")}</b>.
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
            <span style={{ marginRight: 6 }}>➕</span> {t("studioRoles.new")}
          </button>

          <button
            className="btn"
            onClick={openEdit}
            disabled={!selectedItem || isPending}
            style={btnDisabled(!selectedItem || isPending)}
            title={!selectedItem ? t("studioRoles.selectFirst") : t("studioRoles.change")}
          >
            <span style={{ marginRight: 6 }}>✏️</span> {t("studioRoles.change")}
          </button>

          <button className="btn" onClick={onClosePage}>
            <span style={{ marginRight: 6 }}>✖</span> {t("studioRoles.close")}
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
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("studioRoles.searchPlaceholder")}
            style={{ width: 360, maxWidth: "100%" }}
          />

          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            {t("studioRoles.totalCount")} <b style={{ color: "var(--text)" }}>{items.length}</b>
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
              <th>{t("studioRoles.colNaziv")}</th>
              <th className="num">{t("studioRoles.colNivoOvlastenja")}</th>
              <th>{t("studioRoles.colOpis")}</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ color: "var(--muted)", padding: 16 }}>
                  {t("studioRoles.noItems")}
                </td>
              </tr>
            ) : (
              filtered.map((it) => {
                const isSelected = Number(selectedId) === Number(it.role_id);

                return (
                  <tr
                    key={it.role_id}
                    onClick={() => setSelectedId(it.role_id)}
                    onDoubleClick={() => openEditForItem(it)}
                    style={subtleRowStyle(isSelected)}
                    title={t("studioRoles.rowTitle")}
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
                        <span style={{ fontWeight: 700 }}>{it.naziv}</span>
                      </div>
                    </td>

                    <td
                      className="num"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {Number(it.nivo_ovlastenja ?? 0)}
                    </td>

                    <td
                      style={{
                        color: it.opis ? "var(--text)" : "var(--muted)",
                        maxWidth: 400,
                      }}
                    >
                      {it.opis ? (
                        <span
                          style={{
                            display: "inline-block",
                            maxWidth: 400,
                            whiteSpace: "normal",
                          }}
                        >
                          {it.opis}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
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
          <div style={modalStyle(720)}>
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
                      ? t("studioRoles.modalNew")
                      : t("studioRoles.modalEdit")}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--muted)",
                      fontSize: 15,
                    }}
                  >
                    {t("studioRoles.modalSubtitle")}
                  </div>
                </div>
              </div>
              <button className="btn" onClick={closeModal}>
                ✖
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 16,
                }}
              >
                <div style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    {t("studioRoles.labelNaziv")}
                  </div>
                  <input
                    value={form.naziv}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, naziv: e.target.value }))
                    }
                    placeholder={t("studioRoles.placeholderNaziv")}
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
                    {t("studioRoles.labelNivoOvlastenja")}
                  </div>
                  <input
                    type="number"
                    value={form.nivo_ovlastenja}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        nivo_ovlastenja: e.target.value,
                      }))
                    }
                    placeholder={t("studioRoles.placeholderNivo")}
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    {t("studioRoles.labelOpis")}
                  </div>
                  <textarea
                    value={form.opis}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, opis: e.target.value }))
                    }
                    placeholder={t("studioRoles.placeholderOpis")}
                    className="input"
                    style={{
                      width: "100%",
                      minHeight: 88,
                      resize: "vertical",
                      padding: "12px 14px",
                      fontSize: 15,
                    }}
                  />
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
                  {t("studioRoles.system")}
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
                      {t("studioRoles.id")}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {form.role_id ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 14 }}>
                      {t("studioRoles.created")}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {form.created_at ? fmtDateTime(form.created_at) : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 14 }}>
                      {t("studioRoles.updated")}
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
                    title={t("studioRoles.prev")}
                  >
                    ◀
                  </button>
                  <button
                    className="btn"
                    onClick={goNext}
                    disabled={isPending || !canNext}
                    style={btnDisabled(isPending || !canNext)}
                    title={t("studioRoles.next")}
                  >
                    ▶
                  </button>
                </div>
              ) : null}

              <button
                className="btn"
                onClick={closeModal}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {t("studioRoles.cancel")}
              </button>
              <button
                className="btn btn--active"
                onClick={onSave}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {isPending ? t("studioRoles.saving") : t("studioRoles.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
