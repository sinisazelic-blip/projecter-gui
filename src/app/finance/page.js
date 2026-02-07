import Link from "next/link";

export const dynamic = "force-dynamic";

function CardLink({ title, desc, href, href2, href2Label }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{title}</div>
      <div className="subtle" style={{ lineHeight: 1.6, marginBottom: 12 }}>
        {desc}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link className="btn btn-primary" href={href}>
          Otvori
        </Link>
        {href2 ? (
          <Link className="btn" href={href2}>
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
      <div className="topbar glass">
        <div className="topbar-left">
          <h1 className="h1">Finansije</h1>
          <div className="subtle">
            Banka je canonical truth. Business tabele su meaning + linkovi.
          </div>
        </div>

        <div className="topbar-right" style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href="/">
            Home
          </Link>
        </div>
      </div>

      {/* QUICK GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
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
          title="Fiksni troškovi"
          desc="Šifrarnik fiksnih troškova + raspored dospijeća (read-only)."
          href="/finance/fiksni-troskovi"
          href2="/finance/fiksni-troskovi/raspored"
          href2Label="Raspored"
        />
      </div>

      {/* NOTE */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="h2" style={{ marginTop: 0 }}>Napomena</div>
        <div className="subtle" style={{ lineHeight: 1.7 }}>
          Ovo je read-only skeleton faza. Linkovanje i pravila dolaze kasnije,
          ali navigacija i prikazi moraju biti stabilni i jasni.
        </div>
      </div>
    </div>
  );
}
