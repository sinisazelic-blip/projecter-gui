// src/app/projects/[id]/_components/FinalOkButtonClient.tsx
"use client";

import * as React from "react";
import { Flag } from "lucide-react";
import { useTranslation } from "@/components/LocaleProvider";
import { getCurrencyForLocale } from "@/lib/i18n";

const USER_LABEL = "SiNY";
const EUR_TO_BAM = 1.95583;

type FinalOkCheck = {
  ok_to_final: boolean;
  hard_blocks: { code: string; message: string }[];
  warnings: { code: string; message: string; value?: any }[];
  summary: {
    status_id: number;
    status_name: string | null;
    budzet_planirani: number | null;
    troskovi_ukupno: number;
    over_budget: boolean;
  };
};

function formatAmount(
  amountKm: number,
  locale: string,
  t: (k: string) => string
): string {
  const n = Number(amountKm);
  if (!Number.isFinite(n)) return "—";
  const ccy = getCurrencyForLocale(locale);
  const val = ccy === "EUR" ? n / EUR_TO_BAM : n;
  const suffix =
    ccy === "EUR"
      ? ` ${t("finalOkModal.currencyEur")}`
      : ` ${t("finalOkModal.currencyKm")}`;
  const fixed = val.toFixed(2);
  const formatted = locale === "en" ? fixed : fixed.replace(".", ",");
  return formatted + suffix;
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...(init || {}) });
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = j?.message || j?.error || "Greška.";
    const err: any = new Error(msg);
    err.payload = j;
    err.status = res.status;
    throw err;
  }
  return j;
}

