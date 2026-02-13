"use client";

import { useState } from "react";

/**
 * Column picker - omogućava korisniku da bira koje kolone želi vidjeti u tabeli.
 * @param {Object} props
 * @param {string[]} props.columns - Lista svih kolona (keys)
 * @param {Object} props.columnLabels - Map kolona -> label (npr. { id: "ID", naziv: "Naziv" })
 * @param {string[]} props.visibleColumns - Trenutno vidljive kolone (controlled)
 * @param {Function} props.onChange - Callback (visibleColumns) => void
 */
export function ColumnPicker({ columns = [], columnLabels = {}, visibleColumns = [], onChange }) {
  const [open, setOpen] = useState(false);

  if (!columns.length) return null;

  const toggleColumn = (col) => {
    const newVisible = visibleColumns.includes(col)
      ? visibleColumns.filter((c) => c !== col)
      : [...visibleColumns, col];
    onChange?.(newVisible);
  };

  const showAll = () => {
    onChange?.(columns);
  };

  const hideAll = () => {
    onChange?.([]);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="btn"
        onClick={() => setOpen(!open)}
        style={{ fontSize: 12, padding: "6px 10px" }}
        title="Izaberi kolone za prikaz"
      >
        📋 Kolone
      </button>
      {open && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998,
            }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 4,
              background: "white",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              padding: 12,
              zIndex: 999,
              minWidth: 200,
              maxWidth: 300,
              maxHeight: "60vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Kolone</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  onClick={showAll}
                  style={{ fontSize: 11, padding: "2px 6px", background: "rgba(0,0,0,0.05)", border: "none", borderRadius: 4, cursor: "pointer" }}
                >
                  Sve
                </button>
                <button
                  type="button"
                  onClick={hideAll}
                  style={{ fontSize: 11, padding: "2px 6px", background: "rgba(0,0,0,0.05)", border: "none", borderRadius: 4, cursor: "pointer" }}
                >
                  Ništa
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {columns.map((col) => {
                const checked = visibleColumns.includes(col);
                return (
                  <label
                    key={col}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      padding: "4px 0",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleColumn(col)}
                      style={{ cursor: "pointer" }}
                    />
                    <span>{columnLabels[col] || col}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
