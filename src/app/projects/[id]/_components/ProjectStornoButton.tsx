"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  projekatId: number;
  disabled?: boolean;
};

export default function ProjectStornoButton({
  projekatId,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStorno() {
    if (disabled || saving) return;
    if (!window.confirm("Da li ste sigurni da želite stornirati ovaj projekat?"))
      return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projekatId}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Greška");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Greška");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleStorno}
        disabled={disabled || saving}
        className="stornoBtn"
        title="Storniraj projekat (Otkazan)"
        style={{
          background: "#9ca3af",
          color: "#111827",
          border: "1px solid #6b7280",
          borderRadius: 8,
          padding: "4px 8px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          cursor: disabled || saving ? "not-allowed" : "pointer",
          opacity: disabled || saving ? 0.6 : 0.95,
        }}
      >
        {saving ? "…" : "STORNO"}
      </button>
      {error && (
        <span style={{ fontSize: 12, color: "rgba(255,80,80,.95)" }}>{error}</span>
      )}
    </>
  );
}
