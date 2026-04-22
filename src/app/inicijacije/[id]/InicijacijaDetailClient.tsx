// src/app/inicijacije/[id]/InicijacijaDetailClient.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DatePickerDDMMYYYY } from "@/components/DatePickers";
import FluxaLogo from "@/components/FluxaLogo";
import StatusTimelineBar from "@/components/StatusTimelineBar";
import { useTranslation } from "@/components/LocaleProvider";
import { getCurrencyForLocale, getLocaleFromDocument } from "@/lib/i18n";

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
  account_manager_name?: string | null;
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

type AuthUser = {
  user_id: number;
  username: string;
  nivo: number;
};

type EditOverrideState = {
  override_id: number;
  reason: string;
  expires_at: string;
  enabled_by_username: string | null;
  enabled_by_user_id: number | null;
} | null;

const USER_LABEL = "SiNY";
const TIMELINE_STORAGE_KEY = "fluxa_deal_timeline_open";

function getTimelineStoredOpen() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TIMELINE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setTimelineStoredOpen(open: boolean) {
  try {
    window.localStorage.setItem(TIMELINE_STORAGE_KEY, open ? "1" : "0");
  } catch {}
}

function getViaOptions(t: (k: string) => string) {
  return [
    { v: "", label: "—" },
    { v: "MAIL", label: t("dealDetail.viaMail") },
    { v: "PHONE", label: t("dealDetail.viaPhone") },
    { v: "VERBAL", label: t("dealDetail.viaVerbal") },
    { v: "OTHER", label: t("dealDetail.viaOther") },
  ];
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

const LOCALE_MAP: Record<string, string> = { sr: "bs-BA", en: "en-GB" };

function formatHumanDT(v: string | null | undefined, locale: string) {
  if (!v) return "—";
  const s = String(v).replace(" ", "T");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  const loc = LOCALE_MAP[locale] || "bs-BA";
  return d.toLocaleString(loc, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseHumanToIso(v: string): string | null {
  const s = (v ?? "").toString().trim();
  if (!s) return null;

  // Pokušaj prvo sa formatom sa vremenom (dd.mm.yyyy HH:mm)
  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (m) {
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

  // Ako nema vrijeme, pokušaj samo datum (dd.mm.yyyy) i postavi defaultno vrijeme 16:00
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);

    if (mm < 1 || mm > 12) return null;
    if (dd < 1 || dd > 31) return null;

    // Defaultno vrijeme: 16:00
    const iso = `${yyyy}-${pad2(mm)}-${pad2(dd)}T16:00:00`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;

    return iso;
  }

  return null;
}

function toHumanInput(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v).replace(" ", "T");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  // Prikaži samo datum (bez vremena) za date picker
  // Vrijeme će biti dodato pri čuvanju ako nije ručno uneseno
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
  fontSize: 15,
} as const;

function fmtMoney(n: number, locale?: string) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  const loc = locale ? LOCALE_MAP[locale] || "bs-BA" : "bs-BA";
  return x.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normCcy(v: any) {
  const s = String(v ?? "")
    .trim()
    .toUpperCase();
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

function semaforFor(
  isoDate: string | null,
  t: (k: string) => string,
) {
  if (!isoDate)
    return { cls: "sem--none", title: t("dealDetail.semaforNone"), label: t("dealDetail.semaforNone") };
  const diff = daysDiffFromToday(isoDate);
  if (!Number.isFinite(diff))
    return { cls: "sem--none", title: t("dealDetail.semaforInvalid"), label: t("dealDetail.semaforInvalid") };

  if (diff <= 0)
    return {
      cls: "sem--red",
      title: t("dealDetail.semaforOverdue"),
      label: t("dealDetail.semaforOverdueLabel"),
    };
  if (diff <= 3)
    return {
      cls: "sem--orange",
      title: t("dealDetail.semaforSoon"),
      label: t("dealDetail.semaforSoonLabel"),
    };
  return {
    cls: "sem--green",
    title: t("dealDetail.semaforOk"),
    label: t("dealDetail.semaforOkLabel"),
  };
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...(init || {}) });
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = j?.message || j?.error || "Error";
    const err: any = new Error(msg);
    err.payload = j;
    err.status = res.status;
    throw err;
  }
  return j;
}

