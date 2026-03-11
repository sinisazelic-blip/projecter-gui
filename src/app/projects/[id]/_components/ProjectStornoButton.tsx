"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";

type Props = {
  projekatId: number;
  disabled?: boolean;
};

export default function ProjectStornoButton({
  projekatId,
  disabled = false,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getStornoError(data: { error_code?: string; error?: string }) {
    if (data?.error_code === "INVOICED")
      return t("projectDetail.stornoErrorInvoiced");
    if (data?.error_code === "ALREADY_CANCELLED")
      return t("projectDetail.stornoErrorAlreadyCancelled");
    return data?.error || t("common.error");
  }

  async function handleStorno() {
    if (disabled || saving) return;
    if (!window.confirm(t("projectDetail.stornoConfirm"))) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projekatId}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(getStornoError(data));
        return;
      }
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleStorno}
        disabled={disabled || saving}
        className="stornoBtn"
        title={t("projectDetail.stornoTitle")}
        style={{
          background: "#9ca3af",
          color: "#111827",
          border: "1px solid #6b7280",
          borderRadius: 8,
          padding: "4px 8px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          cursor: disabled || saving ? "not-allowed" : "pointer",
          opacity: disabled || saving ? 0.6 : 0.95,
        }}
      >
        {saving ? t("projectDetail.stornoInProgress") : "STORNO"}
      </button>
      {error && (
        <span style={{ fontSize: 12, color: "rgba(255,80,80,.95)" }}>{error}</span>
      )}
    </>
  );
}
