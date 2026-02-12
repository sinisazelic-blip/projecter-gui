import Link from "next/link";
import GrafickiClient from "./GrafickiClient";

export const dynamic = "force-dynamic";

export default function GrafickiPage() {
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
                  <div className="brandTitle">Grafički izvještaj</div>
                  <div className="brandSub">
                    Promet, troškovi i zarada po godinama i mjesecima (stg_master_finansije)
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
          <GrafickiClient />
        </div>
      </div>
    </div>
  );
}
