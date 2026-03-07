"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "@/components/LocaleProvider";

// Helper funkcije
function pad2(n) {
  const s = String(n ?? "");
  return s.length === 1 ? "0" + s : s;
}
function isValidDate(d) {
  return d instanceof Date && Number.isFinite(d.getTime());
}
function parseToDateOnly(v) {
  if (!v) return null;

  if (v instanceof Date && isValidDate(v)) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }

  const s0 = String(v).trim();
  if (!s0) return null;

  const s10 = s0.slice(0, 10);
  const mIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s10);
  if (mIso) {
    const y = Number(mIso[1]);
    const mo = Number(mIso[2]);
    const d = Number(mIso[3]);
    return new Date(y, mo - 1, d);
  }

  const d = new Date(s0);
  if (isValidDate(d))
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());

  return null;
}
function fmtDDMMYYYY(dateOnly) {
  if (!dateOnly) return "—";
  const d = dateOnly.getDate();
  const m = dateOnly.getMonth() + 1;
  const y = dateOnly.getFullYear();
  return `${pad2(d)}.${pad2(m)}.${y}`;
}
function computeDaysDiff(dateOnly) {
  if (!dateOnly) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms = dateOnly.getTime() - today.getTime();
  return Math.round(ms / 86400000);
}
function semColor(daysDiff) {
  if (daysDiff === null) return "gray";
  if (daysDiff <= 0) return "red";
  if (daysDiff <= 3) return "orange";
  return "green";
}
function getSemLabel(daysDiff, t) {
  if (daysDiff === null) return t("projectsPage.deadlineUnknown");
  if (daysDiff < 0) return t("projectsPage.deadlineLate").replace("{days}", Math.abs(daysDiff));
  if (daysDiff === 0) return t("projectsPage.today");
  if (daysDiff === 1) return t("projectsPage.tomorrow");
  return t("projectsPage.deadlineIn").replace("{days}", daysDiff);
}
function dotBg(sem) {
  if (sem === "red") return "rgba(255, 80, 80, .95)";
  if (sem === "orange") return "rgba(255, 165, 0, .95)";
  if (sem === "green") return "rgba(80, 220, 140, .95)";
  return "rgba(180, 180, 180, .85)";
}
const fmtWithSuffix = (v, currencySuffix) => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(2) + currencySuffix;
};

// Status badge komponente
function statusToneById(statusId) {
  const id = Number(statusId ?? 0);
  if (id === 9) return "status-badge--invoiced";
  if (id === 10 || id === 11) return "status-badge--archived";
  if (id === 12) return "status-badge--cancelled";
  if (id === 8) return "status-badge--closed";
  if (id === 7) return "status-badge--done";
  if (id >= 4 && id <= 6) return "status-badge--active";
  if (id >= 1 && id <= 3) return "status-badge--planned";
  return "status-badge--unknown";
}

function StatusBadge({ project, t }) {
  const label =
    project?.statusDisplayName ??
    (project?.status_name ? String(project.status_name) : null) ??
    (project?.status_id ? `Status #${project.status_id}` : "—");
  const cls = statusToneById(project?.status_id);

  return (
    <span className={`status-badge ${cls}`} title={`${t("projectsPage.statusTitle")} ${label}`}>
      <span className="status-badge__dot" />
      {label}
    </span>
  );
}

function normalizeFinStatus(project) {
  const raw = project?.finansijski_status;
  if (!raw) return "unknown";
  return String(raw).trim().toLowerCase();
}

function finMeta(fin, t) {
  switch (fin) {
    case "bez_budzeta":
      return { label: t("projectsPage.finNoBudget"), className: "fin-badge--bez_budzeta" };
    case "u_plusu":
      return { label: t("projectsPage.finInPlus"), className: "fin-badge--u_plusu" };
    case "u_minusu":
      return { label: t("projectsPage.finInMinus"), className: "fin-badge--u_minusu" };
    default:
      return { label: t("projectsPage.finUnknown"), className: "fin-badge--unknown" };
  }
}

function FinancialBadge({ project, t }) {
  const fin = normalizeFinStatus(project);
  const meta = finMeta(fin, t);

  return (
    <span
      className={`fin-badge ${meta.className}`}
      title={`${t("projectsPage.finStatusTitle")} ${fin}`}
    >
      <span className="fin-badge__dot" />
      {meta.label}
    </span>
  );
}

function normalizeSignal(project) {
  const raw = project?.operativni_signal;
  const s = String(raw ?? "NORMALNO")
    .trim()
    .toUpperCase();
  if (s === "PAZNJA") return "PAZNJA";
  if (s === "STOP") return "STOP";
  return "NORMALNO";
}

