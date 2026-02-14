"use client";

import { useState, useRef } from "react";

type ImportResult = {
  ok: boolean;
  imported?: number;
  total?: number;
  errors?: { row: number; message: string }[];
  error?: string;
  message?: string;
};

type Props = {
  templateHref: string;
  apiUrl: string;
  onSuccess?: () => void;
};

export default function ImportSection({
  templateHref,
  apiUrl,
  onSuccess,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiUrl, { method: "POST", body: form });
      const data: ImportResult = await res.json();
      setResult(data);
      if (data.ok && (data.imported ?? 0) > 0) {
        onSuccess?.();
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
        marginTop: 14,
        padding: 16,
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 10,
          color: "var(--muted)",
        }}
      >
        Import iz XLSX
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <a
          href={templateHref}
          download
          className="btn"
          style={{ textDecoration: "none" }}
        >
          Preuzmi predložak
        </a>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setFile(f ?? null);
            setResult(null);
          }}
          style={{ fontSize: 14 }}
        />
        <button
          type="button"
          className="btn"
          disabled={!file || loading}
          onClick={handleUpload}
          style={{
            opacity: !file || loading ? 0.6 : 1,
            cursor: !file || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Uvoz…" : "Uvezi"}
        </button>
      </div>
      {result && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: result.ok
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${result.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            fontSize: 14,
          }}
        >
          {result.error && <div style={{ color: "var(--danger)" }}>{result.error}</div>}
          {result.message && !result.error && (
            <div style={{ color: "var(--muted)" }}>{result.message}</div>
          )}
          {result.ok && result.imported !== undefined && (
            <div>
              Uvezeno: <b>{result.imported}</b>
              {result.total != null && ` od ${result.total}`} redova.
            </div>
          )}
          {result.errors && result.errors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              Greške po redu:
              <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                {result.errors.map((e) => (
                  <li key={e.row}>
                    Red {e.row}: {e.message}
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