export default function InicijacijaDetailClient() {
  const { t, locale } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);
  const primaryCurrency = getCurrencyForLocale(locale);
  const isEurPrimary = primaryCurrency === "EUR";
  const VIA_OPTIONS = useMemo(() => getViaOptions(t), [t]);

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
  const [editValuta, setEditValuta] = useState<string>("BAM");
  const [editOpis, setEditOpis] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTimeline, setSavingTimeline] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [openingProject, setOpeningProject] = useState(false);
  const [ponudeList, setPonudeList] = useState<{ ponuda_id: number; broj_ponude: string }[]>([]);

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
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [overrideState, setOverrideState] = useState<EditOverrideState>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideMinutes, setOverrideMinutes] = useState("30");
  const [overrideBusy, setOverrideBusy] = useState(false);

  const projectStatusId = Number(projStatus?.status_id ?? 0);
  const projectStatusName = projStatus?.status_name
    ? String(projStatus.status_name)
    : null;

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
    !!row?.projekat_id &&
    (isProjectClosed ||
      isProjectInvoiced ||
      isProjectArchived ||
      isProjectCancelled);
  const isOwnerAdmin = Number(authUser?.nivo ?? 0) >= 10;
  const hasOverride = !!overrideState;
  const canEditDeal = !dealReadOnly || (isOwnerAdmin && hasOverride);

  const acceptedOk = useMemo(() => !!parseHumanToIso(t_accepted), [t_accepted]);

  const acceptedIso = useMemo(() => parseHumanToIso(t_accepted), [t_accepted]);
  const acceptedIsoDateOnly = useMemo(
    () => isoDateOnlyFromAccepted(acceptedIso),
    [acceptedIso],
  );
  const sem = useMemo(
    () => semaforFor(acceptedIsoDateOnly, t),
    [acceptedIsoDateOnly, t],
  );

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

  const totalBAM = useMemo(
    () => (totalsByCcy["BAM"] ?? 0) + (totalsByCcy["KM"] ?? 0),
    [totalsByCcy],
  );
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

  const eurInKM = useMemo(
    () => (Number.isFinite(totalEUR) ? totalEUR * EUR_TO_BAM : 0),
    [totalEUR],
  );

  const budgetPrimaryValue = isEurPrimary ? budgetKM / EUR_TO_BAM : budgetKM;
  const budgetPrimaryCode = isEurPrimary ? "EUR" : "BAM";

  async function loadKlijenti() {
    try {
      const res = await fetch("/api/klijenti", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.rows))
        setKlijenti(data.rows as Klijent[]);
    } catch {}
  }

  async function loadPickerItems() {
    setPickerLoading(true);
    try {
      const res = await fetch(`/api/cjenovnik?picker=1&limit=1000`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.rows))
        setPickerItems(data.rows as CjenHit[]);
      else setPickerItems([]);
    } catch {
      setPickerItems([]);
    } finally {
      setPickerLoading(false);
    }
  }

  async function loadTimeline() {
    try {
      const res = await fetch(
        `/api/inicijacije/timeline?inicijacija_id=${id}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || t("common.error"));
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
      const res = await fetch(`/api/inicijacije/stavke?inicijacija_id=${id}`, {
        cache: "no-store",
      });
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
      setProjStatusError(
        e?.message ?? t("dealDetail.loadStatusError"),
      );
    } finally {
      setProjStatusLoading(false);
    }
  }

  async function loadAuthMe() {
    try {
      const j = (await fetchJson("/api/auth/me")) as any;
      setAuthUser((j?.user ?? null) as AuthUser | null);
    } catch {
      setAuthUser(null);
    }
  }

  async function loadEditOverride(projekatId: number) {
    try {
      const j = (await fetchJson(
        `/api/projects/${projekatId}/edit-override`,
      )) as any;
      setOverrideState((j?.state ?? null) as EditOverrideState);
    } catch {
      setOverrideState(null);
    }
  }

  async function loadCloseCheck(projekatId: number) {
    setCloseError(null);
    setCloseLoading(true);
    setCloseConfirmWarnings(false);
    try {
      const j = (await fetchJson(
        `/api/projects/${projekatId}/close-check`,
      )) as any;
      setCloseData(j as CloseCheck);
    } catch (e: any) {
      setCloseData(null);
      setCloseError(e?.message ?? t("dealDetail.closeCheckError"));
    } finally {
      setCloseLoading(false);
    }
  }

  async function loadPonude() {
    try {
      const res = await fetch(`/api/ponude?inicijacija_id=${id}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.rows))
        setPonudeList(data.rows.map((p: any) => ({ ponuda_id: p.ponuda_id, broj_ponude: p.broj_ponude || `P${String(p.broj_u_godini).padStart(3, "0")}/${p.godina}` })));
      else setPonudeList([]);
    } catch {
      setPonudeList([]);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/inicijacije/jedna?id=${id}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || t("common.error"));
      const r = data.row as Row;
      setRow(r);

      await Promise.all([loadTimeline(), loadStavke(), loadPonude()]);

      if (r?.projekat_id) {
        const pid = Number(r.projekat_id);
        await Promise.all([
          loadProjectStatus(pid),
          loadCloseCheck(pid),
          loadEditOverride(pid),
        ]);
      } else {
        setProjStatus(null);
        setCloseData(null);
        setOverrideState(null);
      }
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
      setRow(null);
      setTimeline(null);
      setStavke([]);
      setProjStatus(null);
      setCloseData(null);
    } finally {
      setLoading(false);
    }
  }

  const toggleTimelineExpanded = useCallback(() => {
    setTimelineExpanded((prev) => {
      const next = !prev;
      setTimelineStoredOpen(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setTimelineExpanded(getTimelineStoredOpen());
  }, []);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) return;
    loadAuthMe();
    loadKlijenti();
    loadPickerItems();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleStorno() {
    if (!row) return;
    if (!canEditDeal) return;
    if (row.status_id === 4) return; // već odbijeno
    if (!window.confirm(t("dealDetail.confirmStornoDeal"))) return;

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
          status_id: 4, // Odbijeno = storno
          krajnji_klijent_id: row.krajnji_klijent_id ?? null,
          kontakt_ime: row.kontakt_ime ?? null,
          kontakt_tel: row.kontakt_tel ?? null,
          kontakt_email: row.kontakt_email ?? null,
          napomena: row.napomena ?? null,
        }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || t("common.error"));
      setMsg(t("dealDetail.dealStorned"));
      await load();
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function saveDeal() {
    if (!row) return;
    if (!canEditDeal) return;

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
      if (!data?.ok) throw new Error(data?.error || t("common.error"));
      setMsg(t("dealDetail.saved"));
      await load();
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function saveTimeline() {
    if (!canEditDeal) return;

    setSavingTimeline(true);
    setError(null);
    setMsg(null);

    const accepted_iso = parseHumanToIso(t_accepted);

    if (t_accepted.trim() && !accepted_iso) {
      setSavingTimeline(false);
      setError(t("dealDetail.deadlineFormatError"));
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
      if (!data?.ok) throw new Error(data?.error || t("common.error"));

      setMsg(t("dealDetail.timelineSaved"));
      await loadTimeline();
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    } finally {
      setSavingTimeline(false);
    }
  }

  function findPickerById(stavka_id: number) {
    return (
      pickerItems.find((x) => Number(x.stavka_id) === Number(stavka_id)) ?? null
    );
  }

  async function addItem() {
    if (!canEditDeal) return;
    if (!selected) return;

    setAddingItem(true);
    setError(null);
    setMsg(null);

    const k = asNum(kolicina);
    if (!k || k <= 0) {
      setAddingItem(false);
      setError(t("dealDetail.quantityError"));
      return;
    }

    const cij = asNum(cijenaUI);
    if (cij === null || cij < 0) {
      setAddingItem(false);
      setError(t("dealDetail.priceError"));
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
      if (!data?.ok) throw new Error(data?.error || t("common.error"));

      setSelected(null);
      setKolicina("1");
      setCijenaUI("");
      setOpisStavke("");
      setMsg(t("dealDetail.itemAdded"));
      await loadStavke();
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    } finally {
      setAddingItem(false);
    }
  }

  async function stornoItem(inicijacija_stavka_id: number) {
    if (!canEditDeal) return;

    const ok = window.confirm(t("dealDetail.confirmStornoItem"));
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
      if (!data?.ok) throw new Error(data?.error || t("common.error"));

      setMsg(t("dealDetail.itemStorned"));
      await loadStavke();
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    }
  }

  function startEdit(s: StavkaRow) {
    if (!canEditDeal) return;
    setEditId(s.inicijacija_stavka_id);
    setEditSelected(null);
    setEditKolicina(String(s.kolicina ?? ""));
    setEditCijena(String(s.cijena_jedinicna ?? ""));
    setEditValuta(normCcy(s.valuta) || "BAM");
    setEditOpis(String(s.opis ?? ""));
  }

  function cancelEdit() {
    setEditId(null);
    setEditSelected(null);
    setEditKolicina("");
    setEditCijena("");
    setEditValuta("BAM");
    setEditOpis("");
    setSavingEdit(false);
  }

  async function saveEdit() {
    if (!canEditDeal) return;
    if (!editId) return;

    const k = asNum(editKolicina);
    const cij = asNum(editCijena);

    if (k === null || k <= 0) {
      setError(t("dealDetail.quantityError"));
      return;
    }
    if (cij === null || cij < 0) {
      setError(t("dealDetail.priceError"));
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
          valuta: editValuta || undefined,
          opis: editOpis || null,
        }),
      });

      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || t("common.error"));

      setMsg(t("dealDetail.changesSaved"));
      cancelEdit();
      await loadStavke();
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
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
      if (!data?.ok) throw new Error(data?.error || t("common.error"));

      const pid = data?.projekat_id as number | null;
      setMsg(pid ? t("dealDetail.projectOpenedWithId").replace("#{id}", String(pid)) : t("dealDetail.projectOpened"));
      await load();

      if (pid) router.push(`/projects/${pid}`);
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    } finally {
      setOpeningProject(false);
    }
  }

  async function enableOverride() {
    const pid = Number(row?.projekat_id ?? 0);
    if (!isOwnerAdmin || !pid) return;
    const reason = overrideReason.trim();
    const minutes = Number(overrideMinutes);
    if (!reason) {
      setError("Unesi razlog za admin override.");
      return;
    }
    setOverrideBusy(true);
    setError(null);
    setMsg(null);
    try {
      await fetchJson(`/api/projects/${pid}/edit-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, minutes }),
      });
      setMsg("Admin override je aktivan.");
      await loadEditOverride(pid);
    } catch (e: any) {
      setError(e?.message ?? "Ne mogu aktivirati override.");
    } finally {
      setOverrideBusy(false);
    }
  }

  async function disableOverride() {
    const pid = Number(row?.projekat_id ?? 0);
    if (!isOwnerAdmin || !pid) return;
    setOverrideBusy(true);
    setError(null);
    setMsg(null);
    try {
      await fetchJson(`/api/projects/${pid}/edit-override`, {
        method: "DELETE",
      });
      setMsg("Admin override je isključen.");
      await loadEditOverride(pid);
    } catch (e: any) {
      setError(e?.message ?? "Ne mogu ugasiti override.");
    } finally {
      setOverrideBusy(false);
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
        body: JSON.stringify({
          force: hasWarnings ? closeConfirmWarnings : true,
        }),
      });

      setCloseOpen(false);
      await load(); // povuče novi status projekta (kanonski)
    } catch (e: any) {
      const payload = e?.payload;
      if (payload?.error === "CLOSE_BLOCKED")
        setCloseError(t("dealDetail.closeBlocked"));
      else if (payload?.error === "CLOSE_NEEDS_CONFIRM")
        setCloseError(t("dealDetail.closeNeedsConfirm"));
      else setCloseError(e?.message ?? t("dealDetail.closeError"));

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

  if (!Number.isFinite(id) || id <= 0)
    return (
      <div className="container" style={{ padding: 16 }}>
        {t("dealDetail.invalidId")}
      </div>
    );

  const dealTitle = row?.radni_naziv ? row.radni_naziv : `${t("dealDetail.dealHash")}${id}`;

  const hasHardBlocks = (closeData?.hard_blocks?.length ?? 0) > 0;
  const hasWarnings = (closeData?.warnings?.length ?? 0) > 0;

  const projectStatusKey = projectStatusId ? `statuses.project.${projectStatusId}` : "";
  const projectStatusTranslated =
    projectStatusKey && t(projectStatusKey) !== projectStatusKey
      ? t(projectStatusKey)
      : projectStatusName;
  const projectStatusLabel = !row?.projekat_id
    ? null
    : projStatusLoading
      ? t("common.loading")
      : projStatusError
        ? t("dealDetail.error")
        : projectStatusTranslated
          ? projectStatusTranslated
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

        .topbarLeft { display:flex; align-items:center; gap:12px; flex-wrap:wrap; flex:1; min-width:0; }
        .brandLogoBlock { display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .brandLogo { height: 30px; width:auto; display:block; opacity:.92; }
        .brandSlogan { font-size: 12px; opacity:.75; white-space: nowrap; }
        .pageBrand { flex-shrink:0; }
        .pageBrand .brandTitle { font-size: 20px; font-weight: 800; line-height:1.05; margin:0; }
        .pageBrand .brandSub { margin-top:4px; opacity:.82; font-size:13px; line-height:1.1; }
        .navBtns { display:flex; align-items:center; gap:10px; flex-shrink:0; margin-left: auto; }

        .actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
        .actionBtn { padding:10px 12px; border-radius:14px; display:inline-flex; align-items:center; gap:8px; font-weight:650; white-space:nowrap; }

        .pageHead { margin-top: 8px; }
        .pageTitleRow { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
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

        .hint12 { font-size:14px; opacity:.85; margin-top:6px; }

        .popoverCard { position:absolute; right:0; top: calc(100% + 10px); width: 420px; max-width: 92vw; z-index:60; border: 1px solid rgba(255,255,255,.18); background: rgba(20,20,30,.92); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 14px 40px rgba(0,0,0,.35); border-radius: 14px; padding: 18px; font-size: 15px; }

        .statusPill { display:inline-flex; align-items:center; gap:8px; padding: 6px 10px; border-radius:999px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); font-weight:850; letter-spacing:.2px; font-size:12px; white-space:nowrap; }
        .statusDot { width: 10px; height: 10px; border-radius: 999px; display:inline-block; box-shadow: 0 0 0 2px rgba(0,0,0,.15) inset; }
        .stornoBtn { background:#9ca3af; color:#111827; border:1px solid #6b7280; border-radius:8px; padding:4px 8px; font-size:11px; font-weight:700; letter-spacing:.5px; cursor:pointer; opacity:.95; }
        .stornoBtn:hover { background:#d1d5db; }

        .topbarCenter { flex: 1; display: flex; justify-content: center; align-items: center; min-width: 0; }
        .crossLinkBtn { display: inline-flex; align-items: center; justify-content: center; min-width: 200px; padding: 10px 24px; border-radius: 12px; font-weight: 600; font-size: 14px; letter-spacing: 0.02em; text-decoration: none; color: inherit; border: 1px solid rgba(255,255,255,.2); background: rgba(140,140,150,.25); transition: background .15s, border-color .15s; }
        .crossLinkBtn:hover { background: rgba(160,160,170,.35); border-color: rgba(255,255,255,.28); }
      `}</style>

      <div className="topBlock">
        <div className="container topInner">
          <div className="topbar">
            <div className="topbarLeft">
              <div className="brandLogoBlock">
                <FluxaLogo /><span className="brandSlogan">{t("dealDetail.brandSlogan")}</span>
              </div>
              <div className="pageBrand">
                <div className="brandTitle">{t("dealDetail.pageTitle")}</div>
                <div className="brandSub">{t("dealDetail.pageSubtitle")}</div>
              </div>
            </div>

            <div className="topbarCenter">
              {row?.projekat_id ? (
                <Link
                  href={`/projects/${row.projekat_id}`}
                  className="crossLinkBtn"
                  title={t("dealDetail.openProjectHashTitle")}
                >
                  📁 {t("dealDetail.openProjectHash")}{row.projekat_id}
                </Link>
              ) : null}
            </div>

            <div className="navBtns">
              <Link
                href="/inicijacije"
                aria-label={t("dealDetail.backToDeals")}
                title={t("dealDetail.backToDeals")}
                className="glassbtn actionBtn"
              >
                📋 {t("dealDetail.backToDeals")}
              </Link>
              <Link
                href="/dashboard"
                className="glassbtn actionBtn"
                title={t("dealDetail.dashboard")}
              >
                <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("dealDetail.dashboard")}
              </Link>
            </div>
          </div>

          {/* Drugi red: naslov + Otvori projekat / Zatvori projekat */}
          <div className="pageTitleRow">
            <h1 className="pageTitle">
              {dealTitle}
              <span className="muted" style={{ fontWeight: 600 }}>
                {" "}
                · {t("dealDetail.dealHash")}{id}
              </span>
              {row?.projekat_id ? (
                <span className="muted"> · {t("dealDetail.projectHash")}{row.projekat_id}</span>
              ) : null}
            </h1>

            <div className="actions" style={{ flexWrap: "wrap" }}>
              {!row?.projekat_id ? (
                <>
                  <button
                    onClick={saveDeal}
                    disabled={saving || loading || !row}
                    className="glassbtn actionBtn"
                    type="button"
                    style={{ opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? t("dealDetail.saving") : t("dealDetail.save")}
                  </button>
                  <button
                    onClick={openProject}
                    disabled={
                      openingProject || loading || !acceptedOk
                    }
                    className="glassbtn actionBtn"
                    type="button"
                    style={{
                      opacity: openingProject ? 0.7 : !acceptedOk ? 0.55 : 1,
                    }}
                    title={
                      !acceptedOk
                        ? t("dealDetail.needDeadline")
                        : t("dealDetail.createProjectTitle")
                    }
                  >
                    {openingProject ? t("dealDetail.opening") : t("dealDetail.createProject")}
                  </button>
                  <Link
                    href={row ? `/inicijacije/${id}/ponuda-wizard` : "#"}
                    className="glassbtn actionBtn"
                    style={{
                      opacity: loading || !row ? 0.6 : 1,
                      pointerEvents: loading || !row ? "none" : undefined,
                    }}
                    title={t("dealDetail.quoteTitle")}
                  >
                    {t("dealDetail.quote")}
                  </Link>
                  <button
                    className="glassbtn actionBtn"
                    type="button"
                    disabled
                    style={{ opacity: 0.4, cursor: "not-allowed" }}
                    title={t("dealDetail.closeDisabledTitle")}
                  >
                    🔒 {t("dealDetail.closeProject")}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={row ? `/inicijacije/${id}/ponuda-wizard` : "#"}
                    className="glassbtn actionBtn"
                    style={{
                      opacity: loading || !row ? 0.6 : 1,
                      pointerEvents: loading || !row ? "none" : undefined,
                    }}
                    title={t("dealDetail.quoteTitle")}
                  >
                    {t("dealDetail.quote")}
                  </Link>
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setCloseOpen((v) => !v)}
                      className="glassbtn actionBtn"
                      type="button"
                      title={
                        dealReadOnly
                          ? t("dealDetail.closeReadOnlyTitle")
                          : t("dealDetail.closeTitle")
                      }
                      style={{ opacity: dealReadOnly ? 0.9 : 1 }}
                    >
                      🔒 {t("dealDetail.closeProject")}
                    </button>

                    {closeOpen && (
                      <div className="popoverCard">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>
                            {t("dealDetail.closePopoverTitle")}
                          </div>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setCloseOpen(false)}
                            disabled={closeSaving}
                            title={t("dealDetail.closeBtn")}
                          >
                            ✕
                          </button>
                        </div>

                        <div
                          style={{ marginTop: 8, opacity: 0.88, fontSize: 13 }}
                        >
                          {t("dealDetail.closePopoverMeaning")}
                        </div>

                        <div style={{ marginTop: 12 }}>
                          {closeLoading ? (
                            <div style={{ opacity: 0.85 }}>
                              {t("dealDetail.loadingCheck")}
                            </div>
                          ) : !closeData ? (
                            <div style={{ opacity: 0.9 }}>
                              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                                {t("dealDetail.cannotLoadCheck")}
                              </div>
                              <div style={{ opacity: 0.9 }}>
                                {closeError ?? "—"}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  gap: 8,
                                  marginTop: 10,
                                }}
                              >
                                <button
                                  className="btn"
                                  type="button"
                                  onClick={() => setCloseOpen(false)}
                                  disabled={closeSaving}
                                >
                                  {t("dealDetail.closeBtn")}
                                </button>
                                <button
                                  className="btn"
                                  type="button"
                                  onClick={() =>
                                    row?.projekat_id &&
                                    loadCloseCheck(Number(row.projekat_id))
                                  }
                                  disabled={closeSaving}
                                >
                                  {t("dealDetail.tryAgain")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {hasHardBlocks && (
                                <div
                                  style={{
                                    marginTop: 12,
                                    border: "1px solid rgba(255,80,80,.35)",
                                    background: "rgba(255,80,80,.10)",
                                    padding: 10,
                                    borderRadius: 12,
                                  }}
                                >
                                  <div
                                    style={{ fontWeight: 900, marginBottom: 6 }}
                                  >
                                    {t("dealDetail.cannotClose")}
                                  </div>
                                  <ul
                                    style={{
                                      margin: 0,
                                      paddingLeft: 16,
                                      display: "grid",
                                      gap: 6,
                                      fontSize: 13,
                                    }}
                                  >
                                    {(closeData?.hard_blocks ?? []).map(
                                      (b: any) => (
                                        <li
                                          key={String(
                                            b?.code ??
                                              b?.message ??
                                              Math.random(),
                                          )}
                                        >
                                          {String(b?.message ?? "—")}
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              )}

                              {hasWarnings && (
                                <div
                                  style={{
                                    marginTop: 12,
                                    border: "1px solid rgba(255,165,0,.35)",
                                    background: "rgba(255,165,0,.10)",
                                    padding: 10,
                                    borderRadius: 12,
                                  }}
                                >
                                  <div
                                    style={{ fontWeight: 900, marginBottom: 6 }}
                                  >
                                    Upozorenja
                                  </div>
                                  <ul
                                    style={{
                                      margin: 0,
                                      paddingLeft: 16,
                                      display: "grid",
                                      gap: 6,
                                      fontSize: 13,
                                    }}
                                  >
                                    {(closeData?.warnings ?? []).map(
                                      (w: any) => (
                                        <li
                                          key={String(
                                            w?.code ??
                                              w?.message ??
                                              Math.random(),
                                          )}
                                        >
                                          {String(w?.message ?? "—")}
                                        </li>
                                      ),
                                    )}
                                  </ul>

                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      marginTop: 10,
                                      fontSize: 13,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={closeConfirmWarnings}
                                      onChange={(e) =>
                                        setCloseConfirmWarnings(
                                          e.target.checked,
                                        )
                                      }
                                      disabled={closeSaving}
                                    />
                                    {t("dealDetail.understandContinue")}
                                  </label>
                                </div>
                              )}

                              {closeError && (
                                <div
                                  style={{
                                    marginTop: 10,
                                    border: "1px solid rgba(255,255,255,.14)",
                                    background: "rgba(255,255,255,.06)",
                                    padding: 10,
                                    borderRadius: 12,
                                    fontSize: 13,
                                    opacity: 0.95,
                                  }}
                                >
                                  {closeError}
                                </div>
                              )}

                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  gap: 8,
                                  marginTop: 12,
                                }}
                              >
                                <button
                                  className="btn"
                                  type="button"
onClick={() => setCloseOpen(false)}
                                disabled={closeSaving}
                              >
                                {t("dealDetail.cancel")}
                              </button>
                              <button
                                className="btn"
                                type="button"
                                onClick={doCloseProject}
                                disabled={
                                  closeSaving ||
                                  hasHardBlocks ||
                                  (hasWarnings && !closeConfirmWarnings) ||
                                  isProjectClosed
                                }
                                title={t("dealDetail.closeConfirmTitle")}
                              >
                                {closeSaving
                                  ? t("dealDetail.saving")
                                  : isProjectClosed
                                    ? t("dealDetail.alreadyClosed")
                                    : t("dealDetail.closeProject")}
                              </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            {(ponudeList.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                {t("dealDetail.quotesForDeal")}{" "}
                {ponudeList.map((p) => (
                  <Link
                    key={p.ponuda_id}
                    href={`/ponuda/${p.ponuda_id}/preview`}
                    style={{ marginRight: 10 }}
                  >
                    {p.broj_ponude}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          <div className="pageHead">

            {/* ✅ Deal → Project “kanonska” traka (vizuelna navigacija) */}
            <StatusTimelineBar
              hasProject={!!row?.projekat_id}
              projectStatusId={projectStatusId}
              compact={false}
            />

            {!loading && (
              <div className="pageSub">
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    {t("dealDetail.openedAt")}: <b>{formatHumanDT(row?.opened_at ?? null, locale)}</b>
                    {"  "}·{"  "}
                    {t("dealDetail.timeline")}:{" "}
                    {timeline?.created_at ? (
                      <b>{t("dealDetail.lastRecord")} {formatHumanDT(timeline.created_at, locale)}</b>
                    ) : (
                      <span className="muted">{t("dealDetail.noRecord")}</span>
                    )}
                  </span>

                  {row?.projekat_id ? (
                    <span
                      className="statusPill"
                      style={{
                        borderColor: projectStatusTone.border,
                        background: projectStatusTone.bg,
                      }}
                      title="Kanonski status projekta (projekti.status_id → statusi_projekta)"
                    >
                      <span
                        className="statusDot"
                        style={{
                          background:
                            isProjectArchived || isProjectCancelled
                              ? "rgba(255,255,255,.55)"
                              : isProjectInvoiced
                                ? "rgba(80,170,255,.95)"
                                : isProjectClosed
                                  ? "rgba(255,193,7,.95)"
                                  : "rgba(55,214,122,.95)",
                        }}
                      />
                      <span style={{ opacity: 0.9 }}>{t("dealDetail.projectStatus")}</span>
                      <span style={{ fontWeight: 900 }}>
                        {projectStatusLabel}
                      </span>
                      {projectStatusId ? (
                        <span style={{ opacity: 0.75 }}>
                          #{projectStatusId}
                        </span>
                      ) : null}
                    </span>
                  ) : null}

                  {dealReadOnly ? (
                    <span
                      style={{
                        fontWeight: 850,
                        color: "rgba(255, 214, 102, .95)",
                      }}
                    >
                      · 🔒 {hasOverride ? "Deal je otključan preko admin override moda" : t("dealDetail.dealReadOnly")}
                    </span>
                  ) : null}

                  {!loading && row && row.status_id !== 4 && canEditDeal ? (
                    <button
                      type="button"
                      className="stornoBtn"
                      onClick={handleStorno}
                      disabled={saving}
                      title={t("dealDetail.stornoDealTitle")}
                    >
                      {t("dealDetail.stornoDeal")}
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {!loading && row?.projekat_id ? (
            <div
              className="cardLike dealBanner"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="dealBannerTitle">
                  ⚠️ {t("dealDetail.bannerAlreadyProject")}
                </div>
                <div className="dealBannerText">
                  {t("dealDetail.bannerSnapshot")}{" "}
                  {isProjectArchived || isProjectCancelled ? (
                    <b>{t("dealDetail.bannerArchive")}</b>
                  ) : isProjectInvoiced ? (
                    <b>{t("dealDetail.bannerInvoiced")}</b>
                  ) : isProjectClosed ? (
                    <b>{t("dealDetail.bannerClosed")}</b>
                  ) : (
                    <span>{t("dealDetail.bannerNotPrimary")}</span>
                  )}
                </div>
              </div>

              {row?.operativni_signal &&
              row.operativni_signal !== "NORMALNO" ? (
                <div
                  title={
                    row.operativni_signal === "STOP"
                      ? "STOP (owner): odmah zaustavi i provjeri"
                      : "PAŽNJA (owner): obrati pažnju"
                  }
                  style={{
                    flex: "0 0 auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 999,
                    border:
                      row.operativni_signal === "STOP"
                        ? "1px solid rgba(255, 80, 80, .55)"
                        : "1px solid rgba(255, 214, 102, .55)",
                    background:
                      row.operativni_signal === "STOP"
                        ? "rgba(255, 80, 80, .12)"
                        : "rgba(255, 193, 7, .12)",
                    fontWeight: 900,
                    letterSpacing: ".2px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      display: "inline-block",
                      background:
                        row.operativni_signal === "STOP"
                          ? "#ff3b30"
                          : "#ffb020",
                      boxShadow: "0 0 0 2px rgba(0,0,0,.15) inset",
                    }}
                  />
                  <span style={{ fontSize: 12, opacity: 0.92 }}>OWNER</span>
                  <span style={{ fontSize: 12 }}>
                    {row.operativni_signal === "STOP" ? "STOP" : "PAŽNJA"}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {!loading && row?.projekat_id && dealReadOnly && isOwnerAdmin ? (
            <div
              className="cardLike"
              style={{
                border: "1px solid rgba(80, 170, 255, .45)",
                background: "rgba(80, 170, 255, .10)",
              }}
            >
              <div style={{ fontWeight: 850, marginBottom: 8 }}>
                Admin override za zaključani projekat
              </div>
              {hasOverride ? (
                <div style={{ fontSize: 13, opacity: 0.95, marginBottom: 10 }}>
                  Aktivno do: <b>{overrideState?.expires_at ?? "—"}</b>
                  {" · "}
                  razlog: <b>{overrideState?.reason ?? "—"}</b>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Razlog otključavanja"
                    style={inputStyle}
                  />
                  <input
                    value={overrideMinutes}
                    onChange={(e) => setOverrideMinutes(e.target.value)}
                    placeholder="min"
                    style={inputStyle}
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    className="glassbtn actionBtn"
                    onClick={enableOverride}
                    disabled={overrideBusy}
                  >
                    {overrideBusy ? "Aktiviram..." : "Uključi override"}
                  </button>
                </div>
              )}
              {hasOverride ? (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="glassbtn actionBtn"
                    onClick={disableOverride}
                    disabled={overrideBusy}
                  >
                    {overrideBusy ? "Gasim..." : "Isključi override"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {loading && <div className="cardLike">{t("common.loading")}</div>}
          {!!error && !loading && (
            <div className="cardLike msgErr">{t("dealDetail.error")}: {error}</div>
          )}
          {!!msg && !loading && <div className="cardLike msgOk">{msg}</div>}
          <div className="divider" />
        </div>
      </div>

      {/* SCROLL */}
      <div className="scrollWrap">
        <div className="container" style={{ opacity: canEditDeal ? 1 : 0.92 }}>
          {/* TIMELINE */}
          {!loading && (
            <div className="cardLike">
              <button
                type="button"
                onClick={toggleTimelineExpanded}
                aria-expanded={timelineExpanded}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: 0,
                  marginBottom: timelineExpanded ? 10 : 0,
                  textAlign: "left",
                  fontSize: "inherit",
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 16 }}>
                  {t("dealDetail.timelineDeal")}
                </span>
                <span style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
                  {timelineExpanded ? <ChevronUp size={20} strokeWidth={2} /> : <ChevronDown size={20} strokeWidth={2} />}
                </span>
              </button>

              {/* Uvijek vidljivo: Account Manager, Otvoren, Deadline */}
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 16,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
                  <div className="label">{t("dealDetail.accountManager")}</div>
                  <div style={{ ...inputStyle, opacity: 0.9 }}>
                    {(row?.account_manager_name ?? "").trim() || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140, marginLeft: "auto" }}>
                  <div className="label">{t("dealDetail.openedAt")}</div>
                  <div style={{ ...inputStyle, opacity: 0.9 }}>
                    {formatHumanDT(row?.opened_at ?? null, locale)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 4,
                  opacity: canEditDeal ? 1 : 0.65,
                  pointerEvents: canEditDeal ? "auto" : "none",
                }}
              >
                <div className="label deadlineLabel">
                  {t("dealDetail.deadlineLabel")}
                </div>
                <div className="deadlineWrap">
                  <DatePickerDDMMYYYY
                    value={t_accepted}
                    onChange={setTAccepted}
                    placeholder="dd.mm.yyyy HH:mm"
                    defaultTime="16:00"
                  />

                  <div className="deadlineMeta">
                    <span className={`sem ${sem.cls}`} title={sem.title} />
                    <span className="deadlineBadge" title={sem.title}>
                      {sem.label}
                    </span>
                    <span className="muted">
                      {acceptedIsoDateOnly
                        ? `${t("dealDetail.deadlineDatePrefix")} ${acceptedIsoDateOnly}`
                        : t("dealDetail.deadlineNoDate")}
                    </span>
                  </div>

                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {t("dealDetail.deadlineOnlyMattersHint")}
                  </div>
                </div>
              </div>

              {timelineExpanded && (
                <div
                  className="grid2"
                  style={{
                    marginTop: 14,
                    opacity: canEditDeal ? 1 : 0.65,
                    pointerEvents: canEditDeal ? "auto" : "none",
                  }}
                >
                  <div className="label">{t("dealDetail.via")}</div>
                  <select
                    value={t_via}
                    onChange={(e) => setTVia(e.target.value)}
                    style={inputStyle}
                  >
                    {VIA_OPTIONS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  <div className="label">{t("dealDetail.note")}</div>
                  <input
                    value={t_note}
                    onChange={(e) => setTNote(e.target.value)}
                    placeholder={t("dealDetail.notePlaceholderDeal")}
                    style={inputStyle}
                  />
                </div>
              )}

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={saveTimeline}
                  disabled={savingTimeline || !canEditDeal}
                  className="glassbtn actionBtn"
                  type="button"
                  style={{
                    opacity: savingTimeline ? 0.7 : !canEditDeal ? 0.55 : 1,
                    pointerEvents: !canEditDeal ? "none" : "auto",
                    background: "linear-gradient(135deg, rgba(55, 214, 122, 0.2), rgba(34, 197, 94, 0.15))",
                    border: "1px solid rgba(55, 214, 122, 0.45)",
                  }}
                  title={
                    !canEditDeal
                      ? t("dealDetail.dealReadOnlyTooltip")
                      : t("dealDetail.saveTimelineTooltip")
                  }
                >
                  {savingTimeline ? t("dealDetail.saving") : t("dealDetail.saveTimeline")}
                </button>
              </div>
            </div>
          )}

          {/* STAVKE */}
          {!loading && (
            <div
              className="cardLike"
              data-onboarding="deal-stavke"
              style={{
                opacity: canEditDeal ? 1 : 0.65,
                pointerEvents: canEditDeal ? "auto" : "none",
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
                  {t("dealDetail.budgetTitle")}
                </div>

                {canEditDeal && (
                  <Link
                    href={`/studio/strategic-core?inicijacija_id=${id}`}
                    className="btn btn-sc-strategic"
                    style={{
                      padding: "10px 18px",
                      fontSize: 14,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    title={t("dealDetail.scStrategicCoreTitle")}
                  >
                    🎛️ {t("dealDetail.scStrategicCore")}
                  </Link>
                )}

                <div
                  className="sumPill"
                  title={t("dealDetail.budgetTooltip")}
                >
                  {t("dealDetail.totalBudget")}: <b>{fmtMoney(budgetPrimaryValue, locale)} {budgetPrimaryCode}</b>
                </div>
              </div>

              {row?.projekat_id ? (
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  ⚠️ {t("dealDetail.budgetSnapshotNote")}
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
                {!isEurPrimary && (
                  <div
                    className="sumPill"
                    title={t("dealDetail.budgetTooltip")}
                  >
                    {t("dealDetail.bamKm")}: <b>{fmtMoney(totalBAM, locale)} BAM</b>
                  </div>
                )}
                {totalEUR > 0 ? (
                  <div
                    className="sumPill"
                    title={t("dealDetail.eurTooltip")}
                  >
                    EUR: <b>{fmtMoney(totalEUR, locale)} EUR</b>
                    {!isEurPrimary && (
                      <>
                        {" "}
                        <span className="muted">→</span>{" "}
                        <b>{fmtMoney(eurInKM, locale)} BAM</b>
                      </>
                    )}
                  </div>
                ) : null}
                {isEurPrimary && totalBAM > 0 ? (
                  <div className="sumPill">
                    BAM: <b>{fmtMoney(totalBAM, locale)} BAM</b>
                  </div>
                ) : null}
              </div>

              {hasUnsupportedFX ? (
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  * {t("dealDetail.unsupportedFx")}
                </div>
              ) : totalEUR > 0 && !isEurPrimary ? (
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  * {t("dealDetail.eurFxNote")}
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 14,
                  padding: 18,
                  border: "1px solid rgba(255,255,255,.12)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,.03)",
                  fontSize: 15,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 120px 1fr auto",
                    gridTemplateRows: "auto auto auto",
                    gap: "6px 10px",
                    alignItems: "center",
                  }}
                >
                  {/* Red 1: svi labeli */}
                  <div className="label" style={{ fontSize: 15, fontWeight: 700, opacity: 0.85 }}>{t("dealDetail.itemFromPriceList")}</div>
                  <div className="label" style={{ fontSize: 15, fontWeight: 700, opacity: 0.85 }}>{t("dealDetail.quantity")}</div>
                  <div className="label" style={{ fontSize: 15, fontWeight: 700, opacity: 0.85 }}>{t("dealDetail.price")}</div>
                  <div className="label" style={{ fontSize: 15, fontWeight: 700, opacity: 0.85 }}>{t("dealDetail.descriptionOptional")}</div>
                  <div />

                  {/* Red 2: select + polja + dugme */}
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
                          ? t("dealDetail.loadingPriceList")
                          : t("dealDetail.selectItem")}
                      </option>
                      {pickerItems.map((it) => (
                        <option key={it.stavka_id} value={String(it.stavka_id)}>
                          {it.naziv} (#{it.stavka_id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      value={kolicina}
                      onChange={(e) => setKolicina(e.target.value)}
                      placeholder={t("dealDetail.quantityPlaceholder")}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <input
                      value={cijenaUI}
                      onChange={(e) => setCijenaUI(e.target.value)}
                      placeholder={
                        selected
                          ? normCcy(selected.valuta_default)
                          : t("dealDetail.pricePlaceholder")
                      }
                      style={inputStyle}
                      inputMode="decimal"
                      disabled={!selected}
                    />
                  </div>
                  <div>
                    <input
                      value={opisStavke}
                      onChange={(e) => setOpisStavke(e.target.value)}
                      placeholder={t("dealDetail.descriptionPlaceholder")}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={addItem}
                      disabled={!selected || addingItem}
                      type="button"
                      style={{
                        opacity: !selected || addingItem ? 0.6 : 1,
                        background: "linear-gradient(135deg, rgba(55, 214, 122, 0.2), rgba(34, 197, 94, 0.15))",
                        border: "1px solid rgba(55, 214, 122, 0.45)",
                        color: "inherit",
                        padding: "10px 16px",
                        borderRadius: 12,
                        fontWeight: 750,
                        cursor: !selected || addingItem ? "not-allowed" : "pointer",
                      }}
                    >
                      {addingItem ? t("dealDetail.adding") : t("dealDetail.add")}
                    </button>
                  </div>

                  {/* Red 3: samo hint ispod stavke iz cjenovnika (prva kolona) */}
                  <div style={{ gridColumn: 1 }}>
                    {selected ? (
                      <div className="hint12" style={{ marginTop: 4 }}>
                        #{selected.stavka_id} • {selected.jedinica} •{" "}
                        {Number(selected.cijena_default ?? 0).toFixed(2)}{" "}
                        {normCcy(selected.valuta_default)}
                      </div>
                    ) : null}
                  </div>
              </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  borderTop: "1px solid rgba(255,255,255,.10)",
                  paddingTop: 10,
                }}
              >
                {stavke.length === 0 ? (
                  <div className="muted">{t("dealDetail.noItems")}</div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "80px 1fr 120px 140px 140px 240px",
                      gap: 8,
                      fontWeight: 700,
                      marginBottom: 8,
                      opacity: 0.95,
                      fontSize: 15,
                    }}
                  >
                    <div>{t("dealDetail.colHash")}</div>
                    <div>{t("dealDetail.item")}</div>
                    <div>{t("dealDetail.quantity")}</div>
                    <div>{t("dealDetail.price")}</div>
                    <div>{t("dealDetail.total")}</div>
                    <div>{t("dealDetail.actions")}</div>
                  </div>
                )}

                {stavke.map((s, idx) => {
                  const isEditing = editId === s.inicijacija_stavka_id;

                  return (
                    <div
                      key={s.inicijacija_stavka_id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "80px 1fr 120px 140px 140px 240px",
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
                              <div className="muted" style={{ fontSize: 14 }}>
                                {s.opis}
                              </div>
                            ) : null}
                            <div className="muted" style={{ fontSize: 14 }}>
                              {t("dealDetail.unit")}: {s.jedinica_snapshot} • {t("dealDetail.currency")}:{" "}
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
                                      String(it.cijena_default ?? "0"),
                                    );
                                }}
                                style={inputStyle}
                                disabled={pickerLoading}
                              >
                                <option value="">
                                  {t("dealDetail.keepCurrentItem")}
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
                                    editSelected.cijena_default ?? 0,
                                  ).toFixed(2)}{" "}
                                  {normCcy(editSelected.valuta_default)}
                                </div>
                              ) : null}
                            </div>

                            <div style={{ marginTop: 8 }}>
                              <input
                                value={editOpis}
                                onChange={(e) => setEditOpis(e.target.value)}
                                placeholder={t("dealDetail.descriptionOptional")}
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
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              value={editCijena}
                              onChange={(e) => setEditCijena(e.target.value)}
                              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                              inputMode="decimal"
                            />
                            <select
                              value={editValuta}
                              onChange={(e) => setEditValuta(e.target.value)}
                              style={{ ...inputStyle, width: 56, padding: "8px 6px" }}
                              title={t("dealDetail.valutaTitle")}
                            >
                              <option value="BAM">KM</option>
                              <option value="EUR">EUR</option>
                            </select>
                          </div>
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
                              ✎ {t("dealDetail.change")}
                            </button>

                            <button
                              type="button"
                              className="glassbtn btnSmall"
                              onClick={() =>
                                stornoItem(s.inicijacija_stavka_id)
                              }
                              title={t("dealDetail.stornoItemTitle")}
                            >
                              🧾 {t("dealDetail.stornoItem")}
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
                              💾 {savingEdit ? t("dealDetail.saving") : t("dealDetail.saveChanges")}
                            </button>

                            <button
                              type="button"
                              className="glassbtn btnSmall"
                              onClick={cancelEdit}
                              style={{ opacity: 0.85 }}
                            >
                              ✖ {t("dealDetail.cancel")}
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
                      {t("dealDetail.totalBudget")}: <b>{fmtMoney(budgetPrimaryValue, locale)} {budgetPrimaryCode}</b>
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
                opacity: canEditDeal ? 1 : 0.65,
                pointerEvents: canEditDeal ? "auto" : "none",
              }}
            >
              <div style={{ fontWeight: 750, fontSize: 16, marginBottom: 10 }}>
                {t("dealDetail.statusDeal")}
              </div>

              <div className="grid2">
                <div className="label">{t("dealDetail.radniNaziv")}</div>
                <input
                  value={row.radni_naziv}
                  onChange={(e) =>
                    setRow({ ...row, radni_naziv: e.target.value })
                  }
                  style={inputStyle}
                />

                <div className="label">{t("dealDetail.napomeneProdukcija")}</div>
                <textarea
                  value={row.napomena ?? ""}
                  onChange={(e) => setRow({ ...row, napomena: e.target.value })}
                  rows={4}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={saveDeal}
                  disabled={saving || loading}
                  className="glassbtn actionBtn"
                  type="button"
                  style={{ opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? t("dealDetail.saving") : t("dealDetail.save")}
                </button>
              </div>
            </div>
          )}

          {/* KLIJENT */}
          {row && !loading && (
            <div
              className="cardLike"
              style={{
                opacity: canEditDeal ? 1 : 0.65,
                pointerEvents: canEditDeal ? "auto" : "none",
              }}
            >
              <div style={{ fontWeight: 750, fontSize: 16, marginBottom: 10 }}>
                {t("dealDetail.clientSection")}
              </div>

              <div className="grid2">
                <div className="label">{t("dealDetail.narucilac")}</div>
                <select
                  value={row.narucilac_id}
                  onChange={(e) =>
                    setRow({ ...row, narucilac_id: Number(e.target.value) })
                  }
                  style={inputStyle}
                >
                  {klijenti.length === 0 && (
                    <option value={row.narucilac_id}>
                      {t("dealDetail.loadingClients")}
                    </option>
                  )}
                  {klijenti.map((k) => (
                    <option key={k.klijent_id} value={k.klijent_id}>
                      {k.klijent_id} — {k.naziv_klijenta}
                    </option>
                  ))}
                </select>

                <div className="label">{t("dealDetail.krajnjiKlijent")}</div>
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
                  <option value="">{t("dealDetail.sameAsNarucilac")}</option>
                  {klijenti.map((k) => (
                    <option key={k.klijent_id} value={k.klijent_id}>
                      {k.klijent_id} — {k.naziv_klijenta}
                    </option>
                  ))}
                </select>

                <div className="label">{t("dealDetail.kontaktIme")}</div>
                <input
                  value={row.kontakt_ime ?? ""}
                  onChange={(e) =>
                    setRow({ ...row, kontakt_ime: e.target.value })
                  }
                  style={inputStyle}
                />

                <div className="label">{t("dealDetail.kontaktTel")}</div>
                <input
                  value={row.kontakt_tel ?? ""}
                  onChange={(e) =>
                    setRow({ ...row, kontakt_tel: e.target.value })
                  }
                  style={inputStyle}
                />

                <div className="label">{t("dealDetail.kontaktEmail")}</div>
                <input
                  value={row.kontakt_email ?? ""}
                  onChange={(e) =>
                    setRow({ ...row, kontakt_email: e.target.value })
                  }
                  style={inputStyle}
                />
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={saveDeal}
                  disabled={saving || loading}
                  className="glassbtn actionBtn"
                  type="button"
                  style={{ opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? t("dealDetail.saving") : t("dealDetail.save")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
