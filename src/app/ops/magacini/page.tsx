import { requireEnterPage } from "@/lib/ops/access";
import { listOpsCatalog } from "@/lib/ops/queries";
import { OpsShell } from "../OpsShell";

export const dynamic = "force-dynamic";

function Qty({ n }: { n: number }) {
  return <>{Number.isInteger(n) ? String(n) : n.toFixed(3)}</>;
}

export default async function OpsMagaciniPage() {
  requireEnterPage();
  const { magacini, artikli, stanje, jediniceOpreme } = await listOpsCatalog();
  return (
    <OpsShell
      title="Dva magacina"
      sub="M1 broji materijal. M2 drži opremu po seriji. RN skida M1 i rađa serije."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {magacini.map((m) => {
          const n = artikli.filter(
            (a) => a.default_magacin_id === m.magacin_id && a.aktivan,
          ).length;
          const qty = stanje
            .filter((s) => s.magacin_id === m.magacin_id)
            .reduce((acc, s) => acc + Number(s.kolicina), 0);
          const units = jediniceOpreme.filter((e) => e.magacin_id === m.magacin_id)
            .length;
          return (
            <div
              key={m.magacin_id}
              style={{
                padding: 16,
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "var(--panel)",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>{m.kod}</div>
              <div style={{ fontSize: 20, fontWeight: 800, margin: "4px 0 8px" }}>
                {m.naziv}
              </div>
              <div style={{ fontSize: 13 }}>
                Vrsta: <strong>{m.vrsta}</strong>
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                Šifara: <strong>{n}</strong>
              </div>
              {m.kod === "M1" ? (
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  Na stanju (zbir JM): <strong><Qty n={qty} /></strong>
                </div>
              ) : (
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  Serija u magacinu: <strong>{units}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h3 style={{ margin: "0 0 10px" }}>M1 — količine</h3>
      {stanje.length ? (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            background: "var(--panel)",
            marginBottom: 28,
          }}
        >
          <thead>
            <tr>
              {["Magacin", "Šifra", "Naziv", "Količina", "JM"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stanje.map((s) => (
              <tr key={`${s.magacin_id}-${s.artikal_id}`}>
                <td style={{ padding: "8px 10px" }}>{s.magacin_kod}</td>
                <td style={{ padding: "8px 10px" }}>{s.sifra}</td>
                <td style={{ padding: "8px 10px" }}>{s.naziv}</td>
                <td style={{ padding: "8px 10px" }}>
                  <Qty n={Number(s.kolicina)} />
                </td>
                <td style={{ padding: "8px 10px" }}>{s.jm_oznaka}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 28 }}>
          Još nema količina. Prva prijemnica na materijal puni ovu tabelu.
        </p>
      )}

      <h3 style={{ margin: "0 0 10px" }}>M2 — serije opreme</h3>
      {jediniceOpreme.length ? (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            background: "var(--panel)",
          }}
        >
          <thead>
            <tr>
              {["Kod", "Šifra", "Stanje"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jediniceOpreme.map((e) => (
              <tr key={e.jedinica_id}>
                <td style={{ padding: "8px 10px", fontWeight: 700 }}>{e.kod}</td>
                <td style={{ padding: "8px 10px" }}>{e.sifra}</td>
                <td style={{ padding: "8px 10px" }}>{e.stanje}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          Serija nastaje prijemnicom (OPREMA) ili radnim nalogom (sablon).
        </p>
      )}
    </OpsShell>
  );
}
