"use client";

import { Mail } from "lucide-react";
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "@/components/LocaleProvider";

export type LicenceClientWarning = {
  code: string;
  severity: string;
};

export type LicenceClientAlertsPayload = {
  warnings: LicenceClientWarning[];
  days_until_end: number;
  meet_remaining: number;
  subscription_ends_at: string | null;
  naziv?: string | null;
  tenant_id?: number | null;
};

type LicenceAlertsContextValue = {
  payload: LicenceClientAlertsPayload | null;
};

const LicenceAlertsContext = createContext<LicenceAlertsContextValue | null>(
  null,
);

/** Za SOCCS / SwimVoice / DocCentre — isti oblik kao `GET /api/public/licence-check` + `warnings`. */
export function useLicenceAlerts(): LicenceAlertsContextValue | null {
  return useContext(LicenceAlertsContext);
}

function messageForWarningCode(t: (key: string) => string, code: string) {
  const key = `licenceAlerts.codes.${code}`;
  const msg = t(key);
  return msg === key ? code : msg;
}

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10050,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "rgba(0,0,0,0.5)",
  backdropFilter: "blur(8px)",
};

const modalBoxStyle: CSSProperties = {
  width: "min(100%, 440px)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
  boxShadow: "var(--shadow)",
};

function LicenceClientAlerts({
  initial,
  children,
}: {
  initial: LicenceClientAlertsPayload | null;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ctx = useMemo(() => ({ payload: initial }), [initial]);
  const hasWarnings = Boolean(initial?.warnings?.length);

  if (!initial) {
    return <>{children}</>;
  }

  return (
    <LicenceAlertsContext.Provider value={ctx}>
      {children}
      {hasWarnings ? (
        <button
          type="button"
          className="fluxa-licence-bell"
          title={t("licenceAlerts.bellTitle")}
          aria-label={t("licenceAlerts.bellTitle")}
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            top: 52,
            right: 20,
            zIndex: 10000,
            width: 44,
            height: 44,
            borderRadius: 12,
            border: "1px solid rgba(239,68,68,0.55)",
            background: "rgba(239,68,68,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fecaca",
            padding: 0,
          }}
        >
          <Mail size={22} strokeWidth={2.2} />
        </button>
      ) : null}
      {open && hasWarnings ? (
        <div
          className="studio-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t("licenceAlerts.modalTitle")}
          style={modalOverlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            }
          }}
        >
          <div style={modalBoxStyle}>
            <div style={{ padding: 24 }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>
                {t("licenceAlerts.modalTitle")}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  opacity: 0.88,
                  lineHeight: 1.45,
                  marginBottom: 12,
                }}
              >
                {t("licenceAlerts.modalIntro")}
              </p>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.82,
                  marginBottom: 14,
                  lineHeight: 1.55,
                }}
              >
                {initial.naziv ? (
                  <div>
                    <strong>{t("licenceAlerts.metaTenant")}:</strong>{" "}
                    {initial.naziv}
                  </div>
                ) : null}
                {initial.subscription_ends_at ? (
                  <div>
                    <strong>{t("licenceAlerts.metaSubscription")}:</strong>{" "}
                    {initial.subscription_ends_at}
                  </div>
                ) : null}
                <div>
                  <strong>{t("licenceAlerts.metaDays")}:</strong>{" "}
                  {initial.days_until_end}
                </div>
                <div>
                  <strong>{t("licenceAlerts.metaMeet")}:</strong>{" "}
                  {initial.meet_remaining}
                </div>
              </div>
              <ul
                style={{
                  margin: "0 0 16px",
                  paddingLeft: 18,
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                {initial.warnings.map((w) => (
                  <li key={w.code} style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, marginRight: 6 }}>
                      [{w.severity}]
                    </span>
                    {messageForWarningCode(t, w.code)}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn"
                onClick={() => setOpen(false)}
              >
                {t("licenceAlerts.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </LicenceAlertsContext.Provider>
  );
}

export default LicenceClientAlerts;
