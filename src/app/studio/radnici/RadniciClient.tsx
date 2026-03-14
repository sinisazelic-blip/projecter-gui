"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RadnikRow } from "./page";
import { setRadnikActive } from "./actions";
import { useTranslation } from "@/components/LocaleProvider";

type ProjekatLink = { projekat_id: number; radni_naziv: string; tip?: "account_manager" | "crew" | "faze" };

type FormState = {
  radnik_id?: number;
  ime: string;
  prezime: string;
  adresa: string;
  broj_telefona: string;
  email: string;
  datum_rodjenja: string;
  jib: string;
  aktivan: boolean;
  opis: string;
  created_at?: string | null;
  updated_at?: string | null;
};

const emptyForm = (): FormState => ({
  ime: "",
  prezime: "",
  adresa: "",
  broj_telefona: "",
  email: "",
  datum_rodjenja: "",
  jib: "",
  aktivan: true,
  opis: "",
});

/** Iz bilo kojeg formata (Date, ISO string, itd.) vrati YYYY-MM-DD za input type="date" */
function toIsoDateOnly(dt: string | Date | null | undefined): string {
  if (!dt) return "";
  if (dt instanceof Date) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(dt).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d2 = new Date(s);
  if (!Number.isNaN(d2.getTime())) {
    return toIsoDateOnly(d2);
  }
  return "";
}

