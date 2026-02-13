import Link from "next/link";
import SviIzvjestajiClient from "./SviIzvjestajiClient";

export const dynamic = "force-dynamic";

export default function SviIzvjestajiPage() {
  return (
    <div className="container">
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
                  <div className="brandTitle">Svi izvještaji</div>
                  <div className="brandSub">
                    Odaberi šta te interesuje i period (opciono). Bez datuma = svi podaci.
                  </div>
                </div>
              </div>

              <Link href="/dashboard" className="btn" title="Dashboard">
                🏠 Dashboard
              </Link>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <SviIzvjestajiClient />
        </div>
      </div>
    </div>
  );
}
