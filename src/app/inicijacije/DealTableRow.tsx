"use client";

import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";

interface DealTableRowProps {
  deal: any;
  opened: boolean;
  projectStatusName: string | null;
  dealStatusName: string | null;
  statusLabel: string;
  rokIso: string | null;
  sem: { cls: string; title: string };
  sig: { bg: string; border: string; dot: string; label: string; title: string } | null;
}

export default function DealTableRow({
  deal,
  opened,
  projectStatusName,
  dealStatusName,
  statusLabel,
  rokIso,
  sem,
  sig,
}: DealTableRowProps) {
  const { t } = useTranslation();
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  };

  const fmtDateTime = (v: string | null | undefined) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
  };

  return (
    <tr
      onClick={(e) => {
        // Ne navigiraj ako je klik na link ili button
        const t = e.target as EventTarget & { closest?: (s: string) => Element | null };
        if (
          e.target instanceof HTMLAnchorElement ||
          e.target instanceof HTMLButtonElement ||
          (typeof t.closest === "function" && (t.closest("a") || t.closest("button")))
        )
          return;
        window.location.href = `/inicijacije/${deal.inicijacija_id}`;
      }}
      style={{ cursor: "pointer" }}
      className="clickable-row"
    >
      <td style={{ width: 80 }}>{deal.inicijacija_id}</td>

      <td className="cell-wrap">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {/* ✅ IKONICA + naziv */}
          <div className="dealNameWrap">
            <img
              src="/fluxa/Icon.png"
              alt=""
              className="dealIcon"
            />
            <Link
              href={`/inicijacije/${deal.inicijacija_id}`}
              className="dealLink"
            >
              {deal.radni_naziv}
            </Link>
          </div>

          {/* ✅ Oznaka za plivačko takmičenje iz Kalendara */}
          {deal.is_swim_meet ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(6, 182, 212, 0.15)",
                color: "#22d3ee",
                border: "1px solid rgba(34, 211, 238, 0.35)",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.02em",
              }}
              title={deal.swim_naziv ? `Kalendar takmičenja: ${deal.swim_naziv}` : "Plivačko takmičenje"}
            >
              🏊 Plivačko takmičenje
            </span>
          ) : null}

          {/* ✅ Signal samo kad je PAŽNJA/STOP */}
          {sig ? (
            <span
              className="sigPill"
              title={sig.title}
              style={{
                background: sig.bg,
                borderColor: sig.border,
              }}
            >
              <span
                className="sigDot"
                style={{ background: sig.dot }}
              />
              {sig.label}
            </span>
          ) : null}
        </div>

        {opened && (
          <div className="mutedSmall">
            {t("deals.projectLabel")}{" "}
            <Link
              href={`/projects/${deal.projekat_id}`}
              className="project-link"
            >
              #{deal.projekat_id}
            </Link>
          </div>
        )}
      </td>

      <td style={{ width: 170 }}>
        <span
          className={`sem ${sem.cls}`}
          title={sem.title}
        />{" "}
        <span style={{ marginLeft: 8 }}>
          {rokIso ? fmtDate(rokIso) : "—"}
        </span>
      </td>

      <td style={{ width: 210 }}>{statusLabel}</td>

      <td style={{ width: 190 }}>
        {fmtDateTime(deal.updated_at || deal.created_at)}
      </td>
    </tr>
  );
}
