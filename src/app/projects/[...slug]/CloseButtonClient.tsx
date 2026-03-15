"use client";

import { useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";

const USER_LABEL = "SiNY"; // <- ili "Sinisa"

type CloseCheckResponse = {
  ok?: boolean;
  ok_to_close?: boolean;
  hard_blocks?: { code?: string; message?: string; count?: number }[];
  warnings?: { code?: string; message?: string; value?: any }[];
  error?: string;
};

async function readJson(res: Response) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { ok: false, error: t || "BAD_JSON" };
  }
}

export function CloseButtonClient({
  projekatId,
}: {
  projekatId: number;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  // poruke (greške / success)
  const [msg, setMsg] = useState<string | null>(null);

  // data iz close-check
  const [check, setCheck] = useState<CloseCheckResponse | null>(null);

  // inline potvrda (bez popupa)
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [confirmWarnings, setConfirmWarnings] = useState(false);

  async function runCloseCheck(): Promise<CloseCheckResponse | null> {
    try {
      const r1 = await fetch(`/api/projects/${projekatId}/close-check`, {
        method: "GET",
        cache: "no-store",
      });
      const j1 = (await readJson(r1)) as CloseCheckResponse;

      if (!r1.ok || !j1?.ok) {
        setMsg(j1?.error || t("common.error"));
        setCheck(null);
        return null;
      }

      setCheck(j1);
      return j1;
    } catch (e: any) {
      setMsg(e?.message || t("common.error"));
      setCheck(null);
      return null;
    }
  }

  async function doClose(force: boolean) {
    setLoading(true);
    setMsg(null);

    try {
      const r2 = await fetch(`/api/projects/${projekatId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user": USER_LABEL, // ✅ audit label
        },
        body: JSON.stringify(force ? { force: true } : {}),
      });

      const j2 = await readJson(r2);

      if (!r2.ok || !j2?.ok) {
        const hb = j2?.hard_blocks?.[0];
        const msgKey = hb?.code ? `closeProject.block_${hb.code}` : null;
        const msg = msgKey ? (t(msgKey) !== msgKey ? t(msgKey) : hb?.message) : (j2?.error || t("common.error"));
        setMsg(msg || hb?.message || j2?.error);
        return;
      }

      setMsg(t("closeProject.archivedOk"));
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  // klik na glavno dugme "Arhiviraj"
  async function onPrimaryClick() {
    if (loading) return;

    // reset inline potvrde
    setNeedsConfirm(false);
    setConfirmWarnings(false);
    setMsg(null);

    setLoading(true);
    try {
      const j1 = await runCloseCheck();
      if (!j1) return;

      if (!j1.ok_to_close) {
        const hb = j1?.hard_blocks?.[0];
        const msgKey = hb?.code ? `closeProject.block_${hb.code}` : null;
        setMsg(msgKey && t(msgKey) !== msgKey ? t(msgKey) : (hb?.message || t("closeProject.closeNotAllowed")));
        return;
      }

      const hasWarnings = Array.isArray(j1?.warnings) && j1.warnings.length > 0;

      if (hasWarnings) {
        setNeedsConfirm(true);
        setMsg(t("closeProject.needsConfirm"));
        return;
      }

      // Nema warnings → ide odmah
      await doClose(false);
    } finally {
      setLoading(false);
    }
  }

  const warnings = Array.isArray(check?.warnings) ? check!.warnings! : [];
  const hardBlocks = Array.isArray(check?.hard_blocks)
    ? check!.hard_blocks!
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn" disabled={loading} onClick={onPrimaryClick}>
          {loading ? t("closeProject.checking") : t("closeProject.archive")}
        </button>

        {msg && <span style={{ opacity: 0.85, fontSize: 13 }}>{msg}</span>}
      </div>

      {/* Inline potvrda (bez modala / bez confirm popup-a) */}
      {needsConfirm && (
        <div
          className="card"
          style={{
            borderLeft: "6px solid #f59e0b",
            background: "rgba(245,158,11,0.10)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>{t("closeProject.warningsTitle")}</div>

          {hardBlocks.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{ fontWeight: 700, marginBottom: 6, color: "#b91c1c" }}
              >
                {t("closeProject.blocksTitle")}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {hardBlocks.map((b, i) => {
                  const key = b.code ? `closeProject.block_${b.code}` : "";
                  const text = key && t(key) !== key ? t(key) : (b.message ?? "");
                  return (
                    <li key={`${b.code ?? "HB"}-${i}`}>
                      {text}
                      {typeof b.count === "number" ? ` (${b.count})` : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {warnings.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, marginBottom: 10 }}>
              {warnings.map((w, i) => {
                const key = w.code ? `closeProject.warning_${w.code}` : "";
                const text = key && t(key) !== key ? t(key) : (w.message ?? "");
                return <li key={`${w.code ?? "W"}-${i}`}>{text}</li>;
              })}
            </ul>
          ) : (
            <div style={{ marginBottom: 10, opacity: 0.9 }}>
              {t("closeProject.warningsTitle")}.
            </div>
          )}

          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <input
              type="checkbox"
              checked={confirmWarnings}
              onChange={(e) => setConfirmWarnings(e.target.checked)}
              disabled={loading}
            />
            {t("closeProject.understandAndContinue")}
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn"
              disabled={loading || !confirmWarnings}
              onClick={async () => {
                if (!confirmWarnings) return;
                setNeedsConfirm(false);
                await doClose(true);
              }}
            >
              {t("closeProject.confirmArchive")}
            </button>

            <button
              className="btn"
              disabled={loading}
              onClick={() => {
                setNeedsConfirm(false);
                setConfirmWarnings(false);
                setMsg(null);
              }}
            >
              {t("closeProject.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
