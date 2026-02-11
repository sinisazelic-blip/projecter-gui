"use client";

import React, { useEffect, useMemo, useRef } from "react";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// "dd.mm.yyyy HH:mm" -> Date (local) ili null
function parseHuman(v: string): Date | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const HH = Number(m[4]);
  const MI = Number(m[5]);

  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  if (HH < 0 || HH > 23) return null;
  if (MI < 0 || MI > 59) return null;

  const d = new Date(yyyy, mm - 1, dd, HH, MI, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Date -> "dd.mm.yyyy HH:mm"
function formatHuman(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Date -> "YYYY-MM-DDTHH:mm" (za datetime-local)
function toDateTimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// "YYYY-MM-DDTHH:mm" -> Date (local) ili null
function fromDateTimeLocalValue(v: string): Date | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  // new Date("YYYY-MM-DDTHH:mm") se tretira kao local u modernim browserima, ali da budemo sigurni:
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;

  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const HH = Number(m[4]);
  const MI = Number(m[5]);

  const d = new Date(yyyy, mm - 1, dd, HH, MI, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
};

export function DateTimePickerDDMMYYYYHHMM({
  value,
  onChange,
  placeholder = "dd.mm.yyyy HH:mm",
  title,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
}) {
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parseHuman(value), [value]);
  const hiddenVal = useMemo(
    () => (parsed ? toDateTimeLocalValue(parsed) : ""),
    [parsed],
  );

  // sync hidden input value (so picker opens at the current value)
  useEffect(() => {
    if (hiddenRef.current) hiddenRef.current.value = hiddenVal;
  }, [hiddenVal]);

  const openPicker = () => {
    if (disabled) return;
    const el = hiddenRef.current;
    if (!el) return;

    // Chrome/Edge support
    // @ts-expect-error showPicker exists in Chromium
    if (typeof el.showPicker === "function") {
      // @ts-expect-error
      el.showPicker();
      return;
    }

    // fallback
    el.focus();
    el.click();
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 44px",
        gap: 8,
        alignItems: "center",
      }}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        title={title}
        disabled={disabled}
        inputMode="numeric"
      />

      <button
        type="button"
        onClick={openPicker}
        className="glassbtn"
        title="Otvori date/time picker"
        style={{
          width: 44,
          height: 42,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,.18)",
          background: "rgba(255,255,255,.06)",
          boxShadow: "0 10px 30px rgba(0,0,0,.18)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
        }}
      >
        📅
      </button>

      {/* Hidden native picker */}
      <input
        ref={hiddenRef}
        type="datetime-local"
        defaultValue={hiddenVal}
        onChange={(e) => {
          const d = fromDateTimeLocalValue(e.target.value);
          if (!d) return;
          onChange(formatHuman(d));
        }}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: 0,
          height: 0,
        }}
        tabIndex={-1}
      />
    </div>
  );
}
