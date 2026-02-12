"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const COLS = 4;
const ROWS = 6;

const BOJE = [
  { hex: "#7dd3fc", naziv: "Svijetlo plava" },
  { hex: "#22c55e", naziv: "Zelena" },
  { hex: "#f97316", naziv: "Narandžasta" },
  { hex: "#ef4444", naziv: "Crvena" },
  { hex: "#eab308", naziv: "Žuta" },
  { hex: "#8b5cf6", naziv: "Ljubičasta" },
  { hex: "#ec4899", naziv: "Pink" },
  { hex: "#14b8a6", naziv: "Teal" },
  { hex: "#64748b", naziv: "Siva" },
];

type CjenovnikItem = {
  stavka_id: number;
  naziv: string;
  jedinica: string;
  cijena_default: number;
  valuta_default: string;
  cijena_ino_eur?: number | null;
};

type LayoutCell = {
  col_index: number;
  row_index: number;
  stavka_id: number;
  naziv: string;
  jedinica: string;
  cijena_default: number;
  valuta_default: string;
  cijena_ino_eur?: number | null;
  boja: string;
};

type LayoutRow = {
  sc_layout_id: number;
  naziv: string;
  cols: number;
  rows: number;
};

type Screen =
  | "izbor"
  | "novi_form"
  | "izaberi_layout"
  | "chessboard"
  | "stavke_list"
  | "layout_creator"
  | "cjenovnik_picker"
  | "boja_picker";

const SC_STYLES: React.CSSProperties = {
  maxWidth: 420,
  margin: "0 auto",
  padding: "16px 12px",
  minHeight: "60vh",
};

const BTN_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "16px 20px",
  fontSize: 16,
  fontWeight: 700,
  borderRadius: 16,
  border: "2px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  cursor: "pointer",
  marginBottom: 12,
};

const MODAL_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  backdropFilter: "blur(8px)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

