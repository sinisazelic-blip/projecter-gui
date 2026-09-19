import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import FluxaLogo from "@/components/FluxaLogo";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { isOwnerLike } from "@/lib/projects/deal-edit-guard";
import OsnovnaSredstvaClient from "./OsnovnaSredstvaClient";

export const dynamic = "force-dynamic";

export default async function OsnovnaSredstvaPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !isOwnerLike(session)) {
    redirect("/dashboard");
  }

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">Osnovna Sredstva & Oprema</div>
                  <div className="brandSub">Knjiga DI-1, Amortizacija & Odluke o unošenju lične imovine u s.p.</div>
                </div>
              </div>

              <div className="actions">
                <Link href="/finance/godisnji-izvjestaj" className="btn btn--active" title="PURS Godišnji Izvještaj">
                  📋 PURS Prijava
                </Link>
                <Link href="/finance" className="btn" title="Finansije">
                  Finansije
                </Link>
                <Link href="/dashboard" className="btn" title="Dashboard">
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> Dashboard
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap" style={{ marginTop: 20 }}>
          <OsnovnaSredstvaClient />
        </div>
      </div>
    </div>
  );
}
