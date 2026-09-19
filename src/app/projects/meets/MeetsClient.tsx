"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAmount } from "@/lib/format";

export type MeetProject = {
  projekat_id: number;
  naziv_projekta: string;
  status_id?: number | null;
  status_name?: string | null;
  narucilac_id?: number | null;
  naziv_klijenta?: string | null;
  datum_pocetka?: string | null;
  datum_zavrsetka?: string | null;
  budzet_km?: number | null;
  napomena?: string | null;
  ukupno_troskovi_km?: number | null;
  faktura_id?: number | null;
  broj_fakture?: string | null;
  faktura_status_naplate?: string | null;
};

export type CalendarItem = {
  kalendar_id: number;
  godina: number;
  naziv_takmicenja: string;
  klub_savez_id?: number | null;
  klub_savez_naziv?: string | null;
  lokacija_grad: string;
  bazen_naziv?: string | null;
  tip_lokacije: "DOMACI" | "TEREN_BLIZU" | "TEREN_DALEKO";
  datum_od: string;
  datum_do: string;
  datum_polaska?: string | null;
  datum_povratka?: string | null;
  broj_takmicarskih_dana: number;
  dnevna_tarifa_km?: number | null;
  honorar_nacin_placanja?: "FAKTURA" | "KES";
  ukupno_blokiranih_dana: number;
  nocenja_broj: number;
  nocenje_pokriva: "ORGANIZATOR" | "STUDIO_TAF" | "BEZ_NOCENJA" | "ORGANIZATOR_FAKTURA" | "ORGANIZATOR_KES";
  nocenje_cijena_km: number;
  kilometraza_km: number;
  trosak_goriva_km: number;
  putarine_km: number;
  put_pokriva?: "ORGANIZATOR_KES" | "ORGANIZATOR_DIREKTNO" | "STUDIO_TAF" | "ORGANIZATOR_FAKTURA";
  dnevnice_mjerioca_km: number;
  dnevnice_pokriva?: "ORGANIZATOR" | "STUDIO_TAF" | "BEZ_DNEVNICA" | "ORGANIZATOR_FAKTURA" | "ORGANIZATOR_KES";
  ugovoreni_pausal_km: number;
  iznos_faktura_km?: number | null;
  iznos_kes_km?: number | null;
  trosak_studija_km?: number | null;
  dodatni_kes_troskovi_km?: number | null;
  neto_zarada_km: number;
  status: "PLANIRANO" | "POTVRDJENO" | "U_TOKU" | "ODRZANO" | "OBRADJENO" | "FAKTURISANO" | "NAPLACENO";
  napomena?: string | null;
  projekat_id?: number | null;
  inicijacija_id?: number | null;
  deal_naziv?: string | null;
  naziv_projekta?: string | null;
  faktura_id?: number | null;
  broj_fakture?: string | null;
  faktura_status_naplate?: string | null;
};

export type KlijentOption = {
  klijent_id: number;
  naziv_klijenta: string;
};

// Pomoćna funkcija za obračun finansija i određivanje modela plaćanja
export function calcBreakdown(item: {
  broj_takmicarskih_dana?: number | null;
  dnevna_tarifa_km?: number | null;
  honorar_nacin_placanja?: string | null;
  trosak_goriva_km?: number | null;
  putarine_km?: number | null;
  put_pokriva?: string | null;
  nocenja_broj?: number | null;
  nocenje_cijena_km?: number | null;
  nocenje_pokriva?: string | null;
  dnevnice_mjerioca_km?: number | null;
  dnevnice_pokriva?: string | null;
}) {
  const dana = Number(item.broj_takmicarskih_dana) || 1;
  const tarifa = Number(item.dnevna_tarifa_km) || 500;
  const honorar = dana * tarifa;
  const honorarNacin = item.honorar_nacin_placanja || "FAKTURA";

  const putIznos = (Number(item.trosak_goriva_km) || 0) + (Number(item.putarine_km) || 0);
  const smjestajIznos = (Number(item.nocenja_broj) || 0) * (Number(item.nocenje_cijena_km) || 0);
  const dnevniceIznos = Number(item.dnevnice_mjerioca_km) || 0;

  // 1. Iznos za zvaničnu žiralnu fakturu (virman)
  let fakturaIznos = honorarNacin === "FAKTURA" ? honorar : 0;
  if (item.put_pokriva === "ORGANIZATOR_FAKTURA") fakturaIznos += putIznos;
  if (item.nocenje_pokriva === "ORGANIZATOR_FAKTURA") fakturaIznos += smjestajIznos;
  if (item.dnevnice_pokriva === "ORGANIZATOR_FAKTURA") fakturaIznos += dnevniceIznos;

  // 2. Iznos za naplatu u gotovini (keš na bazenu / na ruke)
  let kesIznos = honorarNacin === "KES" ? honorar : 0;
  if (item.put_pokriva === "ORGANIZATOR_KES") kesIznos += putIznos;
  if (item.nocenje_pokriva === "ORGANIZATOR_KES") kesIznos += smjestajIznos;
  if (item.dnevnice_pokriva === "ORGANIZATOR_KES") kesIznos += dnevniceIznos;

  // 3. Stvarni trošak koji tereti Studio TAF (iz svog džepa)
  let trosakStudija = 0;
  if (item.put_pokriva === "STUDIO_TAF") trosakStudija += putIznos;
  if (item.nocenje_pokriva === "STUDIO_TAF") trosakStudija += smjestajIznos;
  if (item.dnevnice_pokriva === "STUDIO_TAF") trosakStudija += dnevniceIznos;

  // Model plaćanja: KES (sve na ruke), FAKTURA (sve preko računa), HIBRID (honorar virman + put keš)
  let model: "KES" | "FAKTURA" | "HIBRID" = "FAKTURA";
  if (fakturaIznos > 0 && kesIznos > 0) {
    model = "HIBRID";
  } else if (kesIznos > 0 && fakturaIznos === 0) {
    model = "KES";
  } else {
    model = "FAKTURA";
  }

  const cistaZarada = honorar - trosakStudija;
  const ukupnoZaNaplatu = fakturaIznos + kesIznos;

  return {
    honorar,
    putIznos,
    smjestajIznos,
    dnevniceIznos,
    fakturaIznos,
    kesIznos,
    trosakStudija,
    cistaZarada,
    ukupnoZaNaplatu,
    model,
  };
}

