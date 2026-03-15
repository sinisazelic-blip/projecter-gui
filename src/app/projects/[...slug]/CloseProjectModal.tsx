"use client";

import { useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";

const USER_LABEL = "SiNY"; // ← promijeni u "Sinisa" ako želiš

export function CloseProjectModal({
  projekatId,
  onDone,
  onCancel,
}: {
  projekatId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function closeProject(force = false) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projekatId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user": USER_LABEL,
        },
        body: JSON.stringify(force ? { force: true } : {}),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json?.error === "CLOSE_NEEDS_CONFIRM") {
          setNeedsConfirm(true);
          return;
        }
        const hb = json?.hard_blocks?.[0];
        const msgKey = hb?.code ? `closeProject.block_${hb.code}` : null;
        const msg = msgKey && t(msgKey) !== msgKey ? t(msgKey) : (hb?.message || json?.error || t("closeProjectModal.error"));
        throw new Error(msg);
      }

      onDone();
    } catch (e: any) {
      setError(e.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
        {t("closeProjectModal.title")}
      </div>

      <div style={{ opacity: 0.9, marginBottom: 12 }}>
        {t("closeProjectModal.intro")}
      </div>

      {error && (
        <div style={{ color: "#ef4444", marginBottom: 10 }}>{error}</div>
      )}

      {needsConfirm && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            borderLeft: "6px solid #f59e0b",
            background: "rgba(245,158,11,0.10)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {t("closeProjectModal.warningsTitle")}
          </div>
          <div style={{ opacity: 0.9, marginBottom: 10 }}>
            {t("closeProjectModal.warningsIntro")}
          </div>

          <button
            className="btn"
            onClick={() => closeProject(true)}
            disabled={loading}
          >
            {t("closeProjectModal.confirmAnyway")}
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="btn"
          onClick={() => closeProject(false)}
          disabled={loading}
        >
          {t("closeProjectModal.archive")}
        </button>

        <button className="btn" onClick={onCancel} disabled={loading}>
          {t("closeProjectModal.cancel")}
        </button>
      </div>
    </div>
  );
}
