"use client";

import React from "react";
import {
  getFluxaScbBasePackage,
  type FluxaScbBasePackageId,
} from "@/lib/fluxascb-activation";

interface TenantRowLike {
  tenant_id: number;
  naziv: string;
  tenant_public_id?: string | null;
  soccs_tier?: string | null;
  status: string;
  cijena_mjesecno?: number | string | null;
  valuta?: string | null;
  subscription_ends_at?: string | null;
  days_until_end: number;
  licence_token?: string | null;
}

interface FluxaScbTableRowProps {
  row: TenantRowLike;
  isKasicaRole: boolean;
  statusSavingId: number | null;
  onOpenToken: (row: any) => void;
  onOpenExtend: (row: any) => void;
  onOpenManage: (row: any) => void;
  onSetStatus: (tenantId: number, status: "PILOT" | "AKTIVAN" | "SUSPENDOVAN", row: any) => void;
  formatDateBiH: (dateStr: string | null | undefined) => string;
}

export default function FluxaScbTableRow({
  row,
  isKasicaRole,
  statusSavingId,
  onOpenToken,
  onOpenExtend,
  onOpenManage,
  onSetStatus,
  formatDateBiH,
}: FluxaScbTableRowProps) {
  const pkgId = (row.soccs_tier as FluxaScbBasePackageId) || "FLUXASCB_CORE_MONTHLY";
  const pkg = getFluxaScbBasePackage(pkgId);
  const st = String(row.status ?? "").toUpperCase();
  const days = Number(row.days_until_end);

  const thTd: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
    fontSize: 12,
    verticalAlign: "middle",
  };

  const isExpired = days < 0;
  const isSuspended = st === "SUSPENDOVAN";
  const isWarn = days >= 0 && days <= 2;

  return (
    <tr style={{ backgroundColor: isSuspended ? "rgba(239, 68, 68, 0.05)" : "transparent" }}>
      <td style={thTd}>
        <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: 13 }}>{row.naziv}</div>
        {row.tenant_public_id && (
          <code style={{ fontSize: 10, color: "#94a3b8", display: "block", marginTop: 2 }}>
            {row.tenant_public_id}
          </code>
        )}
      </td>
      <td style={thTd}>
        <span
          style={{
            display: "inline-block",
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 999,
            background:
              pkg.tier === "PRO"
                ? "rgba(168, 85, 247, 0.18)"
                : pkg.tier === "CGI"
                  ? "rgba(56, 189, 248, 0.18)"
                  : "rgba(34, 197, 94, 0.16)",
            color: pkg.tier === "PRO" ? "#c084fc" : pkg.tier === "CGI" ? "#38bdf8" : "#4ade80",
            border: "1px solid rgba(148, 163, 184, 0.3)",
            textTransform: "uppercase",
          }}
        >
          {pkg.tier}
        </span>
      </td>
      <td style={thTd}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#cbd5e1" }}>
          {pkg.billingMode === "SINGLE_EVENT" ? "Jedan Event (7d)" : "Mjesečna pretplata"}
        </span>
      </td>
      {!isKasicaRole && (
        <td style={thTd}>
          {row.cijena_mjesecno != null ? `${row.cijena_mjesecno} ${row.valuta || "EUR"}` : `${pkg.priceEur} EUR`}
        </td>
      )}
      <td style={thTd}>{formatDateBiH(row.subscription_ends_at)}</td>
      <td style={thTd}>
        <span style={{ fontWeight: 700, color: isExpired ? "#f87171" : isWarn ? "#fbbf24" : "#4ade80" }}>
          {Number.isFinite(days) ? `${days} d` : "—"}
        </span>
      </td>
      <td style={thTd}>
        <span style={{ fontWeight: 700, color: isSuspended ? "#f87171" : "#34d399" }}>{st || "AKTIVAN"}</span>
      </td>
      <td style={thTd}>
        <button
          type="button"
          className="btn btn-sm"
          style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer" }}
          onClick={() => onOpenToken(row)}
        >
          🔑 Token
        </button>
      </td>
      {!isKasicaRole && (
        <td style={{ ...thTd, textAlign: "center" }}>
          <div style={{ display: "flex", gap: 5, justifyContent: "center", alignItems: "center", flexWrap: "nowrap" }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                fontSize: 11,
                padding: "3px 8px",
                color: "#60a5fa",
                borderColor: "rgba(96, 165, 250, 0.45)",
                background: "rgba(59, 130, 246, 0.12)",
                cursor: "pointer",
              }}
              onClick={() => onOpenExtend(row)}
            >
              Valid to
            </button>
            {isSuspended ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={statusSavingId === row.tenant_id}
                onClick={() => onSetStatus(row.tenant_id, "AKTIVAN", row)}
              >
                Live
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                disabled={statusSavingId === row.tenant_id}
                style={{ color: "#f87171", borderColor: "rgba(248, 113, 113, 0.45)" }}
                onClick={() => onSetStatus(row.tenant_id, "SUSPENDOVAN", row)}
              >
                Kill
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm"
              style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer" }}
              onClick={() => onOpenManage(row)}
            >
              Upravljaj
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
