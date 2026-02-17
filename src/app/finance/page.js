import Link from "next/link";

export const dynamic = "force-dynamic";

function CardLink({ title, desc, href, href2, href2Label }) {
  return (
    <div
      className="card"
      style={{
        margin: 0,
        border: "1px solid var(--border)",
        borderRadius: 16,
        background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
        boxShadow: "var(--shadow)",
        padding: 18,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.01em" }}>
        {title}
      </div>
      <div className="subtle" style={{ lineHeight: 1.6, marginBottom: 14, fontSize: 13 }}>
        {desc}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="btn btn--active" href={href} style={{ padding: "10px 16px" }}>
          Otvori
        </Link>
        {href2 ? (
          <Link className="btn" href={href2} style={{ padding: "10px 16px" }}>
            {href2Label ?? "Drugo"}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default async function FinanceHomePage() {
  return (
    <div className="container">
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
                  <div className="brandTitle">Finansije</div>
                  <div className="brandSub">
                    Banka je canonical truth. Business tabele su meaning + linkovi.
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <CardLink
          title="Banka (postinzi)"
          desc="Canonical ledger: šta se desilo. Detalj pokazuje linkove na prihode, plaćanja, troškove i fiksne."
          href="/finance/banka"
        />

        <CardLink
          title="Potraživanja"
          desc="Šta treba biti naplaćeno (meaning). Detalj pokazuje linkove na prihode i paid sum view."
          href="/finance/potrazivanja"
        />

        <CardLink
          title="Naplate"
          desc="Šta dospijeva uskoro ili kasni. Projekti status 4/6, neplaćeno."
          href="/naplate"
        />

        <CardLink
          title="KUF (ulazne fakture)"
          desc="Import ulaznih faktura + rasknjižavanje: projektni, fiksni, vanredni, investicije."
          href="/finance/kuf"
        />

        <CardLink
          title="Početna stanja"
          desc="Evidencija stanja na 31.12.2025 — klijenti (potraživanja), dobavljači i talenti (naša dugovanja)."
          href="/finance/pocetna-stanja"
        />

        <CardLink
          title="Dugovanja"
          desc="Obaveze prema dobavljačima/talentima. Lista + detalj sa paid sum."
          href="/finance/dugovanja"
        />

        <CardLink
          title="Prihodi"
          desc="Business prihodi (meaning). Detalj pokazuje bank linkove + veze na potraživanja."
          href="/finance/prihodi"
        />

        <CardLink
          title="Plaćanja"
          desc="Business plaćanja (meaning). Detalj pokazuje bank linkove + stavke (ako postoje)."
          href="/finance/placanja"
        />

        <CardLink
          title="CashFlow"
          desc="Hronologija plaćanja — šta je sljedeće za plaćanje. Fiksni troškovi poredani po datumu."
          href="/finance/cashflow"
        />

        <CardLink
          title="Krediti"
          desc="Ukupan iznos, broj rata, uplaćeno, ostatak duga, posljednja rata."
          href="/finance/krediti"
        />

        <CardLink
          title="Fiksni troškovi"
          desc="Šifrarnik fiksnih troškova + raspored dospijeća (read-only)."
          href="/finance/fiksni-troskovi"
          href2="/finance/fiksni-troskovi/raspored"
          href2Label="Raspored"
        />
      </div>

      <div
        className="card"
        style={{
          marginTop: 20,
          gridColumn: "1 / -1",
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
          padding: 18,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Napomena</div>
        <div className="subtle" style={{ lineHeight: 1.7, fontSize: 13 }}>
          Ovo je read-only skeleton faza. Linkovanje i pravila dolaze kasnije,
          ali navigacija i prikazi moraju biti stabilni i jasni.
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
