"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
};

function normInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ✅ normalizuj requires_entity iz baze u: none | talent | vendor
function normalizeRequires(v) {
  const s = String(v ?? "NONE")
    .trim()
    .toUpperCase();

  if (s === "TALENT") return "talent";
  if (s === "DOBAVLJAC") return "vendor";
  if (s === "VENDOR") return "vendor"; // sigurnosno
  if (s === "NONE" || s === "" || s === "NULL") return "none";

  // fallback: ako neko slučajno šalje već "talent/vendor/none"
  const low = String(v ?? "none").toLowerCase();
  if (low === "talent" || low === "vendor" || low === "none") return low;

  return "none";
}

// ✅ tipovi iz API-a mogu biti (id,name) ili (tip_id,naziv)
function getTypeId(t) {
  return normInt(t?.id ?? t?.tip_id);
}
function getTypeName(t) {
  return String(t?.name ?? t?.naziv ?? "").trim();
}

export default function CostTypeAndEntityPicker({ value, onChange, tipLabel: tipLabelProp }) {
  const { t } = useTranslation();
  // value: { tip_id, entity_type, entity_id }
  const tipId = normInt(value?.tip_id);
  const entityType = value?.entity_type ?? null;
  const entityId = normInt(value?.entity_id);

  const [types, setTypes] = useState([]);
  const [talents, setTalents] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [err, setErr] = useState(null);

  // učitaj tipove
  useEffect(() => {
    let cancelled = false;
    setLoadingTypes(true);
    setErr(null);

    fetch("/api/cost-types")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok) setTypes(Array.isArray(data.items) ? data.items : []);
        else setErr(data?.message ?? "Greška pri učitavanju tipova");
      })
      .catch(() => !cancelled && setErr("Greška pri učitavanju tipova"))
      .finally(() => !cancelled && setLoadingTypes(false));

    return () => {
      cancelled = true;
    };
  }, []);

  // izabrani tip (sa requires_entity)
  const selectedType = useMemo(() => {
    if (!tipId) return null;
    return (
      types.find((t) => {
        const id = getTypeId(t);
        return id === tipId;
      }) ?? null
    );
  }, [types, tipId]);

  const requires = useMemo(() => {
    return normalizeRequires(selectedType?.requires_entity);
  }, [selectedType]);

  // učitaj entitete (talents/vendors) samo kad treba
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (requires !== "talent" && requires !== "vendor") return;

      setLoadingEntities(true);
      setErr(null);

      try {
        if (requires === "talent" && talents.length === 0) {
          const r = await fetch("/api/talents");
          const data = await r.json();
          if (!cancelled) {
            if (data?.ok)
              setTalents(Array.isArray(data.items) ? data.items : []);
            else setErr(data?.message ?? "Greška pri učitavanju talenata");
          }
        }

        if (requires === "vendor" && vendors.length === 0) {
          const r = await fetch("/api/vendors");
          const data = await r.json();
          if (!cancelled) {
            if (data?.ok)
              setVendors(Array.isArray(data.items) ? data.items : []);
            else setErr(data?.message ?? "Greška pri učitavanju dobavljača");
          }
        }
      } catch {
        if (!cancelled) setErr("Greška pri učitavanju entiteta");
      } finally {
        if (!cancelled) setLoadingEntities(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requires]);

  // kad promijeniš tip: automatski postavi entity_type i očisti entity_id
  useEffect(() => {
    if (!tipId) return;

    if (requires === "none") {
      if (entityType !== null || entityId !== null) {
        onChange?.({ tip_id: tipId, entity_type: null, entity_id: null });
      }
      return;
    }

    if (requires === "talent") {
      if (entityType !== "talent") {
        onChange?.({ tip_id: tipId, entity_type: "talent", entity_id: null });
      }
      return;
    }

    if (requires === "vendor") {
      if (entityType !== "vendor") {
        onChange?.({ tip_id: tipId, entity_type: "vendor", entity_id: null });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipId, requires]);

  const currentItems =
    requires === "talent" ? talents : requires === "vendor" ? vendors : [];

  const onPickType = (e) => {
    const nextTip = normInt(e.target.value);
    if (!nextTip) {
      onChange?.({ tip_id: null, entity_type: null, entity_id: null });
      return;
    }
    // entity će se podesiti u useEffect iznad
    onChange?.({ tip_id: nextTip, entity_type: null, entity_id: null });
  };

  const onPickEntity = (e) => {
    const nextId = normInt(e.target.value);
    onChange?.({
      tip_id: tipId,
      entity_type:
        requires === "talent"
          ? "talent"
          : requires === "vendor"
            ? "vendor"
            : null,
      entity_id: nextId,
    });
  };

  // mini inline add (prompt) — da radi odmah, bez modala
  const addEntityInline = async () => {
    try {
      const label =
        requires === "talent" ? "Ime i prezime talenta" : "Naziv dobavljača";
      const name = window.prompt(label);
      if (!name || !String(name).trim()) return;

      const endpoint = requires === "talent" ? "/api/talents" : "/api/vendors";
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: String(name).trim() }),
      });
      const data = await r.json();
      if (!data?.ok) {
        alert(data?.message ?? "Greška");
        return;
      }

      // refresh lista
      setLoadingEntities(true);
      const rr = await fetch(endpoint);
      const dd = await rr.json();
      if (dd?.ok) {
        const items = Array.isArray(dd.items) ? dd.items : [];
        if (requires === "talent") setTalents(items);
        else setVendors(items);
      }
      setLoadingEntities(false);

      // auto-select new
      onChange?.({
        tip_id: tipId,
        entity_type: requires === "talent" ? "talent" : "vendor",
        entity_id: Number(data.id) || null,
      });
    } catch (e) {
      setLoadingEntities(false);
      alert(e?.message ?? "Greška");
    }
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {/* TIP */}
      <div>
        <select
          value={tipId ?? ""}
          onChange={onPickType}
          style={inputStyle}
          disabled={loadingTypes}
        >
          <option value="">{t("projectDetail.selectTypePlaceholder")}</option>
          {types.map((typeRow) => {
            const id = getTypeId(typeRow);
            if (!id) return null;
            const label = tipLabelProp ? tipLabelProp(typeRow) : (getTypeName(typeRow) || (t(`projectDetail.costType${id}`) !== `projectDetail.costType${id}` ? t(`projectDetail.costType${id}`) : `Tip ${id}`));
            return (
              <option key={id} value={id}>
                {label}
              </option>
            );
          })}
        </select>
        {loadingTypes && (
          <div className="muted" style={{ marginTop: 6 }}>
            {t("projectDetail.loadingTypes")}
          </div>
        )}
      </div>

      {/* ENTITY (talent/vendor) */}
      {tipId && requires !== "none" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 8,
            alignItems: "center",
          }}
        >
          <select
            value={entityId ?? ""}
            onChange={onPickEntity}
            style={inputStyle}
            disabled={loadingEntities}
          >
            <option value="">
              {requires === "talent"
                ? t("projectDetail.selectTalentPlaceholder")
                : t("projectDetail.selectVendorPlaceholder")}
            </option>

            {currentItems.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={addEntityInline}
            disabled={loadingEntities}
            title={
              requires === "talent"
                ? t("projectDetail.addTalentTitle")
                : t("projectDetail.addVendorTitle")
            }
            style={{
              background: "linear-gradient(135deg, rgba(55, 214, 122, 0.18), rgba(34, 197, 94, 0.12))",
              border: "1px solid rgba(55, 214, 122, 0.4)",
              color: "inherit",
              padding: "8px 12px",
              borderRadius: 10,
              fontWeight: 700,
              cursor: loadingEntities ? "not-allowed" : "pointer",
              opacity: loadingEntities ? 0.6 : 1,
            }}
          >
            {t("projectDetail.addEntityButton")}
          </button>

          {loadingEntities && (
            <div className="muted" style={{ gridColumn: "1 / span 2" }}>
              {requires === "talent" ? t("projectDetail.loadingTalents") : t("projectDetail.loadingVendors")}
            </div>
          )}
        </div>
      )}

      {err && (
        <div style={{ fontSize: 13, opacity: 0.9 }}>
          <span className="badge" data-status="ERROR">
            Greška
          </span>{" "}
          {err}
        </div>
      )}
    </div>
  );
}
