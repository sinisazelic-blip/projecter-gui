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
    if (typeof el.showPicker === "function") {
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

// Helper funkcije za date-only picker
function parseDateOnly(v: string): Date | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);

  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;

  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  if (
    d.getFullYear() !== yyyy ||
    d.getMonth() !== mm - 1 ||
    d.getDate() !== dd
  )
    return null;
  return d;
}

function formatDateOnly(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function toDateLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fromDateLocalValue(v: string): Date | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);

  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function DatePickerDDMMYYYY({
  value,
  onChange,
  placeholder = "dd.mm.yyyy HH:mm",
  title,
  disabled,
  defaultTime = "16:00", // Defaultno vrijeme kada se ažurira
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  defaultTime?: string; // Format "HH:mm"
}) {
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  // Parsiraj datum i vrijeme iz value (može biti "dd.mm.yyyy" ili "dd.mm.yyyy HH:mm")
  const parsedValue = useMemo(() => {
    const s = (value ?? "").trim();
    if (!s) return { date: null, time: defaultTime };
    
    // Pokušaj prvo sa formatom sa vremenom
    const withTimeMatch = s.match(/^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})$/);
    if (withTimeMatch) {
      const date = parseDateOnly(withTimeMatch[1]);
      return { date, time: withTimeMatch[2] };
    }
    
    // Ako nema vrijeme, samo datum
    const date = parseDateOnly(s);
    return { date, time: defaultTime };
  }, [value, defaultTime]);

  const displayValue = useMemo(() => {
    if (!parsedValue.date) return value || "";
    return `${formatDateOnly(parsedValue.date)} ${parsedValue.time}`;
  }, [parsedValue, value]);

  const hiddenVal = useMemo(
    () => (parsedValue.date ? toDateLocalValue(parsedValue.date) : ""),
    [parsedValue.date],
  );

  // sync hidden input value
  useEffect(() => {
    if (hiddenRef.current) hiddenRef.current.value = hiddenVal;
  }, [hiddenVal]);

  const openPicker = () => {
    if (disabled) return;
    const el = hiddenRef.current;
    if (!el) return;

    // Chrome/Edge support
    if (typeof el.showPicker === "function") {
      el.showPicker();
      return;
    }

    // fallback
    el.focus();
    el.click();
  };

  const handleDateChange = (isoDate: string) => {
    const d = fromDateLocalValue(isoDate);
    if (!d) return;
    // Kada se ažurira datum preko date pickera, koristi trenutno vrijeme ili defaultno
    const currentTime = parsedValue.time || defaultTime;
    const dateStr = formatDateOnly(d);
    onChange(`${dateStr} ${currentTime}`);
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
        value={displayValue}
        onChange={(e) => {
          const inputVal = e.target.value.trim();
          // Korisnik može ručno da unese format sa vremenom ili samo datum
          onChange(inputVal);
        }}
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
        title="Otvori date picker (samo datum)"
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

      {/* Hidden native date picker */}
      <input
        ref={hiddenRef}
        type="date"
        defaultValue={hiddenVal}
        onChange={(e) => {
          handleDateChange(e.target.value);
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
