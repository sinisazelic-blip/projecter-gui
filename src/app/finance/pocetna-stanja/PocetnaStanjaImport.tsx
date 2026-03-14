"use client";

import { useState, useRef } from "react";
import { useTranslation } from "@/components/LocaleProvider";

type ImportResult = {
  ok: boolean;
  imported?: number;
  importedKlijenti?: number;
  importedDobavljaci?: number;
  importedTalenti?: number;
  errors?: { sheet: string; row: number; message: string }[];
  error?: string;
};

export default function PocetnaStanjaImport() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleClear() {
    if (!window.confirm(t("pocetnaStanja.clearAllConfirm"))) {
      return;
    }
    setClearLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/finance/pocetna-stanja/clear", {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        window.location.reload();
      } else {
        setResult({ ok: false, error: data.error ?? t("pocetnaStanja.errorDelete") });
      }
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setClearLoading(false);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/finance/pocetna-stanja/import", {
        method: "POST",
        body: form,
      });
      const data: ImportResult = await res.json();
      setResult(data);
      if (data.ok && (data.imported ?? 0) > 0) {
        window.location.reload();
      }
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--muted)" }}>
        {t("pocetnaStanja.importSectionTitle")}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
        {t("pocetnaStanja.importTemplateHint")}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <button
          type="button"
          className="btn"
          disabled={clearLoading}
          onClick={handleClear}
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            borderColor: "rgba(239, 68, 68, 0.4)",
            color: "var(--bad)",
          }}
          title={t("pocetnaStanja.clearAllBtnTitle")}
        >
          {clearLoading ? t("pocetnaStanja.clearAllBtnLoading") : t("pocetnaStanja.clearAllBtn")}
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <a
          href="/api/finance/pocetna-stanja/template"
          download="pocetna-stanja.xlsx"
          className="btn"
          style={{ textDecoration: "none" }}
        >
          {t("pocetnaStanja.downloadTemplate")}
        </a>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
          }}
          style={{ fontSize: 14 }}
        />
        <button
          type="button"
          className="btn btn--active"
          disabled={!file || loading}
          onClick={handleUpload}
          style={{
            opacity: !file || loading ? 0.6 : 1,
            cursor: !file || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? t("pocetnaStanja.importBtnLoading") : t("pocetnaStanja.importBtn")}
        </button>
      </div>
      {result && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 8,
            background: result.ok
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${result.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            fontSize: 14,
          }}
        >
          {result.error && (
            <div style={{ color: "var(--bad)" }}>{result.error}</div>
          )}
          {result.ok && result.imported !== undefined && (
            <div>
              {(t("pocetnaStanja.importedTotal") || "").replace("{{count}}", String(result.imported))}
              {(result.importedKlijenti != null || result.importedDobavljaci != null || result.importedTalenti != null) && (
                <span style={{ color: "var(--muted)", marginLeft: 8 }}>
                  {(t("pocetnaStanja.importedByType") || "")
                    .replace("{{klijenti}}", String(result.importedKlijenti ?? 0))
                    .replace("{{dobavljaci}}", String(result.importedDobavljaci ?? 0))
                    .replace("{{talenti}}", String(result.importedTalenti ?? 0))}
                </span>
              )}
            </div>
          )}
          {result.errors && result.errors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {t("pocetnaStanja.errorsLabel")}
              <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                {result.errors.map((e, idx) => (
                  <li key={idx}>
                    {(t("pocetnaStanja.errorRow") || "").replace("{{sheet}}", e.sheet).replace("{{row}}", String(e.row)).replace("{{message}}", e.message)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
