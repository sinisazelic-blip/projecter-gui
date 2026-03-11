"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import { getCurrencyForLocale } from "@/lib/i18n";

const COLS_NOVI = 4;
const ROWS_NOVI = 1; // novi layout kreće od 4×1, redovi se dodaju dugmetom "Dodaj red"
const COLS_DEFAULT = 4;
const ROWS_DEFAULT = 6;

/** Fallback boja za stare layoute koji nisu imali ručno izabranu boju */
function priceToColor(price: number): string {
  const p = Number(price) || 0;
  if (p <= 50) return "#22c55e";
  if (p <= 200) return "#7dd3fc";
  if (p <= 500) return "#f97316";
  if (p <= 1000) return "#8b5cf6";
  return "#ef4444";
}

/** Paleta boja za ručni izbor – grupisati stavke po karakteru (oprema, audio, video, produkcija…) */
const BOJA_PALETA: { name: string; hex: string }[] = [
  { name: "Žuta (oprema)", hex: "#eab308" },
  { name: "Plava (audio)", hex: "#3b82f6" },
  { name: "Zelena (video)", hex: "#22c55e" },
  { name: "Ljubičasta (produkcija)", hex: "#8b5cf6" },
  { name: "Narandžasta", hex: "#f97316" },
  { name: "Crvena", hex: "#ef4444" },
  { name: "Tirkizna", hex: "#14b8a6" },
  { name: "Siva", hex: "#94a3b8" },
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
  | "layout_editor"
  | "cjenovnik_picker";

const SC_STYLES: React.CSSProperties = {
  maxWidth: "min(560px, calc(100vw - 32px))",
  margin: "0 auto",
  padding: "clamp(12px, 3vw, 20px)",
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
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramInicijacijaId = searchParams.get("inicijacija_id");
  const [screen, setScreen] = useState<Screen>("izbor");
  const [izaberiLayoutSamoEdit, setIzaberiLayoutSamoEdit] = useState(false);

  const [layouts, setLayouts] = useState<LayoutRow[]>([]);
  const [layoutDetail, setLayoutDetail] = useState<{ layout: any; cells: LayoutCell[] } | null>(null);
  const [klijenti, setKlijenti] = useState<{ klijent_id: number; naziv_klijenta: string; is_ino?: number }[]>([]);
  const [cjenovnikItems, setCjenovnikItems] = useState<CjenovnikItem[]>([]);

  const [inicijacija_id, setInicijacija_id] = useState<number | null>(null);
  const defaultValuta = getCurrencyForLocale(locale) === "EUR" ? "EUR" : "BAM";
  const [valuta, setValuta] = useState<"BAM" | "EUR">(defaultValuta);
  const [editingLayoutId, setEditingLayoutId] = useState<number | null>(null);
  const [editingLayoutMeta, setEditingLayoutMeta] = useState<{ cols: number; rows: number } | null>(null);
  const [noviForm, setNoviForm] = useState({
    narucilac_id: "",
    krajnji_klijent_id: "",
    radni_naziv: "",
    napomena: "",
  });

  const [creatorCells, setCreatorCells] = useState<Record<string, { stavka_id: number; naziv: string; cijena: number; valuta: string; boja: string }>>({});
  const [creatorEditing, setCreatorEditing] = useState<{ col: number; row: number } | null>(null);
  const [creatorRows, setCreatorRows] = useState(ROWS_NOVI);
  const [selectedStavkaForColor, setSelectedStavkaForColor] = useState<CjenovnikItem | null>(null);

  const [clicks, setClicks] = useState<Record<string, number>>({});
  const [editMode, setEditMode] = useState(false);
  const [layoutOverrides, setLayoutOverrides] = useState<Record<string, LayoutCell>>({});
  const [overrideEditing, setOverrideEditing] = useState<{ col: number; row: number } | null>(null);
  const [pendingEditContext, setPendingEditContext] = useState<"creator" | "override" | null>(null);

  const [cjenovnikSearch, setCjenovnikSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cellKey = (col: number, row: number) => `${col},${row}`;

  const loadLayouts = useCallback(async () => {
    try {
      const res = await fetch("/api/sc/layouts");
      const j = await res.json();
      if (j.ok) setLayouts(j.rows ?? []);
    } catch (e) {
      setError(t("scPage.errLoadLayouts"));
    }
  }, [t]);

  const loadKlijenti = useCallback(async () => {
    try {
      const res = await fetch("/api/klijenti");
      const j = await res.json();
      if (j?.rows) setKlijenti(j.rows);
    } catch (e) {
      setError(t("scPage.errLoadClients"));
    }
  }, [t]);

  const loadCjenovnik = useCallback(async () => {
    try {
      const res = await fetch("/api/cjenovnik?picker=1&limit=500");
      const j = await res.json();
      if (j.ok) setCjenovnikItems(j.rows ?? []);
    } catch (e) {
      setError(t("scPage.errLoadCjenovnik"));
    }
  }, [t]);

  useEffect(() => {
    loadLayouts();
  }, [loadLayouts]);

  useEffect(() => {
    const kid = Number(noviForm.narucilac_id);
    if (kid > 0 && klijenti.length > 0) {
      const k = klijenti.find((x) => x.klijent_id === kid);
      if (k && Number(k.is_ino ?? 0) === 1) setValuta("EUR");
      else if (k) setValuta("BAM");
    }
  }, [noviForm.narucilac_id, klijenti]);

  useEffect(() => {
    const id = paramInicijacijaId ? Number(paramInicijacijaId) : 0;
    if (id > 0) {
      setInicijacija_id(id);
      loadLayouts();
      setScreen("izaberi_layout");
      fetch(`/api/inicijacije/${id}/valuta`)
        .then((r) => r.json())
        .then((j) => {
          if (j?.ok && (j.valuta === "EUR" || j.valuta === "BAM")) setValuta(j.valuta);
        })
        .catch(() => {});
    }
  }, [paramInicijacijaId]);

  useEffect(() => {
    if (!paramInicijacijaId) {
      setValuta(getCurrencyForLocale(locale) === "EUR" ? "EUR" : "BAM");
    }
  }, [locale, paramInicijacijaId]);

  const handleNovi = () => {
    setScreen("novi_form");
    loadKlijenti();
    setNoviForm({ narucilac_id: "", krajnji_klijent_id: "", radni_naziv: "", napomena: "" });
  };

  const handleCreateDeal = async () => {
    const narucilac_id = Number(noviForm.narucilac_id);
    const radni_naziv = noviForm.radni_naziv.trim();
    if (!narucilac_id || !radni_naziv) {
      setError(t("scPage.errRequired"));
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
      if (!j.ok) throw new Error(j.error || t("common.error"));
      setInicijacija_id(j.inicijacija_id);
      loadLayouts();
      setScreen("izaberi_layout");
    } catch (e: any) {
      setError(e?.message || t("scPage.errCreateDeal"));
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
      if (!j.ok) throw new Error(j.error || t("common.error"));
      setLayoutDetail({
        layout: j.layout,
        cells: j.layout?.cells ?? [],
      });
      setClicks({});
      setLayoutOverrides({});
      setEditMode(false);
      setScreen("chessboard");
    } catch (e: any) {
      setError(e?.message || t("scPage.errLoadLayouts"));
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

  const getCellPrice = (c: LayoutCell): number => {
    if (valuta === "EUR" && Number(c.cijena_ino_eur ?? 0) > 0) return Number(c.cijena_ino_eur);
    return Number(c.cijena_default ?? 0);
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
        setSelectedStavkaForColor(null);
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
      if (qty > 0) sum += qty * getCellPrice(c);
    }
    return sum;
  };

  const stavkeList = () => {
    const cells = effectiveCells();
    const out: { naziv: string; kolicina: number; cijena: number; line_total: number; key: string }[] = [];
    for (const c of cells) {
      const qty = clicks[cellKey(c.col_index, c.row_index)] ?? 0;
      if (qty > 0) {
        const price = getCellPrice(c);
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
      setError(t("scPage.errNoItems"));
      return;
    }
    if (!inicijacija_id) {
      setError(t("scPage.errNoDeal"));
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
          valuta,
        };
      });

      const res = await fetch("/api/inicijacije/stavke/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicijacija_id, items: payload }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || t("common.error"));
      router.push(`/inicijacije/${inicijacija_id}`);
    } catch (e: any) {
      setError(e?.message || t("scPage.errTransfer"));
    } finally {
      setLoading(false);
    }
  };

  const handleLayoutSC = () => {
    setScreen("layout_creator");
    setCreatorCells({});
    setCreatorEditing(null);
    setCreatorRows(ROWS_NOVI);
    setEditingLayoutId(null);
    setEditingLayoutMeta(null);
    loadCjenovnik();
  };

  const handleEditLayout = async (sc_layout_id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sc/layouts/${sc_layout_id}`);
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || t("common.error"));
      const cells = j.layout?.cells ?? [];
      const creatorCellsMap: Record<string, { stavka_id: number; naziv: string; cijena: number; valuta: string; boja: string }> = {};
      for (const c of cells) {
        const key = cellKey(c.col_index, c.row_index);
        const price = valuta === "EUR" && Number(c.cijena_ino_eur ?? 0) > 0 ? Number(c.cijena_ino_eur) : Number(c.cijena_default ?? 0);
        creatorCellsMap[key] = {
          stavka_id: c.stavka_id,
          naziv: c.naziv,
          cijena: price,
          valuta: valuta,
          boja: c.boja ? String(c.boja) : priceToColor(price),
        };
      }
      setCreatorCells(creatorCellsMap);
      setEditingLayoutId(sc_layout_id);
      setEditingLayoutMeta({ cols: j.layout?.cols ?? COLS_NOVI, rows: j.layout?.rows ?? ROWS_NOVI });
      setCreatorEditing(null);
      loadCjenovnik();
      setScreen("layout_editor");
    } catch (e: any) {
      setError(e?.message || t("scPage.errLoadLayouts"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreatorCellClick = (col: number, row: number) => {
    setCreatorEditing({ col, row });
    setPendingEditContext("creator");
    setSelectedStavkaForColor(null);
    setScreen("cjenovnik_picker");
    setCjenovnikSearch("");
  };

  const handlePickStavka = (item: CjenovnikItem, boja: string) => {
    const cijena = Number(valuta === "EUR" && item.cijena_ino_eur ? item.cijena_ino_eur : item.cijena_default ?? 0);
    const hex = boja;
    const cell = creatorEditing ?? overrideEditing;
    if (!cell) return;
    const key = cellKey(cell.col, cell.row);
    if (pendingEditContext === "override") {
      setLayoutOverrides((prev) => ({
        ...prev,
        [key]: {
          col_index: cell.col,
          row_index: cell.row,
          stavka_id: item.stavka_id,
          naziv: item.naziv,
          jedinica: item.jedinica ?? "KOM",
          cijena_default: cijena,
          valuta_default: valuta,
          cijena_ino_eur: item.cijena_ino_eur,
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
          stavka_id: item.stavka_id,
          naziv: item.naziv,
          cijena,
          valuta,
          boja: hex,
        },
      }));
      setScreen(editingLayoutId ? "layout_editor" : "layout_creator");
      setCreatorEditing(null);
    }
  };

  const handleSaveLayout = async () => {
    const layout = editingLayoutId ? layouts.find((l) => l.sc_layout_id === editingLayoutId) : null;
    const naziv = (editingLayoutId && layout?.naziv) ? layout.naziv : (window.prompt(t("scPage.layoutNamePrompt")) ?? "");
    if (!naziv?.trim()) return;
    const cells: { col_index: number; row_index: number; stavka_id: number; boja: string }[] = [];
    for (const [key, v] of Object.entries(creatorCells)) {
      const [col, row] = key.split(",").map(Number);
      cells.push({ col_index: col, row_index: row, stavka_id: v.stavka_id, boja: v.boja });
    }
    const cols = editingLayoutId ? (editingLayoutMeta?.cols ?? COLS_NOVI) : COLS_NOVI;
    const rows = editingLayoutId ? (editingLayoutMeta?.rows ?? ROWS_NOVI) : creatorRows;
    setLoading(true);
    setError(null);
    try {
      const url = editingLayoutId ? `/api/sc/layouts/${editingLayoutId}` : "/api/sc/layouts";
      const res = await fetch(url, {
        method: editingLayoutId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naziv: naziv.trim(), cols, rows, cells }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || t("common.error"));
      loadLayouts();
      setEditingLayoutId(null);
      setEditingLayoutMeta(null);
      setIzaberiLayoutSamoEdit(false);
      setScreen("izbor");
    } catch (e: any) {
      setError(e?.message || t("scPage.errSaveLayout"));
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
              minHeight: "clamp(56px, 12vw, 80px)",
              borderRadius: 12,
              border: "3px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
              fontSize: "clamp(12px, 2.8vw, 16px)",
              fontWeight: 700,
              overflow: "hidden",
              textAlign: "center",
              padding: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
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
          <h2 style={{ fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 800, marginBottom: 20 }}>{t("scPage.choice")}</h2>
          <button
            style={{ ...BTN_STYLE, border: "3px solid rgba(59,130,246,0.6)", background: "rgba(59,130,246,0.18)" }}
            onClick={handleNovi}
          >
            {t("scPage.newDeal")}
          </button>
          <button
            style={{ ...BTN_STYLE, border: "3px solid rgba(34,197,94,0.6)", background: "rgba(34,197,94,0.18)" }}
            onClick={handleLayoutSC}
          >
            {t("scPage.createLayout")}
          </button>
          <button
            style={{ ...BTN_STYLE, border: "2px solid rgba(148,163,184,0.5)", background: "rgba(148,163,184,0.12)", color: "var(--muted)" }}
            onClick={() => {
              setIzaberiLayoutSamoEdit(true);
              loadLayouts();
              setScreen("izaberi_layout");
            }}
          >
            {t("scPage.openEditLayouts")}
          </button>
        </div>
      )}

      {screen === "novi_form" && (
        <div>
          <h2 style={{ fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 800, marginBottom: 16 }}>{t("scPage.newDealTitle")}</h2>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block", marginBottom: 4 }}>{t("scPage.currency")}</label>
            <select
              value={valuta}
              onChange={(e) => setValuta(e.target.value as "BAM" | "EUR")}
              className="input"
              style={{ width: "100%", padding: 12 }}
            >
              <option value="BAM">KM</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block", marginBottom: 4 }}>
              {t("scPage.narucilacRequired")}
            </label>
            <select
              value={noviForm.narucilac_id}
              onChange={(e) => setNoviForm((p) => ({ ...p, narucilac_id: e.target.value }))}
              className="input"
              style={{ width: "100%", padding: 12 }}
            >
              <option value="">{t("scPage.selectOption")}</option>
              {klijenti.map((k) => (
                <option key={k.klijent_id} value={k.klijent_id}>{k.naziv_klijenta}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block", marginBottom: 4 }}>
              {t("scPage.krajnjiOptional")}
            </label>
            <select
              value={noviForm.krajnji_klijent_id}
              onChange={(e) => setNoviForm((p) => ({ ...p, krajnji_klijent_id: e.target.value }))}
              className="input"
              style={{ width: "100%", padding: 12 }}
            >
              <option value="">{t("scPage.notSelected")}</option>
              {klijenti.map((k) => (
                <option key={k.klijent_id} value={k.klijent_id}>{k.naziv_klijenta}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block", marginBottom: 4 }}>
              {t("scPage.radniRequired")}
            </label>
            <input
              value={noviForm.radni_naziv}
              onChange={(e) => setNoviForm((p) => ({ ...p, radni_naziv: e.target.value }))}
              placeholder={t("scPage.radniPlaceholder")}
              className="input"
              style={{ width: "100%", padding: 12 }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block", marginBottom: 4 }}>
              {t("scPage.note")}
            </label>
            <textarea
              value={noviForm.napomena}
              onChange={(e) => setNoviForm((p) => ({ ...p, napomena: e.target.value }))}
              rows={3}
              className="input"
              style={{ width: "100%", padding: 12 }}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={() => setScreen("izbor")} style={BTN_STYLE}>
              {t("scPage.cancel")}
            </button>
            <button className="btn btn--active" onClick={handleCreateDeal} disabled={loading} style={BTN_STYLE}>
              {loading ? t("scPage.working") : t("scPage.createAndSelectLayout")}
            </button>
          </div>
        </div>
      )}

      {screen === "izaberi_layout" && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
            {izaberiLayoutSamoEdit
              ? t("scPage.editExistingLayout")
              : paramInicijacijaId
                ? t("scPage.addBudgetToDeal")
                : t("scPage.selectLayout")}
          </h2>
          {layouts.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>{t("scPage.noLayouts")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {layouts.map((l) => (
                <div key={l.sc_layout_id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() =>
                      izaberiLayoutSamoEdit
                        ? handleEditLayout(l.sc_layout_id)
                        : handleSelectLayout(l.sc_layout_id)
                    }
                    style={{
                      flex: 1,
                      padding: 14,
                      textAlign: "left",
                      borderRadius: 12,
                      border: "2px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.06)",
                      color: "inherit",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: "clamp(14px, 2.5vw, 16px)",
                    }}
                  >
                    {l.naziv}
                  </button>
                  {!izaberiLayoutSamoEdit && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleEditLayout(l.sc_layout_id); }}
                      className="btn"
                      style={{ padding: "10px 14px", fontSize: 13 }}
                      title={t("scPage.editLayout")}
                    >
                      ✏️
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <button
            className="btn"
            onClick={() => {
              if (izaberiLayoutSamoEdit) {
                setIzaberiLayoutSamoEdit(false);
                setScreen("izbor");
              } else if (paramInicijacijaId) {
                router.push(`/inicijacije/${paramInicijacijaId}`);
              } else {
                setScreen("izbor");
              }
            }}
            style={{ ...BTN_STYLE, marginTop: 16 }}
          >
            ← {izaberiLayoutSamoEdit ? t("scPage.backToChoice") : paramInicijacijaId ? t("scPage.backToDeal") : t("scPage.back")}
          </button>
        </div>
      )}

      {screen === "chessboard" && layoutDetail && (
        <div>
          <h2 style={{ fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 800, marginBottom: 12 }}>{layoutDetail.layout?.naziv}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "clamp(13px, 2.5vw, 15px)" }}>
              <span style={{ opacity: 0.9 }}>{t("scPage.currency")}:</span>
              <select
                value={valuta}
                onChange={(e) => setValuta(e.target.value as "BAM" | "EUR")}
                className="input"
                style={{ padding: 6, fontSize: 14, fontWeight: 600 }}
              >
                <option value="BAM">KM</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "clamp(13px, 2.5vw, 15px)" }}>
              <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
              <span>{t("scPage.editField")}</span>
            </label>
          </div>
          <ChessboardGrid
            cols={layoutDetail.layout?.cols ?? COLS}
            rows={layoutDetail.layout?.rows ?? ROWS}
            cellContent={(col, row) => {
              const c = getEffectiveCell(col, row);
              const qty = clicks[cellKey(col, row)] ?? 0;
              const price = c ? getCellPrice(c) : 0;
              if (!c) return <span style={{ opacity: 0.5, fontSize: "0.9em" }}>—</span>;
              return (
                <>
                  <span style={{ fontSize: "1em", lineHeight: 1.2, fontWeight: 700 }}>{c.naziv}</span>
                  <span style={{ fontSize: "0.75em", opacity: 0.9 }}>{price.toFixed(0)} {valuta}</span>
                  {qty > 0 && <span style={{ fontWeight: 800, fontSize: "1.1em" }}>{qty}×</span>}
                </>
              );
            }}
            onCellClick={handleCellClick}
            cellStyle={(col, row) => {
              const c = getEffectiveCell(col, row);
              if (!c?.boja) return {};
              return {
                borderColor: `${c.boja}99`,
                borderWidth: 3,
                background: `${c.boja}28`,
              };
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
                border: "3px solid rgba(125,211,252,0.5)",
                background: "rgba(125,211,252,0.18)",
                color: "inherit",
                fontWeight: 800,
                fontSize: "clamp(16px, 3.5vw, 20px)",
                cursor: "pointer",
              }}
            >
              {totalSum().toFixed(2)} {valuta}
            </button>
            <button className="btn btn--active" onClick={handlePrihvati} disabled={loading || stavkeList().length === 0} style={BTN_STYLE}>
              {loading ? t("scPage.working") : t("scPage.accept")}
            </button>
            <button className="btn" onClick={() => setClicks({})} style={BTN_STYLE}>
              {t("scPage.reset")}
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
            ← {paramInicijacijaId ? t("scPage.backToDeal") : t("scPage.back")}
          </button>
        </div>
      )}

      {screen === "stavke_list" && (
        <div>
          <h2 style={{ fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 800, marginBottom: 12 }}>{t("scPage.items")}</h2>
          <p style={{ fontSize: "clamp(12px, 2.2vw, 14px)", opacity: 0.8, marginBottom: 8 }}>{t("scPage.doubleClickRemove")}</p>
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
                  padding: 14,
                  marginBottom: 8,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  border: "2px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  fontSize: "clamp(14px, 2.8vw, 16px)",
                }}
              >
                {it.naziv} × {it.kolicina} = {it.line_total.toFixed(2)} {valuta}
              </div>
            ))}
          </div>
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: "clamp(16px, 3vw, 18px)" }}>{t("scPage.total")} {totalSum().toFixed(2)} {valuta}</div>
          <button className="btn btn--active" onClick={() => setScreen("chessboard")} style={BTN_STYLE}>
            {t("scPage.ok")}
          </button>
        </div>
      )}

      {(screen === "layout_creator" || screen === "layout_editor") && (
        <div>
          <h2 style={{ fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 800, marginBottom: 12 }}>
            {editingLayoutId ? t("scPage.editLayoutTitle") : t("scPage.newLayoutTitle")}
          </h2>
          <p style={{ fontSize: "clamp(12px, 2.2vw, 14px)", opacity: 0.8, marginBottom: 12 }}>
            {t("scPage.clickFieldHint")}
          </p>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, opacity: 0.8 }}>{t("scPage.currency")}: </label>
            <select value={valuta} onChange={(e) => setValuta(e.target.value as "BAM" | "EUR")} className="input" style={{ padding: 6, marginLeft: 8 }}>
              <option value="BAM">KM</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <ChessboardGrid
            cols={editingLayoutId ? (editingLayoutMeta?.cols ?? COLS_NOVI) : COLS_NOVI}
            rows={editingLayoutId ? (editingLayoutMeta?.rows ?? ROWS_NOVI) : creatorRows}
            cellContent={(col, row) => {
              const v = creatorCells[cellKey(col, row)];
              if (!v) return <span style={{ opacity: 0.5, fontSize: "1.2em" }}>+</span>;
              return (
                <>
                  <span style={{ fontSize: "clamp(11px, 2.2vw, 14px)", fontWeight: 600 }}>{v.naziv}</span>
                  <span style={{ fontSize: "0.7em", opacity: 0.9 }}>{v.cijena.toFixed(0)} {v.valuta}</span>
                </>
              );
            }}
            onCellClick={handleCreatorCellClick}
            cellStyle={(col, row) => {
              const v = creatorCells[cellKey(col, row)];
              if (!v?.boja) return {};
              return { borderColor: `${v.boja}99`, borderWidth: 3, background: `${v.boja}28` };
            }}
          />
          {(editingLayoutId ? true : true) && (
            <button
              type="button"
              className="btn"
              onClick={() =>
                editingLayoutId
                  ? setEditingLayoutMeta((prev) => (prev ? { ...prev, rows: prev.rows + 1 } : { cols: COLS_NOVI, rows: 2 }))
                  : setCreatorRows((r) => r + 1)
              }
              style={{ ...BTN_STYLE, marginBottom: 16, background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.2)" }}
            >
              {t("scPage.addRow")}
            </button>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={() => { setScreen("izbor"); setEditingLayoutId(null); setEditingLayoutMeta(null); setCreatorRows(ROWS_NOVI); setIzaberiLayoutSamoEdit(false); }} style={BTN_STYLE}>
              {t("scPage.cancel")}
            </button>
            <button className="btn btn--active" onClick={handleSaveLayout} disabled={loading} style={BTN_STYLE}>
              {loading ? t("scPage.saving") : editingLayoutId ? t("scPage.saveChanges") : t("scPage.saveLayout")}
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
            {selectedStavkaForColor ? (
              <>
                <h3 style={{ marginBottom: 8 }}>{t("scPage.pickColorFor")} {selectedStavkaForColor.naziv}</h3>
                <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
                  {t("scPage.colorHint")}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {BOJA_PALETA.map((b) => (
                    <button
                      key={b.hex}
                      type="button"
                      onClick={() => {
                        handlePickStavka(selectedStavkaForColor, b.hex);
                        setSelectedStavkaForColor(null);
                      }}
                      title={b.name}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        border: "2px solid rgba(255,255,255,0.3)",
                        background: b.hex,
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSelectedStavkaForColor(null)}
                  style={{ marginBottom: 8 }}
                >
                  {t("scPage.backToItemList")}
                </button>
              </>
            ) : (
              <>
                <h3 style={{ marginBottom: 12 }}>{t("scPage.pickItem")}</h3>
                <input
                  value={cjenovnikSearch}
                  onChange={(e) => setCjenovnikSearch(e.target.value)}
                  placeholder={t("scPage.search")}
                  style={{ width: "100%", padding: 10, marginBottom: 12, borderRadius: 8 }}
                />
                <div style={{ maxHeight: 300, overflow: "auto" }}>
                  {filteredCjenovnik.map((it) => (
                    <button
                      key={it.stavka_id}
                      type="button"
                      onClick={() => setSelectedStavkaForColor(it)}
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
                      {it.naziv} — {(valuta === "EUR" && it.cijena_ino_eur ? Number(it.cijena_ino_eur) : Number(it.cijena_default ?? 0)).toFixed(2)} {valuta}
                    </button>
                  ))}
                </div>
                <button className="btn" onClick={() => {
                  setSelectedStavkaForColor(null);
                  setScreen(pendingEditContext === "override" ? "chessboard" : (editingLayoutId ? "layout_editor" : "layout_creator"));
                  setCreatorEditing(null);
                  setOverrideEditing(null);
                  setPendingEditContext(null);
                }} style={{ marginTop: 12 }}>
                  {t("scPage.cancel")}
                </button>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
