"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  projekatId: number;
  disabled?: boolean;
};

const UPOZORENJE =
  "ProBono projekat se nikad ne fakturiše i ide direktno u arhivu. Samo owner može donijeti ovu odluku. Nastavi?";

export default function ProBonoButton({
  projekatId,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleProBono() {
    if (disabled || saving) return;
    if (!window.confirm(UPOZORENJE)) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projekatId}/pro-bono`, {
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
        onClick={handleProBono}
        disabled={disabled || saving}
        className="glassbtn payBtn"
        title="ProBono — nikad se ne fakturiše, projekat ide u arhivu"
        style={{
          opacity: disabled || saving ? 0.6 : 1,
          cursor: disabled || saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "…" : "ProBono"}
      </button>
      {error && (
        <span style={{ fontSize: 12, color: "rgba(255,80,80,.95)" }}>{error}</span>
      )}
    </>
  );
}
