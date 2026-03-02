"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/components/LocaleProvider";

const POPUP_ITEMS = [
  { key: "narudzbenice", href: "/narudzbenice" },
  { key: "ponude", href: "/ponude" },
  { key: "cashflow", href: "/finance/cashflow" },
  { key: "krediti", href: "/finance/krediti" },
];

export default function FinanceMorePopup() {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(href) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn--orange-accent"
        onClick={() => setOpen((v) => !v)}
        title={t("dashboard.moreTitle")}
      >
        …
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 6,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            zIndex: 50,
            minWidth: 180,
            overflow: "hidden",
          }}
        >
          {POPUP_ITEMS.map(({ key, href }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(href)}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 14px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {t(`dashboard.${key}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
