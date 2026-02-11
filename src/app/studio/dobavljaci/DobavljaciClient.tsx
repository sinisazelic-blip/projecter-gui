"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DobavljacRow } from "./page";
import {
  createDobavljac,
  setDobavljacActive,
  updateDobavljac,
} from "./actions";

type VrstaDobavljaca = "studio" | "freelancer" | "servis" | "ostalo";

type FormState = {
  dobavljac_id?: number;
  naziv: string;
  vrsta: VrstaDobavljaca;
  pravno_lice: boolean;
  drzava_iso2: string;
  grad: string;
  postanski_broj: string;
  email: string;
  telefon: string;
  adresa: string;
  napomena: string;
  aktivan: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

const emptyForm = (): FormState => ({
  naziv: "",
  vrsta: "ostalo",
  pravno_lice: true,
  drzava_iso2: "",
  grad: "",
  postanski_broj: "",
  email: "",
  telefon: "",
  adresa: "",
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

function modalStyle(maxWidth = 980): React.CSSProperties {
  return {
    width: "min(100%, " + maxWidth + "px)",
    border: "1px solid var(--border)",
    borderRadius: "16px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    boxShadow: "var(--shadow)",
    overflow: "hidden",
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

const logoStyle: React.CSSProperties = {
  width: 90,
  height: 35,
  objectFit: "contain",
  opacity: 0.95,
};

export default function DobavljaciClient({
  initialItems,
}: {
  initialItems: DobavljacRow[];
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
        it.naziv,
        it.vrsta,
        it.email ?? "",
        it.telefon ?? "",
        it.grad ?? "",
        it.drzava_iso2 ?? "",
        it.adresa ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(qq);
    });
  }, [items, q, showInactive]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return (
      items.find((x) => Number(x.dobavljac_id) === Number(selectedId)) ?? null
    );
  }, [items, selectedId]);

  const selectedIsActive = selectedItem
    ? Number(selectedItem.aktivan) === 1
    : false;

  function badgeVrsta(v: VrstaDobavljaca) {
    const status =
      v === "studio"
        ? "active"
        : v === "freelancer"
          ? "planned"
          : v === "servis"
            ? "draft"
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

  function loadToForm(it: DobavljacRow) {
    setForm({
      dobavljac_id: it.dobavljac_id,
      naziv: it.naziv ?? "",
      vrsta: (it.vrsta ?? "ostalo") as VrstaDobavljaca,
      pravno_lice: Number(it.pravno_lice) === 1,
      drzava_iso2: it.drzava_iso2 ?? "",
      grad: it.grad ?? "",
      postanski_broj: it.postanski_broj ?? "",
      email: it.email ?? "",
      telefon: it.telefon ?? "",
      adresa: it.adresa ?? "",
      napomena: it.napomena ?? "",
      aktivan: Number(it.aktivan) === 1,
      created_at: it.created_at,
      updated_at: it.updated_at,
    });
  }

  const editIndex = useMemo(() => {
    if (!selectedId) return -1;
    return filtered.findIndex(
      (x) => Number(x.dobavljac_id) === Number(selectedId),
    );
  }, [filtered, selectedId]);

  const canPrev = modalMode === "edit" && editIndex > 0;
  const canNext =
    modalMode === "edit" && editIndex >= 0 && editIndex < filtered.length - 1;

  function goPrev() {
    if (!canPrev) return;
    const it = filtered[editIndex - 1];
    setSelectedId(it.dobavljac_id);
    loadToForm(it);
  }

  function goNext() {
    if (!canNext) return;
    const it = filtered[editIndex + 1];
    setSelectedId(it.dobavljac_id);
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
      naziv: form.naziv,
      vrsta: form.vrsta,
      pravno_lice: !!form.pravno_lice,
      drzava_iso2: form.drzava_iso2 || null,
      grad: form.grad || null,
      postanski_broj: form.postanski_broj || null,
      email: form.email || null,
      telefon: form.telefon || null,
      adresa: form.adresa || null,
      napomena: form.napomena || null,
      aktivan: !!form.aktivan,
    };

    startTransition(async () => {
      try {
        if (modalMode === "new") {
          await createDobavljac(payload);
        } else {
          if (!form.dobavljac_id) throw new Error("Nedostaje ID za izmjenu.");
          await updateDobavljac({
            dobavljac_id: form.dobavljac_id,
            ...payload,
          });
        }
        setModalOpen(false);
        setSelectedId(null);
        router.refresh();
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
        await setDobavljacActive({
          dobavljac_id: selectedItem.dobavljac_id,
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
            <img src="/fluxa/logo-light.png" alt="Fluxa" style={logoStyle} />
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              Dobavljači
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
              placeholder="Traži (naziv, vrsta, grad, email, telefon)…"
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
              <th>Naziv</th>
              <th>Vrsta</th>
              <th>Lokacija</th>
              <th>Kontakt</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)", padding: 16 }}>
                  Nema dobavljača za prikaz.
                </td>
              </tr>
            ) : (
              filtered.map((it) => {
                const isSelected =
                  Number(selectedId) === Number(it.dobavljac_id);
                const isActive = Number(it.aktivan) === 1;

                const lok = [
                  it.grad ? it.grad : null,
                  it.drzava_iso2 ? it.drzava_iso2 : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const kontakt = [
                  it.email ? it.email : null,
                  it.telefon ? it.telefon : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <tr
                    key={it.dobavljac_id}
                    onClick={() => setSelectedId(it.dobavljac_id)}
                    style={subtleRowStyle(isSelected)}
                    data-closed={isActive ? "0" : "1"}
                    title="Klikni za selekciju"
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
                        <span style={{ fontWeight: 800 }}>{it.naziv}</span>
                        {it.pravno_lice ? (
                          <span
                            className="badge"
                            data-status="draft"
                            style={{ marginLeft: 6 }}
                          >
                            pravno lice
                          </span>
                        ) : (
                          <span
                            className="badge"
                            data-status="planned"
                            style={{ marginLeft: 6 }}
                          >
                            fizičko lice
                          </span>
                        )}
                      </div>
                      {it.adresa ? (
                        <div
                          style={{
                            marginTop: 4,
                            color: "var(--muted)",
                            fontSize: 13,
                          }}
                        >
                          {it.adresa}
                        </div>
                      ) : null}
                    </td>

                    <td>{badgeVrsta(it.vrsta)}</td>

                    <td style={{ color: lok ? "var(--text)" : "var(--muted)" }}>
                      {lok || "—"}
                      {it.postanski_broj ? (
                        <div
                          style={{
                            marginTop: 4,
                            color: "var(--muted)",
                            fontSize: 13,
                          }}
                        >
                          {it.postanski_broj}
                        </div>
                      ) : null}
                    </td>

                    <td
                      style={{
                        color: kontakt ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {kontakt || "—"}
                    </td>

                    <td>{badgeStatus(isActive)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div style={overlayStyle()} role="dialog" aria-modal="true">
          <div style={modalStyle(980)}>
            <div
              style={{
                padding: 16,
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
                    width: 22,
                    height: 22,
                    objectFit: "contain",
                    opacity: 0.9,
                    marginTop: 2,
                  }}
                />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {modalMode === "new"
                      ? "Novi dobavljač"
                      : "Promijeni dobavljača"}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      color: "var(--muted)",
                      fontSize: 14,
                    }}
                  >
                    Šifrarnik dobavljača (bez brisanja — samo deaktivacija).
                  </div>
                </div>
              </div>
              <button className="btn" onClick={closeAllModals}>
                ✖
              </button>
            </div>

            <div style={{ padding: 16 }}>
              <div
                className="grid"
                style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
              >
                <div style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    Naziv (obavezno)
                  </div>
                  <input
                    value={form.naziv}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, naziv: e.target.value }))
                    }
                    placeholder="npr. Studio TAF"
                    autoFocus
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    Vrsta
                  </div>
                  <select
                    value={form.vrsta}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        vrsta: e.target.value as VrstaDobavljaca,
                      }))
                    }
                    style={{ width: "100%" }}
                  >
                    <option value="studio">studio</option>
                    <option value="freelancer">freelancer</option>
                    <option value="servis">servis</option>
                    <option value="ostalo">ostalo</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.pravno_lice}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, pravno_lice: e.target.checked }))
                    }
                    style={{ width: 16, height: 16 }}
                  />
                  <span
                    style={{
                      color: "var(--text)",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    Pravno lice
                  </span>
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
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    Aktivno
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    Država (ISO2)
                  </div>
                  <input
                    value={form.drzava_iso2}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        drzava_iso2: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="BA"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    Grad
                  </div>
                  <input
                    value={form.grad}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, grad: e.target.value }))
                    }
                    placeholder="Sarajevo"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    Poštanski broj
                  </div>
                  <input
                    value={form.postanski_broj}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, postanski_broj: e.target.value }))
                    }
                    placeholder="71000"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 13,
                      marginBottom: 6,
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
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 13,
                      marginBottom: 6,
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
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    Adresa
                  </div>
                  <input
                    value={form.adresa}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, adresa: e.target.value }))
                    }
                    placeholder="Ulica i broj"
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 13,
                      marginBottom: 6,
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
                    style={{ width: "100%", minHeight: 90, resize: "vertical" }}
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
                      {form.dobavljac_id ?? "—"}
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
                    ? "Deaktivirati dobavljača?"
                    : "Aktivirati dobavljača?"}
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
                ? "Dobavljač će biti sakriven iz liste aktivnih. Možeš ga vratiti kasnije."
                : "Dobavljač će opet biti vidljiv u listi aktivnih."}
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
