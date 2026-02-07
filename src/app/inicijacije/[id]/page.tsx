// src/app/inicijacije/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DateTimePickerDDMMYYYYHHMM } from "@/components/DatePickers";

type Row = {
  inicijacija_id: number;
  narucilac_id: number;
  krajnji_klijent_id?: number | null;
  radni_naziv: string;
  kontakt_ime?: string | null;
  kontakt_tel?: string | null;
  kontakt_email?: string | null;
  napomena?: string | null;
  status_id: number;
  status_naziv?: string | null;
  status_kod?: string | null;
  projekat_id?: number | null;

  operativni_signal?: "NORMALNO" | "PAZNJA" | "STOP" | null;
  opened_at?: string | null;
};

type Klijent = { klijent_id: number; naziv_klijenta: string };

type TimelineRow = {
  event_id: number;
  inicijacija_id: number;
  required_deadline: string | null;
  studio_estimate: string | null;
  accepted_deadline: string | null;
  confirmed_via: string | null;
  confirmed_at: string | null;
  note: string | null;
  created_at: string;
};

type CjenHit = {
  stavka_id: number;
  naziv: string;
  jedinica: string;
  cijena_default: number;
  valuta_default: string;
  sort_order: number;
  cijena_ino_eur?: number | null;
};

type StavkaRow = {
  inicijacija_stavka_id: number;
  inicijacija_id: number;
  stavka_id: number | null;
  naziv_snapshot: string;
  jedinica_snapshot: string;
  kolicina: number;
  cijena_jedinicna: number;
  valuta: string;
  opis: string | null;
  line_total: number;
};

type CloseCheck = {
  ok?: boolean;
  ok_to_close?: boolean;
  hard_blocks?: { code: string; message: string }[];
  warnings?: { code: string; message: string; value?: any }[];
  summary?: {
    status_id?: number;
    status_name?: string | null;
    [k: string]: any;
  };
  [k: string]: any;
};

type ProjectStatusRow = {
  projekat_id: number;
  status_id: number;
  status_name: string | null;
};

const USER_LABEL = "SiNY";

const STATUSI = [
  { id: 1, naziv: "Nova ponuda" },
  { id: 2, naziv: "Na čekanju" },
  { id: 3, naziv: "Spremno za otvaranje projekta" },
  { id: 4, naziv: "Odbijeno" },
];

const VIA_OPTIONS = [
  { v: "", label: "—" },
  { v: "MAIL", label: "Mail" },
  { v: "PHONE", label: "Telefon" },
  { v: "VERBAL", label: "Usmeno" },
  { v: "OTHER", label: "Ostalo" },
];

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatHumanDT(v: string | null | undefined) {
  if (!v) return "—";
  const s = String(v).replace(" ", "T");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}`;
}

function parseHumanToIso(v: string): string | null {
  const s = (v ?? "").toString().trim();
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

  const iso = `${yyyy}-${pad2(mm)}-${pad2(dd)}T${pad2(HH)}:${pad2(MI)}:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  return iso;
}

