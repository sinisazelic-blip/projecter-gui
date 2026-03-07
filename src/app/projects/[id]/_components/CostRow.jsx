"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/components/LocaleProvider";
import { getCurrencyForLocale } from "@/lib/i18n";
import CostTypeAndEntityPicker from "./CostTypeAndEntityPicker";

const EUR_TO_BAM = 1.95583;

const toYMD = (v) => {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  if (typeof v === "string") {
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];

    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return "";
  }

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const yyyy = v.getFullYear();
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const dd = String(v.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
};

const fmtNum = (v, dec = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(dec);
};

function fmtDisplay(amountKm, locale, t) {
  const n = Number(amountKm);
  if (!Number.isFinite(n)) return "—";
  const ccy = getCurrencyForLocale(locale);
  const loc = locale === "en" ? "en-GB" : "bs-BA";
  const suffix = ccy === "EUR" ? ` ${t("projectDetail.currencyEur")}` : ` ${t("projectDetail.currencyKm")}`;
  const val = ccy === "EUR" ? n / EUR_TO_BAM : n;
  return val.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
}

const fmtDate = (d) => {
  if (!d) return "—";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  if (!y || !m || !day) return s;
  return `${day}.${m}.${y}`;
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
};

const CURRENCIES = ["BAM", "EUR", "USD", "RSD"];

function OneLineAmount({ c, t, locale }) {
  const km = Number(c?.iznos_km);
  const orig = Number(c?.iznos_original);
  const ccy = String(c?.valuta_original || "BAM").toUpperCase();

  if (!ccy || ccy === "BAM" || !Number.isFinite(orig) || !Number.isFinite(km)) {
    return fmtDisplay(km, locale, t);
  }
  return `${fmtNum(orig, 2)} ${ccy} (≈ ${fmtDisplay(km, locale, t)})`;
}