function signalMeta(sig, t) {
  if (sig === "STOP") {
    return {
      label: t("projectsPage.signalStop"),
      bg: "rgba(255, 80, 80, .22)",
      border: "rgba(255, 80, 80, .35)",
      dot: "rgba(255, 80, 80, .95)",
    };
  }
  if (sig === "PAZNJA") {
    return {
      label: t("projectsPage.signalAttention"),
      bg: "rgba(255, 165, 0, .20)",
      border: "rgba(255, 165, 0, .35)",
      dot: "rgba(255, 165, 0, .95)",
    };
  }
  return {
    label: t("projectsPage.signalNormal"),
    bg: "rgba(80, 220, 140, .18)",
    border: "rgba(80, 220, 140, .32)",
    dot: "rgba(80, 220, 140, .95)",
  };
}

function SignalBadge({ project, t }) {
  const sig = normalizeSignal(project);
  const meta = signalMeta(sig, t);

  return (
    <span
      title={`${t("projectsPage.operativniSignalTitle")} ${sig}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: meta.bg,
        fontWeight: 750,
        letterSpacing: 0.3,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: meta.dot,
          boxShadow: "0 0 0 3px rgba(255,255,255,.06)",
          display: "inline-block",
        }}
      />
      {meta.label}
    </span>
  );
}

const FLOW_KEYS = ["deal", "prod", "done", "closed", "invoiced", "arch"];
const FLOW_STEPS = FLOW_KEYS.map((k) => ({ k: k.toUpperCase(), label: k }));

function flowIndexForProjectStatusId(statusId) {
  const id = Number(statusId ?? 0);
  if (id === 10 || id === 11 || id === 12) return 5;
  if (id === 9) return 4;
  if (id === 8) return 3;
  if (id === 7) return 2;
  if (id >= 4 && id <= 6) return 1;
  if (id >= 1 && id <= 3) return 0;
  return 0;
}

function flowAccentByProjectStatusId(statusId) {
  const id = Number(statusId ?? 0);
  if (id === 10 || id === 11 || id === 12) {
    return {
      dot: "rgba(180, 180, 180, .85)",
      line: "rgba(180, 180, 180, .45)",
      text: "rgba(255,255,255,.78)",
    };
  }
  if (id === 9) {
    return {
      dot: "rgba(80, 170, 255, .95)",
      line: "rgba(80, 170, 255, .45)",
      text: "rgba(255,255,255,.90)",
    };
  }
  if (id === 8) {
    return {
      dot: "rgba(255, 193, 7, .95)",
      line: "rgba(255, 193, 7, .45)",
      text: "rgba(255,255,255,.90)",
    };
  }
  if (id === 7) {
    return {
      dot: "rgba(55,214,122,.95)",
      line: "rgba(55,214,122,.45)",
      text: "rgba(255,255,255,.90)",
    };
  }
  return {
    dot: "rgba(55,214,122,.95)",
    line: "rgba(55,214,122,.45)",
    text: "rgba(255,255,255,.90)",
  };
}

function StatusFlowInline({ project, flowSteps, t }) {
  const steps = flowSteps || FLOW_STEPS;
  const statusId = Number(project?.status_id ?? 0);
  const activeIdx = flowIndexForProjectStatusId(statusId);
  const acc = flowAccentByProjectStatusId(statusId);

  return (
    <div
      style={{
        width: "100%",
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid rgba(255,255,255,.10)",
      }}
      aria-label={t("projectsPage.statusFlowAria")}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
          gap: 10,
          alignItems: "start",
        }}
      >
        {steps.map((s, idx) => {
          const isPast = idx < activeIdx;
          const isActive = idx === activeIdx;

          const dotColor = isPast
            ? "rgba(160,160,160,.75)"
            : isActive
              ? acc.dot
              : "rgba(255,255,255,.18)";

          const lineColor = isPast
            ? "rgba(160,160,160,.35)"
            : idx <= activeIdx
              ? acc.line
              : "rgba(255,255,255,.10)";

          const textColor = isPast
            ? "rgba(255,255,255,.55)"
            : isActive
              ? acc.text
              : "rgba(255,255,255,.72)";

          const fontW = isActive ? 900 : 700;

          return (
            <div key={s.k} style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: dotColor,
                    boxShadow: "0 0 0 3px rgba(255,255,255,.06)",
                    flex: "0 0 auto",
                  }}
                />
                <div
                  aria-hidden="true"
                  style={{
                    height: 3,
                    borderRadius: 99,
                    background: lineColor,
                    flex: 1,
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  fontWeight: fontW,
                  color: textColor,
                  lineHeight: 1.15,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={s.label}
              >
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProjectTableRow({ project }) {
  const { t } = useTranslation();
  const currencySuffix = t("projectsPage.currencySuffix");
  const fmt = (v) => fmtWithSuffix(v, currencySuffix);
  const flowSteps = useMemo(
    () =>
      FLOW_KEYS.map((k) => ({
        k: k.toUpperCase(),
        label: t(`statuses.flow.${k}`),
      })),
    [t],
  );
  const d0 = parseToDateOnly(project?.rok_glavni);
  const rokText = fmtDDMMYYYY(d0);
  const diff = computeDaysDiff(d0);
  const sem = semColor(diff);
  const label = getSemLabel(diff, t);

  // ✅ Provera da li je owner (za sada proveravamo localStorage, kasnije će biti pravi owner sistem)
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    const token = window.localStorage.getItem("FLUXA_OWNER_TOKEN");
    setIsOwner(token?.trim().length > 0 || false);
  }, []);

  return (
    <tr
      onClick={(e) => {
        // Ne navigiraj ako je klik na link ili button
        if (
          e.target instanceof HTMLAnchorElement ||
          e.target instanceof HTMLButtonElement ||
          e.target.closest("a") ||
          e.target.closest("button")
        )
          return;
        window.location.href = `/projects/${project.projekat_id}`;
      }}
      style={{ cursor: "pointer" }}
      className="clickable-row"
    >
      <td>{project.projekat_id}</td>

      <td className="cell-wrap">
        <div>
          <Link
            href={`/projects/${project.projekat_id}`}
            className="project-link"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <img
              src={
                project.operativni_signal === "STOP"
                  ? "/fluxa/Icon_red.png"
                  : project.operativni_signal === "PAZNJA"
                    ? "/fluxa/Icon_zuta.png"
                    : "/fluxa/Icon.png"
              }
              alt=""
              width={18}
              height={18}
              style={{ opacity: 0.9 }}
            />
            <span>{project.radni_naziv}</span>
          </Link>

          {/* ✅ STATUS FLOW (ispod naziva, preko širine ćelije) */}
          <StatusFlowInline project={project} flowSteps={flowSteps} t={t} />
        </div>
      </td>

      <td>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontWeight: 650 }}>{rokText}</span>
          <span
            title={label}
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              display: "inline-block",
              background: dotBg(sem),
              boxShadow: "0 0 0 3px rgba(255,255,255,.06)",
            }}
          />
          <span style={{ opacity: 0.7, fontSize: 12 }}>
            {label}
          </span>
        </div>
      </td>

      <td className="num">
        {(() => {
          // ✅ Izračunaj budžet vidljiv radnicima (procenat od punog budžeta)
          const punBudzet = Number(project.budzet_planirani) || 0;
          const procenatZaTim = Number(project.budzet_procenat_za_tim) || 100.00;
          const budzetZaTim = punBudzet * (procenatZaTim / 100);
          
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span>{fmt(budzetZaTim)}</span>
              {/* ✅ Procenat vidljiv samo owneru */}
              {isOwner && procenatZaTim !== 100 && punBudzet > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    opacity: 0.6,
                    fontStyle: "italic",
                  }}
                  title={`${t("projectsPage.fullBudgetTitle")} ${fmt(punBudzet)}`}
                >
                  ({procenatZaTim.toFixed(0)}%)
                </span>
              )}
            </div>
          );
        })()}
      </td>
      <td className="num">{fmt(project.troskovi_ukupno)}</td>
      <td className="num">
        {(() => {
          // ✅ Izračunaj planiranu zaradu na osnovu budžeta za tim
          const punBudzet = Number(project.budzet_planirani) || 0;
          const procenatZaTim = Number(project.budzet_procenat_za_tim) || 100.00;
          const budzetZaTim = punBudzet * (procenatZaTim / 100);
          const planiranaZaradaZaTim = budzetZaTim - (Number(project.troskovi_ukupno) || 0);
          
          // ✅ Crvena boja ako je zarada negativna (u minusu)
          const isNegative = planiranaZaradaZaTim < 0;
          
          return (
            <span
              style={{
                color: isNegative ? "rgba(255, 80, 80, 0.95)" : "inherit",
                fontWeight: isNegative ? 700 : "inherit",
              }}
            >
              {fmt(planiranaZaradaZaTim)}
            </span>
          );
        })()}
      </td>

      <td>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <SignalBadge project={project} t={t} />
          <span style={{ opacity: 0.45 }}>·</span>
          <StatusBadge project={project} t={t} />
        </div>
      </td>
    </tr>
  );
}