const fmtDate = (dt: string | Date | null | undefined) => {
  if (!dt) return "—";
  const iso = toIsoDateOnly(dt);
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

function toIsoDate(display: string): string | null {
  const s = String(display ?? "").trim();
  if (!s) return null;
  const match = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    const dd = d!.padStart(2, "0");
    const mm = m!.padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

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

export default function RadniciClient({
  initialItems,
}: {
  initialItems: RadnikRow[];
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"new" | "edit">("new");
  const [form, setForm] = useState<FormState>(emptyForm());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalFormRef = useRef<HTMLFormElement>(null);
  const datumRef = useRef<string>("");

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
        it.ime,
        it.prezime,
        it.adresa ?? "",
        it.broj_telefona ?? "",
        it.email ?? "",
        it.jib ?? "",
        it.opis ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(qq);
    });
  }, [items, q, showInactive]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return (
      items.find((x) => Number(x.radnik_id) === Number(selectedId)) ?? null
    );
  }, [items, selectedId]);

  const [radnikProjekti, setRadnikProjekti] = useState<ProjekatLink[]>([]);
  useEffect(() => {
    if (!modalOpen || !form.radnik_id) {
      setRadnikProjekti([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/studio/radnici/${form.radnik_id}/projekti`)
      .then((r) => r.json())
      .then((data: { ok?: boolean; projekti?: ProjekatLink[] }) => {
        if (cancelled || !data?.ok || !Array.isArray(data.projekti)) return;
        setRadnikProjekti(data.projekti);
      })
      .catch(() => setRadnikProjekti([]));
    return () => {
      cancelled = true;
    };
  }, [modalOpen, form.radnik_id]);

  const selectedIsActive = selectedItem
    ? Number(selectedItem.aktivan) === 1
    : false;

  function badgeStatus(active: boolean) {
    return (
      <span className="badge" data-status={active ? "active" : "closed"}>
        {active ? t("studioRadnici.active") : t("studioRadnici.inactive")}
      </span>
    );
  }

  function loadToForm(it: RadnikRow) {
    const datum = toIsoDateOnly(it.datum_rodjenja);
    datumRef.current = datum;
    setForm({
      radnik_id: it.radnik_id,
      ime: it.ime ?? "",
      prezime: it.prezime ?? "",
      adresa: it.adresa ?? "",
      broj_telefona: it.broj_telefona ?? "",
      email: it.email ?? "",
      datum_rodjenja: datum,
      jib: it.jib ?? "",
      aktivan: Number(it.aktivan) === 1,
      opis: it.opis ?? "",
      created_at: it.created_at,
      updated_at: it.updated_at,
    });
  }

  const editIndex = useMemo(() => {
    if (!selectedId) return -1;
    return filtered.findIndex(
      (x) => Number(x.radnik_id) === Number(selectedId),
    );
  }, [filtered, selectedId]);

  const canPrev = modalMode === "edit" && editIndex > 0;
  const canNext =
    modalMode === "edit" && editIndex >= 0 && editIndex < filtered.length - 1;

  function goPrev() {
    if (!canPrev) return;
    const it = filtered[editIndex - 1];
    setSelectedId(it.radnik_id);
    loadToForm(it);
  }

  function goNext() {
    if (!canNext) return;
    const it = filtered[editIndex + 1];
    setSelectedId(it.radnik_id);
    loadToForm(it);
  }

  function openNew() {
    setError(null);
    setSelectedId(null);
    setModalMode("new");
    datumRef.current = "";
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

  function openEditForItem(it: RadnikRow) {
    setError(null);
    setSelectedId(it.radnik_id);
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

  async function onSave(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault?.();
    setError(null);

    const formEl = modalFormRef.current;
    const fd = formEl ? new FormData(formEl) : null;
    const datumVal =
      datumRef.current ||
      (fd ? (fd.get("datum_rodjenja") as string) ?? "" : "") ||
      form.datum_rodjenja ||
      "";

    const payload = {
      ime: fd?.get("ime") ? String(fd.get("ime")).trim() : form.ime,
      prezime: fd?.get("prezime") ? String(fd.get("prezime")).trim() : form.prezime,
      adresa: (fd?.get("adresa") ? String(fd.get("adresa")).trim() : form.adresa) || null,
      broj_telefona: (fd?.get("broj_telefona") ? String(fd.get("broj_telefona")).trim() : form.broj_telefona) || null,
      email: (fd?.get("email") ? String(fd.get("email")).trim() : form.email) || null,
      datum_rodjenja: toIsoDate(datumVal) || (datumVal && datumVal.trim() ? datumVal.trim() : null),
      jib: (fd?.get("jib") ? String(fd.get("jib")).trim() : form.jib) || null,
      aktivan: fd ? fd.get("aktivan") === "on" : !!form.aktivan,
      opis: (fd?.get("opis") ? String(fd.get("opis")).trim() : form.opis) || null,
    };

    startTransition(async () => {
      try {
        const body: Record<string, unknown> = {
          ime: payload.ime,
          prezime: payload.prezime,
          adresa: payload.adresa,
          broj_telefona: payload.broj_telefona,
          email: payload.email,
          datum_rodjenja: payload.datum_rodjenja,
          jib: payload.jib,
          aktivan: payload.aktivan,
          opis: payload.opis,
        };
        if (modalMode === "edit" && form.radnik_id) {
          body.radnik_id = form.radnik_id;
        }
        const res = await fetch("/api/radnici/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json();
        if (!j?.ok) {
          throw new Error(j?.error ?? "Greška pri snimanju.");
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
        await setRadnikActive({
          radnik_id: selectedItem.radnik_id,
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
              {t("studioRadnici.title")}
            </h1>
          </div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
            {t("studioRadnici.hintClick")} <b>{t("studioRadnici.change")}</b> /{" "}
            <b>{t("studioRadnici.hintChangeDelete")}</b>.
            <span style={{ opacity: 0.9 }}>
              {" "}
              {t("studioRadnici.hintDeleteMeaning")}
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
            <span style={{ marginRight: 6 }}>➕</span> {t("studioRadnici.new")}
          </button>

          <button
            className="btn"
            onClick={openEdit}
            disabled={!selectedItem || isPending}
            style={btnDisabled(!selectedItem || isPending)}
            title={!selectedItem ? t("studioRadnici.selectFirst") : t("studioRadnici.change")}
          >
            <span style={{ marginRight: 6 }}>✏️</span> {t("studioRadnici.change")}
          </button>

          <button
            className="btn"
            onClick={openConfirmToggle}
            disabled={!selectedItem || isPending}
            style={btnDisabled(!selectedItem || isPending)}
            title={
              !selectedItem
                ? t("studioRadnici.selectFirst")
                : selectedIsActive
                  ? t("studioRadnici.deactivate")
                  : t("studioRadnici.activate")
            }
          >
            <span style={{ marginRight: 6 }}>
              {selectedIsActive ? "🗑️" : "✅"}
            </span>
            {selectedIsActive ? t("studioRadnici.delete") : t("studioRadnici.activate")}
          </button>

          <button className="btn" onClick={onClosePage}>
            <span style={{ marginRight: 6 }}>✖</span> {t("studioRadnici.close")}
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
              placeholder={t("studioRadnici.searchPlaceholder")}
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
              {t("studioRadnici.showInactive")}
            </label>
          </div>

          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            {showInactive ? (
              <>
                {t("studioRadnici.activeCount")}: <b style={{ color: "var(--text)" }}>{counts.active}</b>{" "}
                / {t("studioRadnici.totalCount")}: <b style={{ color: "var(--text)" }}>{counts.total}</b>
              </>
            ) : (
              <>
                {t("studioRadnici.activeCount")}: <b style={{ color: "var(--text)" }}>{counts.active}</b>
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
              <th>{t("studioRadnici.colImePrezime")}</th>
              <th>{t("studioRadnici.colKontakt")}</th>
              <th>{t("studioRadnici.colDatumRodjenja")}</th>
              <th>{t("studioRadnici.colJib")}</th>
              <th>{t("studioRadnici.colStatus")}</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)", padding: 16 }}>
                  {t("studioRadnici.noWorkers")}
                </td>
              </tr>
            ) : (
              filtered.map((it) => {
                const isSelected = Number(selectedId) === Number(it.radnik_id);
                const isActive = Number(it.aktivan) === 1;

                const kontakt = [
                  it.email ? it.email : null,
                  it.broj_telefona ? it.broj_telefona : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <tr
                    key={it.radnik_id}
                    onClick={() => setSelectedId(it.radnik_id)}
                    onDoubleClick={() => openEditForItem(it)}
                    style={subtleRowStyle(isSelected)}
                    data-closed={isActive ? "0" : "1"}
                    title={t("studioRadnici.rowTitle")}
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
                        <span style={{ fontWeight: 700 }}>
                          {it.ime} {it.prezime}
                        </span>
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

                    <td
                      style={{
                        color: kontakt ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {kontakt || "—"}
                    </td>

                    <td
                      style={{
                        color: it.datum_rodjenja ? "var(--text)" : "var(--muted)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtDate(it.datum_rodjenja)}
                    </td>

                    <td
                      style={{
                        color: it.jib ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {it.jib || "—"}
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
                    {modalMode === "new"
                      ? t("studioRadnici.modalNew")
                      : t("studioRadnici.modalEdit")}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--muted)",
                      fontSize: 15,
                    }}
                  >
                    {t("studioRadnici.modalSubtitle")}
                  </div>
                </div>
              </div>
              <button className="btn" onClick={closeAllModals}>
                ✖
              </button>
            </div>

            <form
              ref={modalFormRef}
              onSubmit={(e) => onSave(e)}
              style={{ display: "contents" }}
            >
            <div style={{ padding: 20 }}>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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
                    {t("studioRadnici.labelIme")}
                  </div>
                  <input
                    name="ime"
                    value={form.ime}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, ime: e.target.value }))
                    }
                    placeholder={t("studioRadnici.placeholderIme")}
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
                    {t("studioRadnici.labelPrezime")}
                  </div>
                  <input
                    name="prezime"
                    value={form.prezime}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, prezime: e.target.value }))
                    }
                    placeholder={t("studioRadnici.placeholderPrezime")}
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
                    {t("studioRadnici.labelDatumRodjenja")}
                  </div>
                  <input
                    name="datum_rodjenja"
                    type="date"
                    value={form.datum_rodjenja}
                    onChange={(e) => {
                      const v = e.target.value;
                      datumRef.current = v;
                      setForm((s) => ({ ...s, datum_rodjenja: v }));
                    }}
                    title={t("studioRadnici.labelDatumRodjenja")}
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
                    {t("studioRadnici.labelAdresa")}
                  </div>
                  <input
                    name="adresa"
                    value={form.adresa}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, adresa: e.target.value }))
                    }
                    placeholder={t("studioRadnici.placeholderAdresa")}
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
                    {t("studioRadnici.labelBrojTelefona")}
                  </div>
                  <input
                    name="broj_telefona"
                    value={form.broj_telefona}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, broj_telefona: e.target.value }))
                    }
                    placeholder={t("studioRadnici.placeholderTelefon")}
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
                    {t("studioRadnici.labelEmail")}
                  </div>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, email: e.target.value }))
                    }
                    placeholder={t("studioRadnici.placeholderEmail")}
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
                    {t("studioRadnici.labelJib")}
                  </div>
                  <input
                    name="jib"
                    value={form.jib}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, jib: e.target.value }))
                    }
                    placeholder={t("studioRadnici.placeholderJib")}
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    name="aktivan"
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
                    {t("studioRadnici.labelAktivan")}
                  </span>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    {t("studioRadnici.labelOpis")}
                  </div>
                  <textarea
                    name="opis"
                    value={form.opis}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, opis: e.target.value }))
                    }
                    placeholder={t("studioRadnici.placeholderOpis")}
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
                  {t("studioRadnici.system")}
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
                      {t("studioRadnici.id")}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {form.radnik_id ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 14 }}>
                      {t("studioRadnici.created")}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {form.created_at ? fmtDateTime(form.created_at) : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 14 }}>
                      {t("studioRadnici.updated")}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {form.updated_at ? fmtDateTime(form.updated_at) : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {form.radnik_id ? (
                <div className="card" style={{ marginTop: 20 }}>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 12,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {t("studioRadnici.projectsEngaged")}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {radnikProjekti.length === 0 ? (
                      <span style={{ color: "var(--muted)", fontSize: 14 }}>
                        {t("studioRadnici.noProjectsAssigned")}
                      </span>
                    ) : (
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        {radnikProjekti.map((pr) => (
                          <li key={pr.projekat_id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <Link
                              href={`/projects/${pr.projekat_id}`}
                              style={{
                                color: "var(--accent)",
                                fontWeight: 600,
                                textDecoration: "none",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {pr.radni_naziv}
                            </Link>
                            <span
                              style={{
                                color: "var(--muted)",
                                fontSize: 12,
                              }}
                            >
                              #{pr.projekat_id}
                            </span>
                            {pr.tip && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  background: pr.tip === "account_manager" ? "rgba(59, 130, 246, 0.2)" : pr.tip === "crew" ? "rgba(34, 197, 94, 0.2)" : "rgba(255,255,255,0.08)",
                                  color: pr.tip === "account_manager" ? "rgb(96, 165, 250)" : pr.tip === "crew" ? "rgb(74, 222, 128)" : "var(--muted)",
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                {pr.tip === "account_manager" ? t("studioRadnici.tipAccountManager") : pr.tip === "crew" ? t("studioRadnici.tipCrew") : t("studioRadnici.tipFaze")}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
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
                    type="button"
                    className="btn"
                    onClick={goPrev}
                    disabled={isPending || !canPrev}
                    style={btnDisabled(isPending || !canPrev)}
                    title={t("studioRadnici.prev")}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={goNext}
                    disabled={isPending || !canNext}
                    style={btnDisabled(isPending || !canNext)}
                    title={t("studioRadnici.next")}
                  >
                    ▶
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                className="btn"
                onClick={closeAllModals}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {t("studioRadnici.cancel")}
              </button>
              <button
                type="submit"
                className="btn btn--active"
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {isPending ? t("studioRadnici.saving") : t("studioRadnici.save")}
              </button>
            </div>
            </form>
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
                    ? t("studioRadnici.confirmDeactivateTitle")
                    : t("studioRadnici.confirmActivateTitle")}
                </div>
                <div
                  style={{ marginTop: 4, color: "var(--muted)", fontSize: 14 }}
                >
                  <b style={{ color: "var(--text)" }}>
                    {selectedItem.ime} {selectedItem.prezime}
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
                ? t("studioRadnici.confirmDeactivateBody")
                : t("studioRadnici.confirmActivateBody")}
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
                {t("studioRadnici.cancel")}
              </button>
              <button
                className="btn btn--active"
                onClick={onToggleActiveConfirmed}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {isPending
                  ? t("studioRadnici.working")
                  : selectedIsActive
                    ? t("studioRadnici.deactivate")
                    : t("studioRadnici.activate")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
