"use client";

import React from "react";
import { getFluxaXNetBasePackage, type FluxaXNetBasePackageId } from "@/lib/fluxaxnet-activation";

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

interface FluxaXNetTableRowProps {
  row: TenantRowLike;
  isKasicaRole: boolean;
  statusSavingId: number | null;
  onOpenModules: (row: any) => void;
  onOpenToken: (row: any) => void;
  onOpenExtend: (row: any) => void;
  onSetStatus: (tenantId: number, status: string, row: any) => void;
  formatDateBiH: (dateStr: string | null | undefined) => string;
}

export default function FluxaXNetTableRow({
  row,
  isKasicaRole,
  statusSavingId,
  onOpenModules,
  onOpenToken,
  onOpenExtend,
  onSetStatus,
  formatDateBiH,
}: FluxaXNetTableRowProps) {
  const pkgId = (row.soccs_tier as FluxaXNetBasePackageId) || "FLUXAX_STUDIO_MONTHLY";
  const pkg = getFluxaXNetBasePackage(pkgId);
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
  const isGrace = days === -1 && st !== "SUSPENDOVAN";
  const isWarn = days >= 0 && days <= 2;
  const isSuspended = st === "SUSPENDOVAN";

  return (
    <tr style={{ backgroundColor: isSuspended ? "rgba(239, 68, 68, 0.05)" : "transparent" }}>
      {/* 1. Naziv Studija */}
      <td style={thTd}>
        <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: 13 }}>{row.naziv}</div>
        {row.tenant_public_id && (
          <code style={{ fontSize: 10, color: "#94a3b8", display: "block", marginTop: 2 }}>
            {row.tenant_public_id}
          </code>
        )}
      </td>

      {/* 2. FluxaX Paket */}
      <td style={thTd}>
        <span
          style={{
            display: "inline-block",
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 999,
            background: "rgba(56, 189, 248, 0.16)",
            color: "#38bdf8",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          {pkg.label}
        </span>
      </td>

      {/* 3. Max Kanala I/O */}
      <td style={thTd}>
        <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#a5b4fc" }}>
          {pkg.maxInOutputs} I/O
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
              background: "rgba(15, 23, 42, 0.7)",
              border: "1px solid var(--border)",
              color: "inherit",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <option value="NORMAL">Normal</option>
            <option value="PILOT">Pilot (Demo)</option>
          </select>
        )}
      </td>

      {/* 5. Cijena */}
      {!isKasicaRole && (
        <td style={thTd}>
          <span style={{ fontWeight: 700 }}>
            {row.cijena_mjesecno != null ? `${row.cijena_mjesecno} ${row.valuta || "EUR"}` : `${pkg.priceEur} EUR`}
          </span>
        </td>
      )}

      {/* 6. Ističe Datum */}
      <td style={thTd}>
        {formatDateBiH(row.subscription_ends_at)}
      </td>

      {/* 7. Dana do Isteka */}
      <td style={thTd}>
        {isGrace ? (
          <span style={{ color: "#f59e0b", fontWeight: 800 }}>
            Tolerancija 24h
          </span>
        ) : isExpired ? (
          <span style={{ color: "#ef4444", fontWeight: 800 }}>
            Isteklo ({days}d)
          </span>
        ) : isWarn ? (
          <span style={{ color: "#fb923c", fontWeight: 800 }}>
            {days} d (Uskoro)
          </span>
        ) : (
          <span style={{ color: "#4ade80", fontWeight: 700 }}>
            {days} d
          </span>
        )}
      </td>

      {/* 8. Stanje (Lampica) */}
      <td style={thTd}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: isSuspended ? "#ef4444" : isGrace ? "#f59e0b" : isExpired ? "#ef4444" : "#10b981",
              boxShadow: isSuspended ? "none" : "0 0 8px rgba(16, 185, 129, 0.6)",
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
            {st}
          </span>
        </div>
      </td>

      {/* 9. Moduli & Paket Dugme */}
      <td style={tdFlux}>
        <button
          type="button"
          className="btn"
          style={{
            fontSize: 11,
            padding: "4px 10px",
            color: "#38bdf8",
            borderColor: "rgba(56, 189, 248, 0.45)",
            background: "rgba(14, 165, 233, 0.12)",
            whiteSpace: "nowrap",
            cursor: "pointer",
          }}
          onClick={() => onOpenModules(row)}
          title="Uredi audio module i licencni paket za ovaj studio"
        >
          🎛️ Moduli & Paket
        </button>
      </td>

      {/* 10. Licencni Token */}
      <td style={tdFlux}>
        <button
          type="button"
          className="btn"
          style={{
            fontSize: 11,
            padding: "4px 8px",
            whiteSpace: "nowrap",
            cursor: "pointer",
          }}
          onClick={() => onOpenToken(row)}
          title="Prikaži ili kopiraj trajni licence token za StudioBridge"
        >
          {row.licence_token ? "🔑 Token" : "Bez tokena"}
        </button>
      </td>

      {/* 11. Akcije */}
      {!isKasicaRole && (
        <td style={{ ...thTd, textAlign: "center" }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            <button
              type="button"
              className="btn"
              style={{
                fontSize: 11,
                padding: "4px 8px",
                color: "#60a5fa",
                borderColor: "rgba(96, 165, 250, 0.45)",
                background: "rgba(59, 130, 246, 0.12)",
                cursor: "pointer",
              }}
              onClick={() => onOpenExtend(row)}
              title="Produži licencu za ovaj studio"
            >
              Produži
            </button>

            {isSuspended ? (
              <button
                type="button"
                className="btn"
                disabled={statusSavingId === row.tenant_id}
                style={{
                  fontSize: 11,
                  padding: "4px 8px",
                  color: "#f8fafc",
                  borderColor: "rgba(248, 250, 252, 0.35)",
                  background: "rgba(148, 163, 184, 0.2)",
                  cursor: "pointer",
                }}
                onClick={() => onSetStatus(row.tenant_id, "AKTIVAN", row)}
              >
                Omogući
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={statusSavingId === row.tenant_id}
                style={{
                  fontSize: 11,
                  padding: "4px 8px",
                  color: "#f87171",
                  borderColor: "rgba(248, 113, 113, 0.45)",
                  background: "rgba(239, 68, 68, 0.12)",
                  cursor: "pointer",
                }}
                onClick={() => onSetStatus(row.tenant_id, "SUSPENDOVAN", row)}
              >
                Suspenduj
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
