"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";

export default function FirmaSaveForm({
  children,
  saveLabel,
  savingLabel,
  cancelLabel,
  cancelHref,
  savedTitle,
  savedMessage,
  errorGeneric,
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedOpen, setSavedOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/firma/save", {
        method: "POST",
        body: new FormData(e.currentTarget),
        headers: { Accept: "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || errorGeneric || "Greška pri snimanju");
        return;
      }
      setSavedOpen(true);
      router.refresh();
    } catch (err) {
      setError(err?.message || errorGeneric || "Greška pri snimanju");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        {children}

        {error ? (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255, 80, 80, .35)",
              background: "rgba(255, 80, 80, .12)",
              fontSize: 13,
              color: "#ffb4b4",
            }}
          >
            {error}
          </div>
        ) : null}

        <div className="btnRow">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? savingLabel || saveLabel : saveLabel}
          </button>
          <Link href={cancelHref} className="btn">
            {cancelLabel}
          </Link>
        </div>
      </form>

      <Modal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        title={savedTitle}
        width={440}
        footer={
          <button type="button" className="btn btn--active" onClick={() => setSavedOpen(false)}>
            OK
          </button>
        }
      >
        <p style={{ margin: 0, lineHeight: 1.55, opacity: 0.92 }}>{savedMessage}</p>
      </Modal>
    </>
  );
}