export default function MeetsClient({
  initialProjects,
  klijenti,
  defaultDnevnaTarifa = 500,
  locale = "sr",
}: {
  initialProjects: MeetProject[];
  klijenti: KlijentOption[];
  defaultDnevnaTarifa?: number;
  locale?: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"KALENDAR" | "PROJEKTI">("KALENDAR");
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [loadingCal, setLoadingCal] = useState(false);

  const [isCalModalOpen, setIsCalModalOpen] = useState(false);
  const [editingCalId, setEditingCalId] = useState<number | null>(null);

  // Modal za unos i korekciju
  const [nazivTakmicenja, setNazivTakmicenja] = useState("");
  const [klubId, setKlubId] = useState("");
  const [lokacijaGrad, setLokacijaGrad] = useState("Trebinje");
  const [bazenNaziv, setBazenNaziv] = useState("Zatvoreni olimpijski bazen Ana Čučković");
  const [tipLokacije, setTipLokacije] = useState<"DOMACI" | "TEREN_BLIZU" | "TEREN_DALEKO">("TEREN_DALEKO");
  const [datumOd, setDatumOd] = useState("");
  const [datumDo, setDatumDo] = useState("");
  const [takmicarskihDana, setTakmicarskihDana] = useState(2);
  const [dnevnaTarifaKm, setDnevnaTarifaKm] = useState(defaultDnevnaTarifa || 500);
  const [honorarNacinPlacanja, setHonorarNacinPlacanja] = useState<"FAKTURA" | "KES">("FAKTURA");
  const [pausalKm, setPausalKm] = useState(1000);
  const [nocenjaBroj, setNocenjaBroj] = useState(2);
  const [nocenjePokriva, setNocenjePokriva] = useState<"ORGANIZATOR" | "STUDIO_TAF" | "BEZ_NOCENJA" | "ORGANIZATOR_FAKTURA" | "ORGANIZATOR_KES">("ORGANIZATOR");
  const [nocenjeCijena, setNocenjeCijena] = useState(0);
  const [km, setKm] = useState(720);
  const [gorivoKm, setGorivoKm] = useState(160);
  const [putarineKm, setPutarineKm] = useState(20);
  const [putPokriva, setPutPokriva] = useState<"ORGANIZATOR_KES" | "ORGANIZATOR_DIREKTNO" | "STUDIO_TAF" | "ORGANIZATOR_FAKTURA">("ORGANIZATOR_KES");
  const [dnevniceKm, setDnevniceKm] = useState(200);
  const [dnevnicePokriva, setDnevnicePokriva] = useState<"ORGANIZATOR" | "STUDIO_TAF" | "BEZ_DNEVNICA" | "ORGANIZATOR_FAKTURA" | "ORGANIZATOR_KES">("ORGANIZATOR");
  const [dodatniKesTroskoviKm, setDodatniKesTroskoviKm] = useState(0);
  const [statusVal, setStatusVal] = useState<CalendarItem["status"]>("PLANIRANO");
  const [kreirajDeal, setKreirajDeal] = useState(true);
  const [napomenaCal, setNapomenaCal] = useState("PK Leotar (2 dana). Smještaj i hranu obezbjeđuje organizator. Troškove puta organizator plaća u kešu (180 KM). Žiralna faktura samo za uslugu mjerenja (1.000 KM + PDV).");
  const [savingCal, setSavingCal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal za brzu Keš naplatu
  const [cashModalItem, setCashModalItem] = useState<CalendarItem | null>(null);
  const [cashIznos, setCashIznos] = useState<number>(0);
  const [cashDatum, setCashDatum] = useState<string>("");
  const [cashSaving, setCashSaving] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const fmtDate = (d?: string | null) => {
    if (!d) return "—";
    const s = String(d).slice(0, 10);
    const parts = s.split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return s;
  };

  const loadCalendar = async () => {
    setLoadingCal(true);
    try {
      const res = await fetch(`/api/meets/kalendar?godina=${selectedYear}`);
      const data = await res.json();
      if (data.ok) {
        setCalendarItems(data.rows ?? []);
      }
    } catch (e) {
      console.error("Greška pri učitavanju kalendara:", e);
    } finally {
      setLoadingCal(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [selectedYear]);

  const handleTarifaOrDaysChange = (days: number, tarifa: number) => {
    setTakmicarskihDana(days);
    setDnevnaTarifaKm(tarifa);
    setPausalKm(days * tarifa);
  };

  const openNewModal = () => {
    setEditingCalId(null);
    setNazivTakmicenja("");
    setKlubId("");
    applyPreset("TREBINJE_PK");
    setDatumOd("");
    setDatumDo("");
    setStatusVal("PLANIRANO");
    setKreirajDeal(true);
    setError(null);
    setIsCalModalOpen(true);
  };

  const openEditModal = (item: CalendarItem) => {
    setEditingCalId(item.kalendar_id);
    setNazivTakmicenja(item.naziv_takmicenja);
    setKlubId(item.klub_savez_id ? String(item.klub_savez_id) : "");
    setLokacijaGrad(item.lokacija_grad || "");
    setBazenNaziv(item.bazen_naziv || "");
    setTipLokacije(item.tip_lokacije);
    setDatumOd(item.datum_od ? String(item.datum_od).slice(0, 10) : "");
    setDatumDo(item.datum_do ? String(item.datum_do).slice(0, 10) : "");
    setTakmicarskihDana(item.broj_takmicarskih_dana || 2);
    setDnevnaTarifaKm(Number(item.dnevna_tarifa_km) || defaultDnevnaTarifa || 500);
    setHonorarNacinPlacanja(item.honorar_nacin_placanja || (Number(item.iznos_kes_km) > 0 && Number(item.iznos_faktura_km) === 0 ? "KES" : "FAKTURA"));
    setPausalKm(Number(item.ugovoreni_pausal_km) || 1000);
    setNocenjaBroj(item.nocenja_broj || 0);
    setNocenjePokriva(item.nocenje_pokriva || "BEZ_NOCENJA");
    setNocenjeCijena(Number(item.nocenje_cijena_km) || 0);
    setKm(Number(item.kilometraza_km) || 0);
    setGorivoKm(Number(item.trosak_goriva_km) || 0);
    setPutarineKm(Number(item.putarine_km) || 0);
    setPutPokriva(item.put_pokriva || "ORGANIZATOR_KES");
    setDnevniceKm(Number(item.dnevnice_mjerioca_km) || 0);
    setDnevnicePokriva(item.dnevnice_pokriva || "ORGANIZATOR");
    setDodatniKesTroskoviKm(Number(item.dodatni_kes_troskovi_km) || 0);
    setStatusVal(item.status || "PLANIRANO");
    setKreirajDeal(false);
    setNapomenaCal(item.napomena || "");
    setError(null);
    setIsCalModalOpen(true);
  };

  const handleDeleteCalendarItem = async (id: number, naziv: string) => {
    if (!window.confirm(`Da li ste sigurni da želite ukloniti takmičenje "${naziv}" iz kalendara?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/meets/kalendar?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setCalendarItems((prev) => prev.filter((it) => it.kalendar_id !== id));
        showNotice(`Takmičenje "${naziv}" uklonjeno.`);
      } else {
        alert(data.error || "Greška pri brisanju.");
      }
    } catch (err: any) {
      alert("Greška: " + err.message);
    }
  };

  // Akcija 1: SPREMI ZA FAKTURISANJE (npr. PK Leotar - avansno/unaprijed prije polaska)
  const handleSendToInvoice = async (item: CalendarItem) => {
    if (!item.klub_savez_id) {
      alert("Molimo odaberite Naručioca (Klub/Savez) kroz 'Koriguj' da bi se kreirala faktura.");
      openEditModal(item);
      return;
    }

    try {
      const res = await fetch("/api/meets/kalendar/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SPREMI_ZA_FAKTURISANJE",
          kalendar_id: item.kalendar_id,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Greška pri slanju na fakturisanje.");

      showNotice(`✅ ${data.message || "Kreirano i spremno za fakturisanje!"}`);
      await loadCalendar();

      if (data.redirect_url) {
        router.push(data.redirect_url);
      }
    } catch (err: any) {
      alert("Greška: " + err.message);
    }
  };

  // Akcija 2: EVIDENTIRAJ KEŠ U BLAGAJNU (npr. GKVS Leotar - keš uplata na bazenu)
  const openCashModal = (item: CalendarItem) => {
    const bd = calcBreakdown(item);
    setCashModalItem(item);
    setCashIznos(bd.kesIznos > 0 ? bd.kesIznos : (Number(item.iznos_kes_km) || Number(item.ugovoreni_pausal_km) || 0));
    setCashDatum(item.datum_do ? String(item.datum_do).slice(0, 10) : new Date().toISOString().slice(0, 10));
  };

  const handleConfirmCashPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashModalItem) return;

    setCashSaving(true);
    try {
      const res = await fetch("/api/meets/kalendar/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EVIDENTIRAJ_KES",
          kalendar_id: cashModalItem.kalendar_id,
          iznos: cashIznos,
          datum: cashDatum,
          napomena: `Keš uplata na bazenu: ${cashModalItem.naziv_takmicenja} (${cashModalItem.klub_savez_naziv || cashModalItem.lokacija_grad})`,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Greška pri upisu u blagajnu.");

      showNotice(data.message || "✅ Keš uplata evidentirana u blagajnu!");
      setCashModalItem(null);
      await loadCalendar();
    } catch (err: any) {
      alert("Greška: " + err.message);
    } finally {
      setCashSaving(false);
    }
  };

  // Brzi aranžmani / Predlošci
  const applyPreset = (preset: "TREBINJE_PK" | "TREBINJE_GKVS" | "BANJALUKA" | "SARAJEVO" | "MOSTAR") => {
    if (preset === "BANJALUKA") {
      setLokacijaGrad("Banja Luka");
      setBazenNaziv("Gradski olimpijski bazen (GOB)");
      setTipLokacije("DOMACI");
      handleTarifaOrDaysChange(2, defaultDnevnaTarifa || 500);
      setHonorarNacinPlacanja("FAKTURA");
      setKm(0);
      setGorivoKm(0);
      setPutarineKm(0);
      setPutPokriva("ORGANIZATOR_DIREKTNO");
      setNocenjaBroj(0);
      setNocenjePokriva("BEZ_NOCENJA");
      setNocenjeCijena(0);
      setDnevniceKm(0);
      setDnevnicePokriva("BEZ_DNEVNICA");
      setDodatniKesTroskoviKm(0);
      setNapomenaCal("Domaći bazen GOB Banja Luka. Sve ide na zvaničnu žiralnu fakturu (1.000 KM + PDV).");
    } else if (preset === "TREBINJE_PK") {
      setLokacijaGrad("Trebinje");
      setBazenNaziv("Zatvoreni olimpijski bazen Ana Čučković");
      setTipLokacije("TEREN_DALEKO");
      handleTarifaOrDaysChange(2, defaultDnevnaTarifa || 500);
      setHonorarNacinPlacanja("FAKTURA");
      setKm(720);
      setGorivoKm(160);
      setPutarineKm(20);
      setPutPokriva("ORGANIZATOR_KES");
      setNocenjaBroj(2);
      setNocenjePokriva("ORGANIZATOR");
      setNocenjeCijena(0);
      setDnevniceKm(200);
      setDnevnicePokriva("ORGANIZATOR");
      setDodatniKesTroskoviKm(0);
      setNapomenaCal("PK Leotar (2 dana). Hibridno: faktura za uslugu mjerenja (1.000 KM + PDV), a troškove puta organizator isplaćuje u kešu na bazenu (180 KM). Smještaj i hrana obezbijeđeni.");
    } else if (preset === "TREBINJE_GKVS") {
      setLokacijaGrad("Trebinje");
      setBazenNaziv("Zatvoreni olimpijski bazen Ana Čučković");
      setTipLokacije("TEREN_DALEKO");
      handleTarifaOrDaysChange(1, defaultDnevnaTarifa || 500);
      setHonorarNacinPlacanja("KES");
      setKm(720);
      setGorivoKm(160);
      setPutarineKm(0);
      setPutPokriva("ORGANIZATOR_KES");
      setNocenjaBroj(2);
      setNocenjePokriva("ORGANIZATOR");
      setNocenjeCijena(0);
      setDnevniceKm(0);
      setDnevnicePokriva("ORGANIZATOR");
      setDodatniKesTroskoviKm(0);
      setNapomenaCal("GKVS Leotar (1 dan). Sve se naplaćuje u gotovini na bazenu (500 KM honorar + 160 KM gorivo = 660 KM na ruke). Smještaj i hranu obezbjeđuje klub.");
    } else if (preset === "SARAJEVO") {
      setLokacijaGrad("Sarajevo");
      setBazenNaziv("Olimpijski bazen Otoka");
      setTipLokacije("TEREN_DALEKO");
      handleTarifaOrDaysChange(2, defaultDnevnaTarifa || 500);
      setHonorarNacinPlacanja("FAKTURA");
      setKm(400);
      setGorivoKm(100);
      setPutarineKm(15);
      setPutPokriva("ORGANIZATOR_KES");
      setNocenjaBroj(2);
      setNocenjePokriva("ORGANIZATOR");
      setNocenjeCijena(0);
      setDnevniceKm(0);
      setDnevnicePokriva("ORGANIZATOR");
      setDodatniKesTroskoviKm(0);
      setNapomenaCal("Sarajevo Otoka (2 dana). Polazak dan ranije.");
    } else if (preset === "MOSTAR") {
      setLokacijaGrad("Mostar");
      setBazenNaziv("Bazen Mostar");
      setTipLokacije("TEREN_DALEKO");
      handleTarifaOrDaysChange(2, defaultDnevnaTarifa || 500);
      setHonorarNacinPlacanja("FAKTURA");
      setKm(480);
      setGorivoKm(120);
      setPutarineKm(15);
      setPutPokriva("ORGANIZATOR_KES");
      setNocenjaBroj(2);
      setNocenjePokriva("ORGANIZATOR");
      setNocenjeCijena(0);
      setDnevniceKm(0);
      setDnevnicePokriva("ORGANIZATOR");
      setDodatniKesTroskoviKm(0);
      setNapomenaCal("Mostar (2 dana).");
    }
  };

  const handleSaveCalendarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nazivTakmicenja.trim() || !datumOd || !datumDo) {
      setError("Naziv takmičenja i datumi (od/do) su obavezni.");
      return;
    }

    setSavingCal(true);
    setError(null);

    try {
      const selectedKlub = klijenti.find((k) => String(k.klijent_id) === String(klubId));
      const payload: any = {
        godina: selectedYear,
        naziv_takmicenja: nazivTakmicenja.trim(),
        klub_savez_id: klubId ? Number(klubId) : null,
        klub_savez_naziv: selectedKlub?.naziv_klijenta || null,
        lokacija_grad: lokacijaGrad.trim(),
        bazen_naziv: bazenNaziv.trim() || null,
        tip_lokacije: tipLokacije,
        datum_od: datumOd,
        datum_do: datumDo,
        broj_takmicarskih_dana: Number(takmicarskihDana),
        dnevna_tarifa_km: Number(dnevnaTarifaKm),
        honorar_nacin_placanja: honorarNacinPlacanja,
        nocenja_broj: Number(nocenjaBroj),
        nocenje_pokriva: nocenjePokriva,
        nocenje_cijena_km: Number(nocenjeCijena),
        kilometraza_km: Number(km),
        trosak_goriva_km: Number(gorivoKm),
        putarine_km: Number(putarineKm),
        put_pokriva: putPokriva,
        dnevnice_mjerioca_km: Number(dnevniceKm),
        dnevnice_pokriva: dnevnicePokriva,
        ugovoreni_pausal_km: Number(pausalKm),
        dodatni_kes_troskovi_km: Number(dodatniKesTroskoviKm),
        status: statusVal,
        napomena: napomenaCal.trim() || null,
        kreiraj_deal: kreirajDeal,
      };

      if (editingCalId) {
        payload.kalendar_id = editingCalId;
        const res = await fetch("/api/meets/kalendar", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Greška pri izmjeni.");
      } else {
        const res = await fetch("/api/meets/kalendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Greška pri čuvanju.");
      }

      setIsCalModalOpen(false);
      setEditingCalId(null);
      await loadCalendar();
      showNotice(editingCalId ? "Takmičenje izmijenjeno." : "Takmičenje dodato u kalendar.");
    } catch (err: any) {
      setError(err?.message || "Došlo je do greške.");
    } finally {
      setSavingCal(false);
    }
  };

  // Sezonski zbirovi
  const totalTakmicenjaCal = calendarItems.length;
  const totalFakturaCal = calendarItems.reduce((s, c) => s + calcBreakdown(c).fakturaIznos, 0);
  const totalKesCal = calendarItems.reduce((s, c) => s + calcBreakdown(c).kesIznos, 0);
  const totalNetoCal = calendarItems.reduce((s, c) => s + calcBreakdown(c).cistaZarada, 0);
  const totalBlokiranihDana = calendarItems.reduce((s, c) => s + (Number(c.ukupno_blokiranih_dana) || 0), 0);

  // Trenutni dinamički proračun u modalu za live preview
  const modalBreakdown = calcBreakdown({
    broj_takmicarskih_dana: takmicarskihDana,
    dnevna_tarifa_km: dnevnaTarifaKm,
    honorar_nacin_placanja: honorarNacinPlacanja,
    trosak_goriva_km: gorivoKm,
    putarine_km: putarineKm,
    put_pokriva: putPokriva,
    nocenja_broj: nocenjaBroj,
    nocenje_cijena_km: nocenjeCijena,
    nocenje_pokriva: nocenjePokriva,
    dnevnice_mjerioca_km: dnevniceKm,
    dnevnice_pokriva: dnevnicePokriva,
  });

  return (
    <div>
      {/* OBAVIJEST */}
      {notice && (
        <div style={{ padding: "10px 16px", marginBottom: 14, backgroundColor: "rgba(34, 197, 94, 0.15)", border: "1px solid #22c55e", borderRadius: 8, color: "#86efac", fontWeight: 700, fontSize: 13 }}>
          {notice}
        </div>
      )}

      {/* TABS HEADER */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={`btn ${activeTab === "KALENDAR" ? "btn--active" : ""}`}
            onClick={() => setActiveTab("KALENDAR")}
            style={activeTab === "KALENDAR" ? { background: "#0284c7", borderColor: "#0284c7", fontWeight: 700 } : {}}
          >
            📅 Kalendar sezone & Planer ({calendarItems.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "PROJEKTI" ? "btn--active" : ""}`}
            onClick={() => setActiveTab("PROJEKTI")}
          >
            🏊 Projekti & Poslovi mjerenja ({initialProjects.length})
          </button>
        </div>

        {activeTab === "KALENDAR" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              className="input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ minWidth: 130, padding: "6px 12px", fontWeight: 700 }}
            >
              <option value={2025}>Sezona 2025.</option>
              <option value={2026}>Sezona 2026.</option>
              <option value={2027}>Sezona 2027.</option>
            </select>
            <button
              type="button"
              className="btn btn--active"
              onClick={openNewModal}
              style={{
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                borderColor: "#0284c7",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              + Dodaj u kalendar sezone
            </button>
          </div>
        )}
      </div>

      {activeTab === "KALENDAR" ? (
        <div>
          {/* SUMMARY KARTICE ZA KALENDAR SEZONE */}
          <div
            className="card"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                📅 Sezona {selectedYear}.
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#38bdf8" }}>
                {totalTakmicenjaCal} mitinga
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Blokirano: <b style={{ color: "#fbbf24" }}>{totalBlokiranihDana} dana</b>
              </div>
            </div>

            {totalFakturaCal > 0 && (
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  📄 Ukupno za žiralnu fakturu
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#60a5fa" }}>
                  {formatAmount(totalFakturaCal, locale)}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  Zvanični promet preko računa
                </div>
              </div>
            )}

            {totalKesCal > 0 && (
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  💵 Ukupno gotovina / keš na bazenu
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#4ade80" }}>
                  {formatAmount(totalKesCal, locale)}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  Isplate u gotovini na bazenu
                </div>
              </div>
            )}

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                🏆 Čista neto zarada sezone
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24" }}>
                {formatAmount(totalNetoCal, locale)}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Nakon troškova Studija
              </div>
            </div>
          </div>

          {/* TABELA KALENDARA */}
          <div className="card tableCard">
            <div className="table-wrap" style={{ overflowX: "hidden" }}>
              <table className="table" style={{ width: "100%", tableLayout: "auto" }}>
                <thead>
                  <tr>
                    <th style={{ width: 110, padding: "10px 8px" }}>Termin</th>
                    <th style={{ minWidth: 170, padding: "10px 8px" }}>Takmičenje & Naručilac</th>
                    <th style={{ width: 140, padding: "10px 8px" }}>Lokacija & Bazen</th>
                    <th style={{ padding: "10px 8px" }}>Logistika & Prevoz</th>
                    <th style={{ width: 150, textAlign: "right", padding: "10px 8px", whiteSpace: "nowrap" }}>Iznos za naplatu</th>
                    <th style={{ width: 95, textAlign: "right", padding: "10px 8px", whiteSpace: "nowrap" }}>Zarada Studija</th>
                    <th style={{ width: 90, textAlign: "center", padding: "10px 6px", whiteSpace: "nowrap" }}>Status</th>
                    <th style={{ width: 140, textAlign: "center", padding: "10px 6px", whiteSpace: "nowrap" }}>Akcija naplate</th>
                  </tr>
                </thead>
                <tbody>
                  {calendarItems.length ? (
                    calendarItems.map((c) => {
                      const bd = calcBreakdown(c);

                      return (
                        <tr key={c.kalendar_id}>
                          <td style={{ padding: "10px 8px" }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{fmtDate(c.datum_od)}</div>
                            {c.datum_do !== c.datum_od && (
                              <div className="subtle" style={{ fontSize: 11 }}>do {fmtDate(c.datum_do)}</div>
                            )}
                            <div style={{ marginTop: 4 }}>
                              <span className="badge badge-orange" style={{ fontSize: 10, whiteSpace: "nowrap" }} title="Ukupno blokiranih dana sa putem i pripremom">
                                🛑 {c.ukupno_blokiranih_dana}d blok.
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: "10px 8px", whiteSpace: "normal", wordBreak: "break-word" }}>
                            <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.3 }}>{c.naziv_takmicenja}</div>
                            <div className="subtle" style={{ fontSize: 12, marginTop: 2 }}>{c.klub_savez_naziv || "Plivački savez / Klub"}</div>
                            
                            {/* STATUS DEALA / PROJEKTA */}
                            <div style={{ marginTop: 4, display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                              {c.inicijacija_id ? (
                                <Link
                                  href={`/inicijacije/${c.inicijacija_id}`}
                                  className="badge badge-blue"
                                  style={{ fontSize: 10, textDecoration: "none", cursor: "pointer" }}
                                  title="Otvori pregovore (Deal)"
                                >
                                  📋 Deal #{c.inicijacija_id}
                                </Link>
                              ) : null}

                              {c.projekat_id ? (
                                <Link
                                  href={`/projects/${c.projekat_id}`}
                                  className="badge badge-green"
                                  style={{ fontSize: 10, textDecoration: "none", cursor: "pointer" }}
                                  title="Otvori posao / projekat"
                                >
                                  📊 Posao #{c.projekat_id}
                                </Link>
                              ) : null}

                              {c.broj_fakture && (
                                <span className="badge badge-blue" style={{ fontSize: 10 }}>
                                  📄 Faktura: {c.broj_fakture}
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: "10px 8px", whiteSpace: "normal", wordBreak: "break-word" }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>📍 {c.lokacija_grad}</div>
                            {c.bazen_naziv && (
                              <div className="subtle" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.25 }}>{c.bazen_naziv}</div>
                            )}
                            <div style={{ marginTop: 4 }}>
                              {c.tip_lokacije === "DOMACI" && (
                                <span className="badge badge-green" style={{ fontSize: 10 }}>🏠 Domaći (GOB)</span>
                              )}
                              {c.tip_lokacije === "TEREN_DALEKO" && (
                                <span className="badge badge-red" style={{ fontSize: 10 }}>🚗 Daleki put</span>
                              )}
                              {c.tip_lokacije === "TEREN_BLIZU" && (
                                <span className="badge badge-orange" style={{ fontSize: 10 }}>🚗 Teren</span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: "10px 8px", whiteSpace: "normal", wordBreak: "break-word" }}>
                            <div style={{ fontSize: 12, lineHeight: 1.35 }}>
                              {c.tip_lokacije !== "DOMACI" ? (
                                <>
                                  <div style={{ whiteSpace: "normal", wordBreak: "break-word", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                    <span>⛽ <b>{c.kilometraza_km} km</b> (~{formatAmount(c.trosak_goriva_km, locale)} gorivo)</span>
                                    {c.put_pokriva === "ORGANIZATOR_KES" && (
                                      <span className="badge badge-green" style={{ fontSize: 9 }}>🟢 Put plaća organizator (keš)</span>
                                    )}
                                    {c.put_pokriva === "STUDIO_TAF" && (
                                      <span className="badge badge-red" style={{ fontSize: 9 }}>🔴 Trošak Studija</span>
                                    )}
                                    {c.put_pokriva === "ORGANIZATOR_DIREKTNO" && (
                                      <span className="badge badge-green" style={{ fontSize: 9 }}>🟢 Prevoz organizatora</span>
                                    )}
                                    {c.put_pokriva === "ORGANIZATOR_FAKTURA" && (
                                      <span className="badge badge-blue" style={{ fontSize: 9 }}>📄 Put na fakturi</span>
                                    )}
                                  </div>
                                  <div style={{ whiteSpace: "normal", marginTop: 2 }}>
                                    🛌 <b>{c.nocenja_broj} noći</b> ({c.nocenje_pokriva === "ORGANIZATOR" ? "Hotel organizator" : c.nocenje_pokriva === "STUDIO_TAF" ? "Plaća Studio" : "Bez noćenja"})
                                  </div>
                                </>
                              ) : (
                                <div className="subtle">0 km putovanja · Domaći bazen</div>
                              )}
                              {c.napomena && (
                                <div
                                  className="subtle"
                                  style={{
                                    marginTop: 4,
                                    fontStyle: "italic",
                                    fontSize: 11,
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                    overflowWrap: "anywhere",
                                    lineHeight: 1.35,
                                    color: "var(--muted, #a1a1aa)",
                                  }}
                                >
                                  💬 {c.napomena}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* JEDNOSTAVAN I ČIST PRIKAZ ZA NAPLATU */}
                          <td style={{ textAlign: "right", padding: "10px 8px", whiteSpace: "nowrap" }}>
                            {bd.model === "KES" && (
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: "#4ade80" }}>
                                  💵 {formatAmount(bd.kesIznos, locale)}
                                </div>
                                <div className="subtle" style={{ fontSize: 10 }}>
                                  gotovina na ruke ({c.broj_takmicarskih_dana}d × {c.dnevna_tarifa_km || 500} KM {bd.putIznos > 0 ? `+ ${bd.putIznos} KM put` : ""})
                                </div>
                              </div>
                            )}

                            {bd.model === "FAKTURA" && (
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: "#60a5fa" }}>
                                  📄 {formatAmount(bd.fakturaIznos, locale)}
                                </div>
                                <div className="subtle" style={{ fontSize: 10 }}>
                                  žiralna faktura ({c.broj_takmicarskih_dana}d × {c.dnevna_tarifa_km || 500} KM + PDV)
                                </div>
                              </div>
                            )}

                            {bd.model === "HIBRID" && (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa" }}>
                                  📄 Faktura: {formatAmount(bd.fakturaIznos, locale)}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginTop: 2 }}>
                                  💵 Keš put: {formatAmount(bd.kesIznos, locale)}
                                </div>
                                <div className="subtle" style={{ fontSize: 10, marginTop: 2 }}>
                                  Ukupno: <b>{formatAmount(bd.ukupnoZaNaplatu, locale)}</b>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* ČISTA ZARADA STUDIJA */}
                          <td style={{ textAlign: "right", fontWeight: 800, color: "#fbbf24", padding: "10px 8px", whiteSpace: "nowrap" }}>
                            {formatAmount(bd.cistaZarada, locale)}
                          </td>

                          {/* STATUS */}
                          <td style={{ textAlign: "center", padding: "10px 6px" }}>
                            <span
                              className={`badge ${
                                c.status === "NAPLACENO"
                                  ? "badge-green"
                                  : c.status === "FAKTURISANO"
                                  ? "badge-blue"
                                  : "badge-orange"
                              }`}
                              style={{ fontSize: 10, whiteSpace: "nowrap" }}
                            >
                              {c.status}
                            </span>
                          </td>

                          {/* AKCIJE NAPLATE: FAKTURISANJE ILI KEŠ */}
                          <td style={{ textAlign: "center", padding: "10px 4px", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center" }}>
                              {/* Ako ima fakturu, taster Fakturiši */}
                              {bd.fakturaIznos > 0 && !c.broj_fakture && c.status !== "NAPLACENO" && (
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => handleSendToInvoice(c)}
                                  style={{ padding: "4px 8px", fontSize: 11, background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", borderColor: "rgba(59, 130, 246, 0.4)", fontWeight: 700 }}
                                  title="Kreiraj fakturu za virman"
                                >
                                  📄 Fakturiši ({formatAmount(bd.fakturaIznos, locale)})
                                </button>
                              )}

                              {/* Ako je keš, taster Keš u blagajnu sa tačnim punim iznosom */}
                              {bd.kesIznos > 0 && c.status !== "NAPLACENO" && (
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => openCashModal(c)}
                                  style={{ padding: "4px 8px", fontSize: 11, background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", borderColor: "rgba(34, 197, 94, 0.4)", fontWeight: 700 }}
                                  title="Evidentiraj naplatu gotovine u blagajnu"
                                >
                                  💵 Keš ({formatAmount(bd.kesIznos, locale)})
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn"
                                onClick={() => openEditModal(c)}
                                style={{ padding: "4px 7px", fontSize: 11 }}
                                title="Koriguj takmičenje"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className="btn"
                                onClick={() => handleDeleteCalendarItem(c.kalendar_id, c.naziv_takmicenja)}
                                style={{ padding: "4px 7px", fontSize: 11, color: "#f87171", borderColor: "rgba(248, 113, 113, 0.3)" }}
                                title="Ukloni iz kalendara"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="subtle" style={{ padding: 24, textAlign: "center" }}>
                        Nema unesenih takmičenja za {selectedYear}. godinu. Kliknite na <b>"+ Dodaj u kalendar sezone"</b> za unos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* TAB PROJEKTI */
        <div>
          <div className="card tableCard">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Datum</th>
                    <th>Takmičenje / Miting</th>
                    <th>Klub / Savez (Naručilac)</th>
                    <th style={{ width: 140, textAlign: "right" }}>Ugovoreni paušal</th>
                    <th style={{ width: 140, textAlign: "right" }}>Troškovi</th>
                    <th style={{ width: 140, textAlign: "right" }}>Neto dobit</th>
                    <th style={{ width: 130, textAlign: "center" }}>Faktura</th>
                    <th style={{ width: 130, textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {initialProjects.map((p) => (
                    <tr key={p.projekat_id}>
                      <td>{fmtDate(p.datum_pocetka)}</td>
                      <td>
                        <Link href={`/projects/${p.projekat_id}`} style={{ fontWeight: 700, color: "var(--accent)" }}>
                          {p.naziv_projekta}
                        </Link>
                      </td>
                      <td>{p.naziv_klijenta || "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {formatAmount(p.budzet_km, locale)}
                      </td>
                      <td style={{ textAlign: "right", color: "#f87171" }}>
                        {formatAmount(p.ukupno_troskovi_km, locale)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "#4ade80" }}>
                        {formatAmount((Number(p.budzet_km) || 0) - (Number(p.ukupno_troskovi_km) || 0), locale)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {p.broj_fakture ? (
                          <span className="badge badge-blue">{p.broj_fakture}</span>
                        ) : (
                          <span className="subtle" style={{ fontSize: 11 }}>Nije izdata</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="badge badge-green" style={{ fontSize: 11 }}>
                          {p.status_name || "Aktivno"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ZA UNOS I KOREKCIJU U KALENDARU SEZONE */}
      {isCalModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
          onClick={() => !savingCal && setIsCalModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "var(--panel, #18181b)",
              border: "1px solid var(--border, #27272a)",
              borderRadius: 14,
              width: "calc(100vw - 48px)",
              maxWidth: 1380,
              padding: "16px 24px",
              color: "var(--text, #f4f4f5)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
              maxHeight: "94vh",
              overflowX: "hidden",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>📅</span>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  {editingCalId ? "Koriguj takmičenje u kalendaru" : `Dodaj takmičenje u kalendar (${selectedYear}. godina)`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCalModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--muted, #a1a1aa)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* BRZI PRESETOVI */}
            <div style={{ marginBottom: 12, background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>Brzi predlošci aranžmana:</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" className="btn" style={{ padding: "4px 10px", fontSize: 11, background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.4)" }} onClick={() => applyPreset("TREBINJE_GKVS")}>
                  🏊 GKVS Leotar (1 dan, sve u kešu 660 KM na bazenu)
                </button>
                <button type="button" className="btn" style={{ padding: "4px 10px", fontSize: 11, background: "rgba(2, 132, 199, 0.15)", color: "#38bdf8", borderColor: "rgba(2, 132, 199, 0.4)" }} onClick={() => applyPreset("TREBINJE_PK")}>
                  🏊 PK Leotar (2 dana, virman 1.000 KM + gorivo 180 KM u kešu)
                </button>
                <button type="button" className="btn" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => applyPreset("BANJALUKA")}>
                  🏠 Banja Luka (GOB / BL Open - 2 dana, sve žiralno)
                </button>
                <button type="button" className="btn" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => applyPreset("SARAJEVO")}>
                  📍 Sarajevo (Otoka - 2 dana)
                </button>
                <button type="button" className="btn" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => applyPreset("MOSTAR")}>
                  📍 Mostar (2 dana)
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveCalendarItem} style={{ display: "grid", gap: 10, width: "100%", overflowX: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1.15fr)", gap: 20, width: "100%" }}>
                
                {/* LIJEVA KOLONA: Osnovni podaci, Naručilac & Ugovoreni honorar mjerenja */}
                <div style={{ display: "grid", gap: 8 }}>
                  <div>
                    <label className="label" style={{ display: "block", marginBottom: 3, fontSize: 12 }}>Naziv takmičenja / Mitinga:</label>
                    <input
                      className="input"
                      value={nazivTakmicenja}
                      onChange={(e) => setNazivTakmicenja(e.target.value)}
                      placeholder="npr. Međunarodni plivački miting Trebinje 2026"
                      required
                      style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
                    />
                  </div>

                  <div>
                    <label className="label" style={{ display: "block", marginBottom: 3, fontSize: 12 }}>Klub / Savez (Naručilac koji plaća):</label>
                    <select className="input" value={klubId} onChange={(e) => setKlubId(e.target.value)} style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}>
                      <option value="">— Odaberi naručioca —</option>
                      {klijenti.map((k) => (
                        <option key={k.klijent_id} value={k.klijent_id}>{k.naziv_klijenta}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label className="label" style={{ display: "block", marginBottom: 3, fontSize: 12 }}>Grad / Lokacija:</label>
                      <input className="input" value={lokacijaGrad} onChange={(e) => setLokacijaGrad(e.target.value)} required style={{ width: "100%", padding: "6px 10px", fontSize: 13 }} />
                    </div>
                    <div>
                      <label className="label" style={{ display: "block", marginBottom: 3, fontSize: 12 }}>Bazen:</label>
                      <input className="input" value={bazenNaziv} onChange={(e) => setBazenNaziv(e.target.value)} placeholder="Naziv bazena" style={{ width: "100%", padding: "6px 10px", fontSize: 13 }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    <div>
                      <label className="label" style={{ display: "block", marginBottom: 3, fontSize: 12 }}>Datum od:</label>
                      <input type="date" className="input" value={datumOd} onChange={(e) => setDatumOd(e.target.value)} required style={{ width: "100%", minWidth: 0, padding: "6px 6px", fontSize: 12 }} />
                    </div>
                    <div>
                      <label className="label" style={{ display: "block", marginBottom: 3, fontSize: 12 }}>Datum do:</label>
                      <input type="date" className="input" value={datumDo} onChange={(e) => setDatumDo(e.target.value)} required style={{ width: "100%", minWidth: 0, padding: "6px 6px", fontSize: 12 }} />
                    </div>
                  </div>

                  {/* OBRAČUN HONORARA & NAČIN PLAĆANJA */}
                  <div style={{ background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#60a5fa" }}>
                        ⏱️ Ugovorena tarifa i honorar mjerenja
                      </div>
                      <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: honorarNacinPlacanja === "FAKTURA" ? "#60a5fa" : "#a1a1aa", fontWeight: honorarNacinPlacanja === "FAKTURA" ? 700 : 400 }}>
                          <input
                            type="radio"
                            name="honorarNacin"
                            checked={honorarNacinPlacanja === "FAKTURA"}
                            onChange={() => setHonorarNacinPlacanja("FAKTURA")}
                          />
                          📄 Žiralna faktura
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: honorarNacinPlacanja === "KES" ? "#4ade80" : "#a1a1aa", fontWeight: honorarNacinPlacanja === "KES" ? 700 : 400 }}>
                          <input
                            type="radio"
                            name="honorarNacin"
                            checked={honorarNacinPlacanja === "KES"}
                            onChange={() => setHonorarNacinPlacanja("KES")}
                          />
                          💵 Keš na bazenu (na ruke)
                        </label>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                      <div>
                        <label className="muted" style={{ display: "block", marginBottom: 2, fontSize: 11 }}>Dnevna tarifa (KM/dan):</label>
                        <input
                          type="number"
                          className="input"
                          value={dnevnaTarifaKm}
                          onChange={(e) => handleTarifaOrDaysChange(takmicarskihDana, Number(e.target.value))}
                          style={{ width: "100%", minWidth: 0, padding: "5px 6px", fontSize: 13, fontWeight: 700 }}
                        />
                      </div>
                      <div>
                        <label className="muted" style={{ display: "block", marginBottom: 2, fontSize: 11 }}>Dani na bazenu:</label>
                        <input
                          type="number"
                          className="input"
                          min={1}
                          max={7}
                          value={takmicarskihDana}
                          onChange={(e) => handleTarifaOrDaysChange(Number(e.target.value), dnevnaTarifaKm)}
                          style={{ width: "100%", minWidth: 0, padding: "5px 6px", fontSize: 13, fontWeight: 700 }}
                        />
                      </div>
                      <div>
                        <label className="muted" style={{ display: "block", marginBottom: 2, fontSize: 11 }}>Honorar rada (KM):</label>
                        <input
                          type="number"
                          className="input"
                          value={pausalKm}
                          onChange={(e) => setPausalKm(Number(e.target.value))}
                          required
                          style={{ width: "100%", minWidth: 0, padding: "5px 6px", fontSize: 14, fontWeight: 800, color: "#4ade80" }}
                        />
                      </div>
                    </div>
                    <div className="subtle" style={{ fontSize: 10, marginTop: 4 }}>
                      💡 {takmicarskihDana} dana × {dnevnaTarifaKm} KM = <b>{pausalKm} KM</b> ({honorarNacinPlacanja === "FAKTURA" ? "ide na zvaničnu žiralnu fakturu + PDV" : "naplaćuje se u gotovini na bazenu"}).
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, alignItems: "center" }}>
                    <div>
                      <label className="label" style={{ display: "block", marginBottom: 3, fontSize: 12 }}>Status takmičenja:</label>
                      <select className="input" value={statusVal} onChange={(e) => setStatusVal(e.target.value as any)} style={{ width: "100%", minWidth: 0, padding: "6px 8px", fontSize: 12 }}>
                        <option value="PLANIRANO">PLANIRANO</option>
                        <option value="POTVRDJENO">POTVRĐENO</option>
                        <option value="U_TOKU">U TOKU</option>
                        <option value="ODRZANO">ODRŽANO</option>
                        <option value="OBRADJENO">OBRAĐENO</option>
                        <option value="FAKTURISANO">FAKTURISANO</option>
                        <option value="NAPLACENO">NAPLAĆENO</option>
                      </select>
                    </div>

                    {!editingCalId && (
                      <div style={{ paddingTop: 14 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#60a5fa" }}>
                          <input
                            type="checkbox"
                            checked={kreirajDeal}
                            onChange={(e) => setKreirajDeal(e.target.checked)}
                            style={{ width: 15, height: 15 }}
                          />
                          <span>Kreiraj Deal u pregovorima</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* DESNA KOLONA: Logistika, Troškovi puta & Ko snosi troškove */}
                <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#38bdf8" }}>
                      🚗 Logistika, Put & Podjela troškova
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div>
                        <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>Tip lokacije:</label>
                        <select className="input" value={tipLokacije} onChange={(e) => setTipLokacije(e.target.value as any)} style={{ width: "100%", minWidth: 0, padding: "5px 6px", fontSize: 12 }}>
                          <option value="DOMACI">🏠 Domaći (Banja Luka)</option>
                          <option value="TEREN_DALEKO">🚗 Daleki put (Trebinje...)</option>
                          <option value="TEREN_BLIZU">🚗 Teren u blizini</option>
                        </select>
                      </div>
                      <div>
                        <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>Kilometraža (ukupno):</label>
                        <input type="number" className="input" value={km} onChange={(e) => setKm(Number(e.target.value))} style={{ width: "100%", minWidth: 0, padding: "5px 8px", fontSize: 12 }} />
                      </div>
                    </div>

                    {/* PUT: Gorivo, Putarine i Ko plaća put */}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, marginBottom: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.6fr", gap: 8 }}>
                        <div>
                          <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>Gorivo (KM):</label>
                          <input type="number" className="input" value={gorivoKm} onChange={(e) => setGorivoKm(Number(e.target.value))} style={{ width: "100%", minWidth: 0, padding: "5px 6px", fontSize: 12 }} />
                        </div>
                        <div>
                          <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>Putarine (KM):</label>
                          <input type="number" className="input" value={putarineKm} onChange={(e) => setPutarineKm(Number(e.target.value))} style={{ width: "100%", minWidth: 0, padding: "5px 6px", fontSize: 12 }} />
                        </div>
                        <div>
                          <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 2, color: "#fbbf24" }}>Troškove puta snosi:</label>
                          <select className="input" value={putPokriva} onChange={(e) => setPutPokriva(e.target.value as any)} style={{ width: "100%", minWidth: 0, padding: "5px 6px", fontSize: 11, fontWeight: 700 }}>
                            <option value="ORGANIZATOR_KES">🟢 Organizator (keš na ruke / bonovi)</option>
                            <option value="ORGANIZATOR_DIREKTNO">🟢 Prevoz obezbjeđuje organizator</option>
                            <option value="ORGANIZATOR_FAKTURA">📄 Fakturiše se organizatoru</option>
                            <option value="STUDIO_TAF">🔴 Snosi Studio TAF (trošak iz džepa)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* SMJEŠTAJ */}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, marginBottom: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr 1fr", gap: 8 }}>
                        <div>
                          <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>Noćenja (noći):</label>
                          <input type="number" className="input" min={0} value={nocenjaBroj} onChange={(e) => setNocenjaBroj(Number(e.target.value))} style={{ width: "100%", minWidth: 0, padding: "5px 6px", fontSize: 12 }} />
                        </div>
                        <div>
                          <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>Smještaj pokriva:</label>
                          <select className="input" value={nocenjePokriva} onChange={(e) => setNocenjePokriva(e.target.value as any)} style={{ width: "100%", minWidth: 0, padding: "5px 6px", fontSize: 11 }}>
                            <option value="ORGANIZATOR">🟢 Obezbjeđuje i plaća organizator (hotel)</option>
                            <option value="ORGANIZATOR_KES">🟢 Organizator isplaćuje u kešu</option>
                            <option value="ORGANIZATOR_FAKTURA">📄 Fakturiše se organizatoru</option>
                            <option value="STUDIO_TAF">🔴 Plaća Studio TAF</option>
                            <option value="BEZ_NOCENJA">Bez noćenja</option>
                          </select>
                        </div>
                        <div>
                          <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>Cijena/noć (KM):</label>
                          <input type="number" className="input" value={nocenjeCijena} onChange={(e) => setNocenjeCijena(Number(e.target.value))} disabled={nocenjePokriva === "ORGANIZATOR" || nocenjePokriva === "BEZ_NOCENJA"} style={{ width: "100%", minWidth: 0, padding: "5px 6px", fontSize: 12 }} />
                        </div>
                      </div>
                    </div>

                    {/* DNEVNICE / HRANA */}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                        <div>
                          <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>Dnevnice/Hrana (KM):</label>
                          <input type="number" className="input" value={dnevniceKm} onChange={(e) => setDnevniceKm(Number(e.target.value))} style={{ width: "100%", minWidth: 0, padding: "5px 6px", fontSize: 12 }} />
                        </div>
                        <div>
                          <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>Hranu i dnevnice snosi:</label>
                          <select className="input" value={dnevnicePokriva} onChange={(e) => setDnevnicePokriva(e.target.value as any)} style={{ width: "100%", minWidth: 0, padding: "5px 6px", fontSize: 11 }}>
                            <option value="ORGANIZATOR">🟢 Obezbjeđuje organizator (hrana / keš)</option>
                            <option value="ORGANIZATOR_KES">🟢 Organizator isplaćuje u kešu</option>
                            <option value="ORGANIZATOR_FAKTURA">📄 Fakturiše se organizatoru</option>
                            <option value="STUDIO_TAF">🔴 Isplaćuje Studio TAF</option>
                            <option value="BEZ_DNEVNICA">Bez dnevnica</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* JASNA REKAPITULACIJA BEZ ZBUNJUJUĆIH POLJA */}
                  <div style={{ background: "rgba(30, 41, 59, 0.8)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: 10, padding: "12px 16px" }}>
                    {modalBreakdown.model === "KES" && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                        <div>
                          <span className="muted" style={{ fontSize: 11, display: "block" }}>💵 UKUPNO ZA NAPLATU U GOTOVINI NA BAZENU:</span>
                          <div style={{ fontSize: 20, fontWeight: 900, color: "#4ade80" }}>
                            {formatAmount(modalBreakdown.kesIznos, locale)}
                          </div>
                          <div className="subtle" style={{ fontSize: 11, marginTop: 2 }}>
                            {takmicarskihDana}d × {dnevnaTarifaKm} KM honorar ({pausalKm} KM) {modalBreakdown.putIznos > 0 ? `+ ${modalBreakdown.putIznos} KM troškovi puta` : ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span className="muted" style={{ fontSize: 11, display: "block" }}>🏆 Čista zarada Studija:</span>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24" }}>
                            {formatAmount(modalBreakdown.cistaZarada, locale)}
                          </div>
                          <div className="subtle" style={{ fontSize: 10, color: "#86efac" }}>0 KM trošak iz džepa</div>
                        </div>
                      </div>
                    )}

                    {modalBreakdown.model === "FAKTURA" && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                        <div>
                          <span className="muted" style={{ fontSize: 11, display: "block" }}>📄 UKUPNO ZA ŽIRALNU FAKTURU (VIRMAN):</span>
                          <div style={{ fontSize: 20, fontWeight: 900, color: "#60a5fa" }}>
                            {formatAmount(modalBreakdown.fakturaIznos, locale)} <span style={{ fontSize: 12, fontWeight: 600 }}>+ PDV</span>
                          </div>
                          <div className="subtle" style={{ fontSize: 11, marginTop: 2 }}>
                            {takmicarskihDana}d × {dnevnaTarifaKm} KM honorar {modalBreakdown.fakturaIznos > pausalKm ? `+ ${(modalBreakdown.fakturaIznos - pausalKm).toFixed(2)} KM fakturisani troškovi` : ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span className="muted" style={{ fontSize: 11, display: "block" }}>🏆 Čista zarada Studija:</span>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24" }}>
                            {formatAmount(modalBreakdown.cistaZarada, locale)}
                          </div>
                          <div className="subtle" style={{ fontSize: 10, color: "#86efac" }}>0 KM trošak iz džepa</div>
                        </div>
                      </div>
                    )}

                    {modalBreakdown.model === "HIBRID" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, alignItems: "center" }}>
                        <div>
                          <span className="muted" style={{ fontSize: 11, display: "block" }}>📄 Žiralna faktura:</span>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#60a5fa" }}>
                            {formatAmount(modalBreakdown.fakturaIznos, locale)}
                          </div>
                          <div className="subtle" style={{ fontSize: 10 }}>mjerenje (+ PDV)</div>
                        </div>
                        <div>
                          <span className="muted" style={{ fontSize: 11, display: "block" }}>💵 Gotovina na bazenu:</span>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#4ade80" }}>
                            {formatAmount(modalBreakdown.kesIznos, locale)}
                          </div>
                          <div className="subtle" style={{ fontSize: 10 }}>isplata za put/gorivo</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span className="muted" style={{ fontSize: 11, display: "block" }}>🏆 Čista zarada:</span>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24" }}>
                            {formatAmount(modalBreakdown.cistaZarada, locale)}
                          </div>
                          <div className="subtle" style={{ fontSize: 10 }}>Ukupno od kluba: <b>{formatAmount(modalBreakdown.ukupnoZaNaplatu, locale)}</b></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="label" style={{ display: "block", marginBottom: 2, fontSize: 11 }}>Logistička napomena (plan puta & aranžman):</label>
                    <textarea className="input" rows={2} value={napomenaCal} onChange={(e) => setNapomenaCal(e.target.value)} style={{ width: "100%", minWidth: 0, fontSize: 11, padding: "4px 8px" }} />
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ padding: 8, backgroundColor: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: 6, color: "#fca5a5", fontSize: 12 }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button type="button" className="btn" onClick={() => setIsCalModalOpen(false)} disabled={savingCal} style={{ padding: "6px 14px" }}>
                  Odustani
                </button>
                <button
                  type="submit"
                  className="btn btn--active"
                  disabled={savingCal}
                  style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", borderColor: "#0284c7", color: "#fff", fontWeight: 700, padding: "6px 18px" }}
                >
                  {savingCal ? "Čuvanje..." : editingCalId ? "Sačuvaj izmjene" : "Upiši u kalendar sezone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ZA BRZI UNOS KEŠ UPLATE U BLAGAJNU (npr. GKVS Leotar na bazenu) */}
      {cashModalItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => !cashSaving && setCashModalItem(null)}
        >
          <div
            style={{
              backgroundColor: "var(--panel, #18181b)",
              border: "1px solid var(--border, #27272a)",
              borderRadius: 14,
              maxWidth: 480,
              width: "100%",
              padding: 20,
              color: "var(--text, #f4f4f5)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24 }}>💵</span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#4ade80" }}>
                  Evidentiraj keš uplatu u blagajnu
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCashModalItem(null)}
                style={{ background: "transparent", border: "none", color: "var(--muted, #a1a1aa)", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: "var(--muted, #a1a1aa)", marginBottom: 14, lineHeight: 1.4 }}>
              Evidencija gotovinske uplate za takmičenje <b>{cashModalItem.naziv_takmicenja}</b> ({cashModalItem.klub_savez_naziv || cashModalItem.lokacija_grad}). Novac se direktno dodaje u <b>Gotovinski trezor (Blagajna IN)</b>.
            </p>

            <form onSubmit={handleConfirmCashPayment} style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>Iznos keš uplate (KM):</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={cashIznos}
                  onChange={(e) => setCashIznos(Number(e.target.value))}
                  required
                  style={{ width: "100%", fontSize: 18, fontWeight: 800, color: "#4ade80", padding: "8px 12px" }}
                />
              </div>

              <div>
                <label className="label" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>Datum prijema gotovine:</label>
                <input
                  type="date"
                  className="input"
                  value={cashDatum}
                  onChange={(e) => setCashDatum(e.target.value)}
                  required
                  style={{ width: "100%", padding: "6px 10px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn" onClick={() => setCashModalItem(null)} disabled={cashSaving}>
                  Odustani
                </button>
                <button
                  type="submit"
                  className="btn btn--active"
                  disabled={cashSaving}
                  style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", borderColor: "#16a34a", color: "#fff", fontWeight: 700 }}
                >
                  {cashSaving ? "Upisujem..." : "Potvrdi prijem keša u blagajnu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
