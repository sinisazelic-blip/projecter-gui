// src/app/studio/firma/page.js
import Link from "next/link";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import LogoUpload from "./LogoUpload";
import FiskalModal from "./FiskalModal";
import BrojacFakturaCard from "./BrojacFakturaCard";
import FluxarBridgeCard from "./FluxarBridgeCard";
import FirmaHeader from "./FirmaHeader";
import FirmaSaveForm from "./FirmaSaveForm";
import FirmaTabsClient from "./FirmaTabsClient";
import { isEnterInstance } from "@/lib/fluxa-instance";

export const dynamic = "force-dynamic";

function pick(v) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

function accOrEmpty(accs, idx) {
  return (
    accs?.[idx] || {
      bank_naziv: "",
      bank_racun: "",
      iban: "",
      swift: "",
      show_on_invoice: 1,
      primary_rank: null,
    }
  );
}

function isMissingShowOnInvoiceColumn(err) {
  const msg = String(err?.message ?? err ?? "");
  return msg.includes("Unknown column") && msg.includes("show_on_invoice");
}

export default async function Page() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
  const t = getT(locale);

  const firmaRows = await query(
    `
    SELECT *
    FROM firma_profile
    WHERE is_active = 1
    ORDER BY firma_id DESC
    LIMIT 1
    `,
  );

  const f = firmaRows?.[0] || null;

  let accs = [];
  if (f?.firma_id) {
    try {
      accs = await query(
        `
        SELECT bank_account_id, bank_naziv, bank_racun, iban, swift, show_on_invoice, primary_rank
        FROM firma_bank_accounts
        WHERE firma_id = ?
        ORDER BY bank_account_id ASC
        `,
        [f.firma_id],
      );
    } catch (err) {
      if (!isMissingShowOnInvoiceColumn(err)) throw err;
      const legacyAccs = await query(
        `
        SELECT bank_account_id, bank_naziv, bank_racun, iban, swift, primary_rank
        FROM firma_bank_accounts
        WHERE firma_id = ?
        ORDER BY bank_account_id ASC
        `,
        [f.firma_id],
      );
      accs = Array.isArray(legacyAccs)
        ? legacyAccs.map((x) => ({ ...x, show_on_invoice: 1 }))
        : [];
    }
  }

  const a1 = accOrEmpty(accs, 0);
  const a2 = accOrEmpty(accs, 1);
  const a3 = accOrEmpty(accs, 2);

  // default primary: ako postoji primary_rank=1 na nekom, inače 1
  const primaryIdx =
    accs?.findIndex((x) => Number(x?.primary_rank) === 1) >= 0
      ? String(accs.findIndex((x) => Number(x?.primary_rank) === 1) + 1)
      : "1";

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: 12,
    outline: "none",
    width: "100%",
  };

  const labelStyle = { fontSize: 12, opacity: 0.75, marginBottom: 6 };
  const row2 = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  };
  const row3 = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  };

  return (
    <div className="container">
      <style>{`
        .pageWrap { display:flex; flex-direction:column; height:100vh; overflow:hidden; }
        .topBlock{
          position: sticky; top:0; z-index:30;
          padding: 14px 0 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          box-shadow: 0 14px 40px rgba(0,0,0,.22);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .topInner { padding: 0 14px; }
        .topRow{
          display:flex; justify-content:space-between; gap:12px;
          align-items:center; flex-wrap:wrap;
        }

        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandLogo { height: 30px; width:auto; opacity:.92; }
        .brandTitle { font-size: 22px; font-weight: 800; line-height: 1.1; margin: 0; }
        .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; }
        .divider { height: 1px; background: rgba(255,255,255,.12); margin: 12px 0 0; }

        .settingsModule {
          margin-top: 28px;
          padding: 18px 16px 20px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          box-shadow: 0 8px 24px rgba(0,0,0,.12);
        }
        .settingsModuleTitle {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: .02em;
          opacity: .9;
          margin: 0 0 16px 0;
        }
        .settingsModuleDivider {
          height: 1px;
          background: rgba(255,255,255,.10);
          margin: 18px 0 16px 0;
        }

        .bodyWrap { flex:1; min-height:0; overflow:auto; padding: 14px 0 18px; }
        .card{
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,.16);
          padding: 14px;
        }

        .sectionTitle { font-weight: 850; letter-spacing: .2px; margin: 0 0 10px 0; }
        .hint { font-size: 12px; opacity: .72; margin-top: 6px; }

        .ok {
          border: 1px solid rgba(80, 220, 140, .30);
          background: rgba(80, 220, 140, .10);
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 12px;
          opacity: .92;
          margin-bottom: 12px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 12px;
          min-width: 120px;
          text-align: center;
          white-space: nowrap;
          border-radius: 14px;
          cursor: pointer;
        }

        .btnRow { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top: 14px; }
        .muted { opacity:.75; font-size:12px; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; }

        .bankCard {
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.02);
          border-radius: 16px;
          padding: 12px;
          margin-top: 10px;
        }
        .bankHead {
          display:flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .pill {
          display:inline-flex; align-items:center; gap:8px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.06);
          font-size: 12px; font-weight: 750;
          white-space: nowrap;
          opacity: .9;
        }

        @media (max-width: 900px) {
          .twoCol, .threeCol { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <FirmaHeader hideLanguage={isEnterInstance()} />

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <div className="card">
            <FirmaTabsClient
              firma={f}
              accs={accs}
              t={t}
              locale={locale}
              pick={pick}
              labelStyle={labelStyle}
              inputStyle={inputStyle}
              row2={row2}
              row3={row3}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