function toHumanInput(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v).replace(" ", "T");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}`;
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
} as const;

function fmtMoney(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

function normCcy(v: any) {
  const s = String(v ?? "").trim().toUpperCase();
  return (s || "BAM").slice(0, 3);
}

function asNum(v: any) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const EUR_TO_BAM = 1.95583;

function fxRateToBAM(ccy: string): number | null {
  const c = normCcy(ccy);
  if (c === "BAM" || c === "KM") return 1;
  if (c === "EUR") return EUR_TO_BAM;
  return null;
}

function isoDateOnlyFromAccepted(isoOrNull: string | null): string | null {
  if (!isoOrNull) return null;
  const s = String(isoOrNull);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function daysDiffFromToday(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map((x) => Number(x));
  const target = new Date(y, (m || 1) - 1, d || 1);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function semaforFor(isoDate: string | null) {
  if (!isoDate) return { cls: "sem--none", title: "Nema roka", label: "Nema roka" };
  const diff = daysDiffFromToday(isoDate);
  if (!Number.isFinite(diff)) return { cls: "sem--none", title: "Nevažeći rok", label: "Nevažeći rok" };

  if (diff <= 0) return { cls: "sem--red", title: "Deadline je danas ili prošao", label: "DANAS / PROŠAO" };
  if (diff <= 3) return { cls: "sem--orange", title: "Deadline uskoro (≤ 3 dana)", label: "USKORO (≤3d)" };
  return { cls: "sem--green", title: "Deadline OK (> 3 dana)", label: "OK (>3d)" };
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...(init || {}) });
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = j?.message || j?.error || "Greška.";
    const err: any = new Error(msg);
    err.payload = j;
    err.status = res.status;
    throw err;
  }
  return j;
}

export default function PonudaDetaljPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [row, setRow] = useState<Row | null>(null);
  const [klijenti, setKlijenti] = useState<Klijent[]>([]);
  const [timeline, setTimeline] = useState<TimelineRow | null>(null);

  const [t_accepted, setTAccepted] = useState("");
  const [t_via, setTVia] = useState("");
  const [t_note, setTNote] = useState("");

  const [stavke, setStavke] = useState<StavkaRow[]>([]);
  const [pickerItems, setPickerItems] = useState<CjenHit[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const [selected, setSelected] = useState<CjenHit | null>(null);
  const [kolicina, setKolicina] = useState("1");
  const [cijenaUI, setCijenaUI] = useState("");
  const [opisStavke, setOpisStavke] = useState("");

  const [editId, setEditId] = useState<number | null>(null);
  const [editSelected, setEditSelected] = useState<CjenHit | null>(null);
  const [editKolicina, setEditKolicina] = useState("");
  const [editCijena, setEditCijena] = useState("");
  const [editOpis, setEditOpis] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTimeline, setSavingTimeline] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [openingProject, setOpeningProject] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ Close project (popover) ostaje
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeSaving, setCloseSaving] = useState(false);
  const [closeData, setCloseData] = useState<CloseCheck | null>(null);
  const [closeConfirmWarnings, setCloseConfirmWarnings] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  // ✅ NOVO: stvarni status projekta (kanonski za Deal UI)
  const [projStatus, setProjStatus] = useState<ProjectStatusRow | null>(null);
  const [projStatusLoading, setProjStatusLoading] = useState(false);
  const [projStatusError, setProjStatusError] = useState<string | null>(null);

  const projectStatusId = Number(projStatus?.status_id ?? 0);
  const projectStatusName = projStatus?.status_name ? String(projStatus.status_name) : null;

  // statusi_projekta:
  // 8 = ZATVOREN (soft-lock)
  // 9 = FAKTURISAN
  // 10 = ARHIVIRAN
  // 12 = OTKAZAN
  const isProjectClosed = projectStatusId === 8;
  const isProjectInvoiced = projectStatusId === 9;
  const isProjectArchived = projectStatusId === 10;
  const isProjectCancelled = projectStatusId === 12;

  // ✅ Deal read-only čim projekat uđe u zaključavajuće statuse
  const dealReadOnly =
    !!row?.projekat_id && (isProjectClosed || isProjectInvoiced || isProjectArchived || isProjectCancelled);

  const acceptedOk = useMemo(() => !!parseHumanToIso(t_accepted), [t_accepted]);

  const acceptedIso = useMemo(() => parseHumanToIso(t_accepted), [t_accepted]);
  const acceptedIsoDateOnly = useMemo(() => isoDateOnlyFromAccepted(acceptedIso), [acceptedIso]);
  const sem = useMemo(() => semaforFor(acceptedIsoDateOnly), [acceptedIsoDateOnly]);

  const totalsByCcy = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stavke) {
      const ccy = normCcy(s.valuta);
      const v = Number(s.line_total ?? 0);
      if (!Number.isFinite(v)) continue;
      map.set(ccy, (map.get(ccy) ?? 0) + v);
    }
    const obj: Record<string, number> = {};
    for (const [k, v] of map.entries()) obj[k] = v;
    return obj;
  }, [stavke]);

  const totalBAM = useMemo(() => (totalsByCcy["BAM"] ?? 0) + (totalsByCcy["KM"] ?? 0), [totalsByCcy]);
  const totalEUR = useMemo(() => totalsByCcy["EUR"] ?? 0, [totalsByCcy]);

  const budgetKM = useMemo(() => {
    let sum = 0;
    for (const s of stavke) {
      const ccy = normCcy(s.valuta);
      const v = Number(s.line_total ?? 0);
      if (!Number.isFinite(v)) continue;
      const rate = fxRateToBAM(ccy);
      if (rate === null) continue;
      sum += v * rate;
    }
    return sum;
  }, [stavke]);

  const hasUnsupportedFX = useMemo(() => {
    return stavke.some((s) => {
      const ccy = normCcy(s.valuta);
      if (ccy === "BAM" || ccy === "KM") return false;
      return fxRateToBAM(ccy) === null;
    });
  }, [stavke]);

  const eurInKM = useMemo(() => (Number.isFinite(totalEUR) ? totalEUR * EUR_TO_BAM : 0), [totalEUR]);

  async function loadKlijenti() {
    try {
      const res = await fetch("/api/klijenti", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.rows)) setKlijenti(data.rows as Klijent[]);
    } catch {}
  }

  async function loadPickerItems() {
    setPickerLoading(true);
    try {
      const res = await fetch(`/api/cjenovnik?picker=1&limit=1000`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.rows)) setPickerItems(data.rows as CjenHit[]);
      else setPickerItems([]);
    } catch {
      setPickerItems([]);
    } finally {
      setPickerLoading(false);
    }
  }

  async function loadTimeline() {
    try {
      const res = await fetch(`/api/inicijacije/timeline?inicijacija_id=${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Greška (timeline)");
      const tr = (data.row ?? null) as TimelineRow | null;
      setTimeline(tr);
      setTAccepted(toHumanInput(tr?.accepted_deadline ?? null));
      setTVia(tr?.confirmed_via ?? "");
      setTNote(tr?.note ?? "");
    } catch {
      setTimeline(null);
    }
  }

  async function loadStavke() {
    try {
      const res = await fetch(`/api/inicijacije/stavke?inicijacija_id=${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) return;
      setStavke(Array.isArray(data.rows) ? (data.rows as StavkaRow[]) : []);
    } catch {}
  }

  async function loadProjectStatus(projekatId: number) {
    setProjStatusError(null);
    setProjStatusLoading(true);
    try {
      const j = (await fetchJson(`/api/projects/${projekatId}/status`)) as any;
      const r = (j?.row ?? null) as ProjectStatusRow | null;
      setProjStatus(r);
    } catch (e: any) {
      setProjStatus(null);
      setProjStatusError(e?.message ?? "Greška pri učitavanju statusa projekta.");
    } finally {
      setProjStatusLoading(false);
    }
  }

  async function loadCloseCheck(projekatId: number) {
    setCloseError(null);
    setCloseLoading(true);
    setCloseConfirmWarnings(false);
    try {
      const j = (await fetchJson(`/api/projects/${projekatId}/close-check`)) as any;
      setCloseData(j as CloseCheck);
    } catch (e: any) {
      setCloseData(null);
      setCloseError(e?.message ?? "Greška pri provjeri zatvaranja.");
    } finally {
      setCloseLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/inicijacije/jedna?id=${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Greška");
      const r = data.row as Row;
      setRow(r);

      await Promise.all([loadTimeline(), loadStavke()]);

      if (r?.projekat_id) {
        const pid = Number(r.projekat_id);
        await Promise.all([loadProjectStatus(pid), loadCloseCheck(pid)]);
      } else {
        setProjStatus(null);
        setCloseData(null);
      }
    } catch (e: any) {
      setError(e?.message ?? "Greška");
      setRow(null);
      setTimeline(null);
      setStavke([]);
      setProjStatus(null);
      setCloseData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) return;
    loadKlijenti();
    loadPickerItems();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveDeal() {
    if (!row) return;
    if (dealReadOnly) return;

    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/inicijacije/jedna?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narucilac_id: row.narucilac_id,
          radni_naziv: row.radni_naziv,
          status_id: row.status_id,
          krajnji_klijent_id: row.krajnji_klijent_id ?? null,
          kontakt_ime: row.kontakt_ime ?? null,
          kontakt_tel: row.kontakt_tel ?? null,
          kontakt_email: row.kontakt_email ?? null,
          napomena: row.napomena ?? null,
        }),
      });

      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Greška");
      setMsg("Sačuvano.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Greška");
    } finally {
      setSaving(false);
    }
  }

  async function saveTimeline() {
    if (dealReadOnly) return;

    setSavingTimeline(true);
    setError(null);
    setMsg(null);

    const accepted_iso = parseHumanToIso(t_accepted);

    if (t_accepted.trim() && !accepted_iso) {
      setSavingTimeline(false);
      setError("Deadline mora biti u formatu: dd.mm.yyyy HH:mm (24h).");
      return;
    }

    try {
      const res = await fetch(`/api/inicijacije/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inicijacija_id: id,
          required_deadline: null,
          studio_estimate: null,
          confirmed_at: null,
          accepted_deadline: accepted_iso,
          confirmed_via: t_via || null,
          note: t_note || null,
        }),
      });

      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Greška (timeline)");

      setMsg("Timeline sačuvan (novi zapis).");
      await loadTimeline();
    } catch (e: any) {
      setError(e?.message ?? "Greška");
    } finally {
      setSavingTimeline(false);
    }
  }

  function findPickerById(stavka_id: number) {
    return pickerItems.find((x) => Number(x.stavka_id) === Number(stavka_id)) ?? null;
  }

  async function addItem() {
    if (dealReadOnly) return;
    if (!selected) return;

    setAddingItem(true);
    setError(null);
    setMsg(null);

    const k = asNum(kolicina);
    if (!k || k <= 0) {
      setAddingItem(false);
      setError("Količina mora biti broj > 0.");
      return;
    }

    const cij = asNum(cijenaUI);
    if (cij === null || cij < 0) {
      setAddingItem(false);
      setError("Cijena mora biti broj ≥ 0.");
      return;
    }

    try {
      const res = await fetch(`/api/inicijacije/stavke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inicijacija_id: id,
          stavka_id: selected.stavka_id,
          kolicina: k,
          cijena_jedinicna: cij,
          opis: opisStavke || null,
        }),
      });

      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Greška (stavke)");

      setSelected(null);
      setKolicina("1");
      setCijenaUI("");
      setOpisStavke("");
      setMsg("Stavka dodana.");
      await loadStavke();
    } catch (e: any) {
      setError(e?.message ?? "Greška");
    } finally {
      setAddingItem(false);
    }
  }

  async function stornoItem(inicijacija_stavka_id: number) {
    if (dealReadOnly) return;

    const ok = window.confirm("Stornirati ovu stavku? (Ne briše se; samo se sakrije i ne računa u zbir.)");
    if (!ok) return;

    setError(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/inicijacije/stavke`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicijacija_stavka_id, stornirano: 1 }),
      });

      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Greška (storno)");

      setMsg("Stavka stornirana.");
      await loadStavke();
    } catch (e: any) {
      setError(e?.message ?? "Greška");
    }
  }

  function startEdit(s: StavkaRow) {
    if (dealReadOnly) return;
    setEditId(s.inicijacija_stavka_id);
    setEditSelected(null);
    setEditKolicina(String(s.kolicina ?? ""));
    setEditCijena(String(s.cijena_jedinicna ?? ""));
    setEditOpis(String(s.opis ?? ""));
  }

  function cancelEdit() {
    setEditId(null);
    setEditSelected(null);
    setEditKolicina("");
    setEditCijena("");
    setEditOpis("");
    setSavingEdit(false);
  }

  async function saveEdit() {
    if (dealReadOnly) return;
    if (!editId) return;

    const k = asNum(editKolicina);
    const cij = asNum(editCijena);

    if (k === null || k <= 0) {
      setError("Količina mora biti broj > 0.");
      return;
    }
    if (cij === null || cij < 0) {
      setError("Cijena mora biti broj ≥ 0.");
      return;
    }

    setSavingEdit(true);
    setError(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/inicijacije/stavke`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inicijacija_stavka_id: editId,
          stavka_id: editSelected?.stavka_id ?? undefined,
          kolicina: k,
          cijena_jedinicna: cij,
          opis: editOpis || null,
        }),
      });

      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Greška (snimi promjene)");

      setMsg("Promjene snimljene.");
      cancelEdit();
      await loadStavke();
    } catch (e: any) {
      setError(e?.message ?? "Greška");
      setSavingEdit(false);
    }
  }

  async function openProject() {
    setOpeningProject(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/inicijacije/otvori-projekat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicijacija_id: id }),
      });

      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Greška");

      const pid = data?.projekat_id as number | null;
      setMsg(pid ? `Projekat otvoren (#${pid}).` : "Projekat otvoren.");
      await load();

      if (pid) router.push(`/projects/${pid}`);
    } catch (e: any) {
      setError(e?.message ?? "Greška");
    } finally {
      setOpeningProject(false);
    }
  }

  async function doCloseProject() {
    const pid = Number(row?.projekat_id ?? 0);
    if (!Number.isFinite(pid) || pid <= 0) return;

    const hasWarnings = (closeData?.warnings?.length ?? 0) > 0;

    setCloseSaving(true);
    setCloseError(null);
    try {
      await fetchJson(`/api/projects/${pid}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user": USER_LABEL },
        body: JSON.stringify({ force: hasWarnings ? closeConfirmWarnings : true }),
      });

      setCloseOpen(false);
      await load(); // povuče novi status projekta (kanonski)
    } catch (e: any) {
      const payload = e?.payload;
      if (payload?.error === "CLOSE_BLOCKED") setCloseError("Ne može se zatvoriti projekat. Provjeri blokade.");
      else if (payload?.error === "CLOSE_NEEDS_CONFIRM") setCloseError("Potrebna je potvrda upozorenja (čekiraj).");
      else setCloseError(e?.message ?? "Greška pri zatvaranju projekta.");

      try {
        await loadCloseCheck(pid);
      } catch {}
    } finally {
      setCloseSaving(false);
    }
  }

  useEffect(() => {
    const pid = Number(row?.projekat_id ?? 0);
    if (!closeOpen) return;
    if (!Number.isFinite(pid) || pid <= 0) return;
    void loadCloseCheck(pid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeOpen]);

  if (!Number.isFinite(id) || id <= 0) return <div className="container" style={{ padding: 16 }}>Neispravan ID.</div>;

  const dealTitle = row?.radni_naziv ? row.radni_naziv : `Deal #${id}`;

  const hasHardBlocks = (closeData?.hard_blocks?.length ?? 0) > 0;
  const hasWarnings = (closeData?.warnings?.length ?? 0) > 0;

  const projectStatusLabel =
    !row?.projekat_id
      ? null
      : projStatusLoading
        ? "Učitavam…"
        : projStatusError
          ? "Greška"
          : projectStatusName
            ? projectStatusName
            : projectStatusId
              ? `Status #${projectStatusId}`
              : "—";

  const projectStatusTone =
    isProjectArchived || isProjectCancelled
      ? { border: "rgba(255,255,255,.18)", bg: "rgba(255,255,255,.06)" }
      : isProjectInvoiced
        ? { border: "rgba(80, 170, 255, .45)", bg: "rgba(80, 170, 255, .10)" }
        : isProjectClosed
          ? { border: "rgba(255, 214, 102, .45)", bg: "rgba(255, 193, 7, .10)" }
          : { border: "rgba(55,214,122,.45)", bg: "rgba(55,214,122,.10)" };

  return (
    <div className="pageWrap">
      <style>{`
        .pageWrap { height: 100vh; display:flex; flex-direction:column; overflow:hidden; }
        .topBlock { position: sticky; top:0; z-index:20; background: rgba(10, 12, 16, .62); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,.10); }
        .topInner { padding: 14px 0 12px; }
        .scrollWrap { flex:1; overflow:auto; padding: 0 0 18px; }
        .container { padding-top: 0; }

        .topbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px; flex-wrap:wrap; }
        .glassbtn { border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); box-shadow: 0 10px 30px rgba(0,0,0,.18); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); transition: transform .12s ease, background .12s ease, border-color .12s ease; text-decoration:none; cursor:pointer; user-select:none; color:inherit; }
        .glassbtn:hover { background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.26); }
        .glassbtn:active { transform: scale(.985); }

        .backCluster { display:flex; align-items:center; gap:10px; min-width:240px; }
        .backIcon { width:42px; height:42px; border-radius:14px; display:inline-flex; align-items:center; justify-content:center; }
        .backText { line-height:1.15; }
        .backText .mutedLine { font-size:12px; opacity:.82; }
        .backText .strongLine { font-size:13px; font-weight:650; }

        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandLogo { height: 32px; width:auto; display:block; }
        .brandTitle { font-size:22px; font-weight:700; line-height:1.05; margin:0; }
        .brandSub { margin-top:4px; opacity:.82; font-size:13px; line-height:1.1; }

        .actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
        .actionBtn { padding:10px 12px; border-radius:14px; display:inline-flex; align-items:center; gap:8px; font-weight:650; white-space:nowrap; }

        .pageHead { margin-top: 8px; }
        .pageTitle { font-size:22px; font-weight:700; margin:0; }
        .pageSub { margin-top:6px; opacity:.82; font-size:13px; line-height:1.25; }

        .cardLike { border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.05); border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.14); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); padding: 14px; margin-top: 12px; }

        .grid2 { display:grid; grid-template-columns:220px 1fr; gap:10px; align-items:center; }
        @media (max-width: 860px) { .grid2 { grid-template-columns: 1fr; } }

        .label { opacity:.75; font-size:13px; }
        .muted { opacity:.75; }

        .msgOk { margin-top:10px; color:#21c55d; }
        .msgErr { margin-top:10px; color:#ff4d4d; }

        .sumPill { display:inline-flex; align-items:center; gap:8px; padding:8px 10px; border-radius:999px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); font-size:13px; font-weight:750; white-space:nowrap; }
        .btnSmall { padding:8px 10px; border-radius:12px; font-weight:700; }

        .deadlineWrap { border: 1px solid rgba(255,255,255,.22); background: rgba(140, 210, 255, .10); border-radius: 14px; padding: 10px; }
        .deadlineLabel { font-weight: 800; color: rgba(170, 235, 255, 0.95); }

        .sem { width: 12px; height: 12px; border-radius: 999px; display:inline-block; box-shadow: 0 0 0 2px rgba(0,0,0,.15) inset; }
        .sem--none { background: rgba(255,255,255,.18); }
        .sem--green { background: #37d67a; }
        .sem--orange { background: #ffb020; }
        .sem--red { background: #ff3b30; }

        .deadlineMeta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top: 8px; font-size: 12px; opacity: .92; }
        .deadlineBadge { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); font-weight:800; letter-spacing:.2px; }

        .dealBanner { border: 1px solid rgba(255, 214, 102, .35); background: rgba(255, 193, 7, .10); }
        .dealBannerTitle { font-weight: 850; letter-spacing:.2px; }
        .dealBannerText { margin-top: 6px; font-size: 13px; opacity:.92; }

        .hint12 { font-size:12px; opacity:.75; margin-top:6px; }

        .popoverCard { position:absolute; right:0; top: calc(100% + 10px); width: 380px; max-width: 92vw; z-index:60; border: 1px solid rgba(255,255,255,.18); background: rgba(20,20,30,.92); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 14px 40px rgba(0,0,0,.35); border-radius: 14px; padding: 12px; }

        .statusPill { display:inline-flex; align-items:center; gap:8px; padding: 6px 10px; border-radius:999px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); font-weight:850; letter-spacing:.2px; font-size:12px; white-space:nowrap; }
        .statusDot { width: 10px; height: 10px; border-radius: 999px; display:inline-block; box-shadow: 0 0 0 2px rgba(0,0,0,.15) inset; }
      `}</style>

      <div className="topBlock">
        <div className="container topInner">
          <div className="topbar">
            <div className="backCluster">
              <Link href="/inicijacije" aria-label="Povratak na Deals" title="Povratak na Deals" className="glassbtn backIcon">
                <span style={{ fontSize: 22, lineHeight: 1 }}>←</span>
              </Link>
              <div className="backText">
                <div className="mutedLine">Povratak</div>
                <div className="strongLine">na Deals</div>
              </div>
            </div>

            <div className="brandWrap" style={{ flex: "1 1 auto", justifyContent: "center" }}>
              <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
              <div>
                <div className="brandTitle">Deal</div>
                <div className="brandSub">Project & Finance Engine</div>
              </div>
            </div>

            <div className="actions">
              {row?.projekat_id ? (
                <>
                  <button onClick={() => router.push(`/projects/${row.projekat_id}`)} className="glassbtn actionBtn" type="button">
                    📁 Otvori projekat #{row.projekat_id}
                  </button>

                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setCloseOpen((v) => !v)}
                      className="glassbtn actionBtn"
                      type="button"
                      title={dealReadOnly ? "Deal je read-only jer projekat ima zaključavajući status." : "Zatvori projekat (soft-lock) i spremi za fakturisanje."}
                      style={{ opacity: dealReadOnly ? 0.9 : 1 }}
                    >
                      🔒 Zatvori projekat
                    </button>

                    {closeOpen && (
                      <div className="popoverCard">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                          <div style={{ fontWeight: 900 }}>Zatvori projekat</div>
                          <button type="button" className="btn" onClick={() => setCloseOpen(false)} disabled={closeSaving} title="Zatvori">
                            ✕
                          </button>
                        </div>

                        <div style={{ marginTop: 8, opacity: 0.88, fontSize: 13 }}>
                          Ovo znači: projekat ulazi u status <b>ZATVOREN</b> (soft-lock) i spreman je za fakturisanje.
                        </div>

                        <div style={{ marginTop: 12 }}>
                          {closeLoading ? (
                            <div style={{ opacity: 0.85 }}>Učitavam provjeru…</div>
                          ) : !closeData ? (
                            <div style={{ opacity: 0.9 }}>
                              <div style={{ fontWeight: 800, marginBottom: 6 }}>Nije moguće učitati provjeru</div>
                              <div style={{ opacity: 0.9 }}>{closeError ?? "—"}</div>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                                <button className="btn" type="button" onClick={() => setCloseOpen(false)} disabled={closeSaving}>
                                  Zatvori
                                </button>
                                <button className="btn" type="button" onClick={() => row?.projekat_id && loadCloseCheck(Number(row.projekat_id))} disabled={closeSaving}>
                                  Pokušaj ponovo
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {hasHardBlocks && (
                                <div style={{ marginTop: 12, border: "1px solid rgba(255,80,80,.35)", background: "rgba(255,80,80,.10)", padding: 10, borderRadius: 12 }}>
                                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Ne može se zatvoriti projekat</div>
                                  <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 6, fontSize: 13 }}>
                                    {(closeData?.hard_blocks ?? []).map((b: any) => (
                                      <li key={String(b?.code ?? b?.message ?? Math.random())}>{String(b?.message ?? "—")}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {hasWarnings && (
                                <div style={{ marginTop: 12, border: "1px solid rgba(255,165,0,.35)", background: "rgba(255,165,0,.10)", padding: 10, borderRadius: 12 }}>
                                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Upozorenja</div>
                                  <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 6, fontSize: 13 }}>
                                    {(closeData?.warnings ?? []).map((w: any) => (
                                      <li key={String(w?.code ?? w?.message ?? Math.random())}>{String(w?.message ?? "—")}</li>
                                    ))}
                                  </ul>

                                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13 }}>
                                    <input type="checkbox" checked={closeConfirmWarnings} onChange={(e) => setCloseConfirmWarnings(e.target.checked)} disabled={closeSaving} />
                                    Razumijem i želim nastaviti
                                  </label>
                                </div>
                              )}

                              {closeError && (
                                <div style={{ marginTop: 10, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.06)", padding: 10, borderRadius: 12, fontSize: 13, opacity: 0.95 }}>
                                  {closeError}
                                </div>
                              )}

                              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                                <button className="btn" type="button" onClick={() => setCloseOpen(false)} disabled={closeSaving}>
                                  Otkaži
                                </button>
                                <button
                                  className="btn"
                                  type="button"
                                  onClick={doCloseProject}
                                  disabled={closeSaving || hasHardBlocks || (hasWarnings && !closeConfirmWarnings) || isProjectClosed}
                                  title="Zatvori projekat (status = ZATVOREN)"
                                >
                                  {closeSaving ? "Snima…" : isProjectClosed ? "Već zatvoren" : "Zatvori projekat"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button onClick={saveDeal} disabled={saving || loading || !row} className="glassbtn actionBtn" type="button" style={{ opacity: saving ? 0.7 : 1 }}>
                    {saving ? "Snima..." : "Sačuvaj"}
                  </button>

                  <button
                    onClick={openProject}
                    disabled={openingProject || loading || !!row?.projekat_id || !acceptedOk}
                    className="glassbtn actionBtn"
                    type="button"
                    style={{ opacity: openingProject ? 0.7 : !acceptedOk ? 0.55 : 1 }}
                    title={!acceptedOk ? "Ne može bez Deadline-a (dd.mm.yyyy HH:mm)." : "Otvori projekat iz Deal-a."}
                  >
                    {openingProject ? "Otvaram..." : "Otvori projekat"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="pageHead">
            <h1 className="pageTitle">
              {dealTitle}
              <span className="muted" style={{ fontWeight: 600 }}>{" "}· Deal #{id}</span>
              {row?.projekat_id ? <span className="muted">{" "}· Projekt #{row.projekat_id}</span> : null}
            </h1>

            {!loading && (
              <div className="pageSub">
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span>
                    Otvoren: <b>{formatHumanDT(row?.opened_at ?? null)}</b>
                    {"  "}·{"  "}
                    Timeline:{" "}
                    {timeline?.created_at ? <b>zadnji zapis {formatHumanDT(timeline.created_at)}</b> : <span className="muted">nema zapisa</span>}
                  </span>

                  {row?.projekat_id ? (
                    <span className="statusPill" style={{ borderColor: projectStatusTone.border, background: projectStatusTone.bg }} title="Kanonski status projekta (projekti.status_id → statusi_projekta)">
                      <span
                        className="statusDot"
                        style={{
                          background: isProjectArchived || isProjectCancelled ? "rgba(255,255,255,.55)" : isProjectInvoiced ? "rgba(80,170,255,.95)" : isProjectClosed ? "rgba(255,193,7,.95)" : "rgba(55,214,122,.95)",
                        }}
                      />
                      <span style={{ opacity: 0.9 }}>Status projekta:</span>
                      <span style={{ fontWeight: 900 }}>{projectStatusLabel}</span>
                      {projectStatusId ? <span style={{ opacity: 0.75 }}>#{projectStatusId}</span> : null}
                    </span>
                  ) : null}

                  {dealReadOnly ? (
                    <span style={{ fontWeight: 850, color: "rgba(255, 214, 102, .95)" }}>
                      · 🔒 Deal je read-only (status projekta zaključava)
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {!loading && row?.projekat_id ? (
            <div className="cardLike dealBanner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div className="dealBannerTitle">⚠️ Ovaj Deal je već prešao u projekat.</div>
                <div className="dealBannerText">
                  Budžet i stavke u projektu su snapshotovani.{" "}
                  {isProjectArchived || isProjectCancelled ? (
                    <b>Deal je istorija jer je projekat u ARHIVI.</b>
                  ) : isProjectInvoiced ? (
                    <b>Projekat je FAKTURISAN (9) — prati naplatu.</b>
                  ) : isProjectClosed ? (
                    <b>Deal je zaključan jer je projekat ZATVOREN (8).</b>
                  ) : (
                    <span>Promjene ovdje više nisu primarni izvor istine.</span>
                  )}
                </div>
              </div>

              {row?.operativni_signal && row.operativni_signal !== "NORMALNO" ? (
                <div
                  title={row.operativni_signal === "STOP" ? "STOP (owner): odmah zaustavi i provjeri" : "PAŽNJA (owner): obrati pažnju"}
                  style={{
                    flex: "0 0 auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: row.operativni_signal === "STOP" ? "1px solid rgba(255, 80, 80, .55)" : "1px solid rgba(255, 214, 102, .55)",
                    background: row.operativni_signal === "STOP" ? "rgba(255, 80, 80, .12)" : "rgba(255, 193, 7, .12)",
                    fontWeight: 900,
                    letterSpacing: ".2px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: 999, display: "inline-block", background: row.operativni_signal === "STOP" ? "#ff3b30" : "#ffb020", boxShadow: "0 0 0 2px rgba(0,0,0,.15) inset" }} />
                  <span style={{ fontSize: 12, opacity: 0.92 }}>OWNER</span>
                  <span style={{ fontSize: 12 }}>{row.operativni_signal === "STOP" ? "STOP" : "PAŽNJA"}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {loading && <div className="cardLike">Učitavam...</div>}
          {!!error && !loading && <div className="cardLike msgErr">Greška: {error}</div>}
          {!!msg && !loading && <div className="cardLike msgOk">{msg}</div>}
        </div>
      </div>

      {/* SCROLL */}
      <div className="scrollWrap">
        <div className="container" style={{ opacity: dealReadOnly ? 0.92 : 1 }}>
          {/* TIMELINE */}
          {!loading && (
            <div className="cardLike">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 750, fontSize: 16 }}>Timeline (Deal)</div>

                <button
                  onClick={saveTimeline}
                  disabled={savingTimeline || dealReadOnly}
                  className="glassbtn actionBtn"
                  type="button"
                  style={{ opacity: savingTimeline ? 0.7 : dealReadOnly ? 0.55 : 1, pointerEvents: dealReadOnly ? "none" : "auto" }}
                  title={dealReadOnly ? "Deal je read-only (status projekta zaključava)." : "Snima novi timeline zapis (stari se ne briše)."}
                >
                  {savingTimeline ? "Snima..." : "Sačuvaj timeline"}
                </button>
              </div>

              <div className="grid2" style={{ marginTop: 10, opacity: dealReadOnly ? 0.65 : 1, pointerEvents: dealReadOnly ? "none" : "auto" }}>
                <div className="label">Otvoren Deal</div>
                <div style={{ ...inputStyle, opacity: 0.9 }}>{formatHumanDT(row?.opened_at ?? null)}</div>

                <div className="label deadlineLabel">Deadline / vrijeme događaja</div>
                <div className="deadlineWrap">
                  <DateTimePickerDDMMYYYYHHMM value={t_accepted} onChange={setTAccepted} placeholder="dd.mm.yyyy HH:mm" />

                  <div className="deadlineMeta">
                    <span className={`sem ${sem.cls}`} title={sem.title} />
                    <span className="deadlineBadge" title={sem.title}>
                      {sem.label}
                    </span>
                    <span className="muted">{acceptedIsoDateOnly ? `datum: ${acceptedIsoDateOnly}` : "nema unesenog roka"}</span>
                  </div>

                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    * Ovo je jedini rok koji je bitan za otvaranje projekta i prioritete.
                  </div>
                </div>

                <div className="label">Potvrđeno putem</div>
                <select value={t_via} onChange={(e) => setTVia(e.target.value)} style={inputStyle}>
                  {VIA_OPTIONS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <div className="label">Bilješka</div>
                <input value={t_note} onChange={(e) => setTNote(e.target.value)} placeholder="kratko…" style={inputStyle} />
              </div>
            </div>
          )}

                    {/* STAVKE */}
          {!loading && (
            <div
              className="cardLike"
              style={{
                opacity: dealReadOnly ? 0.65 : 1,
                pointerEvents: dealReadOnly ? "none" : "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontWeight: 750, fontSize: 16 }}>
                  Stavke – određivanje budžeta
                </div>

                <div
                  className="sumPill"
                  title="Budžet (KM/BAM) = BAM + (EUR→BAM)"
                >
                  Ukupno / budžet: <b>{fmtMoney(budgetKM)} BAM</b>
                </div>
              </div>

              {row?.projekat_id ? (
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  ⚠️ Budžet je već snapshotovan u projektu. Promjene ovdje{" "}
                  <b>ne mijenjaju automatski</b> postojeći projekat.
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div
                  className="sumPill"
                  title="Zbir stavki u domaćoj valuti (BAM/KM)"
                >
                  BAM/KM: <b>{fmtMoney(totalBAM)} BAM</b>
                </div>

                {totalEUR > 0 ? (
                  <div
                    className="sumPill"
                    title={`EUR subtotal i preračun u BAM (1 EUR = ${EUR_TO_BAM} BAM)`}
                  >
                    EUR: <b>{fmtMoney(totalEUR)} EUR</b>{" "}
                    <span className="muted">→</span>{" "}
                    <b>{fmtMoney(eurInKM)} BAM</b>
                  </div>
                ) : null}
              </div>

              {hasUnsupportedFX ? (
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  * Postoje stavke u valuti koju trenutno ne znamo preračunati u
                  BAM. One nisu uključene u budžet dok ne uvedemo kursnu tabelu.
                </div>
              ) : totalEUR > 0 ? (
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  * EUR se preračunava fiksno u BAM (1 EUR = {EUR_TO_BAM} BAM).
                  Kasnije ćemo ovo formalizovati kroz kursnu tabelu kad dođe red.
                </div>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 140px 160px 1fr 140px",
                  gap: 8,
                  alignItems: "center",
                  marginTop: 10,
                }}
              >
                <div>
                  <select
                    value={selected ? String(selected.stavka_id) : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        setSelected(null);
                        setCijenaUI("");
                        return;
                      }
                      const it = findPickerById(Number(v));
                      setSelected(it);
                      setCijenaUI(it ? String(it.cijena_default ?? "0") : "");
                    }}
                    style={inputStyle}
                    disabled={pickerLoading}
                  >
                    <option value="">
                      {pickerLoading
                        ? "Učitavam cjenovnik..."
                        : "— Izaberi stavku iz cjenovnika —"}
                    </option>
                    {pickerItems.map((it) => (
                      <option key={it.stavka_id} value={String(it.stavka_id)}>
                        {it.naziv} (#{it.stavka_id})
                      </option>
                    ))}
                  </select>

                  {selected ? (
                    <div className="hint12">
                      #{selected.stavka_id} • {selected.jedinica} •{" "}
                      {Number(selected.cijena_default ?? 0).toFixed(2)}{" "}
                      {normCcy(selected.valuta_default)}
                    </div>
                  ) : null}
                </div>

                <input
                  value={kolicina}
                  onChange={(e) => setKolicina(e.target.value)}
                  placeholder="količina"
                  style={inputStyle}
                />

                <input
                  value={cijenaUI}
                  onChange={(e) => setCijenaUI(e.target.value)}
                  placeholder={
                    selected
                      ? `cijena (${normCcy(selected.valuta_default)})`
                      : "cijena"
                  }
                  style={inputStyle}
                  inputMode="decimal"
                  disabled={!selected}
                />

                <input
                  value={opisStavke}
                  onChange={(e) => setOpisStavke(e.target.value)}
                  placeholder="opis (opciono)"
                  style={inputStyle}
                />

                <button
                  onClick={addItem}
                  disabled={!selected || addingItem}
                  className="glassbtn actionBtn"
                  type="button"
                  style={{
                    opacity: !selected || addingItem ? 0.6 : 1,
                  }}
                >
                  {addingItem ? "Dodajem..." : "Dodaj"}
                </button>
              </div>

              <div
                style={{
                  marginTop: 12,
                  borderTop: "1px solid rgba(255,255,255,.10)",
                  paddingTop: 10,
                }}
              >
                {stavke.length === 0 ? (
                  <div className="muted">Nema stavki.</div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "80px 1fr 120px 140px 140px 240px",
                      gap: 8,
                      fontWeight: 700,
                      marginBottom: 6,
                      opacity: 0.95,
                    }}
                  >
                    <div>#</div>
                    <div>Stavka</div>
                    <div>Količina</div>
                    <div>Cijena</div>
                    <div>Total</div>
                    <div>Akcije</div>
                  </div>
                )}

                {stavke.map((s, idx) => {
                  const isEditing = editId === s.inicijacija_stavka_id;

                  return (
                    <div
                      key={s.inicijacija_stavka_id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "80px 1fr 120px 140px 140px 240px",
                        gap: 8,
                        padding: "10px 0",
                        borderTop: "1px solid rgba(255,255,255,.08)",
                        alignItems: "start",
                      }}
                    >
                      <div>{idx + 1}</div>

                      <div>
                        {!isEditing ? (
                          <>
                            <div style={{ fontWeight: 750 }}>
                              {s.naziv_snapshot}
                            </div>
                            {s.opis ? (
                              <div className="muted" style={{ fontSize: 12 }}>
                                {s.opis}
                              </div>
                            ) : null}
                            <div className="muted" style={{ fontSize: 12 }}>
                              jedinica: {s.jedinica_snapshot} • valuta:{" "}
                              {normCcy(s.valuta)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <select
                                value={
                                  editSelected
                                    ? String(editSelected.stavka_id)
                                    : ""
                                }
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (!v) {
                                    setEditSelected(null);
                                    return;
                                  }
                                  const it = findPickerById(Number(v));
                                  setEditSelected(it);
                                  if (it)
                                    setEditCijena(
                                      String(it.cijena_default ?? "0")
                                    );
                                }}
                                style={inputStyle}
                                disabled={pickerLoading}
                              >
                                <option value="">
                                  — Zadrži trenutnu stavku —
                                </option>
                                {pickerItems.map((it) => (
                                  <option
                                    key={it.stavka_id}
                                    value={String(it.stavka_id)}
                                  >
                                    {it.naziv} (#{it.stavka_id})
                                  </option>
                                ))}
                              </select>

                              {editSelected ? (
                                <div className="hint12">
                                  #{editSelected.stavka_id} •{" "}
                                  {editSelected.jedinica} •{" "}
                                  {Number(
                                    editSelected.cijena_default ?? 0
                                  ).toFixed(2)}{" "}
                                  {normCcy(editSelected.valuta_default)}
                                </div>
                              ) : null}
                            </div>

                            <div style={{ marginTop: 8 }}>
                              <input
                                value={editOpis}
                                onChange={(e) => setEditOpis(e.target.value)}
                                placeholder="opis (opciono)"
                                style={inputStyle}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <div>
                        {!isEditing ? (
                          <div>{Number(s.kolicina ?? 0).toFixed(3)}</div>
                        ) : (
                          <input
                            value={editKolicina}
                            onChange={(e) => setEditKolicina(e.target.value)}
                            style={inputStyle}
                          />
                        )}
                      </div>

                      <div>
                        {!isEditing ? (
                          <div>
                            {Number(s.cijena_jedinicna ?? 0).toFixed(2)}{" "}
                            {normCcy(s.valuta)}
                          </div>
                        ) : (
                          <input
                            value={editCijena}
                            onChange={(e) => setEditCijena(e.target.value)}
                            style={inputStyle}
                            inputMode="decimal"
                          />
                        )}
                      </div>

                      <div>
                        <b>
                          {Number(s.line_total ?? 0).toFixed(2)}{" "}
                          {normCcy(s.valuta)}
                        </b>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        {!isEditing ? (
                          <>
                            <button
                              type="button"
                              className="glassbtn btnSmall"
                              onClick={() => startEdit(s)}
                            >
                              ✎ Promijeni
                            </button>

                            <button
                              type="button"
                              className="glassbtn btnSmall"
                              onClick={() => stornoItem(s.inicijacija_stavka_id)}
                              title="Storniraj stavku (ne briše se; samo se sakrije i ne računa u zbir)"
                            >
                              🧾 Storno
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="glassbtn btnSmall"
                              onClick={saveEdit}
                              disabled={savingEdit}
                              style={{ opacity: savingEdit ? 0.7 : 1 }}
                            >
                              💾 {savingEdit ? "Snima..." : "Snimi promjene"}
                            </button>

                            <button
                              type="button"
                              className="glassbtn btnSmall"
                              onClick={cancelEdit}
                              style={{ opacity: 0.85 }}
                            >
                              ✖ Otkaži
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {stavke.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div className="sumPill">
                      Ukupno / budžet: <b>{fmtMoney(budgetKM)} BAM</b>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STATUS */}
          {row && !loading && (
            <div
              className="cardLike"
              style={{
                opacity: dealReadOnly ? 0.65 : 1,
                pointerEvents: dealReadOnly ? "none" : "auto",
              }}
            >
              <div style={{ fontWeight: 750, fontSize: 16, marginBottom: 10 }}>
                Status (Deal)
              </div>

              <div className="grid2">
                <div className="label">Radni naziv</div>
                <input
                  value={row.radni_naziv}
                  onChange={(e) =>
                    setRow({ ...row, radni_naziv: e.target.value })
                  }
                  style={inputStyle}
                />

                <div className="label">Faza pregovora</div>
                <select
                  value={row.status_id}
                  onChange={(e) =>
                    setRow({ ...row, status_id: Number(e.target.value) })
                  }
                  style={inputStyle}
                >
                  {STATUSI.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.naziv}
                    </option>
                  ))}
                </select>

                <div className="label">Napomene za produkciju</div>
                <textarea
                  value={row.napomena ?? ""}
                  onChange={(e) =>
                    setRow({ ...row, napomena: e.target.value })
                  }
                  rows={4}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                  }}
                />
              </div>

              <div
                style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}
              >
                <button
                  onClick={saveDeal}
                  disabled={saving || loading}
                  className="glassbtn actionBtn"
                  type="button"
                  style={{ opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? "Snima..." : "Sačuvaj"}
                </button>
              </div>
            </div>
          )}

          {/* KLIJENT */}
          {row && !loading && (
            <div
              className="cardLike"
              style={{
                opacity: dealReadOnly ? 0.65 : 1,
                pointerEvents: dealReadOnly ? "none" : "auto",
              }}
            >
              <div style={{ fontWeight: 750, fontSize: 16, marginBottom: 10 }}>
                Podaci o klijentu / naručiocu
              </div>

              <div className="grid2">
                <div className="label">Naručilac</div>
                <select
                  value={row.narucilac_id}
                  onChange={(e) =>
                    setRow({ ...row, narucilac_id: Number(e.target.value) })
                  }
                  style={inputStyle}
                >
                  {klijenti.length === 0 && (
                    <option value={row.narucilac_id}>
                      Učitavam klijente...
                    </option>
                  )}
                  {klijenti.map((k) => (
                    <option key={k.klijent_id} value={k.klijent_id}>
                      {k.klijent_id} — {k.naziv_klijenta}
                    </option>
                  ))}
                </select>

                <div className="label">Krajnji klijent</div>
                <select
                  value={row.krajnji_klijent_id ?? ""}
                  onChange={(e) =>
                    setRow({
                      ...row,
                      krajnji_klijent_id: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  style={inputStyle}
                >
                  <option value="">— isto kao naručilac —</option>
                  {klijenti.map((k) => (
                    <option key={k.klijent_id} value={k.klijent_id}>
                      {k.klijent_id} — {k.naziv_klijenta}
                    </option>
                  ))}
                </select>

                <div className="label">Kontakt ime</div>
                <input
                  value={row.kontakt_ime ?? ""}
                  onChange={(e) =>
                    setRow({ ...row, kontakt_ime: e.target.value })
                  }
                  style={inputStyle}
                />

                <div className="label">Kontakt tel</div>
                <input
                  value={row.kontakt_tel ?? ""}
                  onChange={(e) =>
                    setRow({ ...row, kontakt_tel: e.target.value })
                  }
                  style={inputStyle}
                />

                <div className="label">Kontakt email</div>
                <input
                  value={row.kontakt_email ?? ""}
                  onChange={(e) =>
                    setRow({ ...row, kontakt_email: e.target.value })
                  }
                  style={inputStyle}
                />
              </div>

              <div
                style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}
              >
                <button
                  onClick={saveDeal}
                  disabled={saving || loading}
                  className="glassbtn actionBtn"
                  type="button"
                  style={{ opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? "Snima..." : "Sačuvaj"}
                </button>
              </div>
            </div>
          )}
       </div>
      </div>
    </div>
  );
}