import FluxaLogo from "@/components/FluxaLogo";
import { OpsNav } from "./OpsNav";

export function OpsShell({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container opsPage">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo />
                  <span className="brandSlogan">Deal, Ops &amp; Finance</span>
                </div>
                <div>
                  <div className="brandTitle">{title}</div>
                  <div className="brandSub">{sub}</div>
                </div>
              </div>
              <OpsNav />
            </div>
            <div className="divider" />
          </div>
        </div>
        <div className="bodyWrap">
          <div className="card opsCard">{children}</div>
        </div>
      </div>
    </div>
  );
}
