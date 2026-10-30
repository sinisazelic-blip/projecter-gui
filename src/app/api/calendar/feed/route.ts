import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatICalDate(dateStr: any, isAllDay = true): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());

  if (isAllDay) {
    return `${year}${month}${day}`;
  }

  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${year}${month}${day}T${hours}${mins}${secs}Z`;
}

function escapeICalText(str: string): string {
  return String(str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    // Token zaštita
    if (!token || token !== "fluxa_studio_cal") {
      return new NextResponse("Neautorizovan pristup iCal kalendaru", { status: 401 });
    }

    // 1. Projekti sa rokovima i datumima otvaranja
    const projects: any[] = await query(`
      SELECT 
        p.projekat_id,
        p.radni_naziv,
        p.rok_datum,
        p.datum_otvaranja,
        p.status_projekta,
        k.naziv as klijent_naziv
      FROM projekat p
      LEFT JOIN klijent k ON p.klijent_id = k.klijent_id
      WHERE p.status_projekta NOT IN ('ARHIVIRAN', 'STORNO')
      ORDER BY p.rok_datum DESC
      LIMIT 300
    `).catch(() => []);

    // 2. Takmičenja
    const meets: any[] = await query(`
      SELECT 
        meet_id,
        naziv_takmicenja,
        datum_od,
        datum_do,
        bazen_lokacija,
        grad
      FROM swim_meet
      ORDER BY datum_od DESC
      LIMIT 100
    `).catch(() => []);

    const nowStr = formatICalDate(new Date(), false);

    const ics: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Fluxa Cloud//Fluxa Studio Calendar//BS",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Fluxa Studio & Projekti",
      "X-WR-TIMEZONE:Europe/Sarajevo",
      "X-WR-CALDESC:Zvanični kalendar rokova, otvorenih projekata i takmičenja iz Fluxa sistema",
    ];

    // Mapiramo rokove projekata
    for (const p of projects) {
      if (p.rok_datum) {
        const dStart = formatICalDate(p.rok_datum, true);
        const nextDay = new Date(new Date(p.rok_datum).getTime() + 86400000);
        const dEnd = formatICalDate(nextDay, true);

        const summary = escapeICalText(`🚨 ROK: ${p.klijent_naziv ? p.klijent_naziv + ' - ' : ''}${p.radni_naziv}`);
        const desc = escapeICalText(`Rok za isporuku projekta #${p.projekat_id}. Klijent: ${p.klijent_naziv || '—'}. Status: ${p.status_projekta}`);

        ics.push(
          "BEGIN:VEVENT",
          `UID:fluxa-deadline-${p.projekat_id}@app.fluxa.ba`,
          `DTSTAMP:${nowStr}`,
          `DTSTART;VALUE=DATE:${dStart}`,
          `DTEND;VALUE=DATE:${dEnd}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${desc}`,
          "STATUS:CONFIRMED",
          "TRANSP:TRANSPARENT",
          "END:VEVENT"
        );
      }

      if (p.datum_otvaranja) {
        const dStart = formatICalDate(p.datum_otvaranja, true);
        const nextDay = new Date(new Date(p.datum_otvaranja).getTime() + 86400000);
        const dEnd = formatICalDate(nextDay, true);

        const summary = escapeICalText(`🎬 Otvoren: ${p.radni_naziv}`);
        const desc = escapeICalText(`Početak rada na projektu #${p.projekat_id} (${p.klijent_naziv || ''})`);

        ics.push(
          "BEGIN:VEVENT",
          `UID:fluxa-opened-${p.projekat_id}@app.fluxa.ba`,
          `DTSTAMP:${nowStr}`,
          `DTSTART;VALUE=DATE:${dStart}`,
          `DTEND;VALUE=DATE:${dEnd}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${desc}`,
          "STATUS:CONFIRMED",
          "TRANSP:TRANSPARENT",
          "END:VEVENT"
        );
      }
    }

    // Mapiramo takmičenja
    for (const m of meets) {
      if (m.datum_od) {
        const dStart = formatICalDate(m.datum_od, true);
        const endBase = m.datum_do || m.datum_od;
        const nextDay = new Date(new Date(endBase).getTime() + 86400000);
        const dEnd = formatICalDate(nextDay, true);

        const summary = escapeICalText(`🏊 ${m.naziv_takmicenja}`);
        const loc = escapeICalText([m.bazen_lokacija, m.grad].filter(Boolean).join(", "));

        ics.push(
          "BEGIN:VEVENT",
          `UID:fluxa-meet-${m.meet_id}@app.fluxa.ba`,
          `DTSTAMP:${nowStr}`,
          `DTSTART;VALUE=DATE:${dStart}`,
          `DTEND;VALUE=DATE:${dEnd}`,
          `SUMMARY:${summary}`,
          loc ? `LOCATION:${loc}` : "",
          `DESCRIPTION:${summary} - Elektronsko mjerenje SwissTiming/Omega`,
          "STATUS:CONFIRMED",
          "TRANSP:OPAQUE",
          "END:VEVENT"
        );
      }
    }

    ics.push("END:VCALENDAR");

    const icsContent = ics.filter(Boolean).join("\r\n");

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="fluxa-calendar.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    return new NextResponse("Greška pri generisanju iCal feed-a", { status: 500 });
  }
}
