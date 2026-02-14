"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CjenovnikItem } from "./page";
import {
  createCjenovnikItem,
  setCjenovnikActive,
  updateCjenovnikItem,
} from "./actions";
import ImportSection from "../ImportSection";

type Jedinica = CjenovnikItem["jedinica"];
const JEDINICE: Jedinica[] = ["KOM", "SAT", "MIN", "PAKET", "DAN", "OSTALO"];

const displayCurrency = (dbValuta: string) => {
  const v = String(dbValuta || "")
    .trim()
    .toUpperCase();
  if (!v) return "KM";
  if (v === "BAM") return "KM";
  return v;
};

const toUiCurrency = (dbValuta: string) => displayCurrency(dbValuta);
const toDbCurrencyLabel = (uiValuta: string) =>
  String(uiValuta || "")
    .trim()
    .toUpperCase() === "KM"
    ? "BAM"
    : String(uiValuta || "")
        .trim()
        .toUpperCase();

const fmtDate = (dt: string | null | undefined) => {
  if (!dt) return "—";
  const s = String(dt).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "—";
  return `${d}.${m}.${y}`;
};

const fmtPrice = (v: any) => {
  const raw = String(v ?? "").trim();
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2).replace(".", ",");
};

type ModalMode = "new" | "edit";

type FormState = {
  stavka_id?: number;
  naziv: string;
  jedinica: Jedinica;
  cijena_default: string;
  cijena_ino_eur: string;
  valuta_ui: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

const emptyForm = (): FormState => ({
  naziv: "",
  jedinica: "KOM",
  cijena_default: "0.00",
  cijena_ino_eur: "",
  valuta_ui: "KM",
  active: true,
});

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

function modalStyle(maxWidth = 860): React.CSSProperties {
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

const pageShellStyle: React.CSSProperties = {
  height: "calc(100vh - 24px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

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

export default function CjenovnikClient({
  initialItems,
}: {
  initialItems: CjenovnikItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("new");
  const [form, setForm] = useState<FormState>(emptyForm());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<CjenovnikItem[]>(initialItems ?? []);
  useEffect(() => {
    setItems(initialItems ?? []);
  }, [initialItems]);

  const counts = useMemo(() => {
    const total = items.length;
    const active = items.filter((x) => Number(x.active) === 1).length;
    return { total, active };
  }, [items]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return items.filter((it) => {
      if (!showInactive && Number(it.active) !== 1) return false;
      if (!qq) return true;
      return String(it.naziv || "")
        .toLowerCase()
        .includes(qq);
    });
  }, [items, q, showInactive]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return (
      items.find((x) => Number(x.stavka_id) === Number(selectedId)) ?? null
    );
  }, [items, selectedId]);

  const selectedIsActive = selectedItem
    ? Number(selectedItem.active) === 1
    : false;

  function loadToForm(it: CjenovnikItem) {
    setForm({
      stavka_id: it.stavka_id,
      naziv: it.naziv ?? "",
      jedinica: it.jedinica ?? "KOM",
      cijena_default: String(it.cijena_default ?? "0.00"),
      cijena_ino_eur:
        it.cijena_ino_eur === null || it.cijena_ino_eur === undefined
          ? ""
          : String(it.cijena_ino_eur),
      valuta_ui: toUiCurrency(it.valuta_default ?? "BAM"),
      active: Number(it.active) === 1,
      created_at: it.created_at,
      updated_at: it.updated_at,
    });
  }

  const editIndex = useMemo(() => {
    if (!selectedId) return -1;
    return filtered.findIndex(
      (x) => Number(x.stavka_id) === Number(selectedId),
    );
  }, [filtered, selectedId]);

  const canPrev = modalMode === "edit" && editIndex > 0;
  const canNext =
    modalMode === "edit" && editIndex >= 0 && editIndex < filtered.length - 1;

  function goPrev() {
    if (!canPrev) return;
    const it = filtered[editIndex - 1];
    setSelectedId(it.stavka_id);
    loadToForm(it);
  }

  function goNext() {
    if (!canNext) return;
    const it = filtered[editIndex + 1];
    setSelectedId(it.stavka_id);
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

  function openEditForItem(it: CjenovnikItem) {
    setError(null);
    setSelectedId(it.stavka_id);
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
      else router.push("/");
    } catch {
      router.push("/");
    }
  }

  function badgeStatus(active: boolean) {
    return (
      <span className="badge" data-status={active ? "active" : "closed"}>
        {active ? "Aktivno" : "Neaktivno"}
      </span>
    );
  }

  async function onSave() {
    setError(null);

    const payload = {
      naziv: form.naziv,
      jedinica: form.jedinica,
      cijena_default: form.cijena_default,
      cijena_ino_eur: form.cijena_ino_eur,
      valuta_ui: form.valuta_ui || "KM",
      active: !!form.active,
    };

    startTransition(async () => {
      try {
        if (modalMode === "new") {
          await createCjenovnikItem(payload);
          setModalOpen(false);
          setSelectedId(null);
          router.refresh();
        } else {
          if (!form.stavka_id) throw new Error("Nedostaje ID za izmjenu.");
          const result = await updateCjenovnikItem({
            stavka_id: form.stavka_id,
            ...payload,
          });
          if (result?.created_at != null || result?.updated_at != null) {
            setForm((prev) => ({
              ...prev,
              created_at: result.created_at ?? prev.created_at,
              updated_at: result.updated_at ?? prev.updated_at,
            }));
            setItems((prev) =>
              prev.map((it) =>
                Number(it.stavka_id) === Number(form.stavka_id)
                  ? {
                      ...it,
                      created_at: result.created_at ?? it.created_at,
                      updated_at: result.updated_at ?? it.updated_at,
                    }
                  : it,
              ),
            );
          }
          router.refresh();
        }
      } catch (e: any) {
        setError(e?.message || "Greška pri snimanju.");
      }
    });
  }

  async function onToggleActiveConfirmed() {
    if (!selectedItem) return;
    const nextActive = Number(selectedItem.active) !== 1;

    startTransition(async () => {
      try {
        await setCjenovnikActive({
          stavka_id: selectedItem.stavka_id,
          active: nextActive,
        });
        setConfirmOpen(false);
        setSelectedId(null);
        router.refresh();
      } catch (e: any) {
        setError(e?.message || "Greška pri promjeni statusa.");
      }
    });
  }

  const btnDisabled = (cond: boolean) =>
    cond ? { opacity: 0.45, cursor: "not-allowed" as const } : {};

  return (
    <div className="container" style={pageShellStyle}>
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
              Cjenovnik
            </h1>
          </div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
            Klikni red da ga označiš, pa koristi <b>Promijeni</b> /{" "}
            <b>Obriši</b>.
            <span style={{ opacity: 0.9 }}>
              {" "}
              “Obriši” = deaktiviraj (istorija ostaje).
            </span>
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
            <span style={{ marginRight: 6 }}>➕</span> Novi
          </button>

          <button
            className="btn"
            onClick={openEdit}
            disabled={!selectedItem || isPending}
            style={btnDisabled(!selectedItem || isPending)}
            title={!selectedItem ? "Prvo odaberi red" : "Promijeni"}
          >
            <span style={{ marginRight: 6 }}>✏️</span> Promijeni
          </button>

          <button
            className="btn"
            onClick={openConfirmToggle}
            disabled={!selectedItem || isPending}
            style={btnDisabled(!selectedItem || isPending)}
            title={
              !selectedItem
                ? "Prvo odaberi red"
                : selectedIsActive
                  ? "Deaktiviraj"
                  : "Aktiviraj"
            }
          >
            <span style={{ marginRight: 6 }}>
              {selectedIsActive ? "🗑️" : "✅"}
            </span>
            {selectedIsActive ? "Obriši" : "Aktiviraj"}
          </button>

          <button className="btn" onClick={onClosePage}>
            <span style={{ marginRight: 6 }}>✖</span> Zatvori
          </button>
        </div>
      </div>

      <ImportSection
        templateHref="/templates/import/cjenovnik.xlsx"
        apiUrl="/api/studio/import/cjenovnik"
        onSuccess={() => router.refresh()}
      />

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
              placeholder="Traži…"
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
              Prikaži deaktivirane
            </label>
          </div>

          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            {showInactive ? (
              <>
                Aktivni: <b style={{ color: "var(--text)" }}>{counts.active}</b>{" "}
                / Ukupno: <b style={{ color: "var(--text)" }}>{counts.total}</b>
              </>
            ) : (
              <>
                Aktivni: <b style={{ color: "var(--text)" }}>{counts.active}</b>
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
              <th>Naziv</th>
              <th>Jedinica</th>
              <th className="num">Cijena (KM)</th>
              <th className="num">INO (EUR)</th>
              <th>Valuta</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: "var(--muted)", padding: 16 }}>
                  Nema stavki za prikaz.
                </td>
              </tr>
            ) : (
              filtered.map((it) => {
                const isSelected = Number(selectedId) === Number(it.stavka_id);
                const isActive = Number(it.active) === 1;

                return (
                  <tr
                    key={it.stavka_id}
                    onClick={() => setSelectedId(it.stavka_id)}
                    onDoubleClick={() => openEditForItem(it)}
                    style={subtleRowStyle(isSelected)}
                    data-closed={isActive ? "0" : "1"}
                    title="Klikni za selekciju, dvoklik za izmjenu"
                  >
                    <td>
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
                        <span style={{ fontWeight: 600 }}>{it.naziv}</span>
                      </div>
                    </td>

                    <td>
                      <span className="badge">{it.jedinica}</span>
                    </td>

                    <td
                      className="num"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {fmtPrice(it.cijena_default)}
                    </td>

                    <td
                      className="num"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {it.cijena_ino_eur === null ||
                      it.cijena_ino_eur === undefined ||
                      String(it.cijena_ino_eur).trim() === ""
                        ? "—"
                        : fmtPrice(it.cijena_ino_eur)}
                    </td>

                    <td>{displayCurrency(it.valuta_default)}</td>

                    <td>{badgeStatus(isActive)}</td>

                    <td style={{ color: "var(--muted)" }}>
                      {fmtDate(it.updated_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
                    {modalMode === "new" ? "Novi artikl" : "Promijeni artikl"}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--muted)",
                      fontSize: 15,
                    }}
                  >
                    Cjenovnik stavka. Domaća valuta se prikazuje kao <b>KM</b>{" "}
                    (interno DB: BAM).
                  </div>
                </div>
              </div>
              <button className="btn" onClick={closeAllModals}>
                ✖
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div
                className="grid"
                style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
              >
                <div style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    Naziv (obavezno)
                  </div>
                  <input
                    value={form.naziv}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, naziv: e.target.value }))
                    }
                    placeholder="npr. Mix pjesme"
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
                    Jedinica
                  </div>
                  <select
                    value={form.jedinica}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        jedinica: e.target.value as Jedinica,
                      }))
                    }
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  >
                    {JEDINICE.map((u) => (
                      <option key={u} value={u}>
                        {u}
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
                    Cijena (KM)
                  </div>
                  <input
                    value={form.cijena_default}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, cijena_default: e.target.value }))
                    }
                    placeholder="0,00"
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  />
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--muted)",
                      fontSize: 12,
                    }}
                  >
                    Prikaz: <b>{fmtPrice(form.cijena_default)}</b>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    INO cijena (EUR)
                  </div>
                  <input
                    value={form.cijena_ino_eur}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, cijena_ino_eur: e.target.value }))
                    }
                    placeholder="—"
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  />
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--muted)",
                      fontSize: 12,
                    }}
                  >
                    Prazno = nema INO cijene.
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    Valuta
                  </div>
                  <select
                    value={form.valuta_ui}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, valuta_ui: e.target.value }))
                    }
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  >
                    <option value="KM">KM</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="CHF">CHF</option>
                    <option value="RSD">RSD</option>
                  </select>
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--muted)",
                      fontSize: 12,
                    }}
                  >
                    Interno u bazi: <b>{toDbCurrencyLabel(form.valuta_ui)}</b>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, active: e.target.checked }))
                    }
                    style={{ width: 16, height: 16 }}
                  />
                  <span
                    style={{
                      color: "var(--text)",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    Aktivno
                  </span>
                </div>
              </div>

              <div className="card" style={{ marginTop: 14 }}>
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: 12,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                  }}
                >
                  Sistem
                </div>
                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      ID
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {form.stavka_id ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      Kreirano
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {form.created_at ? fmtDate(form.created_at) : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      Updated
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {form.updated_at ? fmtDate(form.updated_at) : "—"}
                    </div>
                  </div>
                </div>
              </div>
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
                    title="Prethodni"
                  >
                    ◀
                  </button>
                  <button
                    className="btn"
                    onClick={goNext}
                    disabled={isPending || !canNext}
                    style={btnDisabled(isPending || !canNext)}
                    title="Naredni"
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
                Otkaži
              </button>
              <button
                className="btn btn--active"
                onClick={onSave}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {isPending ? "Snima..." : "Snimi"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                    ? "Deaktivirati stavku?"
                    : "Aktivirati stavku?"}
                </div>
                <div
                  style={{ marginTop: 4, color: "var(--muted)", fontSize: 14 }}
                >
                  <b style={{ color: "var(--text)" }}>{selectedItem.naziv}</b>
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
                ? "Stavka će biti sakrivena iz liste aktivnih. Možeš je vratiti kasnije."
                : "Stavka će opet biti vidljiva u listi aktivnih."}
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
                Otkaži
              </button>
              <button
                className="btn btn--active"
                onClick={onToggleActiveConfirmed}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {isPending
                  ? "Radi..."
                  : selectedIsActive
                    ? "Deaktiviraj"
                    : "Aktiviraj"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
