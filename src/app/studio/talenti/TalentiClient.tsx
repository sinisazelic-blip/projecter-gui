"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TalentRow } from "./page";
import { createTalent, setTalentActive, updateTalent } from "./actions";
import ImportSection from "../ImportSection";

type VrstaTalenta =
  | "spiker"
  | "glumac"
  | "pjevac"
  | "dijete"
  | "muzicar"
  | "ostalo";

type FormState = {
  talent_id?: number;
  ime_prezime: string;
  vrsta: VrstaTalenta;
  email: string;
  telefon: string;
  napomena: string;
  aktivan: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

const emptyForm = (): FormState => ({
  ime_prezime: "",
  vrsta: "ostalo",
  email: "",
  telefon: "",
  napomena: "",
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

export default function TalentiClient({
  initialItems,
}: {
  initialItems: TalentRow[];
}) {
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

  const [items, setItems] = useState<TalentRow[]>(initialItems ?? []);
  useEffect(() => {
    setItems(initialItems ?? []);
  }, [initialItems]);

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
        it.ime_prezime,
        it.vrsta,
        it.email ?? "",
        it.telefon ?? "",
        it.napomena ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(qq);
    });
  }, [items, q, showInactive]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return (
      items.find((x) => Number(x.talent_id) === Number(selectedId)) ?? null
    );
  }, [items, selectedId]);

  const selectedIsActive = selectedItem
    ? Number(selectedItem.aktivan) === 1
    : false;

  function badgeVrsta(v: VrstaTalenta) {
    const status =
      v === "spiker"
        ? "planned"
        : v === "glumac"
          ? "active"
          : v === "pjevac"
            ? "draft"
            : v === "muzicar"
              ? "planned"
              : v === "dijete"
                ? "warn"
                : "unknown";

    return (
      <span className="badge" data-status={status}>
        {v}
      </span>
    );
  }

  function badgeStatus(active: boolean) {
    return (
      <span className="badge" data-status={active ? "active" : "closed"}>
        {active ? "Aktivno" : "Neaktivno"}
      </span>
    );
  }

  function loadToForm(it: TalentRow) {
    setForm({
      talent_id: it.talent_id,
      ime_prezime: it.ime_prezime ?? "",
      vrsta: (it.vrsta ?? "ostalo") as VrstaTalenta,
      email: it.email ?? "",
      telefon: it.telefon ?? "",
      napomena: it.napomena ?? "",
      aktivan: Number(it.aktivan) === 1,
      created_at: it.created_at,
      updated_at: it.updated_at,
    });
  }

  const editIndex = useMemo(() => {
    if (!selectedId) return -1;
    return filtered.findIndex(
      (x) => Number(x.talent_id) === Number(selectedId),
    );
  }, [filtered, selectedId]);

  const canPrev = modalMode === "edit" && editIndex > 0;
  const canNext =
    modalMode === "edit" && editIndex >= 0 && editIndex < filtered.length - 1;

  function goPrev() {
    if (!canPrev) return;
    const it = filtered[editIndex - 1];
    setSelectedId(it.talent_id);
    loadToForm(it);
  }

  function goNext() {
    if (!canNext) return;
    const it = filtered[editIndex + 1];
    setSelectedId(it.talent_id);
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

  function openEditForItem(it: TalentRow) {
    setError(null);
    setSelectedId(it.talent_id);
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

  const btnDisabled = (cond: boolean) =>
    cond ? { opacity: 0.45, cursor: "not-allowed" as const } : {};

  async function onSave() {
    setError(null);

    const payload = {
      ime_prezime: form.ime_prezime,
      vrsta: form.vrsta,
      email: form.email || null,
      telefon: form.telefon || null,
      napomena: form.napomena || null,
      aktivan: !!form.aktivan,
    };

    startTransition(async () => {
      try {
        if (modalMode === "new") {
          await createTalent(payload);
          setModalOpen(false);
          setSelectedId(null);
          router.refresh();
        } else {
          if (!form.talent_id) throw new Error("Nedostaje ID za izmjenu.");
          const result = await updateTalent({
            talent_id: form.talent_id,
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
                Number(it.talent_id) === Number(form.talent_id)
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
    const nextActive = Number(selectedItem.aktivan) !== 1;

    startTransition(async () => {
      try {
        await setTalentActive({
          talent_id: selectedItem.talent_id,
          aktivan: nextActive,
        });
        setConfirmOpen(false);
        setSelectedId(null);
        router.refresh();
      } catch (e: any) {
        setError(e?.message || "Greška pri promjeni statusa.");
      }
    });
  }

  const kpiText = showInactive
    ? `Aktivni: ${counts.active} / Ukupno: ${counts.total}`
    : `Aktivni: ${counts.active}`;

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
              Talenti
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
        templateHref="/templates/import/talenti.xlsx"
        apiUrl="/api/studio/import/talenti"
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
              placeholder="Traži (ime, vrsta, email, telefon)…"
              style={{ width: 420, maxWidth: "100%" }}
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

          <div style={{ color: "var(--muted)", fontSize: 14 }}>{kpiText}</div>
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
              <th>Ime i prezime</th>
              <th>Vrsta</th>
              <th>Kontakt</th>
              <th>Napomena</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)", padding: 16 }}>
                  Nema talenata za prikaz.
                </td>
              </tr>
            ) : (
              filtered.map((it) => {
                const isSelected = Number(selectedId) === Number(it.talent_id);
                const isActive = Number(it.aktivan) === 1;

                const kontakt = [
                  it.email ? it.email : null,
                  it.telefon ? it.telefon : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <tr
                    key={it.talent_id}
                    onClick={() => setSelectedId(it.talent_id)}
                    onDoubleClick={() => openEditForItem(it)}
                    style={subtleRowStyle(isSelected)}
                    data-closed={isActive ? "0" : "1"}
                    title="Klikni za selekciju, dvoklik za izmjenu"
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
                        <span style={{ fontWeight: 800 }}>
                          {it.ime_prezime}
                        </span>
                      </div>
                    </td>

                    <td>{badgeVrsta(it.vrsta)}</td>

                    <td
                      style={{
                        color: kontakt ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {kontakt || "—"}
                    </td>

                    <td
                      style={{
                        color: it.napomena ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {it.napomena ? (
                        <span
                          style={{
                            display: "inline-block",
                            maxWidth: 520,
                            whiteSpace: "normal",
                          }}
                        >
                          {it.napomena}
                        </span>
                      ) : (
                        "—"
                      )}
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
                    {modalMode === "new" ? "Novi talenat" : "Promijeni talenat"}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--muted)",
                      fontSize: 15,
                    }}
                  >
                    Šifrarnik talenata (bez brisanja — samo deaktivacija).
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
                style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
              >
                <div style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    Ime i prezime (obavezno)
                  </div>
                  <input
                    value={form.ime_prezime}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, ime_prezime: e.target.value }))
                    }
                    placeholder="npr. Muhamed Bahonjić"
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
                    Vrsta
                  </div>
                  <select
                    value={form.vrsta}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        vrsta: e.target.value as VrstaTalenta,
                      }))
                    }
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  >
                    <option value="spiker">spiker</option>
                    <option value="glumac">glumac</option>
                    <option value="pjevac">pjevac</option>
                    <option value="muzicar">muzicar</option>
                    <option value="dijete">dijete</option>
                    <option value="ostalo">ostalo</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.aktivan}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, aktivan: e.target.checked }))
                    }
                    style={{ width: 16, height: 16 }}
                  />
                  <span
                    style={{
                      color: "var(--text)",
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  >
                    Aktivno
                  </span>
                </div>

                <div />

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    Email
                  </div>
                  <input
                    value={form.email}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, email: e.target.value }))
                    }
                    placeholder="email@domena.com"
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
                    Telefon
                  </div>
                  <input
                    value={form.telefon}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, telefon: e.target.value }))
                    }
                    placeholder="+387 ..."
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
                    Napomena
                  </div>
                  <textarea
                    value={form.napomena}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, napomena: e.target.value }))
                    }
                    placeholder="Interna napomena"
                    className="input"
                    style={{ width: "100%", minHeight: 90, resize: "vertical", padding: "12px 14px", fontSize: 15 }}
                  />
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
                    <div style={{ fontWeight: 800 }}>
                      {form.talent_id ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      Kreirano
                    </div>
                    <div style={{ fontWeight: 800 }}>
                      {form.created_at ? fmtDateTime(form.created_at) : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      Updated
                    </div>
                    <div style={{ fontWeight: 800 }}>
                      {form.updated_at ? fmtDateTime(form.updated_at) : "—"}
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

      {/* Confirm */}
      {confirmOpen && selectedItem ? (
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
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {selectedIsActive
                    ? "Deaktivirati talenat?"
                    : "Aktivirati talenat?"}
                </div>
                <div
                  style={{ marginTop: 6, color: "var(--muted)", fontSize: 16 }}
                >
                  <b style={{ color: "var(--text)" }}>
                    {selectedItem.ime_prezime}
                  </b>
                </div>
              </div>
              <button className="btn" onClick={closeAllModals}>
                ✖
              </button>
            </div>

            <div
              style={{
                padding: 20,
                color: "var(--text)",
                fontSize: 16,
                lineHeight: 1.5,
              }}
            >
              {selectedIsActive
                ? "Talenat će biti sakriven iz liste aktivnih. Možeš ga vratiti kasnije."
                : "Talenat će opet biti vidljiv u listi aktivnih."}
            </div>

            <div
              style={{
                padding: 20,
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
