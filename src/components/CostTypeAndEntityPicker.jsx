"use client";
import { useEffect, useMemo, useState } from "react";

async function jget(url) {
  const r = await fetch(url, { cache: "no-store" });
  return r.json();
}
async function jpost(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

export default function CostTypeAndEntityPicker({
  value, // { tip_id: number|null, entity_type: 'talent'|'vendor'|null, entity_id: number|null }
  onChange, // (nextValue) => void
}) {
  const [types, setTypes] = useState([]);
  const [items, setItems] = useState([]); // talent/vendor items
  const [loadingItems, setLoadingItems] = useState(false);

  const tipId = value?.tip_id ?? "";
  const entityType = value?.entity_type ?? null;
  const entityId = value?.entity_id ?? "";

  const selectedType = useMemo(() => {
    return types.find((t) => String(t.tip_id) === String(tipId)) || null;
  }, [types, tipId]);

  // modal state
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const d = await jget("/api/cost-types");
      if (d?.ok) setTypes(d.items || []);
    })();
  }, []);

  // When tip changes -> decide which entity picker to show and load items
  useEffect(() => {
    (async () => {
      setErr("");
      setItems([]);
      // reset entity fields whenever the type changes
      const code = selectedType?.code || null;

      if (code === "TALENT") {
        onChange?.({
          tip_id: Number(tipId) || null,
          entity_type: "talent",
          entity_id: null,
        });
      } else if (code === "VENDOR") {
        onChange?.({
          tip_id: Number(tipId) || null,
          entity_type: "vendor",
          entity_id: null,
        });
      } else {
        onChange?.({
          tip_id: Number(tipId) || null,
          entity_type: null,
          entity_id: null,
        });
      }

      if (code === "TALENT") {
        setLoadingItems(true);
        const d = await jget("/api/talents");
        setLoadingItems(false);
        if (d?.ok) setItems(d.items || []);
      } else if (code === "VENDOR") {
        setLoadingItems(true);
        const d = await jget("/api/vendors");
        setLoadingItems(false);
        if (d?.ok) setItems(d.items || []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType?.code, tipId]);

  const showEntity =
    selectedType?.code === "TALENT" || selectedType?.code === "VENDOR";
  const entityLabel = selectedType?.code === "TALENT" ? "Talenat" : "Dobavljač";
  const addLabel =
    selectedType?.code === "TALENT" ? "Novi talenat" : "Novi dobavljač";
  const addPlaceholder =
    selectedType?.code === "TALENT" ? "Ime i prezime" : "Naziv";

  async function refreshItemsAndSelect(idToSelect) {
    if (selectedType?.code === "TALENT") {
      const d = await jget("/api/talents");
      if (d?.ok) setItems(d.items || []);
      onChange?.({
        tip_id: Number(tipId) || null,
        entity_type: "talent",
        entity_id: idToSelect,
      });
    } else if (selectedType?.code === "VENDOR") {
      const d = await jget("/api/vendors");
      if (d?.ok) setItems(d.items || []);
      onChange?.({
        tip_id: Number(tipId) || null,
        entity_type: "vendor",
        entity_id: idToSelect,
      });
    }
  }

  async function handleCreate() {
    setErr("");
    const name = newName.trim();
    if (!name) {
      setErr("Unesi naziv.");
      return;
    }
    setSaving(true);
    const url =
      selectedType?.code === "TALENT" ? "/api/talents" : "/api/vendors";
    const d = await jpost(url, { name });
    setSaving(false);

    if (!d?.ok) {
      setErr(d?.message || "Greška pri snimanju.");
      return;
    }

    setIsOpen(false);
    setNewName("");
    await refreshItemsAndSelect(Number(d.id));
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <div>Vrsta troška</div>
        <select
          value={tipId}
          onChange={(e) =>
            onChange?.({
              ...value,
              tip_id: e.target.value ? Number(e.target.value) : null,
            })
          }
        >
          <option value="">— izaberi —</option>
          {types.map((t) => (
            <option key={t.tip_id} value={t.tip_id}>
              {t.naziv}
            </option>
          ))}
        </select>
      </label>

      {showEntity && (
        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>{entityLabel}</div>
            <button
              type="button"
              onClick={() => {
                setErr("");
                setIsOpen(true);
              }}
            >
              + {addLabel}
            </button>
          </div>

          <select
            value={entityId || ""}
            onChange={(e) =>
              onChange?.({
                tip_id: Number(tipId) || null,
                entity_type: entityType,
                entity_id: e.target.value ? Number(e.target.value) : null,
              })
            }
            disabled={loadingItems}
          >
            <option value="">
              {loadingItems
                ? "Loading…"
                : `— izaberi (${entityLabel.toLowerCase()}) —`}
            </option>
            {items.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>

          {/* Minimal modal */}
          {isOpen && (
            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 12,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 600 }}>{addLabel}</div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={addPlaceholder}
              />
              {err && <div style={{ color: "crimson" }}>{err}</div>}
              <div
                style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setNewName("");
                    setErr("");
                  }}
                >
                  Otkaži
                </button>
                <button type="button" onClick={handleCreate} disabled={saving}>
                  {saving ? "Snimam..." : "Snimi"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
