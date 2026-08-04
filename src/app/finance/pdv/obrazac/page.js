import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { formatReportNum } from "@/lib/format";
import { getLastMonthRange, getPdvPrijavaData } from "@/lib/pdv-prijava";
import PdvObrazacActions from "./PdvObrazacActions";

export const dynamic = "force-dynamic";

const fmtDate = (s) => {
  if (!s || typeof s !== "string") return "—";
  const part = String(s).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return "—";
  const [y, m, d] = part.split("-");
  return `${d}.${m}.${y}`;
};

function FieldBox({ num, value, locale, wide }) {
  return (
    <span className={`pdvField ${wide ? "pdvField--wide" : ""}`}>
      <span className="pdvFieldNum">{num}</span>
      <span className="pdvFieldVal">{formatReportNum(value, locale)}</span>
    </span>
  );
}

export default async function PdvObrazacPage({ searchParams }) {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  const sp = await Promise.resolve(searchParams);
  const prosliMjesec = sp?.prosli_mjesec === "1" || sp?.prošli_mjesec === "1";
  let from = (sp?.from ?? "").trim();
  let to = (sp?.to ?? "").trim();
  if (prosliMjesec) {
    const range = getLastMonthRange();
    from = range.from;
    to = range.to;
  }
  // Obrazac uvijek iz kompletnog perioda (bez exclude_paid).
  const data = await getPdvPrijavaData(from || null, to || null, {
    excludePaidKif: false,
  });
  const { from: dataFrom, to: dataTo, obrazac: o, firma: f } = data;

  const naziv =
    String(f?.pravni_naziv || f?.naziv || "").trim() || "—";
  const adresa = String(f?.adresa || "").trim() || "—";
  const grad = String(f?.grad || "").trim() || "—";
  const jibDigits = String(f?.jib || "").replace(/\D/g, "");
  const jibDisplay = jibDigits || "—";
  const postanski = grad.match(/\b\d{5}\b/)?.[0] || "";
  const mjestoLinija = [postanski, grad.replace(/\b\d{5}\b/, "").trim()]
    .filter(Boolean)
    .join(" ");

  const backQs = new URLSearchParams();
  if (dataFrom) backQs.set("from", dataFrom);
  if (dataTo) backQs.set("to", dataTo);
  const backHref = `/finance/pdv${backQs.toString() ? `?${backQs}` : ""}`;

  const today = new Date();
  const datumIspisa = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

  return (
    <div className="pdvObrazacPage">
      <style>{`
        .pdvObrazacPage {
          min-height: 100vh;
          background: #1a1d24;
          padding: 20px 16px 48px;
        }
        .pdvObrazacToolbar {
          max-width: 820px;
          margin: 0 auto 16px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .pdvObrazacSheet {
          max-width: 820px;
          margin: 0 auto;
          background: #fff;
          color: #111;
          font-family: "Times New Roman", Times, serif;
          font-size: 13px;
          line-height: 1.35;
          padding: 28px 32px 36px;
          box-shadow: 0 8px 40px rgba(0,0,0,.35);
        }
        .pdvObrazacSheet * { box-sizing: border-box; }
        .pdvHead {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px 24px;
          border-bottom: 2px solid #111;
          padding-bottom: 12px;
          margin-bottom: 14px;
        }
        .pdvFormTitle {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.04em;
          margin: 0 0 4px;
        }
        .pdvFormSub {
          font-size: 12px;
          color: #333;
          margin: 0;
        }
        .pdvMetaRight {
          text-align: right;
          font-size: 12px;
        }
        .pdvMetaRight strong { display: block; font-size: 13px; margin-bottom: 4px; }
        .pdvIdRow {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 6px 12px;
          margin: 10px 0;
          align-items: baseline;
        }
        .pdvIdLabel { color: #333; font-size: 12px; }
        .pdvIdValue { font-weight: 700; letter-spacing: 0.08em; }
        .pdvSection {
          margin-top: 16px;
          border-top: 1px solid #111;
          padding-top: 10px;
        }
        .pdvSectionTitle {
          font-weight: 700;
          font-size: 13px;
          margin: 0 0 10px;
        }
        .pdvTwoCol {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 20px;
        }
        .pdvColTitle {
          font-weight: 700;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 8px;
          letter-spacing: 0.03em;
        }
        .pdvLine {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
          min-height: 28px;
          margin-bottom: 6px;
        }
        .pdvLineLabel { font-size: 12px; }
        .pdvField {
          display: inline-flex;
          align-items: stretch;
          border: 1px solid #111;
          min-width: 118px;
        }
        .pdvField--wide { min-width: 140px; }
        .pdvFieldNum {
          background: #eee;
          border-right: 1px solid #111;
          padding: 3px 6px;
          font-size: 11px;
          font-weight: 700;
          min-width: 22px;
          text-align: center;
        }
        .pdvFieldVal {
          padding: 3px 8px;
          text-align: right;
          font-variant-numeric: tabular-nums;
          flex: 1;
          min-width: 72px;
        }
        .pdvHighlight {
          background: #f5f5f5;
          border: 1px solid #111;
          padding: 10px 12px;
          margin-top: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .pdvHighlight .pdvField { background: #fff; }
        .pdvCheck {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }
        .pdvCheckBox {
          width: 18px;
          height: 18px;
          border: 1px solid #111;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }
        .pdvSign {
          margin-top: 28px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          font-size: 12px;
        }
        .pdvSignLine {
          border-top: 1px solid #111;
          margin-top: 36px;
          padding-top: 4px;
          color: #444;
        }
        .pdvNote {
          margin-top: 16px;
          font-size: 11px;
          color: #555;
          border-top: 1px dashed #999;
          padding-top: 10px;
        }
        @media print {
          body { background: #fff !important; }
          .pdvObrazacPage {
            background: #fff;
            padding: 0;
          }
          .no-print { display: none !important; }
          .pdvObrazacSheet {
            box-shadow: none;
            max-width: none;
            padding: 12mm 14mm;
          }
        }
        @media (max-width: 700px) {
          .pdvTwoCol { grid-template-columns: 1fr; }
          .pdvHead { grid-template-columns: 1fr; }
          .pdvMetaRight { text-align: left; }
        }
      `}</style>

      <PdvObrazacActions backHref={backHref} />

      <article className="pdvObrazacSheet">
        <header className="pdvHead">
          <div>
            <p className="pdvFormSub">Obrazac P PDV</p>
            <h1 className="pdvFormTitle">PDV PRIJAVA</h1>
          </div>
          <div className="pdvMetaRight">
            <strong>Period</strong>
            {fmtDate(dataFrom)} – {fmtDate(dataTo)}
            <div style={{ marginTop: 8 }}>
              <strong>Dostaviti do</strong>
              {fmtDate(o.rok_predaje)}
            </div>
            <div style={{ marginTop: 8 }}>
              <strong>Regionalni centar</strong>
              {grad !== "—" ? grad : "—"}
            </div>
          </div>
        </header>

        <div className="pdvIdRow">
          <span className="pdvIdLabel">1 Identifikacioni broj</span>
          <span className="pdvIdValue">{jibDisplay}</span>
        </div>
        <div className="pdvIdRow">
          <span className="pdvIdLabel">3 Naziv poreskog obveznika</span>
          <span>{naziv}</span>
        </div>
        <div className="pdvIdRow">
          <span className="pdvIdLabel">4 Adresa</span>
          <span>{adresa}</span>
        </div>
        <div className="pdvIdRow">
          <span className="pdvIdLabel">5 Poštanski broj / Mjesto</span>
          <span>{mjestoLinija || grad}</span>
        </div>

        <section className="pdvSection">
          <h2 className="pdvSectionTitle">
            I. Isporuke i nabavke (svi iznosi iskazani bez PDV-a)
          </h2>
          <div className="pdvTwoCol">
            <div>
              <div className="pdvColTitle">Izlazi</div>
              <div className="pdvLine">
                <span className="pdvLineLabel">
                  Isporuke (uključujući i one u vanposlovne svrhe) osim u poljima 12 i 13
                </span>
                <FieldBox num={11} value={o.f11} locale={locale} />
              </div>
              <div className="pdvLine">
                <span className="pdvLineLabel">Vrijednost izvoza</span>
                <FieldBox num={12} value={o.f12} locale={locale} />
              </div>
              <div className="pdvLine">
                <span className="pdvLineLabel">Isporuke oslobođene plaćanja PDV-a</span>
                <FieldBox num={13} value={o.f13} locale={locale} />
              </div>
            </div>
            <div>
              <div className="pdvColTitle">Ulazi</div>
              <div className="pdvLine">
                <span className="pdvLineLabel">
                  Sve nabavke osim onih u poljima 22 i 23
                </span>
                <FieldBox num={21} value={o.f21} locale={locale} />
              </div>
              <div className="pdvLine">
                <span className="pdvLineLabel">Vrijednost uvoza</span>
                <FieldBox num={22} value={o.f22} locale={locale} />
              </div>
              <div className="pdvLine">
                <span className="pdvLineLabel">Vrijednost nabavke od poljoprivrednika</span>
                <FieldBox num={23} value={o.f23} locale={locale} />
              </div>
            </div>
          </div>
        </section>

        <section className="pdvSection">
          <h2 className="pdvSectionTitle">II. Izlazni PDV / Ulazni PDV</h2>
          <div className="pdvTwoCol">
            <div>
              <div className="pdvLine">
                <span className="pdvLineLabel">
                  PDV obračunat na izlaze (dobra i usluge)
                </span>
                <FieldBox num={51} value={o.f51} locale={locale} />
              </div>
            </div>
            <div>
              <div className="pdvLine">
                <span className="pdvLineLabel">
                  PDV obračunat na ulaze od registrovanih obveznika osim u 42 i 43
                </span>
                <FieldBox num={41} value={o.f41} locale={locale} />
              </div>
              <div className="pdvLine">
                <span className="pdvLineLabel">PDV na uvoz</span>
                <FieldBox num={42} value={o.f42} locale={locale} />
              </div>
              <div className="pdvLine">
                <span className="pdvLineLabel">Paušalna naknada za poljoprivrednike</span>
                <FieldBox num={43} value={o.f43} locale={locale} />
              </div>
              <div className="pdvLine">
                <span className="pdvLineLabel">Ulazni PDV (ukupno)</span>
                <FieldBox num={61} value={o.f61} locale={locale} />
              </div>
            </div>
          </div>

          <div className="pdvHighlight">
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700 }}>
                Iznos PDV-a za uplatu / povrat
                <span style={{ fontWeight: 400, display: "block", fontSize: 11 }}>
                  Razlika polja 51 i 61
                </span>
              </span>
              <FieldBox num={71} value={o.f71} locale={locale} wide />
            </div>
            <div className="pdvCheck">
              <span className="pdvCheckBox">{o.f80_povrat ? "X" : ""}</span>
              <span>
                <strong>80</strong> Zahtjev za povrat — obilježite sa &apos;X&apos; samo ako tražite povrat
                (inače se pretplata prenosi u sljedeći mjesec)
              </span>
            </div>
          </div>
        </section>

        <section className="pdvSection">
          <h2 className="pdvSectionTitle">III. Podaci o krajnjoj potrošnji</h2>
          <p style={{ margin: "0 0 10px", fontSize: 12 }}>
            PDV na isporuke licima koji nisu registrovani PDV obveznici u:
          </p>
          <div className="pdvTwoCol">
            <div className="pdvLine">
              <span className="pdvLineLabel">Federaciji BiH</span>
              <FieldBox num={32} value={o.f32} locale={locale} />
            </div>
            <div className="pdvLine">
              <span className="pdvLineLabel">Republici Srpskoj</span>
              <FieldBox num={33} value={o.f33} locale={locale} />
            </div>
            <div className="pdvLine">
              <span className="pdvLineLabel">Brčko Distriktu</span>
              <FieldBox num={34} value={o.f34} locale={locale} />
            </div>
          </div>
        </section>

        <p style={{ marginTop: 20, fontSize: 12 }}>
          Ovim potvrđujem da su navedeni podaci tačni.
        </p>

        <div className="pdvSign">
          <div>
            <div>Mjesto: {grad !== "—" ? grad : "________________"}</div>
            <div style={{ marginTop: 8 }}>Datum: {datumIspisa}</div>
          </div>
          <div>
            <div>Ime i prezime odgovornog lica</div>
            <div className="pdvSignLine">Potpis</div>
          </div>
        </div>

        <p className="pdvNote">
          {t("pdv.obrazacNote")}
        </p>
      </article>
    </div>
  );
}
