"use client";

import { createContext, useContext, useCallback, useState, useEffect } from "react";
import { getLocaleFromDocument, setLocaleInDocument, getValidLocale } from "@/lib/i18n";
import sr from "@/locales/sr.json";
import en from "@/locales/en.json";

const messages = { sr, en };

const LocaleContext = createContext({
  locale: "sr",
  setLocale: () => {},
  t: (key) => key,
});

function getNested(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return path;
  }
  return typeof cur === "string" ? cur : path;
}

export function LocaleProvider({ children, initialLocale }) {
  const [locale, setLocaleState] = useState(() => getValidLocale(initialLocale) || "sr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(getLocaleFromDocument());
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale) => {
    const valid = getValidLocale(newLocale);
    setLocaleInDocument(valid);
    setLocaleState(valid);
  }, []);

  const t = useCallback(
    (key) => {
      if (!mounted) return key;
      const dict = messages[locale] || messages.sr;
      return getNested(dict, key);
    },
    [locale, mounted],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) return { locale: "sr", setLocale: () => {}, t: (k) => k };
  return ctx;
}
