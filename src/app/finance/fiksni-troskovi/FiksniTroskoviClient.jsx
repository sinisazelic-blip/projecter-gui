"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import {
  createFiksniTrosak,
  updateFiksniTrosak,
  setFiksniTrosakActive,
} from "./actions";

const FREQUENCIES = [
  { value: "MJESECNO", key: "freqMonthly" },
  { value: "GODISNJE", key: "freqYearly" },
  { value: "JEDNOKRATNO", key: "freqOnce" },
];
const VALUTE = ["BAM", "EUR"];

function emptyForm() {
  return {
    trosak_id: null,
    naziv_troska: "",
    frekvencija: "MJESECNO",
    dan_u_mjesecu: "",
    datum_dospijeca: "",
    iznos: "",
    valuta: "BAM",
    aktivan: true,
  };
}

const overlayStyle = {
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

const modalStyle = {
  width: "min(100%, 520px)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
  boxShadow: "var(--shadow)",
  overflow: "hidden",
};

export default function FiksniTroskoviClient({ initialRows = [] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState(null);

  const excelRows = (initialRows ?? []).map((r) => [
    r.trosak_id ?? "",
    r.naziv_troska ?? "",
    r.frekvencija ?? "",
    r.dan_u_mjesecu ?? "",
    r.datum_dospijeca ? String(r.datum_dospijeca).slice(0, 10) : "",
    r.iznos ?? "",
    r.valuta ?? "BAM",
    r.zadnje_placeno ? String(r.zadnje_placeno).slice(0, 10) : "",
    r.aktivan != null ? (r.aktivan ? t("fiksniTroskovi.yes") : t("fiksniTroskovi.no")) : "",
  ]);

  function openNew() {
    setError(null);
    setForm(emptyForm());
    setIsEdit(false);
    setModalOpen(true);
  }

  function openEdit(row) {
    setError(null);
    setForm({
      trosak_id: row.trosak_id,
      naziv_troska: row.naziv_troska ?? "",
      frekvencija: row.frekvencija ?? "MJESECNO",
      dan_u_mjesecu: row.dan_u_mjesecu != null ? String(row.dan_u_mjesecu) : "",
      datum_dospijeca: row.datum_dospijeca
        ? String(row.datum_dospijeca).slice(0, 10)
        : "",
      iznos: row.iznos != null ? String(row.iznos) : "",
      valuta: row.valuta ?? "BAM",
      aktivan: Number(row.aktivan) === 1,
    });
    setIsEdit(true);
    setModalOpen(true);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      ...form,
      dan_u_mjesecu: form.dan_u_mjesecu || null,
      datum_dospijeca: form.datum_dospijeca || null,
      iznos: form.iznos,
      aktivan: form.aktivan,
    };
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateFiksniTrosak(payload);
        } else {
          await createFiksniTrosak(payload);
        }
        setModalOpen(false);
        router.refresh();
      } catch (err) {
        setError(err?.message ?? "Greška");
      }
    });
  }

  function handleDeactivate(id) {
    setConfirmDeactivateId(id);
  }

  function confirmDeactivateYes() {
    if (!confirmDeactivateId) return;
    const id = confirmDeactivateId;
    setConfirmDeactivateId(null);
    startTransition(async () => {
      try {
        await setFiksniTrosakActive(id, false);
        router.refresh();
      } catch (err) {
        setError(err?.message ?? "Greška");
      }
    });
  }

  function handleReactivate(id) {
    startTransition(async () => {
      try {
        await setFiksniTrosakActive(id, true);
        router.refresh();
      } catch (err) {
        setError(err?.message ?? "Greška");
      }
    });
  }

  return (
    <>
      <div className="card tableCard">
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t("fiksniTroskovi.catalogueTitle")}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="muted">
              {(t("fiksniTroskovi.shownCount") || "").replace("{{count}}", initialRows?.length ?? 0)}
            </span>
            <button
              type="button"
              className="btn btn--active"
              onClick={openNew}
              disabled={isPending}
            >
              + {t("fiksniTroskovi.addButton")}
            </button>
            <ExportExcelButton
              filename="fiksni_troskovi"
              sheetName={t("fiksniTroskovi.excelSheetName")}
              headers={[
                t("fiksniTroskovi.colId"),
                t("fiksniTroskovi.colName"),
                t("fiksniTroskovi.colFrequency"),
                t("fiksniTroskovi.colDay"),
                t("fiksniTroskovi.colDue"),
                t("fiksniTroskovi.colAmount"),
                t("fiksniTroskovi.colCurrency"),
                t("fiksniTroskovi.colLastPaid"),
                t("fiksniTroskovi.colActive"),
              ]}
              rows={excelRows}
            />
          </span>
        </div>
        <div className="table-wrap">
          <table className="table" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: 70 }}>{t("fiksniTroskovi.colId")}</th>
                <th style={{ width: 180 }}>{t("fiksniTroskovi.colName")}</th>
                <th style={{ width: 100 }}>{t("fiksniTroskovi.colFrequency")}</th>
                <th style={{ width: 70 }}>{t("fiksniTroskovi.colDay")}</th>
                <th style={{ width: 120 }}>{t("fiksniTroskovi.colDue")}</th>
                <th style={{ width: 100 }} className="num">{t("fiksniTroskovi.colAmount")}</th>
                <th style={{ width: 110 }}>{t("fiksniTroskovi.colLastPaid")}</th>
                <th style={{ width: 70 }}>{t("fiksniTroskovi.colActive")}</th>
                <th style={{ width: 200 }}>{t("fiksniTroskovi.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {initialRows?.length
                ? initialRows.map((r, idx) => (
                    <tr key={r.trosak_id ?? idx}>
                      <td style={{ width: 70 }}>{r.trosak_id ?? "—"}</td>
                      <td
                        style={{
                          fontWeight: 700,
                          maxWidth: 180,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={r.naziv_troska ?? ""}
                      >
                        {r.naziv_troska ?? "—"}
                      </td>
                      <td style={{ width: 100 }}>{r.frekvencija ?? "—"}</td>
                      <td style={{ width: 70 }}>{r.dan_u_mjesecu ?? "—"}</td>
                      <td style={{ width: 120 }} className="nowrap">
                        {r.datum_dospijeca
                          ? String(r.datum_dospijeca).slice(0, 10)
                          : "—"}
                      </td>
                      <td style={{ width: 100 }} className="num">
                        {r.iznos != null
                          ? `${Number(r.iznos).toFixed(2)} ${r.valuta ?? "BAM"}`
                          : "—"}
                      </td>
                      <td style={{ width: 110 }} className="nowrap">
                        {r.zadnje_placeno
                          ? String(r.zadnje_placeno).slice(0, 10)
                          : "—"}
                      </td>
                      <td style={{ width: 70 }}>
                        {r.aktivan != null
                          ? r.aktivan
                            ? t("fiksniTroskovi.yes")
                            : "—"
                          : "—"}
                      </td>
                      <td style={{ width: 200 }}>
                        <span style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => openEdit(r)}
                            disabled={isPending}
                          >
                            {t("fiksniTroskovi.editButton")}
                          </button>
                          {Number(r.aktivan) === 1 ? (
                            <button
                              type="button"
                              className="btn"
                              onClick={() => handleDeactivate(r.trosak_id)}
                              disabled={isPending}
                            >
                              {t("fiksniTroskovi.deactivateButton")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--active"
                              onClick={() => handleReactivate(r.trosak_id)}
                              disabled={isPending}
                            >
                              {t("fiksniTroskovi.reactivateButton")}
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))
                : (
                    <tr>
                      <td colSpan={9} className="muted" style={{ padding: 16 }}>
                        {t("fiksniTroskovi.noResults")}
                      </td>
                    </tr>
                  )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Novi / Uredi */}
      {modalOpen && (
        <div style={overlayStyle} onClick={() => !isPending && setModalOpen(false)}>
          <div
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 16, borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
              {isEdit ? t("fiksniTroskovi.formTitleEdit") : t("fiksniTroskovi.formTitleNew")}
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              {error && (
                <div style={{ padding: 10, background: "rgba(239,68,68,0.15)", borderRadius: 8, color: "var(--bad)", fontSize: 14 }}>
                  {error}
                </div>
              )}
              <div>
                <label className="label">{t("fiksniTroskovi.colName")} *</label>
                <input
                  className="input"
                  value={form.naziv_troska}
                  onChange={(e) => setForm((f) => ({ ...f, naziv_troska: e.target.value }))}
                  required
                  maxLength={255}
                />
              </div>
              <div>
                <label className="label">{t("fiksniTroskovi.colFrequency")}</label>
                <select
                  className="input"
                  value={form.frekvencija}
                  onChange={(e) => setForm((f) => ({ ...f, frekvencija: e.target.value }))}
                >
                  {FREQUENCIES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t("fiksniTroskovi." + opt.key)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t("fiksniTroskovi.colDay")} (1–31)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={31}
                  value={form.dan_u_mjesecu}
                  onChange={(e) => setForm((f) => ({ ...f, dan_u_mjesecu: e.target.value }))}
                  placeholder="—"
                />
              </div>
              <div>
                <label className="label">{t("fiksniTroskovi.formDueDate")}</label>
                <input
                  className="input"
                  type="date"
                  value={form.datum_dospijeca}
                  onChange={(e) => setForm((f) => ({ ...f, datum_dospijeca: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">{t("fiksniTroskovi.colAmount")} *</label>
                <input
                  className="input"
                  type="text"
                  inputMode="decimal"
                  value={form.iznos}
                  onChange={(e) => setForm((f) => ({ ...f, iznos: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">{t("fiksniTroskovi.colCurrency")}</label>
                <select
                  className="input"
                  value={form.valuta}
                  onChange={(e) => setForm((f) => ({ ...f, valuta: e.target.value }))}
                >
                  {VALUTE.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.aktivan}
                  onChange={(e) => setForm((f) => ({ ...f, aktivan: e.target.checked }))}
                />
                <span>{t("fiksniTroskovi.colActive")}</span>
              </label>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn--active" disabled={isPending}>
                  {t("fiksniTroskovi.save")}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                >
                  {t("fiksniTroskovi.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm deactivate */}
      {confirmDeactivateId != null && (
        <div style={overlayStyle} onClick={() => !isPending && setConfirmDeactivateId(null)}>
          <div
            style={{ ...modalStyle, width: "min(100%, 400px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 16 }}>
              <p style={{ margin: "0 0 16px", lineHeight: 1.5 }}>
                {t("fiksniTroskovi.confirmDeactivate")}
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn--active"
                  onClick={confirmDeactivateYes}
                  disabled={isPending}
                >
                  {t("fiksniTroskovi.deactivateButton")}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setConfirmDeactivateId(null)}
                  disabled={isPending}
                >
                  {t("fiksniTroskovi.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