export default function FinalOkButtonClient({
  projekatId,
  disabled = false,
}: {
  projekatId: number;
  disabled?: boolean;
}) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [data, setData] = React.useState<FinalOkCheck | null>(null);
  const [confirmWarnings, setConfirmWarnings] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const hasHardBlocks = (data?.hard_blocks?.length ?? 0) > 0;
  const hasWarnings = (data?.warnings?.length ?? 0) > 0;

  async function load() {
    setErrorMsg(null);
    setLoading(true);
    setConfirmWarnings(false);
    try {
      const j = await fetchJson(`/api/projects/${projekatId}/final-ok-check`);
      // j: { ok:true, ...payload }
      setData(j as any);
    } catch (e: any) {
      setData(null);
      setErrorMsg(e?.message ?? t("finalOkModal.errCheck"));
    } finally {
      setLoading(false);
    }
  }

  async function doFinalOk() {
    if (!data) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await fetchJson(`/api/projects/${projekatId}/final-ok`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user": USER_LABEL,
        },
        body: JSON.stringify({ force: hasWarnings ? confirmWarnings : true }),
      });

      // nakon uspjeha: zatvori, refresh
      setOpen(false);
      // refresh stranice (najjednostavnije i najpouzdanije)
      window.location.reload();
    } catch (e: any) {
      const payload = e?.payload;
      if (payload?.error === "FINAL_BLOCKED") {
        setErrorMsg(t("finalOkModal.errBlocked"));
      } else if (payload?.error === "FINAL_NEEDS_CONFIRM") {
        setErrorMsg(t("finalOkModal.errNeedsConfirm"));
      } else {
        setErrorMsg(e?.message ?? t("finalOkModal.errGeneric"));
      }

      // osvježi check
      try {
        await load();
      } catch {}
    } finally {
      setSaving(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projekatId]);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="glassbtn payBtn"
        title={
          disabled
            ? t("finalOkModal.disabledTooltip")
            : t("finalOkModal.btnTooltip")
        }
        onClick={() => setOpen(true)}
        disabled={disabled}
        style={{
          fontSize: 15,
          fontWeight: 800,
          padding: "12px 20px",
          background: disabled
            ? "rgba(100, 100, 100, 0.3)"
            : "linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(22, 163, 74, 0.95) 100%)",
          border: disabled
            ? "1px solid rgba(100, 100, 100, 0.3)"
            : "1px solid rgba(34, 197, 94, 0.5)",
          color: "white",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          boxShadow: disabled
            ? "none"
            : "0 4px 12px rgba(34, 197, 94, 0.3)",
          transition: "all 0.2s",
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? "none" : "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(34, 197, 94, 0.4)";
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(34, 197, 94, 0.3)";
          }
        }}
      >
        <Flag size={18} />
        {t("finalOkModal.title")}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 10px)",
            width: 360,
            maxWidth: "90vw",
            zIndex: 50,
            border: "1px solid rgba(255,255,255,.18)",
            background: "rgba(20,20,30,.92)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 14px 40px rgba(0,0,0,.35)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 800,
              }}
            >
              <Flag size={16} />
              {t("finalOkModal.title")}
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => setOpen(false)}
              disabled={saving}
              title={t("finalOkModal.closeTitle")}
            >
              ✕
            </button>
          </div>

          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
            {t("finalOkModal.intro")}
          </div>

          <div style={{ marginTop: 12 }}>
            {loading ? (
              <div style={{ opacity: 0.85 }}>{t("finalOkModal.loadingCheck")}</div>
            ) : !data ? (
              <div style={{ opacity: 0.9 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  {t("finalOkModal.cannotLoadCheck")}
                </div>
                <div style={{ opacity: 0.9 }}>{errorMsg ?? "—"}</div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={saving}
                  >
                    {t("finalOkModal.closeTitle")}
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={load}
                    disabled={saving}
                  >
                    {t("finalOkModal.tryAgain")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    border: "1px solid rgba(255,255,255,.14)",
                    borderRadius: 12,
                    padding: 10,
                    background: "rgba(255,255,255,.04)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                      fontSize: 13,
                      opacity: 0.92,
                    }}
                  >
                    <div>
                      {t("finalOkModal.statusNow")}{" "}
                      <b>
                        {data.summary.status_name
                          ? data.summary.status_name
                          : `#${data.summary.status_id}`}
                      </b>
                    </div>
                    <div>
                      {t("finalOkModal.budget")}{" "}
                      <b>
                        {data.summary.budzet_planirani == null
                          ? "—"
                          : formatAmount(
                              Number(data.summary.budzet_planirani),
                              locale,
                              t
                            )}
                      </b>
                    </div>
                    <div>
                      {t("finalOkModal.costs")}{" "}
                      <b>
                        {formatAmount(
                          Number(data.summary.troskovi_ukupno ?? 0),
                          locale,
                          t
                        )}
                      </b>
                    </div>
                  </div>
                </div>

                {hasHardBlocks && (
                  <div
                    style={{
                      marginTop: 12,
                      border: "1px solid rgba(255,80,80,.35)",
                      background: "rgba(255,80,80,.10)",
                      padding: 10,
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      {t("finalOkModal.cannotFinalOk")}
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 16,
                        display: "grid",
                        gap: 6,
                        fontSize: 13,
                      }}
                    >
                      {data.hard_blocks.map((b) => {
                        const key = `finalOkModal.block_${b.code}`;
                        const msg = t(key);
                        return (
                          <li key={b.code}>
                            {msg === key ? b.message : msg}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {hasWarnings && (
                  <div
                    style={{
                      marginTop: 12,
                      border: "1px solid rgba(255,165,0,.35)",
                      background: "rgba(255,165,0,.10)",
                      padding: 10,
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      {t("finalOkModal.warningsTitle")}
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 16,
                        display: "grid",
                        gap: 6,
                        fontSize: 13,
                      }}
                    >
                      {data.warnings.map((w) => {
                        const key = `finalOkModal.warning_${w.code}`;
                        const msg = t(key);
                        return (
                          <li key={w.code}>
                            {msg === key ? w.message : msg}
                          {w.code === "OVER_BUDGET" && w.value ? (
                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.9,
                                marginTop: 3,
                              }}
                            >
                              {t("finalOkModal.budget")}{" "}
                              {formatAmount(
                                Number(w.value.budzet_planirani),
                                locale,
                                t
                              )}{" "}
                              · {t("finalOkModal.costs")}{" "}
                              {formatAmount(
                                Number(w.value.troskovi_ukupno),
                                locale,
                                t
                              )}
                            </div>
                          ) : null}
                          </li>
                        );
                      })}
                    </ul>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 10,
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={confirmWarnings}
                        onChange={(e) => setConfirmWarnings(e.target.checked)}
                        disabled={saving}
                      />
                      {t("finalOkModal.understandContinue")}
                    </label>
                  </div>
                )}

                {errorMsg && (
                  <div
                    style={{
                      marginTop: 10,
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(255,255,255,.06)",
                      padding: 10,
                      borderRadius: 12,
                      fontSize: 13,
                      opacity: 0.95,
                    }}
                  >
                    {errorMsg}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={saving}
                  >
                    {t("finalOkModal.cancel")}
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={doFinalOk}
                    disabled={
                      saving ||
                      hasHardBlocks ||
                      (hasWarnings && !confirmWarnings)
                    }
                    title={t("finalOkModal.submitTitle")}
                  >
                    {saving ? t("finalOkModal.saving") : t("finalOkModal.submitFinalOk")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
