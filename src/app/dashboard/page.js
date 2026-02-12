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
    <div className="container">
      <style>{`
        .dashboardWrap {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px 0;
        }

        .finansijeContainer {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 20px;
          align-items: stretch;
        }

        .finansijeSidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 280px;
        }

        .finansijeGroup {
          display: flex;
          flex-direction: column;
        }

        .dashboardGroup {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
          padding: 18px 20px;
        }

        .groupHeader {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .groupTitle {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.3px;
          margin: 0;
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
          margin-bottom: 16px;
          margin-top: -4px;
        }

        /* Desk grupa - posebni stilovi */
        .deskGroup {
          position: relative;
        }

        .deskMainButtons {
          display: flex;
          gap: 16px;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .deskMainBtn {
          flex: 1;
          min-width: 200px;
          max-width: 300px;
          padding: 14px 20px;
          font-size: 16px;
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
          font-size: 13px;
          opacity: 0.7;
        }

        /* Finansije grupa */
        .finansijeGroup {
          background: rgba(255, 165, 0, 0.05);
          border-color: rgba(255, 165, 0, 0.15);
        }

        .finansijeRow {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .finansijeSubsection {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .finansijeSubsectionTitle {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          font-size: 14px;
          font-weight: 750;
        }

        /* Šifarnici grupa */
        .sifarniciRow {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .sifarniciRow--equal-width {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .sifarniciRow--equal {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
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

        @media (max-width: 1200px) {
          .sifarniciRow--equal {
            grid-template-columns: repeat(2, 1fr);
          }
          .sifarniciRow--equal-width {
            grid-template-columns: repeat(3, 1fr);
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
                <img
                  src="/fluxa/logo-light.png"
                  alt="FLUXA"
                  className="brandLogo"
                />
                <div>
                  <div className="brandTitle">Dashboard</div>
                  <div className="brandSub">
                    Project & Finance Engine
                  </div>
                </div>
              </div>

              {/* ✅ TOPBAR: samo Blagajna */}
              <div className="actions">
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
                <span className="groupPill groupPill--operativa">operativa</span>
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
                title="Strategic Core (u izradi)"
              >
                SC Strategic Core
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

                <div className="finansijeRow">
                  <ActionBtn label="Narudžbenice" href="/narudzbenice" />
                  <ActionBtn label="Fakturisanje" href="/fakture/za-fakturisanje" title="Za fakturisanje → wizard" />
                  <ActionBtn label="Naplate" href="/naplate" />
                  <ActionBtn label="Dugovanja" href="/finance/dugovanja" />
                </div>

                <div className="finansijeRow">
                  <ActionBtn label="Import izvoda" href="/banking/import" />
                  <ActionBtn label="Izvodi" href="/izvodi" title="Lista bankovnih izvoda" className="btn--orange-accent" />
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
                  <div className="finansijeRow">
                    <ActionBtn label="Finance" href="/finance" />
                    <ActionBtn label="Finance Tools" href="/studio/finance-tools" />
                  </div>
                </div>

                <div className="dashboardGroup">
                  <div className="groupHeader">
                    <div className="groupTitle">Izvještaji</div>
                    <span className="groupPill groupPill--reports">reports</span>
                  </div>
                  <div className="finansijeRow">
                    <ActionBtn label="Periodični" href={null} className="btn--disabled" />
                    <ActionBtn label="Grafički" href={null} className="btn--disabled" />
                    <ActionBtn label="All" href={null} className="btn--disabled" />
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

              <div className="sifarniciRow sifarniciRow--equal-width">
                <ActionBtn label="All About Us" href="/studio/firma" icon="🏢" title="Firma identitet" className="btn--glossy" />
                <ActionBtn label="Radne faze" href="/studio/radne-faze" />
                <ActionBtn label="Radnici" href="/studio/radnici" />
                <ActionBtn label="Users" href="/studio/users" title="Korisnici" />
                <ActionBtn label="Roles" href="/studio/roles" title="Uloge" />
              </div>

              <div className="sifarniciRow sifarniciRow--equal">
                <ActionBtn label="Cjenovnik" href="/studio/cjenovnik" />
                <ActionBtn label="Talenti" href="/studio/talenti" />
                <ActionBtn label="Dobavljači" href="/studio/dobavljaci" />
                <ActionBtn label="Klijenti" href="/studio/klijenti" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
