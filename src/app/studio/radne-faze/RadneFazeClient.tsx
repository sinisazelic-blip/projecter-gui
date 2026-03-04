"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RadnaFazaRow } from "./page";
import { createRadnaFaza, updateRadnaFaza } from "./actions";
import { useTranslation } from "@/components/LocaleProvider";

type FormState = {
  faza_id?: number;
  naziv: string;
  opis_poslova: string;
  slozenost_posla: string;
  vrsta_posla: string;
  created_at?: string | null;
  updated_at?: string | null;
};

const emptyForm = (): FormState => ({
  naziv: "",
  opis_poslova: "",
  slozenost_posla: "",
  vrsta_posla: "",
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

function modalStyle(maxWidth = 920): React.CSSProperties {
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

const pageTitleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

export default function RadneFazeClient({
  initialItems,
}: {
  initialItems: RadnaFazaRow[];
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"new" | "edit">("new");
  const [form, setForm] = useState<FormState>(emptyForm());

  const [error, setError] = useState<string | null>(null);

  const items = initialItems ?? [];

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((it) => {
      const hay = [
        it.naziv,
        it.opis_poslova ?? "",
        it.slozenost_posla ?? "",
        it.vrsta_posla ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(qq);
    });
  }, [items, q]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return (
      items.find((x) => Number(x.faza_id) === Number(selectedId)) ?? null
    );
  }, [items, selectedId]);

  function loadToForm(it: RadnaFazaRow) {
    setForm({
      faza_id: it.faza_id,
      naziv: it.naziv ?? "",
      opis_poslova: it.opis_poslova ?? "",
      slozenost_posla: it.slozenost_posla ?? "",
      vrsta_posla: it.vrsta_posla ?? "",
      created_at: it.created_at,
      updated_at: it.updated_at,
    });
  }

  const editIndex = useMemo(() => {
    if (!selectedId) return -1;
    return filtered.findIndex(
      (x) => Number(x.faza_id) === Number(selectedId),
    );
  }, [filtered, selectedId]);

  const canPrev = modalMode === "edit" && editIndex > 0;
  const canNext =
    modalMode === "edit" && editIndex >= 0 && editIndex < filtered.length - 1;

  function goPrev() {
    if (!canPrev) return;
    const it = filtered[editIndex - 1];
    setSelectedId(it.faza_id);
    loadToForm(it);
  }

  function goNext() {
    if (!canNext) return;
    const it = filtered[editIndex + 1];
    setSelectedId(it.faza_id);
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

  function openEditForItem(it: RadnaFazaRow) {
    setError(null);
    setSelectedId(it.faza_id);
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
      opis_poslova: form.opis_poslova || null,
      slozenost_posla: form.slozenost_posla || null,
      vrsta_posla: form.vrsta_posla || null,
    };

    startTransition(async () => {
      try {
        if (modalMode === "new") {
          await createRadnaFaza(payload);
        } else {
          if (!form.faza_id) throw new Error("Nedostaje ID za izmjenu.");
          await updateRadnaFaza({ faza_id: form.faza_id, ...payload });
        }
        setModalOpen(false);
        setSelectedId(null);
        router.refresh();
      } catch (e: any) {
        setError(e?.message || "Greška pri snimanju.");
      }
    });
  }

  return (
    <div className="container" style={{ height: "calc(100vh - 24px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={topbarStyle()}>
        <div style={{ minWidth: 280 }}>
          <div style={pageTitleRowStyle}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              {t("studioRadneFaze.title")}
            </h1>
          </div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
            {t("studioRadneFaze.hintClick")} <b>{t("studioRadneFaze.change")}</b>.
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
            <span style={{ marginRight: 6 }}>➕</span> {t("studioRadneFaze.new")}
          </button>

          <button
            className="btn"
            onClick={openEdit}
            disabled={!selectedItem || isPending}
            style={btnDisabled(!selectedItem || isPending)}
            title={!selectedItem ? t("studioRadneFaze.selectFirst") : t("studioRadneFaze.change")}
          >
            <span style={{ marginRight: 6 }}>✏️</span> {t("studioRadneFaze.change")}
          </button>

          <button className="btn" onClick={onClosePage}>
            <span style={{ marginRight: 6 }}>✖</span> {t("studioRadneFaze.close")}
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
            placeholder={t("studioRadneFaze.searchPlaceholder")}
            style={{ width: 420, maxWidth: "100%" }}
          />

          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            {t("studioRadneFaze.totalCount")}: <b style={{ color: "var(--text)" }}>{items.length}</b>
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
              <th>{t("studioRadneFaze.colNaziv")}</th>
              <th>{t("studioRadneFaze.colOpisPoslova")}</th>
              <th>{t("studioRadneFaze.colSlozenostPosla")}</th>
              <th>{t("studioRadneFaze.colVrstaPosla")}</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: "var(--muted)", padding: 16 }}>
                  {t("studioRadneFaze.noItems")}
                </td>
              </tr>
            ) : (
              filtered.map((it) => {
                const isSelected = Number(selectedId) === Number(it.faza_id);

                return (
                  <tr
                    key={it.faza_id}
                    onClick={() => setSelectedId(it.faza_id)}
                    onDoubleClick={() => openEditForItem(it)}
                    style={subtleRowStyle(isSelected)}
                    title={t("studioRadneFaze.rowTitle")}
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
                      style={{
                        color: it.opis_poslova ? "var(--text)" : "var(--muted)",
                        maxWidth: 320,
                      }}
                    >
                      {it.opis_poslova ? (
                        <span
                          style={{
                            display: "inline-block",
                            maxWidth: 320,
                            whiteSpace: "normal",
                          }}
                        >
                          {it.opis_poslova}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td
                      style={{
                        color: it.slozenost_posla ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {it.slozenost_posla || "—"}
                    </td>

                    <td
                      style={{
                        color: it.vrsta_posla ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {it.vrsta_posla || "—"}
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
          <div style={modalStyle(920)}>
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
                      ? t("studioRadneFaze.modalNew")
                      : t("studioRadneFaze.modalEdit")}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--muted)",
                      fontSize: 15,
                    }}
                  >
                    {t("studioRadneFaze.modalSubtitle")}
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
                    {t("studioRadneFaze.labelNaziv")}
                  </div>
                  <input
                    value={form.naziv}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, naziv: e.target.value }))
                    }
                    placeholder={t("studioRadneFaze.placeholderNaziv")}
                    autoFocus
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
                    {t("studioRadneFaze.labelOpisPoslova")}
                  </div>
                  <textarea
                    value={form.opis_poslova}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, opis_poslova: e.target.value }))
                    }
                    placeholder={t("studioRadneFaze.placeholderOpisPoslova")}
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

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    {t("studioRadneFaze.labelSlozenostPosla")}
                  </div>
                  <input
                    value={form.slozenost_posla}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        slozenost_posla: e.target.value,
                      }))
                    }
                    placeholder={t("studioRadneFaze.placeholderSlozenostPosla")}
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
                    {t("studioRadneFaze.labelVrstaPosla")}
                  </div>
                  <input
                    value={form.vrsta_posla}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, vrsta_posla: e.target.value }))
                    }
                    placeholder={t("studioRadneFaze.placeholderVrstaPosla")}
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
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
                  {t("studioRadneFaze.system")}
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
                      {t("studioRadneFaze.id")}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {form.faza_id ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 14 }}>
                      {t("studioRadneFaze.created")}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {form.created_at ? fmtDateTime(form.created_at) : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 14 }}>
                      {t("studioRadneFaze.updated")}
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
                    title={t("studioRadneFaze.prev")}
                  >
                    ◀
                  </button>
                  <button
                    className="btn"
                    onClick={goNext}
                    disabled={isPending || !canNext}
                    style={btnDisabled(isPending || !canNext)}
                    title={t("studioRadneFaze.next")}
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
                {t("studioRadneFaze.cancel")}
              </button>
              <button
                className="btn btn--active"
                onClick={onSave}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {isPending ? t("studioRadneFaze.saving") : t("studioRadneFaze.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
