"use client";

import React, { useRef, useState, useEffect } from "react";

interface FluxaDateInputProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { name?: string; value: string; id?: string } }) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

// "YYYY-MM-DD" -> "DD.MM.YYYY"
export function toDisplayDate(val: any): string {
  if (!val) return "";
  const s = String(val).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}.${m}.${y}`;
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    return s;
  }
  return s;
}

// "DD.MM.YYYY" -> "YYYY-MM-DD"
export function toIsoDate(val: any): string {
  if (!val) return "";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const match = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const d = match[1].padStart(2, "0");
    const m = match[2].padStart(2, "0");
    const y = match[3];
    return `${y}-${m}-${d}`;
  }
  return "";
}

export default function FluxaDateInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  className = "input",
  style,
  placeholder = "dd.mm.yyyy",
  required,
  disabled,
}: FluxaDateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const initialIso = value !== undefined ? (value || "") : (defaultValue || "");
  const [displayText, setDisplayText] = useState(() => toDisplayDate(initialIso));

  useEffect(() => {
    if (value !== undefined) {
      setDisplayText(toDisplayDate(value || ""));
    }
  }, [value]);

  const isoVal = toIsoDate(displayText);

  // Sync hidden input for native form serialization or getElementById
  useEffect(() => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = isoVal;
    }
  }, [isoVal]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    setDisplayText(raw);
    const convertedIso = toIsoDate(raw);
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = convertedIso;
    }
    if (onChange) {
      onChange({ target: { name, id, value: convertedIso } });
    }
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedIso = e.target.value; // "YYYY-MM-DD"
    if (!pickedIso) return;
    const formatted = toDisplayDate(pickedIso);
    setDisplayText(formatted);
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = pickedIso;
    }
    if (onChange) {
      onChange({ target: { name, id, value: pickedIso } });
    }
  };

  const openCalendar = () => {
    if (disabled) return;
    if (pickerRef.current) {
      const el = pickerRef.current as any;
      if (typeof el.showPicker === "function") {
        try {
          el.showPicker();
          return;
        } catch (err) {}
      }
      pickerRef.current.focus();
      pickerRef.current.click();
    }
  };

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: style?.width || "100%",
        ...style,
      }}
    >
      <input
        type="text"
        id={id ? `${id}_display` : undefined}
        value={displayText}
        onChange={handleTextChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={className}
        style={{
          width: "100%",
          paddingRight: "30px",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.3px",
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={openCalendar}
        disabled={disabled}
        title="Kalendar"
        style={{
          position: "absolute",
          right: 6,
          background: "transparent",
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 14,
          padding: "2px 4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.7,
        }}
      >
        📅
      </button>

      {/* Hidden real input with the given id and name for form submission / getElementById */}
      <input
        ref={hiddenInputRef}
        type="hidden"
        id={id}
        name={name}
        value={isoVal}
      />

      {/* Native calendar trigger */}
      <input
        ref={pickerRef}
        type="date"
        value={isoVal}
        onChange={handlePickerChange}
        tabIndex={-1}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "30px",
          height: "100%",
          opacity: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