export default function StrategicCoreClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramInicijacijaId = searchParams.get("inicijacija_id");
  const [screen, setScreen] = useState<Screen>("izbor");

  const [layouts, setLayouts] = useState<LayoutRow[]>([]);
  const [layoutDetail, setLayoutDetail] = useState<{ layout: any; cells: LayoutCell[] } | null>(null);
  const [klijenti, setKlijenti] = useState<{ klijent_id: number; naziv_klijenta: string }[]>([]);
  const [cjenovnikItems, setCjenovnikItems] = useState<CjenovnikItem[]>([]);

  const [inicijacija_id, setInicijacija_id] = useState<number | null>(null);
  const [noviForm, setNoviForm] = useState({
    narucilac_id: "",
    krajnji_klijent_id: "",
    radni_naziv: "",
    napomena: "",
  });

  const [creatorCells, setCreatorCells] = useState<Record<string, { stavka_id: number; naziv: string; cijena: number; valuta: string; boja: string }>>({});
  const [creatorEditing, setCreatorEditing] = useState<{ col: number; row: number } | null>(null);

  const [clicks, setClicks] = useState<Record<string, number>>({});
  const [editMode, setEditMode] = useState(false);
  const [layoutOverrides, setLayoutOverrides] = useState<Record<string, LayoutCell>>({});
  const [overrideEditing, setOverrideEditing] = useState<{ col: number; row: number } | null>(null);
  const [pendingEditContext, setPendingEditContext] = useState<"creator" | "override" | null>(null);

  const [cjenovnikSearch, setCjenovnikSearch] = useState("");
  const [selectedStavka, setSelectedStavka] = useState<CjenovnikItem | null>(null);
  const [pendingColorCell, setPendingColorCell] = useState<{ col: number; row: number } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cellKey = (col: number, row: number) => `${col},${row}`;

  const loadLayouts = useCallback(async () => {
    try {
      const res = await fetch("/api/sc/layouts");
      const j = await res.json();
      if (j.ok) setLayouts(j.rows ?? []);
    } catch (e) {
      setError("Greška pri učitavanju layouta.");
    }
  }, []);

  const loadKlijenti = useCallback(async () => {
    try {
      const res = await fetch("/api/klijenti");
      const j = await res.json();
      if (j?.rows) setKlijenti(j.rows);
    } catch (e) {
      setError("Greška pri učitavanju klijenata.");
    }
  }, []);

  const loadCjenovnik = useCallback(async () => {
    try {
      const res = await fetch("/api/cjenovnik?picker=1&limit=500");
      const j = await res.json();
      if (j.ok) setCjenovnikItems(j.rows ?? []);
    } catch (e) {
      setError("Greška pri učitavanju cjenovnika.");
    }
  }, []);

  useEffect(() => {
    loadLayouts();
  }, [loadLayouts]);

  useEffect(() => {
    const id = paramInicijacijaId ? Number(paramInicijacijaId) : 0;
    if (id > 0) {
      setInicijacija_id(id);
      loadLayouts();
      setScreen("izaberi_layout");
    }
  }, [paramInicijacijaId]);

  const handleNovi = () => {
    setScreen("novi_form");
    loadKlijenti();
    setNoviForm({ narucilac_id: "", krajnji_klijent_id: "", radni_naziv: "", napomena: "" });
  };

  const handleCreateDeal = async () => {
    const narucilac_id = Number(noviForm.narucilac_id);
    const radni_naziv = noviForm.radni_naziv.trim();
    if (!narucilac_id || !radni_naziv) {
      setError("Naručilac i radni naziv su obavezni.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inicijacije", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narucilac_id,
          krajnji_klijent_id: noviForm.krajnji_klijent_id ? Number(noviForm.krajnji_klijent_id) : null,
          radni_naziv,
          napomena: noviForm.napomena.trim() || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Greška");
      setInicijacija_id(j.inicijacija_id);
      loadLayouts();
      setScreen("izaberi_layout");
    } catch (e: any) {
      setError(e?.message || "Greška pri kreiranju Deala.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLayout = async (sc_layout_id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sc/layouts/${sc_layout_id}`);
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Greška");
      setLayoutDetail({
        layout: j.layout,
        cells: j.layout?.cells ?? [],
      });
      setClicks({});
      setLayoutOverrides({});
      setEditMode(false);
      setScreen("chessboard");
    } catch (e: any) {
      setError(e?.message || "Greška pri učitavanju layouta.");
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveCell = (col: number, row: number): LayoutCell | null => {
    const key = cellKey(col, row);
    const over = layoutOverrides[key];
    if (over) return over;
    return layoutDetail?.cells?.find((x) => x.col_index === col && x.row_index === row) ?? null;
  };

  const handleCellClick = (col: number, row: number) => {
    if (!layoutDetail) return;
    if (editMode) {
      const c = getEffectiveCell(col, row);
      if (c) {
        setOverrideEditing({ col, row });
        setPendingEditContext("override");
        loadCjenovnik();
        setScreen("cjenovnik_picker");
        setCjenovnikSearch("");
        setSelectedStavka(null);
      }
      return;
    }
    const c = getEffectiveCell(col, row);
    if (!c) return;
    const key = cellKey(col, row);
    setClicks((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  };

  const effectiveCells = (): LayoutCell[] => {
    if (!layoutDetail?.cells) return [];
    return layoutDetail.cells.map((c) => getEffectiveCell(c.col_index, c.row_index) ?? c).filter(Boolean);
  };

  const totalSum = () => {
    const cells = effectiveCells();
    let sum = 0;
    for (const c of cells) {
      const qty = clicks[cellKey(c.col_index, c.row_index)] ?? 0;
      if (qty > 0) {
        const price = Number(c.cijena_default ?? 0);
        sum += qty * price;
      }
    }
    return sum;
  };

  const stavkeList = () => {
    const cells = effectiveCells();
    const out: { naziv: string; kolicina: number; cijena: number; line_total: number; key: string }[] = [];
    for (const c of cells) {
      const qty = clicks[cellKey(c.col_index, c.row_index)] ?? 0;
      if (qty > 0) {
        const price = Number(c.cijena_default ?? 0);
        out.push({
          naziv: c.naziv,
          kolicina: qty,
          cijena: price,
          line_total: qty * price,
          key: cellKey(c.col_index, c.row_index),
        });
      }
    }
    return out;
  };

  const handlePrihvati = async () => {
    const items = stavkeList();
    if (items.length === 0) {
      setError("Nema stavki za prenos.");
      return;
    }
    if (!inicijacija_id) {
      setError("Deal nije kreiran.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const cells = effectiveCells();
      const payload = items.map((it) => {
        const c = cells.find((x) => cellKey(x.col_index, x.row_index) === it.key);
        return {
          stavka_id: c?.stavka_id ?? 0,
          naziv: it.naziv,
          jedinica: c?.jedinica ?? "KOM",
          kolicina: it.kolicina,
          cijena_jedinicna: it.cijena,
          valuta: c?.valuta_default ?? "BAM",
        };
      });

      const res = await fetch("/api/inicijacije/stavke/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicijacija_id, items: payload }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Greška");
      router.push(`/inicijacije/${inicijacija_id}`);
    } catch (e: any) {
      setError(e?.message || "Greška pri prenosu stavki.");
    } finally {
      setLoading(false);
    }
  };

  const handleLayoutSC = () => {
    setScreen("layout_creator");
    setCreatorCells({});
    setCreatorEditing(null);
    loadCjenovnik();
  };

  const handleCreatorCellClick = (col: number, row: number) => {
    setCreatorEditing({ col, row });
    setPendingEditContext("creator");
    setScreen("cjenovnik_picker");
    setCjenovnikSearch("");
    setSelectedStavka(null);
  };

  const handlePickStavka = (item: CjenovnikItem) => {
    setSelectedStavka(item);
    setPendingColorCell(creatorEditing ?? overrideEditing);
    setScreen("boja_picker");
  };

  const handlePickBoja = (hex: string) => {
    if (!pendingColorCell || !selectedStavka) return;
    const key = cellKey(pendingColorCell.col, pendingColorCell.row);
    if (pendingEditContext === "override") {
      setLayoutOverrides((prev) => ({
        ...prev,
        [key]: {
          col_index: pendingColorCell.col,
          row_index: pendingColorCell.row,
          stavka_id: selectedStavka.stavka_id,
          naziv: selectedStavka.naziv,
          jedinica: selectedStavka.jedinica ?? "KOM",
          cijena_default: Number(selectedStavka.cijena_default ?? 0),
          valuta_default: selectedStavka.valuta_default ?? "BAM",
          cijena_ino_eur: selectedStavka.cijena_ino_eur,
          boja: hex,
        },
      }));
      setScreen("chessboard");
      setOverrideEditing(null);
      setPendingEditContext(null);
    } else {
      setCreatorCells((prev) => ({
        ...prev,
        [key]: {
          stavka_id: selectedStavka.stavka_id,
          naziv: selectedStavka.naziv,
          cijena: Number(selectedStavka.cijena_default ?? 0),
          valuta: selectedStavka.valuta_default ?? "BAM",
          boja: hex,
        },
      }));
      setScreen("layout_creator");
      setCreatorEditing(null);
    }
    setSelectedStavka(null);
    setPendingColorCell(null);
  };

  const handleSaveLayout = async () => {
    const naziv = window.prompt("Naziv layouta:");
    if (!naziv?.trim()) return;
    const cells: { col_index: number; row_index: number; stavka_id: number; boja: string }[] = [];
    for (const [key, v] of Object.entries(creatorCells)) {
      const [col, row] = key.split(",").map(Number);
      cells.push({ col_index: col, row_index: row, stavka_id: v.stavka_id, boja: v.boja });
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sc/layouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naziv: naziv.trim(), cols: COLS, rows: ROWS, cells }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Greška");
      loadLayouts();
      setScreen("izbor");
    } catch (e: any) {
      setError(e?.message || "Greška pri snimanju layouta.");
    } finally {
      setLoading(false);
    }
  };

  const filteredCjenovnik = cjenovnikItems.filter(
    (x) =>
      !cjenovnikSearch.trim() ||
      x.naziv.toLowerCase().includes(cjenovnikSearch.toLowerCase())
  );

  const ChessboardGrid = ({
    cols,
    rows,
    cellContent,
    onCellClick,
    cellStyle,
  }: {
    cols: number;
    rows: number;
    cellContent: (col: number, row: number) => React.ReactNode;
    onCellClick: (col: number, row: number) => void;
    cellStyle?: (col: number, row: number) => React.CSSProperties;
  }) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 8,
        marginBottom: 16,
      }}
    >
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => (
          <button
            key={cellKey(col, row)}
            type="button"
            onClick={() => onCellClick(col, row)}
            style={{
              aspectRatio: "1",
              minHeight: 56,
              borderRadius: 12,
              border: "2px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              overflow: "hidden",
              textAlign: "center",
              padding: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              ...(cellStyle?.(col, row) ?? {}),
            }}
          >
            {cellContent(col, row)}
          </button>
        ))
      ).flat()}
    </div>
  );

  return (
    <div style={SC_STYLES}>
      {error && (
        <div
          style={{
            padding: 12,
            background: "rgba(239,68,68,0.2)",
            borderRadius: 12,
            color: "#fca5a5",
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {screen === "izbor" && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Izbor</h2>
          <button
            style={{ ...BTN_STYLE, borderColor: "rgba(59,130,246,0.4)", background: "rgba(59,130,246,0.1)" }}
            onClick={handleNovi}
          >
            📋 Novi
          </button>
          <button
            style={{ ...BTN_STYLE, borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.1)" }}
            onClick={handleLayoutSC}
          >
            🎛️ Layout SC
          </button>
        </div>
      )}

      {screen === "novi_form" && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Novi Deal</h2>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block", marginBottom: 4 }}>
              Naručilac (obavezno)
            </label>
            <select
              value={noviForm.narucilac_id}
              onChange={(e) => setNoviForm((p) => ({ ...p, narucilac_id: e.target.value }))}
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)", color: "inherit" }}
            >
              <option value="">— izaberi —</option>
              {klijenti.map((k) => (
                <option key={k.klijent_id} value={k.klijent_id}>{k.naziv_klijenta}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block", marginBottom: 4 }}>
              Krajnji klijent (opcionalno)
            </label>
            <select
              value={noviForm.krajnji_klijent_id}
              onChange={(e) => setNoviForm((p) => ({ ...p, krajnji_klijent_id: e.target.value }))}
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)", color: "inherit" }}
            >
              <option value="">(NULL)</option>
              {klijenti.map((k) => (
                <option key={k.klijent_id} value={k.klijent_id}>{k.naziv_klijenta}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block", marginBottom: 4 }}>
              Radni naziv (obavezno)
            </label>
            <input
              value={noviForm.radni_naziv}
              onChange={(e) => setNoviForm((p) => ({ ...p, radni_naziv: e.target.value }))}
              placeholder="Npr. Spot za X"
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)", color: "inherit" }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block", marginBottom: 4 }}>
              Napomena
            </label>
            <textarea
              value={noviForm.napomena}
              onChange={(e) => setNoviForm((p) => ({ ...p, napomena: e.target.value }))}
              rows={3}
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)", color: "inherit" }}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={() => setScreen("izbor")} style={BTN_STYLE}>
              Odustani
            </button>
            <button className="btn btn--active" onClick={handleCreateDeal} disabled={loading} style={BTN_STYLE}>
              {loading ? "Radi..." : "Kreiraj → Izaberi layout"}
            </button>
          </div>
        </div>
      )}

      {screen === "izaberi_layout" && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
            {paramInicijacijaId ? "Dodaj budžet u Deal – izaberi layout" : "Izaberi layout"}
          </h2>
          {layouts.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>Nema layouta. Kreiraj layout u Layout SC.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {layouts.map((l) => (
                <button
                  key={l.sc_layout_id}
                  type="button"
                  onClick={() => handleSelectLayout(l.sc_layout_id)}
                  style={{
                    padding: 14,
                    textAlign: "left",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.06)",
                    color: "inherit",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {l.naziv}
                </button>
              ))}
            </div>
          )}
          <button
            className="btn"
            onClick={() =>
              paramInicijacijaId
                ? router.push(`/inicijacije/${paramInicijacijaId}`)
                : setScreen("izbor")
            }
            style={{ ...BTN_STYLE, marginTop: 16 }}
          >
            ← {paramInicijacijaId ? "Nazad na Deal" : "Nazad"}
          </button>
        </div>
      )}

      {screen === "chessboard" && layoutDetail && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{layoutDetail.layout?.naziv}</h2>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={editMode}
              onChange={(e) => setEditMode(e.target.checked)}
            />
            <span>Edit polje (promijeni stavku/boju)</span>
          </label>
          <ChessboardGrid
            cols={layoutDetail.layout?.cols ?? COLS}
            rows={layoutDetail.layout?.rows ?? ROWS}
            cellContent={(col, row) => {
              const c = getEffectiveCell(col, row);
              const qty = clicks[cellKey(col, row)] ?? 0;
              if (!c) return <span style={{ opacity: 0.5 }}>—</span>;
              return (
                <>
                  <span style={{ fontSize: 10, lineHeight: 1.2 }}>{c.naziv}</span>
                  {qty > 0 && <span style={{ fontWeight: 800 }}>{qty}×</span>}
                </>
              );
            }}
            onCellClick={handleCellClick}
            cellStyle={(col, row) => {
              const c = getEffectiveCell(col, row);
              if (!c?.boja) return {};
              return { borderColor: `${c.boja}66`, background: `${c.boja}18` };
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              padding: "12px 0",
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <button
              type="button"
              onClick={() => setScreen("stavke_list")}
              style={{
                flex: 1,
                minWidth: 100,
                padding: 14,
                borderRadius: 12,
                border: "2px solid rgba(125,211,252,0.4)",
                background: "rgba(125,211,252,0.1)",
                color: "inherit",
                fontWeight: 800,
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              {totalSum().toFixed(2)} KM
            </button>
            <button className="btn btn--active" onClick={handlePrihvati} disabled={loading || stavkeList().length === 0} style={BTN_STYLE}>
              {loading ? "Radi..." : "Prihvati"}
            </button>
            <button className="btn" onClick={() => setClicks({})} style={BTN_STYLE}>
              Reset
            </button>
          </div>
          <button
            className="btn"
            onClick={() =>
              paramInicijacijaId
                ? router.push(`/inicijacije/${paramInicijacijaId}`)
                : setScreen("izaberi_layout")
            }
            style={BTN_STYLE}
          >
            ← {paramInicijacijaId ? "Nazad na Deal" : "Nazad"}
          </button>
        </div>
      )}

      {screen === "stavke_list" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Stavke</h2>
          <div style={{ marginBottom: 12 }}>
            {stavkeList().map((it) => (
              <div
                key={it.key}
                onDoubleClick={() => {
                  setClicks((prev) => {
                    const next = { ...prev };
                    delete next[it.key];
                    return next;
                  });
                  setScreen("chessboard");
                }}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                }}
              >
                {it.naziv} × {it.kolicina} = {it.line_total.toFixed(2)} KM
              </div>
            ))}
          </div>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Ukupno: {totalSum().toFixed(2)} KM</div>
          <button className="btn btn--active" onClick={() => setScreen("chessboard")} style={BTN_STYLE}>
            OK
          </button>
        </div>
      )}

      {screen === "layout_creator" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Layout SC</h2>
          <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
            Klikni na polje → izaberi stavku iz cjenovnika → izaberi boju. Layout može imati samo neka polja.
          </p>
          <ChessboardGrid
            cols={COLS}
            rows={ROWS}
            cellContent={(col, row) => {
              const v = creatorCells[cellKey(col, row)];
              if (!v) return <span style={{ opacity: 0.5 }}>+</span>;
              return (
                <span style={{ fontSize: 10 }}>
                  {v.naziv}
                </span>
              );
            }}
            onCellClick={handleCreatorCellClick}
            cellStyle={(col, row) => {
              const v = creatorCells[cellKey(col, row)];
              if (!v?.boja) return {};
              return { borderColor: `${v.boja}99`, background: `${v.boja}22` };
            }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={() => setScreen("izbor")} style={BTN_STYLE}>
              Odustani
            </button>
            <button className="btn btn--active" onClick={handleSaveLayout} disabled={loading} style={BTN_STYLE}>
              {loading ? "Snima..." : "OK (snimi layout)"}
            </button>
          </div>
        </div>
      )}

      {screen === "cjenovnik_picker" && (
        <div style={MODAL_STYLE}>
          <div
            style={{
              width: "min(100%, 360px)",
              maxHeight: "80vh",
              background: "var(--bg)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              padding: 16,
              overflow: "auto",
            }}
          >
            <h3 style={{ marginBottom: 12 }}>Izaberi stavku</h3>
            <input
              value={cjenovnikSearch}
              onChange={(e) => setCjenovnikSearch(e.target.value)}
              placeholder="Traži..."
              style={{ width: "100%", padding: 10, marginBottom: 12, borderRadius: 8 }}
            />
            <div style={{ maxHeight: 300, overflow: "auto" }}>
              {filteredCjenovnik.map((it) => (
                <button
                  key={it.stavka_id}
                  type="button"
                  onClick={() => handlePickStavka(it)}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginBottom: 6,
                    textAlign: "left",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {it.naziv} — {Number(it.cijena_default ?? 0).toFixed(2)} {it.valuta_default}
                </button>
              ))}
            </div>
            <button className="btn" onClick={() => {
              setScreen(pendingEditContext === "override" ? "chessboard" : "layout_creator");
              setCreatorEditing(null);
              setOverrideEditing(null);
              setPendingEditContext(null);
            }} style={{ marginTop: 12 }}>
              Odustani
            </button>
          </div>
        </div>
      )}

      {screen === "boja_picker" && (
        <div style={MODAL_STYLE}>
          <div
            style={{
              width: "min(100%, 300px)",
              background: "var(--bg)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              padding: 16,
            }}
          >
            <h3 style={{ marginBottom: 12 }}>Izaberi boju</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {BOJE.map((b) => (
                <button
                  key={b.hex}
                  type="button"
                  onClick={() => handlePickBoja(b.hex)}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 12,
                    border: "2px solid rgba(255,255,255,0.3)",
                    background: b.hex,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
            <button className="btn" onClick={() => {
              setScreen(pendingEditContext === "override" ? "chessboard" : "layout_creator");
              setCreatorEditing(null);
              setOverrideEditing(null);
              setPendingColorCell(null);
              setSelectedStavka(null);
              setPendingEditContext(null);
            }} style={{ marginTop: 12 }}>
              Odustani
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
