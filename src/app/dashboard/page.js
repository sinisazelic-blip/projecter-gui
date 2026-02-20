// src/app/dashboard/page.js
import Link from "next/link";

export const dynamic = "force-dynamic";

function ActionBtn({ label, href, title, icon, className = "" }) {
  const content = icon ? `${icon} ${label}` : label;
  
  if (!href) {
    return (
      <span
        className={`btn btn--disabled ${className}`}
        aria-disabled="true"
        title={title || "Još nije implementirano"}
      >
        {content}
      </span>
    );
  }
  return (
    <Link className={`btn ${className}`} href={href} title={title || label}>
      {content}
    </Link>
  );
}

export default function Page() {
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
          grid-template-columns: 1.75fr 0.75fr;
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
          align-items: center;
          justify-content: center;
          margin-bottom: clamp(10px, 1.2vh, 16px);
          flex-wrap: wrap;
        }

        .deskMainBtn {
          flex: 1;
          min-width: 200px;
          max-width: 300px;
          padding: clamp(10px, 1.2vh, 14px) clamp(14px, 1.5vw, 20px);
          font-size: clamp(14px, 1.6vh, 16px);
          font-weight: 750;
          border-radius: 16px;
          text-align: center;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          border: 2px solid;
        }

        .deskMainBtn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        }

        .deskMainBtn--blue {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(37, 99, 235, 0.05));
          border-color: rgba(59, 130, 246, 0.25);
          color: rgba(147, 197, 253, 0.95);
          box-shadow: 0 4px 16px rgba(59, 130, 246, 0.1);
        }

        .deskMainBtn--green {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(22, 163, 74, 0.05));
          border-color: rgba(34, 197, 94, 0.25);
          color: rgba(134, 239, 172, 0.95);
          box-shadow: 0 4px 16px rgba(34, 197, 94, 0.1);
        }

        .deskMainBtnSubtitle {
          font-size: 11px;
          opacity: 0.85;
          font-weight: 600;
        }

        .deskSCBtn {
          position: absolute;
          bottom: 18px;
          right: 20px;
          padding: 8px 14px;
          font-size: clamp(14px, 1.5vh, 16px);
          border-color: rgba(251, 191, 36, 0.35);
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(245, 158, 11, 0.06));
        }

        .deskSCBtn:hover {
          border-color: rgba(251, 191, 36, 0.5);
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.18), rgba(245, 158, 11, 0.1));
        }

        .deskSCBtn:hover .deskSCBtnSc {
          color: rgba(254, 243, 199, 1);
        }

        .deskSCBtn .deskSCBtnSc {
          color: rgba(253, 230, 138, 0.95);
        }

        .deskSCBtn .deskSCBtnLabel {
          color: rgba(255, 255, 255, 0.95);
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

        .finansijeRow--4 .btn,
        .finansijeRow--6 .btn,
        .finansijeRow--7 .btn,
        .finansijeRow--2 .btn {
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
          .sifarniciRow--equal-width {
            grid-template-columns: 1fr;
          }
          .finansijeRow--4,
          .finansijeRow--6,
          .finansijeRow--7,
          .finansijeRow--2 {
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
                  <img
                    src="/fluxa/logo-light.png"
                    alt="FLUXA"
                    className="brandLogo"
                  />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">Dashboard</div>
                  <div className="brandSub">
                    Centralna konzola
                  </div>
                </div>
              </div>

              {/* ✅ TOPBAR: Blagajna + Mobile */}
              <div className="actions">
                <Link
                  href="/mobile"
                  className="btn"
                  title="Pojednostavljena mobilna verzija (StrategicCore)"
                >
                  📱 Mobile
                </Link>
                <Link
                  href="/cash"
                  className="btn"
                  title="Interna blagajna (owner-only signal)"
                >
                  💰 Blagajna
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <div className="dashboardWrap">
            {/* ✅ GRUPA 1: Desk */}
            <div className="dashboardGroup deskGroup">
              <div className="groupHeader">
                <div className="groupTitle">Desk</div>
              </div>

              <div className="deskMainButtons">
                <Link
                  href="/inicijacije"
                  className="deskMainBtn deskMainBtn--blue"
                  title="Deals lista"
                >
                  <span style={{ fontSize: 28 }}>📋</span>
                  <span>Deals</span>
                  <span className="deskMainBtnSubtitle">Pregovori</span>
                </Link>

                <Link
                  href="/projects"
                  className="deskMainBtn deskMainBtn--green"
                  title="Pregled Projekata"
                >
                  <span style={{ fontSize: 28 }}>📊</span>
                  <span>PP</span>
                  <span className="deskMainBtnSubtitle">Pregled Projekata</span>
                </Link>
              </div>

              <Link
                href="/studio/strategic-core"
                className="btn deskSCBtn"
                title="Strategic Core – brzi budžet u pregovorima"
              >
                <span className="deskSCBtnSc">SC</span>{" "}
                <span className="deskSCBtnLabel">Strategic Core</span>
              </Link>
            </div>

            {/* ✅ GRUPA 2: Finansije - sa sidebar grupama */}
            <div className="finansijeContainer">
              <div className="dashboardGroup finansijeGroup">
                <div className="groupHeader">
                  <div className="groupTitle">Finansije</div>
                  <span className="groupPill groupPill--operativa">operativa</span>
                </div>
                <div className="groupSubtitle">Operativni finansijski tokovi</div>

                <div className="finansijeRow finansijeRow--4 finansijeRow--spaced">
                  <ActionBtn label="Narudžbenice" href="/narudzbenice" />
                  <ActionBtn label="Fakturisanje" href="/fakture/za-fakturisanje" title="Za fakturisanje → wizard" />
                  <ActionBtn label="Naplate" href="/naplate" />
                  <ActionBtn label="Dugovanja" href="/finance/dugovanja" />
                </div>

                <div className="finansijeRow finansijeRow--7">
                  <ActionBtn label="Import izvoda" href="/banking/import" />
                  <ActionBtn label="Izvodi" href="/izvodi" title="Lista bankovnih izvoda" className="btn--orange-accent" />
                  <ActionBtn label="Ponude" href="/ponude" title="Lista generisanih ponuda (predračuni)" className="btn--purple-accent" />
                  <ActionBtn label="Fakture" href="/fakture" title="Lista izdatih faktura" className="btn--orange-accent" />
                  <ActionBtn label="KUF" href="/finance/kuf" title="Import i rasknjižavanje ulaznih faktura" />
                  <ActionBtn label="CashFlow" href="/finance/cashflow" title="Hronologija plaćanja — šta je sljedeće" />
                  <ActionBtn label="Krediti" href="/finance/krediti" title="Pregled kreditnih obaveza" />
                </div>
              </div>

              <div className="finansijeSidebar">
                <div className="dashboardGroup">
                  <div className="groupHeader">
                    <div className="groupTitle">Finansije analiza</div>
                    <span className="groupPill groupPill--legacy">legacy</span>
                  </div>
                  <div className="finansijeRow finansijeRow--2">
                    <ActionBtn label="Finance" href="/finance" />
                    <ActionBtn label="Finance Tools" href="/studio/finance-tools" />
                  </div>
                </div>

                <div className="dashboardGroup">
                  <div className="groupHeader">
                    <div className="groupTitle">Izvještaji</div>
                    <span className="groupPill groupPill--reports">reports</span>
                  </div>
                  <div className="finansijeRow finansijeRow--2">
                    <ActionBtn label="Svi" href="/izvjestaji/svi" title="Svi izvještaji – filter i period" />
                    <ActionBtn label="Grafički" href="/izvjestaji/graficki" title="Promet, troškovi i zarada po godinama i mjesecima" />
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ GRUPA 3: Šifarnici */}
            <div className="dashboardGroup">
              <div className="groupHeader">
                <div className="groupTitle">Šifarnici</div>
                <span className="groupPill">#</span>
              </div>
              <div className="groupSubtitle">Svi operativni elementi</div>

              <div className="sifarniciRow sifarniciRow--equal">
                <ActionBtn label="Cjenovnik" href="/studio/cjenovnik" />
                <ActionBtn label="Talenti" href="/studio/talenti" />
                <ActionBtn label="Dobavljači" href="/studio/dobavljaci" />
                <ActionBtn label="Klijenti" href="/studio/klijenti" />
              </div>

              <div className="sifarniciRow sifarniciRow--equal-width sifarniciRow--blue">
                <ActionBtn label="Radne faze" href="/studio/radne-faze" />
                <ActionBtn label="Radnici" href="/studio/radnici" />
                <ActionBtn label="Users" href="/studio/users" title="Korisnici" />
                <ActionBtn label="Roles" href="/studio/roles" title="Uloge" />
                <ActionBtn label="All About Us" href="/studio/firma" icon="🏢" title="Firma identitet" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
