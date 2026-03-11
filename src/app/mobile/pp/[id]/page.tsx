"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";
import { getCurrencyForLocale } from "@/lib/i18n";

type ProjectDetail = {
  projekat_id: number;
  radni_naziv: string | null;
  status_name?: string | null;
  budzet_planirani?: number | null;
  troskovi_ukupno?: number | null;
  planirana_zarada?: number | null;
};

type ApiResponse = {
  success: boolean;
  data?: { project: ProjectDetail };
  message?: string;
};

function fmtAmount(v: number | null | undefined, locale: string): string {
  const curr = getCurrencyForLocale(locale);
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const s = n.toFixed(2);
  const sep = locale === "en" ? "." : ",";
  return s.replace(".", sep) + " " + curr;
}

export default function MobilePPDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { t, locale } = useTranslation();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) {
      setLoading(false);
      return;
    }
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ success: false, message: "Error" }))
      .finally(() => setLoading(false));
  }, [id]);

  const project = data?.data?.project;

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
          #{id}
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

      {!loading && (!data?.success || !project) && (
        <div style={{ padding: 24, color: "rgba(239, 68, 68, 0.95)", fontSize: 14 }}>
          {data?.message ?? t("mobile.loadError")}
        </div>
      )}

      {!loading && data?.success && project && (
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
            gap: 18,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
            {project.radni_naziv || `#${id}`}
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
              {t("mobile.projectPhase")}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              {project.status_name ?? "—"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
              {t("mobile.projectBudget")}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              {fmtAmount(Number(project.budzet_planirani), locale)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
              {t("mobile.projectSpending")}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              {fmtAmount(Number(project.troskovi_ukupno), locale)}
            </div>
          </div>

          <div
            style={{
              paddingTop: 12,
              borderTop: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
              {t("mobile.projectProfit")}
            </div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 800,
                color:
                  Number(project.planirana_zarada) >= 0
                    ? "rgba(34, 197, 94, 0.95)"
                    : "rgba(239, 68, 68, 0.95)",
              }}
            >
              {fmtAmount(Number(project.planirana_zarada), locale)}
            </div>
          </div>

          <Link
            href={`/projects/${id}`}
            style={{
              fontSize: 14,
              color: "rgba(216, 180, 254, 0.95)",
              textDecoration: "none",
              marginTop: 8,
            }}
          >
            {t("mobile.openProjectFull")} →
          </Link>
        </div>
      )}
    </div>
  );
}
