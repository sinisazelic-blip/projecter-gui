"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const ALLOWED = "image/png, image/jpeg, image/jpg, image/svg+xml";
const MAX_MB = 2;

export default function LogoUpload({ logoPath }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const p = logoPath?.trim();
  const currentSrc =
    p && (p.startsWith("http://") || p.startsWith("https://"))
      ? p
      : "/api/firma/logo";

  async function handleChange(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Maksimalna veličina ${MAX_MB} MB`);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("logo", file);
      const res = await fetch("/api/firma/upload-logo", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Greška pri uploadu");
        return;
      }
      const pathInput = document.querySelector('input[name="logo_path"]');
      if (pathInput) pathInput.value = data.path;
      router.refresh();
    } catch (err) {
      setError(err?.message || "Greška");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 12,
            padding: 10,
            background: "rgba(255,255,255,.04)",
          }}
        >
          <img
            src={currentSrc}
            alt="Logo firme"
            style={{
              maxHeight: 80,
              maxWidth: 200,
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED}
            onChange={handleChange}
            disabled={uploading}
            style={{ display: "block", marginBottom: 8, fontSize: 12 }}
          />
          <p style={{ fontSize: 11, opacity: 0.75, margin: 0 }}>
            PNG, JPG ili SVG, max {MAX_MB} MB. Prikazuje se na fakturi.
          </p>
          {error && (
            <p style={{ color: "var(--error, #f87171)", fontSize: 12, marginTop: 6 }}>
              {error}
            </p>
          )}
          {uploading && (
            <p style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>Upload…</p>
          )}
        </div>
      </div>
    </div>
  );
}
