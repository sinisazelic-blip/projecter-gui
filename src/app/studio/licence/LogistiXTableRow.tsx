"use client";

import React from "react";
import { getLogistixBasePackage, type LogistixBasePackageId } from "@/lib/logistix-activation";

interface TenantRowLike {
  tenant_id: number;
  naziv: string;
  tenant_public_id?: string | null;
  soccs_tier?: string | null;
  soccs_platform_scope?: string | null;
  status: string;
  cijena_mjesecno?: number | string | null;
  valuta?: string | null;
  subscription_ends_at?: string | null;
  days_until_end: number;
  licence_token?: string | null;
}

interface LogistiXTableRowProps {
  row: TenantRowLike;
  isKasicaRole: boolean;
  statusSavingId: number | null;
  onOpenModules: (row: any) => void;
  onOpenToken: (row: any) => void;
  onOpenExtend: (row: any) => void;
  onOpenManage: (row: any) => void;
  onSetStatus: (tenantId: number, status: "PILOT" | "AKTIVAN" | "SUSPENDOVAN", row: any) => void;
  formatDateBiH: (dateStr: string | null | undefined) => string;
}

export default function LogistiXTableRow({
  row,
  isKasicaRole,
  statusSavingId,
  onOpenModules,
  onOpenToken,
  onOpenExtend,
  onOpenManage,
  onSetStatus,
  formatDateBiH,
}: LogistiXTableRowProps) {
  const pkgId = (row.soccs_tier as LogistixBasePackageId) || "LOGISTIX_FLEET_MONTHLY";
  const pkg = getLogistixBasePackage(pkgId);
  const st = String(row.status ?? "").toUpperCase();
  const days = Number(row.days_until_end);

  const thTd: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
    fontSize: 12,
    verticalAlign: "middle",
  };

  const tdFlux: React.CSSProperties = {
    ...thTd,
    textAlign: "center",
  };

  // Status color logic
  const isExpired = days < 0;
  const isSuspended = st === "SUSPENDOVAN";

  return (
    <tr style={{ backgroundColor: isSuspended ? "rgba(239, 68, 68, 0.05)" : "transparent" }}>
      {/* 1. Naziv Prevoznika (Tenant) */}
      <td style={thTd}>
        <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: 13 }}>{row.naziv}</div>
        {row.tenant_public_id && (
          <code style={{ fontSize: 10, color: "#94a3b8", display: "block", marginTop: 2 }}>
            {row.tenant_public_id}
          </code>
        )}
      </td>

      {/* 2. LogistiX Paket */}
      <td style={thTd}>
        <span
          style={{
            display: "inline-block",
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 999,
            background: "rgba(245, 158, 11, 0.16)",
            color: "#f59e0b",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          {pkg.label}
        </span>
      </td>

      {/* 3. Vozni Park / Kapacitet */}
      <td style={thTd}>
        <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#f1f5f9" }}>
          🚛 Do {pkg.maxTrucks} šlepera
        </span>
      </td>

      {/* 4. Režim (PILOT / NORMAL) */}
      <td style={thTd}>
        {isKasicaRole ? (
          st === "PILOT" ? "Pilot" : "Normal"
        ) : (
          <select
            value={st === "PILOT" ? "PILOT" : "NORMAL"}
            disabled={statusSavingId === row.tenant_id || isSuspended}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const next = e.target.value === "PILOT" ? "PILOT" : "AKTIVAN";
              onSetStatus(row.tenant_id, next, row);
            }}
            style={{
              padding: "4px 8px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "inherit",
              fontSize: 11,
            }}
          >
            <option value="PILOT">Pilot (Demo)</option>
            <option value="NORMAL">Normal</option>
          </select>
        )}
      </td>

      {/* 5. Cijena / Način Naplate */}
      {!isKasicaRole && (
        <td style={thTd}>
          <div style={{ fontWeight: 600, color: "#f8fafc" }}>
            {row.cijena_mjesecno ? `${row.cijena_mjesecno} ${row.valuta || "EUR"}` : "—"}
          </div>
        </td>
      )}

      {/* 6. Ističe Datum */}
      <td style={thTd}>
        <span style={{ color: isExpired ? "#ef4444" : "#cbd5e1" }}>
          {formatDateBiH(row.subscription_ends_at)}
        </span>
      </td>

      {/* 7. Dana do Isteka */}
      <td style={thTd}>
        <span
          style={{
            fontWeight: 700,
            color: isExpired ? "#ef4444" : days <= 14 ? "#f59e0b" : "#10b981",
          }}
        >
          {days} d
        </span>
      </td>

      {/* 8. Stanje */}
      <td style={thTd}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            color: isSuspended ? "#ef4444" : st === "PILOT" ? "#f59e0b" : "#10b981",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: isSuspended ? "#ef4444" : st === "PILOT" ? "#f59e0b" : "#10b981",
            }}
          />
          {st || "AKTIVAN"}
        </span>
      </td>

      {/* 9. Moduli & Paket Dugme */}
      <td style={tdFlux}>
        <button
          type="button"
          onClick={() => onOpenModules(row)}
          style={{
            padding: "5px 12px",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.15))",
            color: "#f59e0b",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            cursor: "pointer",
          }}
        >
          Moduli & Paket
        </button>
      </td>

      {/* 10. Licencni Token */}
      <td style={tdFlux}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {row.licence_token && (
            <code
              style={{
                fontSize: 10,
                color: "#94a3b8",
                background: "rgba(0,0,0,0.25)",
                padding: "2px 6px",
                borderRadius: 4,
                maxWidth: 100,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "inline-block",
              }}
              title={row.licence_token}
            >
              {row.licence_token.slice(0, 10)}…
            </code>
          )}
          <button
            type="button"
            onClick={() => onOpenToken(row)}
            style={{
              padding: "4px 8px",
              fontSize: 11,
              borderRadius: 6,
              background: "#1e293b",
              color: "#f8fafc",
              border: "1px solid #334155",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            🔑 Token
          </button>
        </div>
      </td>

      {/* 11. Akcije */}
      {!isKasicaRole && (
        <td style={{ ...thTd, textAlign: "center" }}>
          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => onOpenExtend(row)}
              style={{
                padding: "4px 8px",
                fontSize: 11,
                borderRadius: 6,
                background: "#0284c7",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Valid to
            </button>
            <button
              type="button"
              onClick={() => onOpenManage(row)}
              style={{
                padding: "4px 8px",
                fontSize: 11,
                borderRadius: 6,
                background: "#334155",
                color: "#f8fafc",
                border: "none",
                cursor: "pointer",
              }}
            >
              Upravljaj
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
