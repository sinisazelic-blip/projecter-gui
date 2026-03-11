"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";

type DealRow = {
  inicijacija_id: number;
  radni_naziv: string | null;
  status_naziv?: string | null;
  projekat_id?: number | null;
  updated_at?: string | null;
};

export default function MobileDealsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/inicijacije?limit=100")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.rows)) setRows(data.rows);
        else setError(data?.error ?? t("mobile.loadError"));
      })
      .catch(() => setError(t("mobile.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <div
      style={{
        minHeight: "100vh",
        minHeight: "100dvh",
        padding: "20px 16px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <FluxaLogo
          alt="Fluxa"
          style={{ width: 72, height: 28, objectFit: "contain", opacity: 0.95 }}
        />
        <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700 }}>
          {t("mobile.dealsList")}
        </div>
      </div>

      <Link
        href="/mobile"
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 16px",
          fontSize: 15,
          fontWeight: 600,
          color: "rgba(255,255,255,0.9)",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        {t("mobile.backToMobile")}
      </Link>

      {loading && (
        <div style={{ padding: 24, color: "var(--muted)", fontSize: 15 }}>
          {t("common.loading")}
        </div>
      )}

      {error && (
        <div style={{ padding: 24, color: "rgba(239, 68, 68, 0.95)", fontSize: 14 }}>
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={{ padding: 24, color: "var(--muted)", fontSize: 15 }}>
          {t("mobile.noDeals")}
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {rows.map((row) => (
            <Link
              key={row.inicijacija_id}
              href={`/mobile/deals/${row.inicijacija_id}`}
              style={{
                display: "block",
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                {row.radni_naziv || `#${row.inicijacija_id}`}
              </div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                {row.status_naziv ?? "—"}
                {row.projekat_id ? ` · #${row.projekat_id}` : ""}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
