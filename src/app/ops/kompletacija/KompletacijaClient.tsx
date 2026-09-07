"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  OpsJedinicaOpreme,
  OpsJedinicaZivot,
  OpsKlasaRizika,
  OpsKompletacija,
  OpsKompletacijaStavka,
  OpsPovratStanje,
  OpsRnPosao,
  OpsRnSpec,
} from "@/lib/ops/schema";

type RnRow = OpsRnPosao & { spec: OpsRnSpec[]; saas: string[] };

const ERR: Record<string, string> = {
  EVENT_REQUIRED: "Naziv KC je obavezan.",
  KLASA_REQUIRED: "Izaberi klasu rizika.",
  NARUCILAC_REQUIRED: "Naručilac mora biti klijent koji plaća, ne krajnji objekat.",
  KOD_REQUIRED: "Upiši ili skeniraj kod.",
  KOD_NOT_FOUND: "Taj kod ne postoji.",
  OSOBA_REQUIRED: "Ko skenira?",
  KOMPLETACIJA_REQUIRED: "Prvo otvori ili izaberi KC.",
  KOMPLETACIJA_ZATVORENA: "Taj KC je već zatvoren.",
  NIJE_U_MAGACINU: "Komad nije u M2.",
  NIJE_IZDATO: "Komad još nije izdat na KC.",
  NIJE_NA_TERENU: "Komad nije na terenu.",
  NIJE_NA_EVENTU: "Komad nije vezan za ovaj KC.",
  NIJE_NA_RAMP: "Komad nije na KC ovog naloga.",
  NIJE_U_SERVISU: "Komad nije u servisu.",
  UGRADJENO_NIJE_SKEN: "To je ugrađena komponenta, ne sklop.",
  OTPIS_ZATVOREN: "Otpisani komad se ne skenira.",
  OTPIS_SAMO_RADIONICA: "Otpis ide samo iz radionice, ne s rampe.",
  POVRAT_STANJE: "Izaberi stanje povrata.",
  NIJE_NA_SPEC_RN: "Ovaj komad nije na speci radnog naloga.",
  SPEC_RN_PUN: "Spec ovog naloga je već puna za tu šifru.",
  RN_POSAO_INVALID: "Radni nalog nije pronađen.",
  RN_POSAO_ZATVOREN: "Taj radni nalog je već razdužen.",
};

function fmtWhen(raw?: string | null) {
  if (!raw) return "—";
  const d = String(raw).replace("T", " ").slice(0, 16);
  return d;
}

