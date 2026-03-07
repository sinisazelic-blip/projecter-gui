"use client";

import { useEffect } from "react";

/**
 * Globalni patch za fetch: response.json() ne baca SyntaxError kad server
 * vrati HTML (404/500). Tijelo se čita tek kad se pozove .json(), da drugi
 * (npr. getReader()) ne dobiju "stream already locked".
 */
export default function FetchJsonSafePatch() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).__fetchJsonSafePatched) return;

    const originalFetch = window.fetch;
    window.fetch = async function (...args: Parameters<typeof fetch>) {
      const res = await originalFetch.apply(this, args);

      const safeJson = () =>
        res.text().then((text) => {
          const t = text.trim();
          if (!t || t.startsWith("<")) {
            return { ok: false, error: "Server returned non-JSON" };
          }
          try {
            return JSON.parse(text);
          } catch {
            return { ok: false, error: "Invalid JSON" };
          }
        });

      return new Proxy(res, {
        get(target, prop) {
          if (prop === "json") return safeJson;
          const val = (target as any)[prop];
          return typeof val === "function" ? val.bind(target) : val;
        },
      }) as Response;
    };

    (window as any).__fetchJsonSafePatched = true;
  }, []);

  return null;
}
