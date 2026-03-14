"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { KlijentRow } from "./page";
import { createKlijent, setKlijentActive, updateKlijent } from "./actions";
import ImportSection from "../ImportSection";
import { useTranslation } from "@/components/LocaleProvider";

type TipKlijenta = "direktni" | "agencija";

type FormState = {
  klijent_id?: number;
  naziv_klijenta: string;
  tip_klijenta: TipKlijenta;
  porezni_id: string;
  jib: string;
  pib: string;
  adresa: string;
  grad: string;
  drzava: string;
  email: string;
  rok_placanja_dana: string;
  napomena: string;
  aktivan: boolean;
  is_ino: boolean;
  pdv_oslobodjen: boolean;
  pdv_oslobodjen_napomena: string;
  created_at?: string | null;
  updated_at?: string | null;
};

const emptyForm = (): FormState => ({
  naziv_klijenta: "",
  tip_klijenta: "direktni",
  porezni_id: "",
  jib: "",
  pib: "",
  adresa: "",
  grad: "",
  drzava: "",
  email: "",
  rok_placanja_dana: "0",
  napomena: "",
  aktivan: true,
  is_ino: false,
  pdv_oslobodjen: false,
  pdv_oslobodjen_napomena: "",
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
  paddingRight: 12,
};

const pageTitleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

/** hasJib/hasPib su false za EU regional (locale en): tamo se prikazuje samo VAT No (porezni_id), ne JIB/PIB. */
export default function KlijentiClient({
  initialItems,
  hasJib = false,
  hasPib = false,
}: {
  initialItems: KlijentRow[];
  hasJib?: boolean;
  hasPib?: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"new" | "edit">("new");
  const [form, setForm] = useState<FormState>(emptyForm());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveWarning, setSaveWarning] = useState<{ message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<KlijentRow[]>(initialItems ?? []);
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
        it.naziv_klijenta,
        it.porezni_id ?? "",
        it.grad ?? "",
        it.drzava ?? "",
        it.adresa ?? "",
        (it as any).email ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(qq);
    });
  }, [items, q, showInactive]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return (
      items.find((x) => Number(x.klijent_id) === Number(selectedId)) ?? null
    );
  }, [items, selectedId]);

  const selectedIsActive = selectedItem
    ? Number(selectedItem.aktivan) === 1
    : false;

  function badgeTip(tip: TipKlijenta) {
    const label = tip === "agencija" ? t("studioKlijenti.tipAgencija") : t("studioKlijenti.tipDirektni");
    return (
      <span
        className="badge"
        data-status={tip === "agencija" ? "planned" : "draft"}
      >
        {label}
      </span>
    );
  }

  function badgeStatus(active: boolean) {
    return (
      <span className="badge" data-status={active ? "active" : "closed"}>
        {active ? t("studioKlijenti.active") : t("studioKlijenti.inactive")}
      </span>
    );
  }

  function badgeTrziste(isIno: boolean) {
    const label = locale === "en" ? (isIno ? t("vat.vatEuB2b") : t("vat.vatDomestic")) : (isIno ? "INO" : "BiH");
    return (
      <span className="badge" data-status={isIno ? "planned" : "active"}>
        {label}
      </span>
    );
  }

  function loadToForm(it: KlijentRow) {
    setForm({
      klijent_id: it.klijent_id,
      naziv_klijenta: it.naziv_klijenta ?? "",
      tip_klijenta: (it.tip_klijenta ?? "direktni") as TipKlijenta,
      porezni_id: it.porezni_id ?? "",
      jib: it.jib ?? "",
      pib: it.pib ?? "",
      adresa: it.adresa ?? "",
      grad: it.grad ?? "",
      drzava: it.drzava ?? "",
      email: (it as any).email ?? "",
      rok_placanja_dana: String(it.rok_placanja_dana ?? 0),
      napomena: it.napomena ?? "",
      aktivan: Number(it.aktivan) === 1,
      is_ino: Number(it.is_ino) === 1,
      pdv_oslobodjen: Number(it.pdv_oslobodjen ?? 0) === 1,
      pdv_oslobodjen_napomena: it.pdv_oslobodjen_napomena ?? "",
      created_at: it.created_at,
      updated_at: it.updated_at,
    });
  }

  const editIndex = useMemo(() => {
    if (!selectedId) return -1;
    return filtered.findIndex(
      (x) => Number(x.klijent_id) === Number(selectedId),
    );
  }, [filtered, selectedId]);

  const canPrev = modalMode === "edit" && editIndex > 0;
  const canNext =
    modalMode === "edit" && editIndex >= 0 && editIndex < filtered.length - 1;

  function goPrev() {
    if (!canPrev) return;
    const it = filtered[editIndex - 1];
    setSelectedId(it.klijent_id);
    loadToForm(it);
  }

  function goNext() {
    if (!canNext) return;
    const it = filtered[editIndex + 1];
    setSelectedId(it.klijent_id);
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

  function openEditForItem(it: KlijentRow) {
    setError(null);
    setSelectedId(it.klijent_id);
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
    setSaveWarning(null);
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

  function runJibPibValidation(): string | null {
    const jibDigits = (form.jib ?? "").trim().replace(/\D/g, "");
    const pibDigits = (form.pib ?? "").trim().replace(/\D/g, "");

    if (hasJib && !form.is_ino && jibDigits.length === 0) {
      return t("studioKlijenti.jibPibWarningNoJib");
    }
    if (hasJib && jibDigits.length > 0 && jibDigits.length !== 13) {
      return t("studioKlijenti.jibPibWarningJibFormat").replace("{{count}}", String(jibDigits.length));
    }
    if (hasPib && pibDigits.length > 0 && pibDigits.length !== 12) {
      return t("studioKlijenti.jibPibWarningPibFormat").replace("{{count}}", String(pibDigits.length));
    }
    if (hasJib && hasPib && jibDigits.length === 13 && pibDigits.length === 12 && jibDigits !== "4" + pibDigits) {
      return t("studioKlijenti.jibPibWarningMismatch");
    }
    return null;
  }

  async function onSave(forceSave?: boolean) {
    setError(null);
    if (!forceSave) {
      const warning = runJibPibValidation();
      if (warning) {
        setSaveWarning({ message: warning });
        return;
      }
    }
    setSaveWarning(null);

    const payload: {
      naziv_klijenta: string;
      tip_klijenta: TipKlijenta;
      porezni_id?: string | null;
      jib?: string | null;
      pib?: string | null;
      adresa?: string | null;
      grad?: string | null;
      drzava?: string | null;
      email?: string | null;
      rok_placanja_dana?: number | string;
      napomena?: string | null;
      aktivan?: boolean;
      is_ino?: boolean;
      pdv_oslobodjen?: boolean;
      pdv_oslobodjen_napomena?: string | null;
    } = {
      naziv_klijenta: form.naziv_klijenta,
      tip_klijenta: form.tip_klijenta,
      porezni_id: form.porezni_id || null,
      adresa: form.adresa || null,
      grad: form.grad || null,
      drzava: form.drzava || null,
      email: form.email || null,
      rok_placanja_dana: form.rok_placanja_dana,
      napomena: form.napomena || null,
      aktivan: !!form.aktivan,
      is_ino: !!form.is_ino,
      pdv_oslobodjen: !!form.pdv_oslobodjen,
      pdv_oslobodjen_napomena: form.pdv_oslobodjen_napomena || null,
    };
    if (hasJib) payload.jib = form.jib || null;
    if (hasPib) payload.pib = form.pib || null;

    startTransition(async () => {
      try {
        if (modalMode === "new") {
          await createKlijent(payload);
          setModalOpen(false);
          setSelectedId(null);
          router.refresh();
        } else {
          if (!form.klijent_id) throw new Error("Nedostaje ID za izmjenu.");
          const result = await updateKlijent({
            klijent_id: form.klijent_id,
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
                Number(it.klijent_id) === Number(form.klijent_id)
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
        await setKlijentActive({
          klijent_id: selectedItem.klijent_id,
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
              {t("studioKlijenti.title")}
            </h1>
          </div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
            {t("studioKlijenti.hintClick")} <b>{t("studioKlijenti.change")}</b> /{" "}
            <b>{t("studioKlijenti.hintChangeDelete")}</b>.
            <span style={{ opacity: 0.9 }}>
              {" "}
              {t("studioKlijenti.hintDeleteMeaning")}
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
            <span style={{ marginRight: 6 }}>➕</span> {t("studioKlijenti.new")}
          </button>

          <button
            className="btn"
            onClick={openEdit}
            disabled={!selectedItem || isPending}
            style={btnDisabled(!selectedItem || isPending)}
            title={!selectedItem ? t("studioKlijenti.selectFirst") : t("studioKlijenti.change")}
          >
            <span style={{ marginRight: 6 }}>✏️</span> {t("studioKlijenti.change")}
          </button>

          <button
            className="btn"
            onClick={openConfirmToggle}
            disabled={!selectedItem || isPending}
            style={btnDisabled(!selectedItem || isPending)}
            title={
              !selectedItem
                ? t("studioKlijenti.selectFirst")
                : selectedIsActive
                  ? t("studioKlijenti.deactivate")
                  : t("studioKlijenti.activate")
            }
          >
            <span style={{ marginRight: 6 }}>
              {selectedIsActive ? "🗑️" : "✅"}
            </span>
            {selectedIsActive ? t("studioKlijenti.delete") : t("studioKlijenti.activate")}
          </button>

          <button className="btn" onClick={onClosePage}>
            <span style={{ marginRight: 6 }}>✖</span> {t("studioKlijenti.close")}
          </button>
        </div>
      </div>

      <ImportSection
        templateHref="/templates/import/klijenti.xlsx"
        apiUrl="/api/studio/import/klijenti"
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
              placeholder={t("studioKlijenti.searchPlaceholder")}
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
              {t("studioKlijenti.showInactive")}
            </label>
          </div>

          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            {showInactive ? (
              <>
                {t("studioKlijenti.activeCount")}: <b style={{ color: "var(--text)" }}>{counts.active}</b>{" "}
                / {t("studioKlijenti.totalCount")}: <b style={{ color: "var(--text)" }}>{counts.total}</b>
              </>
            ) : (
              <>
                {t("studioKlijenti.activeCount")}: <b style={{ color: "var(--text)" }}>{counts.active}</b>
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
        <table className="table" style={{ tableLayout: "fixed", minWidth: 900 }}>
          <colgroup>
            <col style={{ width: "28%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>{t("studioKlijenti.colNaziv")}</th>
              <th>{t("studioKlijenti.colTip")}</th>
              <th>{t("studioKlijenti.colTrziste")}</th>
              <th>{t("studioKlijenti.colGradDrzava")}</th>
              <th>{hasJib ? "JIB" : t("studioKlijenti.colPorezniId")}</th>
              <th className="num">{t("studioKlijenti.colRokDana")}</th>
              <th>{t("studioKlijenti.colStatus")}</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: "var(--muted)", padding: 16 }}>
                  {t("studioKlijenti.noClients")}
                </td>
              </tr>
            ) : (
              filtered.map((it) => {
                const isSelected = Number(selectedId) === Number(it.klijent_id);
                const isActive = Number(it.aktivan) === 1;

                const gradDrzava = [it.grad, it.drzava]
                  .filter(Boolean)
                  .join(" · ");
                const isIno = Number(it.is_ino) === 1;

                return (
                  <tr
                    key={it.klijent_id}
                    onClick={() => setSelectedId(it.klijent_id)}
                    onDoubleClick={() => openEditForItem(it)}
                    style={subtleRowStyle(isSelected)}
                    data-closed={isActive ? "0" : "1"}
                    title={t("studioKlijenti.rowTitle")}
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
                          {it.naziv_klijenta}
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

                    <td>{badgeTip(it.tip_klijenta)}</td>

                    <td>{badgeTrziste(isIno)}</td>

                    <td
                      className="cell-wrap"
                      style={{
                        color: gradDrzava ? "var(--text)" : "var(--muted)",
                        fontSize: 13,
                      }}
                    >
                      {gradDrzava || "—"}
                    </td>

                    <td
                      style={{
                        color: (hasJib ? it.jib : it.porezni_id) ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {hasJib ? (it.jib || "—") : (it.porezni_id || "—")}
                    </td>

                    <td
                      className="num"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {Number(it.rok_placanja_dana ?? 0)}
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
        <div className="studio-modal" style={overlayStyle()} role="dialog" aria-modal="true">
          <div style={modalStyle(980)}>
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
                      ? t("studioKlijenti.modalNew")
                      : t("studioKlijenti.modalEdit")}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--muted)",
                      fontSize: 15,
                    }}
                  >
                    {t("studioKlijenti.modalSubtitle")}
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
                    {t("studioKlijenti.labelNaziv")}
                  </div>
                  <input
                    value={form.naziv_klijenta}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, naziv_klijenta: e.target.value }))
                    }
                    placeholder={t("studioKlijenti.placeholderNaziv")}
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
                    {t("studioKlijenti.labelTip")}
                  </div>
                  <select
                    value={form.tip_klijenta}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        tip_klijenta: e.target.value as TipKlijenta,
                      }))
                    }
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  >
                    <option value="direktni">{t("studioKlijenti.tipDirektni")}</option>
                    <option value="agencija">{t("studioKlijenti.tipAgencija")}</option>
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
                    {t("studioKlijenti.labelPorezniId")}
                  </div>
                  <input
                    value={form.porezni_id}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, porezni_id: e.target.value }))
                    }
                    placeholder={t("studioKlijenti.placeholderPorezniId")}
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  />
                </div>

                {hasJib && (
                  <div>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: 16,
                        marginBottom: 8,
                      }}
                    >
                      {t("studioKlijenti.labelJib")}
                    </div>
                    <input
                      value={form.jib}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, jib: e.target.value }))
                      }
                      placeholder={t("studioKlijenti.placeholderJib")}
                      className="input"
                      style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                      maxLength={20}
                    />
                  </div>
                )}

                {hasPib && (
                  <div>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: 16,
                        marginBottom: 8,
                      }}
                    >
                      {t("studioKlijenti.labelPib")}
                    </div>
                    <input
                      value={form.pib}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, pib: e.target.value }))
                      }
                      placeholder={t("studioKlijenti.placeholderPib")}
                      className="input"
                      style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                      maxLength={20}
                    />
                  </div>
                )}

                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    {t("studioKlijenti.labelRokPlacanja")}
                  </div>
                  <input
                    value={form.rok_placanja_dana}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        rok_placanja_dana: e.target.value,
                      }))
                    }
                    placeholder="0"
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
                    {t("studioKlijenti.labelAdresa")}
                  </div>
                  <input
                    value={form.adresa}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, adresa: e.target.value }))
                    }
                    placeholder={t("studioKlijenti.placeholderAdresa")}
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
                    {t("studioKlijenti.labelGrad")}
                  </div>
                  <input
                    value={form.grad}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, grad: e.target.value }))
                    }
                    placeholder={t("studioKlijenti.placeholderGrad")}
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
                    {t("studioKlijenti.labelDrzava")}
                  </div>
                  <input
                    value={form.drzava}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, drzava: e.target.value }))
                    }
                    placeholder={t("studioKlijenti.placeholderDrzava")}
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
                    {t("studioKlijenti.labelEmail")}
                  </div>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, email: e.target.value }))
                    }
                    placeholder={t("studioKlijenti.placeholderEmail")}
                    className="input"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 15 }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.is_ino}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, is_ino: e.target.checked }))
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
                    {locale === "en" ? t("vat.vatTreatment") : t("vat.inoClient")}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>
                    {locale === "en" ? t("vat.vatTreatmentHint") : `— ${t("vat.inoClientHint")}`}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.pdv_oslobodjen}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        pdv_oslobodjen: e.target.checked,
                      }))
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
                    {locale === "en" ? t("vat.vatExempt") : t("vat.pdvOslobodjenLabel")}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>
                    — {t("vat.pdvOslobodjenHint")}
                  </span>
                </div>

                {form.pdv_oslobodjen && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      {t("vat.pdvNapomenaLabel")}
                    </div>
                    <textarea
                      value={form.pdv_oslobodjen_napomena}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          pdv_oslobodjen_napomena: e.target.value,
                        }))
                      }
                      placeholder={t("studioKlijenti.placeholderPdvNapomena")}
                      className="input"
                    style={{ width: "100%", minHeight: 70, resize: "vertical", padding: "12px 14px", fontSize: 15 }}
                    />
                  </div>
                )}

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
                      fontWeight: 600,
                    }}
                  >
                    {t("studioKlijenti.labelAktivno")}
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
                    {t("studioKlijenti.labelNapomena")}
                  </div>
                  <textarea
                    value={form.napomena}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, napomena: e.target.value }))
                    }
                    placeholder={t("studioKlijenti.placeholderNapomena")}
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
                  {t("studioKlijenti.system")}
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
                      {t("studioKlijenti.id")}
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {form.klijent_id ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {t("studioKlijenti.created")}
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {form.created_at ? fmtDateTime(form.created_at) : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {t("studioKlijenti.updated")}
                    </div>
                    <div style={{ fontWeight: 700 }}>
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
                    title={t("studioKlijenti.prev")}
                  >
                    ◀
                  </button>
                  <button
                    className="btn"
                    onClick={goNext}
                    disabled={isPending || !canNext}
                    style={btnDisabled(isPending || !canNext)}
                    title={t("studioKlijenti.next")}
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
                {t("studioKlijenti.cancel")}
              </button>
              <button
                className="btn btn--active"
                onClick={() => onSave()}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {isPending ? t("studioKlijenti.saving") : t("studioKlijenti.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Upozorenje JIB/PIB: Koriguj ili Snimi svejedno */}
      {saveWarning ? (
        <div className="studio-modal" style={overlayStyle()} role="dialog" aria-modal="true">
          <div style={modalStyle(520)}>
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid var(--border)",
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              {t("studioKlijenti.correctBtn")} ili {t("studioKlijenti.saveAnywayBtn")}?
            </div>
            <div
              style={{
                padding: 16,
                color: "var(--text)",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {saveWarning.message}
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
                onClick={() => setSaveWarning(null)}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {t("studioKlijenti.correctBtn")}
              </button>
              <button
                className="btn btn--active"
                onClick={() => {
                  setSaveWarning(null);
                  onSave(true);
                }}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {t("studioKlijenti.saveAnywayBtn")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm: deactivate/activate */}
      {confirmOpen && selectedItem ? (
        <div className="studio-modal" style={overlayStyle()} role="dialog" aria-modal="true">
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
                    ? t("studioKlijenti.confirmDeactivateTitle")
                    : t("studioKlijenti.confirmActivateTitle")}
                </div>
                <div
                  style={{ marginTop: 4, color: "var(--muted)", fontSize: 14 }}
                >
                  <b style={{ color: "var(--text)" }}>
                    {selectedItem.naziv_klijenta}
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
                ? t("studioKlijenti.confirmDeactivateBody")
                : t("studioKlijenti.confirmActivateBody")}
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
                {t("studioKlijenti.cancel")}
              </button>
              <button
                className="btn btn--active"
                onClick={onToggleActiveConfirmed}
                disabled={isPending}
                style={btnDisabled(isPending)}
              >
                {isPending
                  ? t("studioKlijenti.working")
                  : selectedIsActive
                    ? t("studioKlijenti.deactivate")
                    : t("studioKlijenti.activate")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