export default function KompletacijaClient({
  initialEvents,
  naloziPosla,
  radnici,
  klijenti,
  projekti,
}: {
  initialEvents: OpsKompletacija[];
  naloziPosla: RnRow[];
  radnici: Array<{ radnik_id: number; naziv: string }>;
  klijenti: Array<{ klijent_id: number; naziv: string; is_narucilac?: number }>;
  projekti: Array<{
    projekat_id: number;
    naziv: string;
    narucilac_id?: number | null;
    narucilac_naziv?: string | null;
    krajnji_klijent_id?: number | null;
    krajnji_naziv?: string | null;
  }>;
}) {
  const narucioci = klijenti.filter((k) => Number(k.is_narucilac) === 1);
  const krajnjiKlijenti = klijenti.filter((k) => Number(k.is_narucilac) !== 1);
  const openRn = naloziPosla.filter(
    (r) => !["RAZDUZEN", "ZATVOREN"].includes(String(r.status || "").toUpperCase()),
  );
  const [events, setEvents] = useState(initialEvents);
  const [eventId, setEventId] = useState(
    String(initialEvents.find((e) => e.status !== "ZATVOREN")?.kompletacija_id ?? ""),
  );
  const [stavke, setStavke] = useState<OpsKompletacijaStavka[]>([]);
  const [rnId, setRnId] = useState(String(openRn[0]?.rn_posao_id ?? ""));
  const [eventNaziv, setEventNaziv] = useState("");
  const [klasa, setKlasa] = useState<OpsKlasaRizika>("OSTALO");
  const [objekat, setObjekat] = useState(openRn[0]?.objekat ?? "");
  const [klijentId, setKlijentId] = useState("");
  const [krajnjiId, setKrajnjiId] = useState("");
  const [projekatId, setProjekatId] = useState(String(openRn[0]?.projekat_id ?? ""));
  const [kod, setKod] = useState("");
  const [osobaId, setOsobaId] = useState("");
  const [osobaNaziv, setOsobaNaziv] = useState("");
  const [jedinica, setJedinica] = useState<OpsJedinicaOpreme | null>(null);
  const [zivot, setZivot] = useState<OpsJedinicaZivot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const osoba =
    radnici.find((r) => String(r.radnik_id) === osobaId)?.naziv || osobaNaziv;
  const activeEvent = events.find(
    (e) => String(e.kompletacija_id) === eventId,
  );
  const selectedRn = naloziPosla.find((r) => String(r.rn_posao_id) === rnId);
  const rampRn = naloziPosla.find(
    (r) => r.rn_posao_id === Number(activeEvent?.rn_posao_id || 0),
  );

  const nextAction = useMemo(() => {
    const s = jedinica?.stanje;
    if (s === "U_MAGACINU") return "IZDATO" as const;
    if (s === "IZDATO") return "UTOVAR" as const;
    if (s === "NA_TERENU" || s === "MONTAZA") return "POVRAT" as const;
    if (s === "SERVIS") return "SERVIS_GOTOVO" as const;
    return null;
  }, [jedinica]);

  function fail(code: string) {
    setError(ERR[code] || code);
  }

  function applyRn(id: string) {
    setRnId(id);
    const rn = naloziPosla.find((r) => String(r.rn_posao_id) === id);
    if (!rn) return;
    setProjekatId(String(rn.projekat_id));
    if (rn.objekat) setObjekat(rn.objekat);
    setEventNaziv(`${rn.broj}${rn.objekat ? ` · ${rn.objekat}` : ""}`);
    const job = projekti.find((p) => p.projekat_id === rn.projekat_id);
    if (job?.narucilac_id) setKlijentId(String(job.narucilac_id));
    if (job?.krajnji_klijent_id) setKrajnjiId(String(job.krajnji_klijent_id));
  }

  async function refreshEvents(id?: string) {
    const q = id ? `?id=${id}` : eventId ? `?id=${eventId}` : "";
    const res = await fetch(`/api/ops/kompletacija${q}`);
    const json = await res.json();
    if (json.ok) {
      setEvents(json.kompletacije ?? []);
      if (q) setStavke(json.stavke ?? []);
    }
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!rnId) {
      fail("RN_POSAO_INVALID");
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const rn = naloziPosla.find((r) => String(r.rn_posao_id) === rnId);
      const res = await fetch("/api/ops/kompletacija", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_naziv:
            eventNaziv ||
            `${rn?.broj ?? "KC"}${objekat ? ` · ${objekat}` : ""}`,
          klasa_rizika: klasa,
          objekat,
          rn_posao_id: Number(rnId),
          klijent_id: klijentId ? Number(klijentId) : null,
          klijent_naziv: narucioci.find((k) => String(k.klijent_id) === klijentId)
            ?.naziv,
          krajnji_klijent_id: krajnjiId ? Number(krajnjiId) : null,
          krajnji_klijent_naziv: krajnjiKlijenti.find(
            (k) => String(k.klijent_id) === krajnjiId,
          )?.naziv,
          projekat_id: projekatId ? Number(projekatId) : rn?.projekat_id ?? null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setEvents(json.kompletacije ?? []);
      setEventId(String(json.kompletacija_id));
      setStavke([]);
      setInfo(`KC ${json.broj} · ${rn?.broj ?? "RN"}`);
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(
        `/api/ops/kompletacija/sken?kod=${encodeURIComponent(kod)}`,
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setJedinica(json.jedinica);
      setZivot(json.zivot ?? []);
    } catch (err) {
      setJedinica(null);
      setZivot([]);
      fail(err instanceof Error ? err.message : String(err));
    }
  }

  async function act(
    akcija: NonNullable<typeof nextAction>,
    povrat?: OpsPovratStanje,
  ) {
    if (!osoba.trim()) {
      fail("OSOBA_REQUIRED");
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/ops/kompletacija/sken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kod: jedinica?.kod || kod,
          akcija,
          kompletacija_id: eventId ? Number(eventId) : null,
          osoba,
          povrat_stanje: povrat ?? null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setJedinica(json.jedinica);
      setZivot(json.zivot ?? []);
      setKod("");
      setInfo(`${json.jedinica.kod} → ${json.jedinica.stanje}`);
      await refreshEvents(eventId);
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function pickEvent(id: string) {
    setEventId(id);
    setError(null);
    if (!id) {
      setStavke([]);
      return;
    }
    const res = await fetch(`/api/ops/kompletacija?id=${id}`);
    const json = await res.json();
    if (json.ok) {
      setEvents(json.kompletacije ?? []);
      setStavke(json.stavke ?? []);
    }
  }

  useEffect(() => {
    if (eventId) void pickEvent(eventId);
    if (rnId) applyRn(rnId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const specVsLoaded = (rampRn?.spec ?? []).map((s) => {
    const loaded = stavke.filter(
      (x) =>
        x.sifra === s.sifra &&
        ["IZDATO", "UTOVAR", "MONTAZA", "NA_TERENU"].includes(x.faza),
    ).length;
    return { ...s, loaded };
  });

  return (
    <div>
      {error ? <p className="opsMsgErr">{error}</p> : null}
      {info ? <p className="opsMsgOk">{info}</p> : null}

      <form onSubmit={(e) => void createEvent(e)} style={{ marginBottom: 22 }}>
        <h3 style={{ margin: "0 0 10px" }}>Novi KC</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <select
            value={rnId}
            onChange={(e) => applyRn(e.target.value)}
            style={{ padding: 8, minWidth: 280 }}
            required
          >
            <option value="">— radni nalog —</option>
            {openRn.map((r) => (
              <option key={r.rn_posao_id} value={r.rn_posao_id}>
                {r.broj} · {r.projekat_naziv || `#${r.projekat_id}`}
                {r.objekat ? ` · ${r.objekat}` : ""} · {r.status}
              </option>
            ))}
          </select>
          <input
            placeholder="Naziv"
            value={eventNaziv}
            onChange={(e) => setEventNaziv(e.target.value)}
            style={{ padding: 8, minWidth: 200 }}
          />
          <select
            value={klasa}
            onChange={(e) => setKlasa(e.target.value as OpsKlasaRizika)}
            style={{ padding: 8 }}
          >
            <option value="OSTALO">Ostalo</option>
            <option value="POZORISTE">Pozorište</option>
            <option value="STADION">Stadion (teški)</option>
          </select>
          <input
            placeholder="Objekat"
            value={objekat}
            onChange={(e) => setObjekat(e.target.value)}
            style={{ padding: 8, minWidth: 160 }}
          />
          <select
            value={klijentId}
            onChange={(e) => setKlijentId(e.target.value)}
            style={{ padding: 8, minWidth: 180 }}
          >
            <option value="">— naručilac (plaća) —</option>
            {narucioci.map((k) => (
              <option key={k.klijent_id} value={k.klijent_id}>
                {k.naziv}
              </option>
            ))}
          </select>
          <button type="submit" className="btn" disabled={saving || !rnId}>
            Otvori KC
          </button>
        </div>
        {selectedRn?.spec.length ? (
          <p style={{ fontSize: 12, opacity: 0.75, margin: "8px 0 0" }}>
            Spec:{" "}
            {selectedRn.spec.map((s) => `${s.sifra}×${s.kolicina}`).join(", ")}
          </p>
        ) : null}
      </form>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          Aktivni KC
          <select
            value={eventId}
            onChange={(e) => void pickEvent(e.target.value)}
            style={{ padding: 8, minWidth: 320 }}
          >
            <option value="">— izaberi —</option>
            {events.map((ev) => (
              <option key={ev.kompletacija_id} value={ev.kompletacija_id}>
                {ev.broj} · {ev.event_naziv} · {ev.status}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          Ko skenira
          <select
            value={osobaId}
            onChange={(e) => setOsobaId(e.target.value)}
            style={{ padding: 8, minWidth: 200 }}
          >
            <option value="">— ručni unos —</option>
            {radnici.map((r) => (
              <option key={r.radnik_id} value={r.radnik_id}>
                {r.naziv}
              </option>
            ))}
          </select>
        </label>
        {!osobaId ? (
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Ime
            <input
              value={osobaNaziv}
              onChange={(e) => setOsobaNaziv(e.target.value)}
              style={{ padding: 8, minWidth: 160 }}
            />
          </label>
        ) : null}
      </div>
      {activeEvent ? (
        <p style={{ fontSize: 13, opacity: 0.8, marginTop: 0 }}>
          {activeEvent.klijent_naziv || "bez naručioca"}
          {activeEvent.krajnji_klijent_naziv
            ? ` → ${activeEvent.krajnji_klijent_naziv}`
            : activeEvent.objekat
              ? ` → ${activeEvent.objekat}`
              : ""}{" "}
          · {activeEvent.jedinica_count ?? stavke.length}
        </p>
      ) : null}
      {specVsLoaded.length ? (
        <p style={{ fontSize: 12, opacity: 0.8, marginTop: 0 }}>
          Spec:{" "}
          {specVsLoaded
            .map((s) => `${s.sifra} ${s.loaded}/${s.kolicina}`)
            .join(" · ")}
        </p>
      ) : null}

      <form onSubmit={(e) => void lookup(e)} style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px" }}>Sken</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={kod}
            onChange={(e) => setKod(e.target.value)}
            placeholder="TTS-ZONA-000001"
            autoFocus
            style={{ padding: 10, minWidth: 260, fontWeight: 700 }}
          />
          <button type="submit" className="btn">
            Nađi
          </button>
        </div>
      </form>

      {jedinica ? (
        <div
          style={{
            padding: 14,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--panel)",
            marginBottom: 18,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 18 }}>{jedinica.kod}</div>
          <div style={{ fontSize: 13, margin: "4px 0 10px" }}>
            {jedinica.sifra} · {jedinica.stanje}
            {jedinica.teski_eventi
              ? ` · teških eventa: ${jedinica.teski_eventi}`
              : ""}
          </div>
          {nextAction === "IZDATO" ? (
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={() => void act("IZDATO")}
            >
              Izdaj na KC
            </button>
          ) : null}
          {nextAction === "UTOVAR" ? (
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={() => void act("UTOVAR")}
            >
              Utovar
            </button>
          ) : null}
          {nextAction === "POVRAT" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(
                [
                  ["ISPRAVAN", "Ispravan → M2"],
                  ["OSTECEN", "Oštećen → servis"],
                  ["SERVIS", "Za servis"],
                ] as Array<[OpsPovratStanje, string]>
              ).map(([st, label]) => (
                <button
                  key={st}
                  type="button"
                  className="btn"
                  disabled={saving}
                  onClick={() => void act("POVRAT", st)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {nextAction === "SERVIS_GOTOVO" ? (
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={() => void act("SERVIS_GOTOVO")}
            >
              Vrati iz servisa u M2
            </button>
          ) : null}
        </div>
      ) : null}

      {zivot.length ? (
        <>
          <h3 style={{ margin: "0 0 8px" }}>Životna knjiga</h3>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              background: "var(--panel)",
              marginBottom: 24,
            }}
          >
            <thead>
              <tr>
                {["Kad", "Akcija", "KC", "Klasa", "Stanje", "Ko"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zivot.map((z) => (
                <tr key={z.zivot_id}>
                  <td style={{ padding: "8px 10px" }}>{fmtWhen(z.created_at)}</td>
                  <td style={{ padding: "8px 10px" }}>{z.akcija}</td>
                  <td style={{ padding: "8px 10px" }}>{z.event_naziv || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{z.klasa_rizika || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{z.povrat_stanje || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{z.osoba || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <h3 style={{ margin: "0 0 8px" }}>Komadi</h3>
      {stavke.length ? (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            background: "var(--panel)",
          }}
        >
          <thead>
            <tr>
              {["Kod", "Šifra", "Faza", "Povrat", "Izdao", "Utovar", "Vratio"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {stavke.map((s) => (
              <tr key={s.stavka_id}>
                <td style={{ padding: "8px 10px", fontWeight: 700 }}>{s.kod}</td>
                <td style={{ padding: "8px 10px" }}>{s.sifra}</td>
                <td style={{ padding: "8px 10px" }}>{s.faza}</td>
                <td style={{ padding: "8px 10px" }}>{s.povrat_stanje || "—"}</td>
                <td style={{ padding: "8px 10px" }}>{s.izdao_naziv || "—"}</td>
                <td style={{ padding: "8px 10px" }}>{s.montaza_naziv || "—"}</td>
                <td style={{ padding: "8px 10px" }}>{s.vratio_naziv || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          Nema skeniranih komada.
        </p>
      )}
    </div>
  );
}
