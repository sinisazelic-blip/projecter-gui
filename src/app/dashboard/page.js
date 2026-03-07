// src/app/dashboard/page.js
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import DashboardTopActions from "./DashboardTopActions";
import DashboardBody from "./DashboardBody";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);
  return (
    <div className="container dashboardPage">
      <style>{`
        .dashboardPage {
          height: 100vh;
          max-height: 100dvh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .dashboardPage .topBlock {
          padding: clamp(8px, 1vh, 14px) 0 clamp(8px, 1vh, 12px);
          flex-shrink: 0;
        }

        .dashboardPage .pageWrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }

        .dashboardPage .bodyWrap {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: clamp(10px, 1.2vh, 18px) 0 clamp(12px, 1.5vh, 22px);
        }

        .dashboardWrap {
          display: flex;
          flex-direction: column;
          gap: clamp(16px, 2.5vh, 28px);
          padding: clamp(12px, 1.5vh, 24px) 0;
        }

        .finansijeContainer {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(14px, 2vh, 24px);
          align-items: stretch;
        }

        .finansijeSidebar {
          display: flex;
          flex-direction: column;
          gap: clamp(18px, 2vh, 26px);
          min-width: 200px;
        }

        .finansijeGroup {
          display: flex;
          flex-direction: column;
        }

        /* Svi dugmići na Dashboardu – blago veći font naziva */
        .dashboardPage .btn {
          font-size: clamp(14px, 1.5vh, 16px);
        }

        .dashboardGroup {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
          padding: clamp(14px, 1.8vh, 22px) clamp(14px, 1.8vw, 24px);
        }

        .groupHeader {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: clamp(8px, 1vh, 14px);
          flex-wrap: wrap;
        }

        .groupTitle {
          font-size: clamp(15px, 1.8vh, 18px);
          font-weight: 800;
          letter-spacing: 0.3px;
          margin: 0;
        }

        .deskGroup .groupTitle {
          font-size: clamp(19px, 2.2vh, 24px);
        }

        .groupPill {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
        }

        .groupPill--operativa {
          border-color: rgba(125, 211, 252, 0.35);
          background: rgba(125, 211, 252, 0.1);
        }

        .groupPill--legacy {
          border-color: rgba(255, 190, 90, 0.35);
          background: rgba(255, 190, 90, 0.1);
        }

        .groupPill--reports {
          border-color: rgba(180, 180, 180, 0.35);
          background: rgba(180, 180, 180, 0.1);
        }

        .groupPill--profitMargin {
          border-color: rgba(167, 139, 250, 0.4);
          background: rgba(167, 139, 250, 0.15);
          color: rgba(216, 204, 255, 0.95);
        }

        .groupSubtitle {
          font-size: 12px;
          opacity: 0.75;
          margin-bottom: clamp(10px, 1.2vh, 18px);
          margin-top: -2px;
        }

        /* Desk grupa - posebni stilovi */
        .deskGroup {
          position: relative;
        }

        .deskMainButtons {
          display: flex;
          gap: clamp(14px, 1.5vw, 22px);
          align-items: stretch;
          justify-content: center;
          margin-bottom: clamp(10px, 1.2vh, 16px);
          flex-wrap: wrap;
        }

        .deskMainBtn {
          flex: 1;
          min-width: 260px;
          max-width: 380px;
          min-height: 100px;
          padding: clamp(10px, 1.2vh, 14px) clamp(14px, 1.5vw, 20px);
          font-size: clamp(16px, 1.9vh, 18px);
          font-weight: 750;
          border-radius: 16px;
          text-align: center;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          border: 2px solid;
        }

        .deskMainBtn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        }

        .deskMainBtn--blue {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(37, 99, 235, 0.14));
          border-color: rgba(59, 130, 246, 0.4);
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(59, 130, 246, 0.15);
        }

        .deskMainBtn--blue .deskMainBtnSubtitle {
          color: #ffffff;
          opacity: 1;
        }

        .deskMainBtn--green {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.22), rgba(22, 163, 74, 0.14));
          border-color: rgba(34, 197, 94, 0.4);
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(34, 197, 94, 0.15);
        }

        .deskMainBtn--green .deskMainBtnSubtitle {
          color: #ffffff;
          opacity: 1;
        }

        .deskMainBtnSubtitle {
          font-size: 12px;
          font-weight: 600;
        }

        .deskMainBtn--sc {
          flex: 0 0 auto;
          min-width: 72px;
          max-width: 88px;
          min-height: 100px;
          padding: clamp(10px, 1.2vh, 14px) 10px;
          font-size: clamp(15px, 1.6vh, 17px);
          border-color: rgba(251, 191, 36, 0.5);
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(245, 158, 11, 0.14));
          color: #ffffff;
        }

        .deskMainBtn--sc .deskMainBtnSubtitle {
          color: #ffffff;
          opacity: 1;
        }

        .deskMainBtn--sc:hover {
          border-color: rgba(251, 191, 36, 0.6);
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.32), rgba(245, 158, 11, 0.18));
          color: #ffffff;
        }

        .deskMainBtn--sc .deskMainBtnSubtitle {
          display: none;
        }

        /* Finansije grupa */
        .finansijeGroup {
          background: rgba(255, 165, 0, 0.05);
          border-color: rgba(255, 165, 0, 0.15);
        }

        .finansijeRow {
          display: flex;
          gap: clamp(12px, 1.2vw, 18px);
          margin-bottom: clamp(14px, 1.8vh, 22px);
          flex-wrap: wrap;
        }

        .finansijeRow:last-child {
          margin-bottom: 0;
        }

        .finansijeGroup .btn {
          min-height: 44px;
          padding-top: 10px;
          padding-bottom: 10px;
        }

        .finansijeGroup .finansijeRow--spaced {
          margin-top: clamp(6px, 0.8vh, 12px);
        }

        /* Finansije / Izvještaji / Finansije analiza – širina od ruba do ruba kao Šifarnici */
        .finansijeRow--4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: clamp(12px, 1.2vw, 18px);
        }

        .finansijeRow--6 {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: clamp(12px, 1.2vw, 18px);
        }

        .finansijeRow--7 {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: clamp(12px, 1.2vw, 18px);
        }

        .finansijeRow--2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: clamp(12px, 1.2vw, 18px);
        }

        .finansijeRow--3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: clamp(12px, 1.2vw, 18px);
        }

        .finansijeRow--3 .btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
        }

        .finansijeRow--4 .btn,
        .finansijeRow--6 .btn,
        .finansijeRow--7 .btn,
        .finansijeRow--2 .btn,
        .finansijeRow--3 .btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
        }

        .finansijeSubsection {
          margin-top: clamp(14px, 1.8vh, 24px);
          padding-top: clamp(14px, 1.8vh, 20px);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .finansijeSubsectionTitle {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
          font-size: 14px;
          font-weight: 750;
        }

        /* Šifarnici grupa */
        .sifarniciRow {
          display: flex;
          gap: clamp(12px, 1.2vw, 18px);
          margin-bottom: clamp(14px, 1.8vh, 22px);
          flex-wrap: wrap;
        }

        .sifarniciRow:last-child {
          margin-bottom: 0;
        }

        .sifarniciRow--equal-width {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: clamp(12px, 1.2vw, 18px);
          margin-bottom: clamp(14px, 1.8vh, 22px);
        }

        .sifarniciRow--equal-width:last-child {
          margin-bottom: 0;
        }

        .sifarniciRow--equal {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: clamp(12px, 1.2vw, 18px);
        }

        .sifarniciRow--3cols {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: clamp(12px, 1.2vw, 18px);
          width: 100%;
        }

        .sifarniciRow--3cols .btn {
          width: 100%;
          min-width: 0;
        }

        .sifarniciRow--blue .btn {
          background: linear-gradient(135deg, rgba(125, 211, 252, 0.12), rgba(59, 130, 246, 0.08));
          border-color: rgba(125, 211, 252, 0.25);
        }

        .sifarniciRow--blue .btn:hover {
          background: linear-gradient(135deg, rgba(125, 211, 252, 0.18), rgba(59, 130, 246, 0.12));
          border-color: rgba(125, 211, 252, 0.35);
        }

        .btn--glossy {
          background: linear-gradient(135deg, rgba(125, 211, 252, 0.15), rgba(59, 130, 246, 0.1));
          border-color: rgba(125, 211, 252, 0.3);
          box-shadow: 0 4px 16px rgba(125, 211, 252, 0.15);
        }

        .btn--glossy:hover {
          background: linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(59, 130, 246, 0.15));
          box-shadow: 0 6px 20px rgba(125, 211, 252, 0.2);
        }

        .btn--orange-accent {
          border-color: rgba(251, 146, 60, 0.25) !important;
          background: linear-gradient(135deg, rgba(251, 146, 60, 0.08), rgba(249, 115, 22, 0.05)) !important;
        }

        .btn--orange-accent:hover {
          border-color: rgba(251, 146, 60, 0.35) !important;
          background: linear-gradient(135deg, rgba(251, 146, 60, 0.12), rgba(249, 115, 22, 0.08)) !important;
        }

        .btn--purple-accent {
          border-color: rgba(167, 139, 250, 0.3) !important;
          background: linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(139, 92, 246, 0.06)) !important;
        }

        .btn--purple-accent:hover {
          border-color: rgba(167, 139, 250, 0.45) !important;
          background: linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(139, 92, 246, 0.1)) !important;
        }

        @media (max-width: 1200px) {
          .sifarniciRow--equal {
            grid-template-columns: repeat(2, 1fr);
          }
          .sifarniciRow--3cols {
            grid-template-columns: repeat(2, 1fr);
          }
          .sifarniciRow--equal-width {
            grid-template-columns: repeat(3, 1fr);
          }
          .finansijeRow--4 {
            grid-template-columns: repeat(2, 1fr);
          }
          .finansijeRow--6 {
            grid-template-columns: repeat(3, 1fr);
          }
          .finansijeRow--7 {
            grid-template-columns: repeat(4, 1fr);
          }
          .finansijeContainer {
            grid-template-columns: 1fr;
          }
          .finansijeSidebar {
            min-width: 100%;
          }
        }

        @media (max-width: 768px) {
          .sifarniciRow--equal {
            grid-template-columns: 1fr;
          }
          .sifarniciRow--3cols {
            grid-template-columns: 1fr;
          }
          .sifarniciRow--equal-width {
            grid-template-columns: 1fr;
          }
          .finansijeRow--4,
          .finansijeRow--6,
          .finansijeRow--7,
          .finansijeRow--2,
          .finansijeRow--3 {
            grid-template-columns: 1fr;
          }
          .deskMainButtons {
            flex-direction: column;
          }
          .deskMainBtn {
            max-width: 100%;
          }
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
                  <div className="brandTitle">{t("dashboard.title")}</div>
                  <div className="brandSub">{t("dashboard.subtitle")}</div>
                </div>
              </div>

              <DashboardTopActions />
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <div className="dashboardWrap">
            <DashboardBody />
          </div>
        </div>
      </div>
    </div>
  );
}
