import Link from "next/link";
import { query } from "@/lib/db";
import DugovanjeNovoForm from "./DugovanjeNovoForm";

export const dynamic = "force-dynamic";

export default async function DugovanjeNovoPage() {
  let dobavljaci = [];
  try {
    dobavljaci = await query(
      `SELECT dobavljac_id, naziv FROM dobavljaci WHERE aktivan = 1 ORDER BY naziv ASC LIMIT 500`,
      [],
    );
  } catch {
    // ignore
  }
  if (!Array.isArray(dobavljaci)) dobavljaci = [];

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
                <div>
                  <div className="brandTitle">Novo dugovanje</div>
                  <div className="brandSub">Finansije / Dugovanja / Unos</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Link href="/finance/dugovanja" className="btn" title="Lista">
                  Lista dugovanja
                </Link>
                <Link href="/finance" className="btn" title="Finansije">
                  Finansije
                </Link>
              </div>
            </div>
            <div className="divider" />
          </div>
        </div>
        <div className="bodyWrap">
          <div className="card tableCard" style={{ maxWidth: 560 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 16 }}>
              Unos obaveze prema dobavljaču / talentu
            </div>
            <DugovanjeNovoForm dobavljaci={dobavljaci} />
          </div>
        </div>
      </div>
    </div>
  );
}
