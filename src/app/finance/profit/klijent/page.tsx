import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import ProfitKlijentClient from "./ProfitKlijentClient";
import ProfitTopActions from "../ProfitTopActions";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

export default async function ProfitKlijentPage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  return (
    <div className="container profitPageWrap">
      <style>{`
        .profitPageWrap .pageWrap { display: flex; flex-direction: column; min-height: 100vh; overflow: hidden; }
        .profitPageWrap .topBlock {
          position: sticky; top: 0; z-index: 30;
          padding: 14px 0 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 18px;
          box-shadow: 0 14px 40px rgba(0,0,0,.22);
          backdrop-filter: blur(12px);
        }
        .profitPageWrap .topInner { padding: 0 14px; }
        .profitPageWrap .topRow { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .profitPageWrap .brandWrap { display: flex; align-items: center; gap: 12px; }
        .profitPageWrap .brandLogo { height: 30px; width: auto; opacity: .92; }
        .profitPageWrap .brandTitle { font-size: 22px; font-weight: 800; margin: 0; }
        .profitPageWrap .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; }
        .profitPageWrap .divider { height: 1px; background: rgba(255,255,255,.12); margin: 12px 0 0; }
        .profitPageWrap .bodyWrap { flex: 1; min-height: 0; overflow: auto; padding: 14px 0 18px; }
        .profitPageWrap .profitActions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .profitPageWrap .printFooter { display: none; }
        .profitPageWrap .printTitle { display: none; }
        @media print {
          .profitPageWrap .topBlock { position: static; }
          .profitPageWrap .profitActions { display: none !important; }
          .profitPageWrap .no-print { display: none !important; }
          .profitPageWrap .printFooter { display: flex !important; align-items: center; justify-content: center; gap: 8px; padding: 12px; font-size: 11px; color: var(--muted); }
          .profitPageWrap .printTitle { display: block !important; font-size: 18px; font-weight: 700; margin-bottom: 12px; text-align: center; }
          @page { size: landscape; margin: 16px; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">{t("dashboard.marginPoKlijentuTitle")}</div>
                  <div className="brandSub">{t("dashboard.profitPageSubtitle")}</div>
                </div>
              </div>
              <ProfitTopActions
                printLabel={t("dashboard.profitPrint")}
                printTitle={t("dashboard.profitPrintTitle")}
                dashboardLabel={t("common.dashboard")}
              />
            </div>
            <div className="divider" />
          </div>
        </div>
        <div className="bodyWrap">
          <ProfitKlijentClient />
        </div>
        <div className="printFooter">
          <FluxaLogo alt="Fluxa" style={{ height: 20, opacity: 0.9 }} />
          <span>{t("dashboard.generatedBy")}</span>
        </div>
      </div>
    </div>
  );
}
