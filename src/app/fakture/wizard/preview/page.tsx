// src/app/fakture/wizard/preview/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";

function fmtDDMMYYYYFromISO(isoLike: string | null): string {
  if (!isoLike) return "—";
  const s = String(isoLike);
  const y = s.slice(0, 4);
  const m = s.slice(5, 7);
  const d = s.slice(8, 10);
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d))
    return "—";
  return `${d}.${m}.${y}`;
}

function fmtMoney(n: number, ccy: string) {
  const v = Number.isFinite(n) ? n : 0;
  const s = v.toFixed(2);
  const label = (ccy === "BAM" || ccy === "KM") ? "KM" : ccy;
  return `${s} ${label}`;
}

function parseIds(idsRaw: string): number[] {
  return String(idsRaw || "")
    .split(",")
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function isBiH(drzava: any): boolean {
  const s = String(drzava ?? "")
    .trim()
    .toLowerCase();
  if (!s) return true; // prazno = domaći (BiH)
  return (
    s === "bih" ||
    s === "ba" ||
    s === "bosna i hercegovina" ||
    s === "bosnia and herzegovina"
  );
}

type Lang = "BH" | "EN";

type ApiProject = {
  projekat_id: number;
  radni_naziv: string | null;
  narucilac_id: number | null;
  narucilac_naziv: string | null;
  narucilac_drzava: string | null;
  krajnji_klijent_id: number | null;
  klijent_naziv: string | null;
  budzet_planirani: number | null;
  closed_at: string | null;
};

type ApiBuyer = {
  klijent_id: number;
  naziv_klijenta: string | null;
  tip_klijenta: string | null;
  porezni_id: string | null;
  adresa: string | null;
  grad: string | null;
  postanski_broj?: string | null;
  drzava: string | null;
  email: string | null;
  rok_placanja_dana: number | null;
  is_ino?: number | boolean;
};

type ApiFirma = {
  firma_id: number;
  is_active: number;
  naziv: string | null;
  pravni_naziv: string | null;
  adresa: string | null;
  grad: string | null;
  postanski_broj: string | null;
  drzava: string | null;
  telefon: string | null;
  email: string | null;
  web: string | null;
  jib: string | null;
  pib: string | null;
  pdv_broj: string | null;
  broj_rjesenja: string | null;
  bank_naziv: string | null;
  bank_racun: string | null;
  swift: string | null;
  iban: string | null;
  logo_path: string | null;
  bank_accounts?: any[];
};

type PreviewData = {
  ok: boolean;
  ids: number[];
  projects: ApiProject[];
  buyer: ApiBuyer | null;
  firma: ApiFirma | null;
  narucioc_count: number;
  error?: string;
};

function safeLineJoin(
  parts: Array<string | null | undefined>,
  sep = ", ",
): string {
  return parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(sep);
}

function fmtBankLine(acc: any): string {
  const bank = String(
    acc?.bank_naziv ?? acc?.banka_naziv ?? acc?.bank ?? acc?.naziv_bank ?? "",
  ).trim();
  const account = String(
    acc?.bank_racun ??
      acc?.racun ??
      acc?.broj_racuna ??
      acc?.account_no ??
      acc?.account ??
      "",
  ).trim();
  const iban = String(acc?.iban ?? "").trim();
  const swift = String(acc?.swift ?? acc?.bic ?? "").trim();

  const chunks: string[] = [];
  if (bank) chunks.push(bank);
  if (account) chunks.push(account);
  if (iban) chunks.push(`IBAN ${iban}`);
  if (swift) chunks.push(`SWIFT ${swift}`);

  const out = chunks.join(" · ");
  return out || "—";
}

// ✅ Formatiraj bankovne račune prema traženom formatu: Naziv banke - (KM) broj - (EUR) IBAN - SWIFT
function formatBankAccounts(accounts: any[]): string[] {
  if (!accounts || accounts.length === 0) return [];

  // Grupiši račune po banci
  const byBank: Record<string, any[]> = {};

  for (const acc of accounts) {
    const bankName = String(
      acc?.bank_naziv ?? acc?.banka_naziv ?? acc?.bank ?? acc?.naziv_bank ?? "",
    ).trim();
    
    if (!bankName) continue;

    if (!byBank[bankName]) {
      byBank[bankName] = [];
    }
    byBank[bankName].push(acc);
  }

  // Formatiraj svaku banku
  const formatted: string[] = [];
  
  for (const [bankName, bankAccounts] of Object.entries(byBank)) {
    const parts: string[] = [bankName];
    
    // Pronađi KM broj računa (bank_racun)
    let kmAccount = "";
    for (const acc of bankAccounts) {
      const account = String(
        acc?.bank_racun ??
        acc?.racun ??
        acc?.broj_racuna ??
        acc?.account_no ??
        acc?.account ??
        "",
      ).trim();
      if (account && !account.toUpperCase().startsWith("BA")) {
        kmAccount = account;
        break;
      }
    }
    
    if (kmAccount) {
      parts.push(`(KM) ${kmAccount}`);
    }
    
    // Pronađi IBAN i SWIFT (za EUR/INO račune)
    let iban = "";
    let swift = "";
    
    for (const acc of bankAccounts) {
      const accIban = String(acc?.iban ?? "").trim();
      const accSwift = String(acc?.swift ?? acc?.bic ?? "").trim();
      
      if (accIban && accIban.toUpperCase().startsWith("BA")) {
        iban = accIban;
      }
      if (accSwift && !swift) {
        swift = accSwift;
      }
    }
    
    // Dodaj (EUR) IBAN i SWIFT ako postoje
    if (iban || swift) {
      if (iban) {
        parts.push(`(EUR) IBAN ${iban}`);
      }
      if (swift) {
        parts.push(`SWIFT ${swift}`);
      }
    }
    
    formatted.push(parts.join(" - "));
  }

  return formatted;
}

export default function Page() {
  const sp = useSearchParams();
  const { t } = useTranslation();

  const ids = useMemo(() => parseIds(String(sp.get("ids") ?? "")), [sp]);

  const invoiceDateISO = sp.get("date") ?? "";
  const dueDateISO = sp.get("due") ?? "";
  const ccy = (sp.get("ccy") ?? "KM").toUpperCase();
  const fisk = sp.get("pfr") ?? sp.get("fisk") ?? ""; // Podržavamo oba parametra za kompatibilnost
  const pnb = sp.get("pnb") ?? "";
  const useFiskalizacijaDropbox = sp.get("fiskalizacija") === "1";
  const invoiceNumberFromUrl = sp.get("invoice_number") ?? ""; // Broj fakture iz URL-a (kada se učitava postojeća)

  // Popust prije PDV-a (KM)
  const popustKm = useMemo(() => {
    const v = sp.get("popust");
    if (!v) return 0;
    const n = parseFloat(String(v).trim());
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [sp]);
  
  // ✅ Override nazivi projekata (projekat_id -> naziv_override)
  const projectNameOverrides = useMemo(() => {
    const overridesRaw = sp.get("project_names");
    if (!overridesRaw) return {};
    const map: Record<number, string> = {};
    overridesRaw.split(",").forEach((pair) => {
      const [idStr, naziv] = pair.split(":");
      const id = Number(idStr);
      if (Number.isFinite(id) && naziv) {
        map[id] = decodeURIComponent(naziv);
      }
    });
    return map;
  }, [sp]);

  // ✅ Opisne stavke po projektu (projekat_id -> string[])
  const projectSubItems = useMemo(() => {
    const raw = sp.get("project_sub_items");
    if (!raw) return {};
    const map: Record<number, string[]> = {};
    raw.split(",").forEach((pair) => {
      const colonIdx = pair.indexOf(":");
      if (colonIdx <= 0) return;
      const idStr = pair.slice(0, colonIdx);
      const itemsStr = pair.slice(colonIdx + 1);
      const id = Number(idStr);
      if (!Number.isFinite(id) || !itemsStr) return;
      const items = decodeURIComponent(itemsStr)
        .split("|")
        .map((s) => String(s).trim())
        .filter(Boolean);
      if (items.length > 0) map[id] = items;
    });
    return map;
  }, [sp]);

  // ✅ Grupisanje projekata (group_id -> { name: string, projectIds: number[] })
  const projectGroups = useMemo(() => {
    const raw = sp.get("project_groups");
    if (!raw) return {};
    const map: Record<string, { name: string; projectIds: number[] }> = {};
    raw.split(";").forEach((groupStr) => {
      const parts = groupStr.split(":");
      if (parts.length < 3) return;
      const groupId = parts[0];
      const name = decodeURIComponent(parts[1]);
      const projectIdsStr = parts.slice(2).join(":"); // Može biti više : u nazivu
      const projectIds = projectIdsStr
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isFinite(id) && id > 0);
      if (name && projectIds.length > 0) {
        map[groupId] = { name, projectIds };
      }
    });
    return map;
  }, [sp]);

  // ✅ Mapiranje projekat_id -> group_id (za brzu provjeru)
  const projectToGroup = useMemo(() => {
    const map = new Map<number, string>();
    Object.entries(projectGroups).forEach(([groupId, group]) => {
      group.projectIds.forEach((pid) => {
        map.set(pid, groupId);
      });
    });
    return map;
  }, [projectGroups]);

  const [data, setData] = useState<PreviewData | null>(null);
  const [fiskalizujLoading, setFiskalizujLoading] = useState(false);
  const [fiskalizacijaDone, setFiskalizacijaDone] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(invoiceNumberFromUrl);
  const [calculatedDueDate, setCalculatedDueDate] = useState<string>(dueDateISO || "");

  // Ažuriraj invoiceNumber kada se promeni URL parametar
  useEffect(() => {
    if (invoiceNumberFromUrl) {
      setInvoiceNumber(invoiceNumberFromUrl);
    }
  }, [invoiceNumberFromUrl]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const qs = new URLSearchParams();
        qs.set("ids", ids.join(","));
        const res = await fetch(
          `/api/fakture/wizard/preview-data?${qs.toString()}`,
          { cache: "no-store" },
        );
        const j = (await res.json()) as PreviewData;
        if (alive) setData(j);
      } catch (e: any) {
        if (alive)
          setData({
            ok: false,
            ids,
            projects: [],
            buyer: null,
            firma: null,
            narucioc_count: 0,
            error: e?.message ?? "Error",
          });
      }
    })();
    return () => {
      alive = false;
    };
  }, [ids.join(",")]);

  const buyer = data?.buyer ?? null;
  const firma = data?.firma ?? null;
  const projects = Array.isArray(data?.projects) ? data!.projects : [];

  // BH = bosanski, EN = engleski (samo za INO klijente)
  const bh = useMemo(() => {
    if (!buyer) return true;
    if (buyer.is_ino === true || buyer.is_ino === 1) return false;
    return isBiH(buyer.drzava);
  }, [buyer]);
  const lang: Lang = useMemo(() => (bh ? "BH" : "EN"), [bh]);
  const docTitle = useMemo(
    () => (lang === "EN" ? "INVOICE" : "RAČUN"),
    [lang],
  );

  // Fiskalizuj — poziva PU dropbox sistem, dobija QR kod i ostale elemente
  async function handleFiskalizuj() {
    if (fiskalizujLoading || fiskalizacijaDone) return;
    setFiskalizujLoading(true);
    try {
      // TODO: Integracija sa PU fiskalizacijom (dropbox sistem)
      // 1. Pozovi PU API / dropbox
      // 2. Dobij QR kod i ostale elemente za štampu
      // 3. Osvježi preview sa tim podacima
      // 4. Korisnik zatim klikne "Kreiraj račun"
      alert(
        "Fiskalizacija putem PU dropbox sistema će biti implementirana. " +
        "Flow: 1) Fiskalizuj dobija od PU QR kod i elemente → 2) Preview se osvježi → 3) Kreiraj račun. " +
        "Razdvojeno je jer PU može biti spor — Chrome ne bi trebao timeout-ovati."
      );
      setFiskalizacijaDone(true);
    } finally {
      setFiskalizujLoading(false);
    }
  }

  // Funkcija za kreiranje fakture
  async function handleCreateInvoice() {
    if (creating || created) return;

    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/fakture/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: ids.join(","),
          date: invoiceDateISO,
          ccy: ccy,
          vat: bh && !Number(buyer?.pdv_oslobodjen ?? 0) ? "BH_17" : "INO_0",
          pfr: fisk ? Number(fisk) : null,
          pnb: pnb,
          popust: popustKm > 0 ? popustKm : 0,
          project_names: Object.entries(projectNameOverrides)
            .filter(([_, val]) => val && String(val).trim())
            .map(([id, naziv]) => `${id}:${String(naziv).trim()}`)
            .join(","),
          project_sub_items: Object.entries(projectSubItems)
            .filter(([_, arr]) => arr && arr.length > 0)
            .map(([id, arr]) => `${id}:${(arr as string[]).join("|")}`)
            .join(","),
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.ok) {
        throw new Error(result.error || "Greška pri kreiranju fakture");
      }

      setCreated(true);
      setCreatedInvoice(result);
      // Postavi broj fakture i datum dospijeća za prikaz
      if (result.broj_fakture) {
        setInvoiceNumber(result.broj_fakture);
      }
      if (result.datum_dospijeca) {
        setCalculatedDueDate(result.datum_dospijeca);
      } else if (invoiceDateISO && data?.buyer?.rok_placanja_dana) {
        // Fallback: izračunaj datum dospijeća ako nije vraćen iz API-ja
        const rokDana = Number(data.buyer.rok_placanja_dana) || 30;
        const dueDate = new Date(invoiceDateISO);
        dueDate.setDate(dueDate.getDate() + rokDana);
        setCalculatedDueDate(dueDate.toISOString().slice(0, 10));
      }
    } catch (err: any) {
      setCreateError(err?.message || "Greška pri kreiranju fakture");
    } finally {
      setCreating(false);
    }
  }

  // Funkcija za kreiranje PDF-a i prikaz
  function handleCreatePDFAndShow() {
    if (!created) {
      alert("Prvo kreirajte račun!");
      return;
    }
    handlePrint();
  }

  // Funkcija za PDF Save as — preuzima PDF sa predloženim imenom
  function handlePDFSaveAs() {
    if (!created) {
      alert("Prvo kreirajte račun!");
      return;
    }
    handleSaveAsPdf();
  }

  // Funkcija za slanje mail-om — otvara email klijent s predpopunjenim podacima
  function handleSendEmail() {
    if (!created) {
      alert("Prvo kreirajte račun!");
      return;
    }
    const to = String(buyer?.email ?? "").trim();
    const subj =
      lang === "EN"
        ? `Invoice ${invoiceNumber} - ${buyerName}`
        : `Račun ${invoiceNumber} - ${buyerName}`;
    const body =
      lang === "EN"
        ? `Dear ${buyerName},\n\nPlease find attached invoice ${invoiceNumber}.\n\nBest regards`
        : `Poštovani,\n\nU prilogu Vam šaljemo račun br. ${invoiceNumber}.\n\nSrdačan pozdrav`;
    const mailto = `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  // Funkcija za zatvaranje prozora
  function handleClose() {
    if (created) {
      window.location.href = "/fakture";
    } else {
      window.location.href = "/dashboard";
    }
  }

  const items = useMemo(() => {
    // Prvo kreiraj sve stavke po projektu
    const rawItems = projects.map((p) => {
      // ✅ Provjeri da li je projekat u grupi
      const groupId = projectToGroup.get(p.projekat_id);
      const group = groupId ? projectGroups[groupId] : null;
      
      // ✅ Ako je u grupi, koristi grupni naziv; inače override naziv ili radni_naziv
      const overrideNaziv = projectNameOverrides[p.projekat_id];
      const title = group
        ? group.name
        : String(overrideNaziv || p.radni_naziv || `Projekat #${p.projekat_id}`).trim();
      
      const sub = p.klijent_naziv ? `Klijent: ${p.klijent_naziv}` : "";
      const subItems = projectSubItems[p.projekat_id] ?? [];
      const qty = 1;
      const unit = Number(p.budzet_planirani ?? 0);
      const total = qty * unit;
      return {
        id: p.projekat_id,
        title,
        sub,
        subItems,
        qty,
        unit,
        total,
        closed_at: p.closed_at,
        groupId: groupId || null, // za grupisanje
      };
    });

    // ✅ Grupiši stavke po groupId ili po nazivu ako nisu u grupi
    const grouped = new Map<string, typeof rawItems[0] & { ids: number[]; allSubItems: string[][] }>();
    
    for (const item of rawItems) {
      // Ako je u grupi, koristi groupId kao ključ; inače koristi title
      const key = item.groupId || `single_${item.id}`;
      const existing = grouped.get(key);
      
      if (existing && item.groupId) {
        // Kombinuj projekte iz iste grupe: zbroji iznose, kombinuj subItems
        // Količina ostaje 1 (jedna stavka na fakturi), samo iznosi se zbrajaju
        existing.total += item.total;
        existing.unit += item.unit;
        existing.qty = 1; // Količina je uvijek 1 za kombinovane projekte
        existing.ids.push(item.id);
        if (item.subItems.length > 0) {
          existing.allSubItems.push(item.subItems);
        }
        // Zadrži najnoviji datum zatvaranja
        if (item.closed_at && (!existing.closed_at || item.closed_at > existing.closed_at)) {
          existing.closed_at = item.closed_at;
        }
      } else {
        // Prva stavka sa ovim ključem
        grouped.set(key, {
          ...item,
          ids: [item.id],
          allSubItems: item.subItems.length > 0 ? [item.subItems] : [],
        });
      }
    }

    // Konvertuj nazad u array i kombinuj subItems u jedan niz
    return Array.from(grouped.values()).map((g) => {
      // Kombinuj sve subItems u jedan niz (ukloni duplikate)
      const combinedSubItems = Array.from(
        new Set(g.allSubItems.flat().filter(Boolean))
      );
      
      return {
        id: g.ids.length === 1 ? g.ids[0] : g.ids[0], // prvi ID za kompatibilnost
        title: g.title,
        sub: g.sub,
        subItems: combinedSubItems,
        qty: g.qty,
        unit: g.unit, // ukupan iznos (svi projekti zbrojeni)
        total: g.total, // isto kao unit u ovom slučaju
        closed_at: g.closed_at,
      };
    });
  }, [projects, projectNameOverrides, projectSubItems, projectGroups, projectToGroup]);

  const baseAmount = useMemo(
    () =>
      items.reduce(
        (s, it) => s + (Number.isFinite(it.total) ? it.total : 0),
        0,
      ),
    [items],
  );
  const popustAmount = popustKm;
  const baseAfterPopust = Math.max(0, baseAmount - popustAmount);
  const pdvOslobodjen = Number(buyer?.pdv_oslobodjen ?? 0) === 1;
  const vatRate = useMemo(
    () => (bh && !pdvOslobodjen ? 0.17 : 0),
    [bh, pdvOslobodjen],
  );
  const vatAmount = useMemo(() => Math.round(baseAfterPopust * vatRate * 100) / 100, [baseAfterPopust, vatRate]);
  const totalAmount = useMemo(
    () => baseAfterPopust + vatAmount,
    [baseAfterPopust, vatAmount],
  );

  const lastClosed = useMemo(
    () =>
      (items
        .map((x) => x.closed_at)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] as string | undefined),
    [items],
  );

  const sellerName = String(
    firma?.naziv || firma?.pravni_naziv || "Studio TAF",
  ).trim();
  const sellerAddr1 = String(firma?.adresa ?? "—").trim();
  const sellerCityLine = safeLineJoin(
    [firma?.postanski_broj, firma?.grad],
    " ",
  );
  const sellerCountry = String(firma?.drzava ?? "BiH").trim();
  const sellerTax =
    String(firma?.pdv_broj ?? "").trim() ||
    String(firma?.pib ?? "").trim() ||
    String(firma?.jib ?? "").trim() ||
    "—";

  const bankAccounts = Array.isArray(firma?.bank_accounts)
    ? firma!.bank_accounts
    : [];
  
  // ✅ Formatiraj račune prema traženom formatu
  const formattedBankAccounts = formatBankAccounts(bankAccounts);

  const buyerName = String(
    buyer?.naziv_klijenta ?? (lang === "EN" ? "Buyer" : "Kupac"),
  ).trim();
  const buyerAddr1 = String(buyer?.adresa ?? "—").trim();
  const buyerCityLine = safeLineJoin([buyer?.postanski_broj, buyer?.grad], " ");
  const buyerCountry = String(buyer?.drzava ?? "—").trim();
  const buyerTax = String(buyer?.porezni_id ?? "—").trim();

  // PDF filename: broj-2026 Naručioc (npr. 012-2026 Udruženje poslodavaca RS)
  const pdfFilename = useMemo(() => {
    const broj = String(
      invoiceNumber || createdInvoice?.broj_fakture || invoiceNumberFromUrl || "",
    )
      .replace(/\//g, "-")
      .trim() || "faktura";
    const narucilac = String(buyerName || "")
      .replace(/[/\\:*?"<>|]/g, "_")
      .trim() || "nepoznat";
    return `${broj} ${narucilac}`;
  }, [invoiceNumber, createdInvoice?.broj_fakture, invoiceNumberFromUrl, buyerName]);

  const paperRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const prevTitle = document.title;
    document.title = pdfFilename;
    window.print();
    const restore = () => {
      document.title = prevTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
  }

  async function handleSaveAsPdf() {
    const el = paperRef.current;
    if (!el) return;
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf()
        .set({
          margin: 0,
          filename: `${pdfFilename}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait", hotfixes: ["px_scaling"] },
        })
        .from(el)
        .save();
    } catch (err: any) {
      console.error("PDF greška:", err);
      alert(err?.message || "Greška pri generisanju PDF-a.");
    }
  }

  return (
    <div className="container">
      <style>{`
        .pageWrap { display:flex; flex-direction:column; height:100vh; overflow:hidden; }

        .topBlock {
          position: sticky; top:0; z-index: 40;
          padding: 14px 0 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          box-shadow: 0 14px 40px rgba(0,0,0,.22);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .topInner { padding: 0 14px; }
        .topRow { display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; }
        .topRowSecondary { margin-top: 14px; }
        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandLogo { height: 30px; width:auto; opacity:.92; }
        .brandTitle { font-size: 18px; font-weight: 800; line-height: 1.1; margin: 0; }
        .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; }

        .actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }

        .btn {
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          box-shadow: 0 10px 30px rgba(0,0,0,.18);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: transform .12s ease, background .12s ease, border-color .12s ease;
          text-decoration: none;
          cursor: pointer;
          user-select: none;
          padding: 10px 12px;
          border-radius: 14px;
          font-weight: 650;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: inherit;
          white-space: nowrap;
        }
        .btn:hover { background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.26); }
        .btn:active { transform: scale(.985); }

        .divider { height:1px; background: rgba(255,255,255,.12); margin: 12px 0 0; }

        .body { flex:1; min-height:0; overflow:auto; padding: 18px 0 28px; }

        .paperStage{ display:flex; justify-content:center; padding: 0 10px; }
        .paper{
          width: 210mm;
          min-height: 297mm;
          background: #ffffff;
          color: #000000;
          border-radius: 0;
          box-shadow: 0 18px 60px rgba(0,0,0,.35);
          border: none;
          padding: 18mm 16mm;
          box-sizing: border-box;
          overflow-x: hidden;
        }
        @media (max-width: 980px){
          .paper{ width: min(100%, 210mm); padding: 16px; }
        }

        .invRow{ display:flex; gap:14px; justify-content:space-between; align-items:flex-start; }
        .invHeaderLeft{ display:flex; align-items:flex-start; gap:12px; }
        .companyLogo{ max-height: 105px; max-width: 276px; object-fit: contain; }

        .docTitle{ font-size: 22px; font-weight: 800; letter-spacing: .6px; text-align:right; margin: 0; color: #000 !important; }

        .meta{ margin-top: 8px; font-size: 12px; line-height: 1.35; text-align:right; color: #000 !important; }
        .meta .line{ display:flex; justify-content:flex-end; gap:10px; }
        .meta .k{ min-width: 140px; color:#000 !important; text-align:right; }
        .meta .kStrong{ font-weight: 850; color:#000 !important; }
        .meta .v{ font-weight: 650; color:#000 !important; }

        .hr{ height: 1px; background: #000 !important; margin: 14px 0; }

        .cols2{ display:grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 760px){ .cols2{ grid-template-columns: 1fr; } }
        
        /* ✅ Desna kolona (Klijent/Naručioc) - desno poravnanje */
        .cols2 > div:last-child {
          text-align: right;
        }
        .cols2 > div:last-child .blockTitle {
          text-align: right;
        }

        .blockTitle{
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .3px;
          margin-bottom: 6px;
          color:#000 !important;
          text-transform: uppercase;
        }
        .addr{ font-size: 12px; line-height: 1.4; color:#000 !important; }
        .addr .name{ font-weight: 750; color:#000 !important; }
        .addr .muted{ color:#000 !important; }
        .addr .bankList{ margin-top: 8px; }
        .addr .bankLine{ color:#000 !important; margin-top: 3px; }

        .tblWrap{
          overflow:hidden;
          margin-top: 14px;
        }
        table{ width:100%; border-collapse:collapse; }
        thead tr{ background: #F7F7F7 !important; }
        th{
          padding: 10px 10px !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: .35px !important;
          color:#000 !important;
          font-weight: 700 !important;
          text-align:left !important;
          border-bottom: 1px solid #000 !important;
          white-space: nowrap !important;
          background: #F7F7F7 !important;
        }
        td{
          padding: 10px 10px !important;
          font-size: 12px !important;
          vertical-align: top !important;
          color:#000 !important;
        }
        .num{ text-align:right !important; white-space:nowrap !important; color:#000 !important; }
        .desc{ color:#000 !important; font-weight: 650 !important; }
        .mutedSmall{ font-size: 11px !important; color:#000 !important; margin-top: 2px !important; }

        .totalsRow{
          display:flex;
          justify-content:flex-end;
          gap: 18px;
          margin-top: 8px;
        }

        .totalsBox{
          width: 50%;
          max-width: 320px;
          border: 1px solid #000 !important;
          background: #F7F7F7 !important;
          padding: 10px 12px !important;
        }
        .totLine{
          display:flex !important;
          justify-content:space-between !important;
          gap: 12px !important;
          font-size: 12px !important;
          padding: 2px 0 !important;
          border-top: 1px solid rgba(0,0,0,.06) !important;
        }
        .totLine:first-child{ border-top: none !important; }
        .totLine .k{ color:#000 !important; }
        .totLine .v{ font-weight: 650 !important; color:#000 !important; }
        .totLine.total .k{ color:#000 !important; font-weight: 800 !important; }
        .totLine.total .v{ font-weight: 900 !important; color:#000 !important; }

        /* ✅ Info line unutar obračuna (umjesto između tabele i obračuna) */
        .completedLine{
          margin-top: 6px !important;
          font-size: 10px !important;
          color:#000 !important;
          line-height: 1.25 !important;
        }

        .footer{
          margin-top: 18px;
          padding-top: 10px;
          border-top: 1px solid rgba(0,0,0,.08);
          font-size: 11px;
          color: #666;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .fluxaSig{
          display:inline-flex;
          align-items:center;
          gap: 6px;
          opacity: .75;
        }
        .fluxaSig img{ height: 12px; width: 12px; object-fit: contain; opacity: .85; }

        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          html {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color-scheme: light !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #111111 !important;
          }
          
          .container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
          }
          
          .pageWrap {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .topBlock, .divider { 
            display: none !important; 
          }
          
          .body { 
            padding: 0 !important; 
            margin: 0 !important;
            overflow: visible !important;
            flex: none !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
          }
          
          .paperStage { 
            padding: 0 !important; 
            margin: 0 !important;
            display: block !important;
            width: 100% !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
          }
          
          .paper {
            width: 210mm !important;
            min-height: 297mm !important;
            max-width: 210mm !important;
            box-sizing: border-box !important;
            overflow-x: hidden !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 18mm 16mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            page-break-inside: auto;
          }
          
          .meta, .meta .k, .meta .v, .meta .kStrong {
            color: #000 !important;
          }
          
          .blockTitle, .addr, .addr .name, .addr .muted, .addr .bankLine {
            color: #000 !important;
          }
          
          .docTitle {
            color: #000 !important;
          }
          
          .hr {
            background: #000 !important;
          }
          
          .cols2 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
          }
          
          table {
            page-break-inside: auto;
          }
          
          thead tr {
            background: #F7F7F7 !important;
          }
          
          th {
            color: #000 !important;
            font-weight: 700 !important;
            background: #F7F7F7 !important;
            border-bottom: 1px solid #000 !important;
          }
          
          td {
            color: #000 !important;
          }
          
          .num, .desc, .mutedSmall {
            color: #000 !important;
          }
          
          .totalsBox {
            border: 1px solid #000 !important;
            background: #F7F7F7 !important;
          }
          
          .totLine .k, .totLine .v {
            color: #000 !important;
          }
          
          .totLine.total .k, .totLine.total .v {
            color: #000 !important;
          }
          
          .completedLine {
            color: #000 !important;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          /* Safe zone: ne cijepati logičke cjeline na pola stranice */
          .invRow, .cols2, .totalsRow, .totalsBox, .footer {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <img
                    src="/fluxa/logo-light.png"
                    alt="FLUXA"
                    className="brandLogo"
                  />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">
                    {t("wizard.previewRacuna33")}
                  </div>
                  <div className="brandSub">
                    {t("wizard.previewRacunaSub")}
                  </div>
                </div>
              </div>
              <Link className="btn" href="/dashboard" title={t("common.dashboard")}>
                🏠 {t("common.dashboard")}
              </Link>
            </div>
            <div className="topRow topRowSecondary">
              <div style={{ flex: 1, minWidth: 0 }} />

              <div className="actions">
                {!created ? (
                  <>
                    <Link
                      className="btn"
                      href={`/fakture/wizard?ids=${encodeURIComponent(ids.join(","))}`}
                      title={t("wizard.nazadNaWizard")}
                    >
                      ← {t("wizard.nazad23")}
                    </Link>

                    {useFiskalizacijaDropbox && (
                      <button
                        type="button"
                        className="btn"
                        onClick={handleFiskalizuj}
                        disabled={fiskalizujLoading || fiskalizacijaDone}
                        style={{
                          background: fiskalizacijaDone
                            ? "rgba(34, 197, 94, 0.2)"
                            : "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.1))",
                          borderColor: "rgba(34, 197, 94, 0.4)",
                          fontWeight: 600,
                        }}
                        title={t("wizard.fiskalizujTitle")}
                      >
                        {fiskalizujLoading ? "⏳" : fiskalizacijaDone ? "✓" : "📋"}{" "}
                        {t("wizard.fiskalizuj")}
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn"
                      onClick={handleCreateInvoice}
                      disabled={creating}
                      style={{
                        background: creating
                          ? "rgba(255, 80, 80, 0.3)"
                          : "linear-gradient(135deg, rgba(255, 80, 80, 0.15), rgba(239, 68, 68, 0.1))",
                        borderColor: "rgba(255, 80, 80, 0.4)",
                        fontWeight: 700,
                      }}
                      title={t("wizard.kreirajRacunTitle")}
                    >
                      {creating ? "⏳" : "📄"}{" "}
                      {t("wizard.kreirajRacun")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn"
                      onClick={handleCreatePDFAndShow}
                      title={t("wizard.kreirajPdfTitle")}
                    >
                      📄 {t("wizard.kreirajPdf")}
                    </button>

                    <button
                      type="button"
                      className="btn"
                      onClick={handlePDFSaveAs}
                      title={
                        lang === "EN"
                          ? "Save as PDF (in print dialog, choose 'Save as PDF' as destination)"
                          : "Sačuvaj kao PDF (u print dialogu odaberi 'Sačuvaj kao PDF' kao destinaciju)"
                      }
                    >
                      💾 {lang === "EN" ? "PDF Save as" : "PDF Sačuvaj"}
                    </button>

                    <button
                      type="button"
                      className="btn"
                      onClick={handleSendEmail}
                      title={lang === "EN" ? "Send by email" : "Pošalji mail-om"}
                    >
                      📧 {lang === "EN" ? "Send Email" : "Pošalji mail"}
                    </button>

                    <button
                      type="button"
                      className="btn"
                      onClick={handleClose}
                      style={{
                        background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.1))",
                        borderColor: "rgba(59, 130, 246, 0.4)",
                        fontWeight: 700,
                      }}
                      title={lang === "EN" ? "Close window" : "Zatvori prozor"}
                    >
                      ✕ {lang === "EN" ? "Close" : "Zatvori"}
                    </button>
                  </>
                )}

                {createError && (
                  <div
                    style={{
                      color: "#ff3b30",
                      fontSize: 13,
                      marginLeft: 10,
                      padding: "6px 12px",
                      background: "rgba(255, 59, 48, 0.1)",
                      borderRadius: 6,
                    }}
                  >
                    ⚠️ {createError}
                  </div>
                )}

                {created && createdInvoice && (
                  <div
                    style={{
                      color: "#34c759",
                      fontSize: 13,
                      marginLeft: 10,
                      padding: "6px 12px",
                      background: "rgba(52, 199, 89, 0.1)",
                      borderRadius: 6,
                      fontWeight: 600,
                    }}
                  >
                    ✅ Račun kreiran: {createdInvoice.broj_fakture}
                  </div>
                )}
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="body">
          <div className="paperStage">
            <div className="paper" ref={paperRef}>
              <div className="invRow">
                <div className="invHeaderLeft">
                  <img
                    src={
                      (() => {
                        const p = data?.firma?.logo_path?.trim();
                        if (!p) return "/api/firma/logo";
                        if (p.startsWith("http://") || p.startsWith("https://"))
                          return p;
                        return "/api/firma/logo";
                      })()
                    }
                    alt="Company logo"
                    className="companyLogo"
                  />
                </div>

                <div>
                  <h1 className="docTitle">{docTitle}</h1>
                  <div className="meta">
                    <div className="line">
                      <div className="k kStrong">
                        {lang === "EN" ? "Invoice No." : "Broj računa"}
                      </div>
                      <div className="v">
                        {invoiceNumber || invoiceNumberFromUrl || (createdInvoice?.broj_fakture) || "—"}
                      </div>
                    </div>
                    <div className="line">
                      <div className="k">
                        {lang === "EN" ? "Invoice date" : "Datum računa"}
                      </div>
                      <div className="v">
                        {fmtDDMMYYYYFromISO(invoiceDateISO)}
                      </div>
                    </div>
                    <div className="line">
                      <div className="k">
                        {lang === "EN" ? "Due date" : "Datum dospijeća"}
                      </div>
                      <div className="v">
                        {calculatedDueDate || createdInvoice?.datum_dospijeca || dueDateISO
                          ? fmtDDMMYYYYFromISO(calculatedDueDate || createdInvoice?.datum_dospijeca || dueDateISO)
                          : "—"}
                      </div>
                    </div>
                    <div className="line">
                      <div className="k">
                        {lang === "EN" ? "Currency" : "Valuta"}
                      </div>
                      <div className="v">{(ccy === "BAM" || ccy === "KM") ? "KM" : ccy}</div>
                    </div>
                    <div className="line">
                      <div className="k">
                        {lang === "EN" ? "PFR No." : "PFR broj"}
                      </div>
                      <div className="v">{createdInvoice?.broj_fiskalni ?? (fisk ? fisk : "—")}</div>
                    </div>
                    <div className="line">
                      <div className="k">
                        {lang === "EN" ? "Payment reference" : "Poziv na broj"}
                      </div>
                      <div className="v">{pnb ? pnb : "—"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hr" />

              <div className="cols2">
                <div>
                  <div className="blockTitle">
                    {lang === "EN" ? "Legal entity" : "PRAVNO LICE"}
                  </div>
                  <div className="addr">
                    <div className="name">{sellerName}</div>
                    <div className="muted">{sellerAddr1}</div>
                    {sellerCityLine ? (
                      <div className="muted">{sellerCityLine}</div>
                    ) : null}
                    <div className="muted">{sellerCountry}</div>
                    <div className="muted">PIB/JIB: {sellerTax}</div>

                    {formattedBankAccounts.length > 0 ? (
                      <div className="bankList">
                        <div className="muted" style={{ marginTop: 8 }}>
                          Bankovni računi:
                        </div>
                        {formattedBankAccounts.map((formatted, i) => (
                          <div
                            key={`bank-${i}`}
                            className="bankLine"
                          >
                            • {formatted}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="blockTitle">
                    {lang === "EN"
                      ? "Client"
                      : "KLIJENT/NARUČILAC"}
                  </div>
                  <div className="addr">
                    <div className="name">{buyerName}</div>
                    <div className="muted">{buyerAddr1}</div>
                    {buyerCityLine ? (
                      <div className="muted">{buyerCityLine}</div>
                    ) : null}
                    <div className="muted">{buyerCountry}</div>
                    <div className="muted">PIB/JIB: {buyerTax}</div>
                  </div>
                </div>
              </div>

              <div className="tblWrap table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>#</th>
                      <th>
                        {lang === "EN"
                          ? "Service / Project"
                          : "USLUGA / PROJEKAT"}
                      </th>
                      <th className="num" style={{ width: 72 }}>
                        {lang === "EN" ? "Qty" : "KOL."}
                      </th>
                      <th className="num" style={{ width: 120 }}>
                        {lang === "EN" ? "Unit price" : "JED. CIJENA"}
                      </th>
                      <th className="num" style={{ width: 120 }}>
                        {lang === "EN" ? "Total" : "UKUPNO"}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 14, color: "#666" }}>
                          {lang === "EN"
                            ? "No selected projects."
                            : "Nema izabranih projekata."}
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={it.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <div className="desc">{it.title}</div>
                            {it.sub ? (
                              <div className="mutedSmall">{it.sub}</div>
                            ) : null}
                            {it.subItems && it.subItems.length > 0 ? (
                              <ul
                                className="mutedSmall"
                                style={{
                                  margin: "6px 0 0 0",
                                  paddingLeft: 18,
                                  listStyle: "disc",
                                  lineHeight: 1.4,
                                }}
                              >
                                {it.subItems.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            ) : null}
                          </td>
                          <td className="num">{it.qty}</td>
                          <td className="num">{fmtMoney(it.unit, ccy)}</td>
                          <td className="num">{fmtMoney(it.total, ccy)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="totalsRow">
                <div className="totalsBox">
                  <div className="totLine">
                    <div className="k">
                      {lang === "EN" ? "Subtotal" : "Osnovica"}
                    </div>
                    <div className="v">{fmtMoney(baseAmount, ccy)}</div>
                  </div>

                  {popustAmount > 0 && (
                    <>
                      <div className="totLine">
                        <div className="k">
                          {lang === "EN" ? "Discount" : "Popust"}
                        </div>
                        <div className="v">
                          − {fmtMoney(popustAmount, ccy)}
                        </div>
                      </div>
                      <div className="totLine">
                        <div className="k">
                          {lang === "EN" ? "Base after discount" : "Osnovica nakon popusta"}
                        </div>
                        <div className="v">{fmtMoney(baseAfterPopust, ccy)}</div>
                      </div>
                    </>
                  )}

                  <div className="totLine">
                    <div className="k">{lang === "EN" ? "VAT" : "PDV"}</div>
                    <div className="v">
                      {bh ? fmtMoney(vatAmount, ccy) : "—"}
                    </div>
                  </div>

                  <div className="totLine total">
                    <div className="k">
                      {lang === "EN" ? "Total due" : "Ukupno za plaćanje"}
                    </div>
                    <div className="v">{fmtMoney(totalAmount, ccy)}</div>
                  </div>

                  {/* ✅ Proj completion ovdje, da se “rupa” iznad obračuna zatvori */}
                  <div className="completedLine">
                    {lang === "EN"
                      ? `Project completed: ${lastClosed ? fmtDDMMYYYYFromISO(lastClosed) : "—"}`
                      : `Projekat je završen ${lastClosed ? fmtDDMMYYYYFromISO(lastClosed) : "—"}`}
                  </div>

                  {!bh ? (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 10,
                        color: "#555",
                        lineHeight: 1.25,
                      }}
                    >
                      VAT exemption: In accordance with the VAT Law, this service is exempt from VAT pursuant to Article 27, paragraph 1.
                    </div>
                  ) : pdvOslobodjen && buyer?.pdv_oslobodjen_napomena ? (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 10,
                        color: "#555",
                        lineHeight: 1.25,
                      }}
                    >
                      {buyer.pdv_oslobodjen_napomena}
                    </div>
                  ) : null}

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 10,
                      color: "#555",
                      lineHeight: 1.25,
                    }}
                  >
                    {lang === "EN"
                      ? "This invoice was generated electronically and is valid without signature and stamp."
                      : "Račun je generisan elektronskim putem i važeći je bez pečata i potpisa."}
                  </div>
                </div>
              </div>

              <div className="footer">
                <div className="fluxaSig">
                  <img src="/fluxa/Icon.png" alt="FLUXA" />
                  <span>Made by FLUXA Project &amp; Finance Engine</span>
                </div>
              </div>

              {!data?.ok ? (
                <div style={{ marginTop: 12, fontSize: 11, color: "#b00" }}>
                  {data?.error ? `API error: ${data.error}` : "API not ready"}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
