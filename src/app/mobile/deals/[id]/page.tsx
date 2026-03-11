"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";

type DealDetail = {
  ok: boolean;
  row?: {
    inicijacija_id: number;
    radni_naziv: string | null;
    status_naziv?: string | null;
    projekat_id?: number | null;
    opened_at?: string | null;
    projekat_status_id?: number | null;
    projekat_status_name?: string | null;
  };
  error?: string;
};

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "—";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

export default function MobileDealDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { t } = useTranslation();
  const [data, setData] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) {
      setLoading(false);
      return;
    }
    fetch(`/api/inicijacije/jedna?id=${id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ ok: false, error: "Error" }))
      .finally(() => setLoading(false));
  }, [id]);

  const row = data?.row;

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
        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600, opacity: 0.85 }}>
          Deal #{id}
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
          marginBottom: 20,
        }}
      >
        {t("mobile.backToMobile")}
      </Link>

      {loading && (
        <div style={{ padding: 24, color: "var(--muted)", fontSize: 15 }}>
          {t("common.loading")}
        </div>
      )}

      {!loading && (!data?.ok || !row) && (
        <div style={{ padding: 24, color: "rgba(239, 68, 68, 0.95)", fontSize: 14 }}>
          {data?.error ?? t("mobile.loadError")}
        </div>
      )}

      {!loading && data?.ok && row && (
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            padding: "20px 18px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
              {t("mobile.dealDate")}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              {fmtDate(row.opened_at)}
            </div>
          </div>

          {row.projekat_id ? (
            <>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                  {t("mobile.dealPhase")}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  {row.projekat_status_name ?? "—"}
                </div>
              </div>
              <Link
                href={`/projects/${row.projekat_id}`}
                style={{
                  fontSize: 14,
                  color: "rgba(147, 197, 253, 0.95)",
                  textDecoration: "none",
                }}
              >
                {t("mobile.openProject")} #{row.projekat_id} →
              </Link>
            </>
          ) : (
            <Link
              href={`/inicijacije/${id}`}
              style={{
                display: "inline-block",
                padding: "12px 20px",
                borderRadius: 12,
                background: "rgba(59, 130, 246, 0.2)",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                color: "rgba(147, 197, 253, 0.98)",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              {t("mobile.convertToProject")}
            </Link>
          )}

          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>
            {row.radni_naziv || `Deal #${id}`}
          </div>
        </div>
      )}
    </div>
  );
}
