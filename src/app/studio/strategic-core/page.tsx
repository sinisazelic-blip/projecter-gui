import Link from "next/link";
import StrategicCoreClient from "./StrategicCoreClient";

export const dynamic = "force-dynamic";

export default function StrategicCorePage() {
  return (
    <div className="container" style={{ minHeight: "100vh" }}>
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
                  <div className="brandTitle">StrategicCore</div>
                  <div className="brandSub">Brzi budžet u pregovorima</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/mobile" className="btn" title="Mobile">
                  📱 Mobile
                </Link>
                <Link href="/dashboard" className="btn" title="Dashboard">
                  🏠 Dashboard
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <StrategicCoreClient />
        </div>
      </div>
    </div>
  );
}