export default function CostRow({ c, project, actions, returnTo }) {
  const { t, locale } = useTranslation();
  const safeReturnTo = returnTo || `/projects/${project?.projekat_id ?? ""}`;

  const ccy = String(c?.valuta_original || "BAM").toUpperCase();
  const kursDefault = Number.isFinite(Number(c?.kurs_u_km))
    ? String(c.kurs_u_km)
    : "1";

  const iznosDefault = Number.isFinite(Number(c?.iznos_original))
    ? String(c.iznos_original)
    : String(c?.iznos_km ?? "");

  const [editLink, setEditLink] = useState({
    tip_id: Number(c.tip_id) || null,
    entity_type: c.entity_type ?? null,
    entity_id: c.entity_id ?? null,
  });

  useEffect(() => {
    setEditLink({
      tip_id: Number(c.tip_id) || null,
      entity_type: c.entity_type ?? null,
      entity_id: c.entity_id ?? null,
    });
  }, [c.trosak_id, c.tip_id, c.entity_type, c.entity_id]);

  const hasEntity = Boolean(c?.entity_type && c?.entity_name);

  const [open, setOpen] = useState(false);
  const [canPortal, setCanPortal] = useState(false);

  useEffect(() => {
    setCanPortal(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const initialDate = useMemo(
    () => toYMD(c?.datum_troska) || "",
    [c?.datum_troska],
  );

  const modal = (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.72)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: "min(980px, 100%)",
          maxHeight: "85vh",
          overflow: "auto",
          padding: 14,
          borderRadius: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 700 }}>{t("projectDetail.editCostTitle")}</div>
          <button type="button" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>

        <form action={actions.editCost} style={{ marginTop: 10 }}>
          <input type="hidden" name="projekat_id" value={project.projekat_id} />
          <input type="hidden" name="trosak_id" value={c.trosak_id} />
          <input type="hidden" name="return_to" value={safeReturnTo} />

          <input type="hidden" name="tip_id" value={editLink.tip_id ?? ""} />
          <input
            type="hidden"
            name="entity_type"
            value={editLink.entity_type ?? ""}
          />
          <input
            type="hidden"
            name="entity_id"
            value={editLink.entity_id ?? ""}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(240px, 1.4fr) minmax(140px, 1fr) minmax(220px, 2.4fr) minmax(120px, .8fr) minmax(140px, .9fr) minmax(140px, 1fr)",
              gap: 8,
              alignItems: "start",
            }}
          >
            <div style={{ minWidth: 240 }}>
              <CostTypeAndEntityPicker
                value={editLink}
                onChange={(v) =>
                  setEditLink({
                    tip_id: v?.tip_id ?? null,
                    entity_type: v?.entity_type ?? null,
                    entity_id: v?.entity_id ?? null,
                  })
                }
              />
            </div>

            <input
              type="date"
              name="datum_troska"
              defaultValue={initialDate}
              required
              style={inputStyle}
            />

            <textarea
              name="opis"
              defaultValue={String(c.opis ?? "")}
              required
              rows={3}
              style={{ ...inputStyle, resize: "vertical", minHeight: 46 }}
            />

            <select name="valuta" defaultValue={ccy} style={inputStyle}>
              {CURRENCIES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>

            <input
              type="number"
              step="0.01"
              name="iznos_km"
              defaultValue={iznosDefault}
              required
              style={inputStyle}
              title="Iznos u valuti"
            />

            <input
              type="number"
              step="0.000001"
              name="kurs"
              defaultValue={ccy === "BAM" ? "1" : kursDefault}
              required
              style={inputStyle}
              title="Kurs (BAM)"
            />
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button type="submit" disabled={c.status === "STORNIRANO"}>
              {t("projectDetail.saveChanges")}
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              {t("projectDetail.cancel")}
            </button>
            <span className="subtle">{t("projectDetail.costIdLabel")} {c.trosak_id}</span>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <tr style={c.status === "STORNIRANO" ? { opacity: 0.6 } : undefined}>
      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(c.datum_troska)}</td>

      <td
        className="cell-wrap"
        style={{
          maxWidth: 680,
          whiteSpace: "normal",
          wordBreak: "break-word",
          lineHeight: 1.35,
        }}
        title={String(c.opis ?? "")}
      >
        {hasEntity && (
          <div style={{ marginBottom: 6 }}>
            <span
              className="badge"
              data-kind={c.entity_type || ""}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                opacity: 0.9,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                maxWidth: 520,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={`${c.entity_type === "talent" ? t("projectDetail.talentLabel") : t("projectDetail.vendorLabel")}: ${c.entity_name}`}
            >
              <span aria-hidden="true">
                {c.entity_type === "talent" ? "🎤" : "🏢"}
              </span>
              <span style={{ fontWeight: 700 }}>
                {c.entity_type === "talent" ? t("projectDetail.talentLabel") : t("projectDetail.vendorLabel")}:
              </span>
              <span style={{ opacity: 0.95 }}>{c.entity_name}</span>
            </span>
          </div>
        )}

        {c.opis}
      </td>

      <td className="num" style={{ whiteSpace: "nowrap" }}>
        <OneLineAmount c={c} t={t} locale={locale} />
      </td>

      <td>
        <span className="badge" data-status={c.status}>
          {c.status}
        </span>
      </td>

      <td style={{ whiteSpace: "normal" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={c.status === "STORNIRANO"}
          >
            {t("projectDetail.edit")}
          </button>

          <form
            action={actions.setCostStatus}
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <input
              type="hidden"
              name="projekat_id"
              value={project.projekat_id}
            />
            <input type="hidden" name="trosak_id" value={c.trosak_id} />
            <input type="hidden" name="return_to" value={safeReturnTo} />

            <select
              name="status"
              defaultValue={c.status}
              disabled={c.status === "STORNIRANO"}
              style={inputStyle}
            >
              <option value="PLANIRANO">{t("projectDetail.statusPlanned")}</option>
              <option value="NASTALO">{t("projectDetail.statusOccurred")}</option>
              <option value="PLACENO">{t("projectDetail.statusPaid")}</option>
            </select>

            <button type="submit" disabled={c.status === "STORNIRANO"}>
              {t("projectDetail.save")}
            </button>
          </form>

          <details style={{ display: "inline-block" }}>
            <summary
              style={{
                cursor: c.status === "STORNIRANO" ? "not-allowed" : "pointer",
                opacity: c.status === "STORNIRANO" ? 0.6 : 1,
                display: "inline",
              }}
            >
              {t("projectDetail.storno")}
            </summary>

            <div
              className="card"
              style={{ padding: 10, marginTop: 8, minWidth: 320 }}
            >
              background: "rgba(15,15,18,.92)", border: "1px solid
              rgba(255,255,255,.12)",
              <div style={{ marginBottom: 8 }}>
                Da li stvarno želiš stornirati ovaj trošak?
              </div>
              <form
                action={actions.setCostStatus}
                style={{ display: "flex", gap: 8 }}
              >
                <input
                  type="hidden"
                  name="projekat_id"
                  value={project.projekat_id}
                />
                <input type="hidden" name="trosak_id" value={c.trosak_id} />
                <input type="hidden" name="status" value="STORNIRANO" />
                <input type="hidden" name="return_to" value={safeReturnTo} />

                <button type="submit" disabled={c.status === "STORNIRANO"}>
                  Da, storniraj
                </button>
              </form>
              <div className="subtle" style={{ marginTop: 8 }}>
                (Stornirano vidiš kroz “prikaži”.)
              </div>
            </div>
          </details>
        </div>

        {/* ✅ Portal modal ide u BODY, nije u tbody */}
        {open && canPortal ? createPortal(modal, document.body) : null}
      </td>
    </tr>
  );
}
