import { requireEnterPage } from "@/lib/ops/access";
import {
  listOpsCatalog,
  listOpsRadnici,
  listOpsRadniNalozi,
} from "@/lib/ops/queries";
import { OpsShell } from "../OpsShell";
import NaloziClient from "./NaloziClient";

export const dynamic = "force-dynamic";

export default async function OpsNaloziPage() {
  requireEnterPage();
  const [catalog, radnici, docs] = await Promise.all([
    listOpsCatalog(),
    listOpsRadnici(),
    listOpsRadniNalozi(),
  ]);
  return (
    <OpsShell
      title="Radni nalozi"
      sub="Bez sastavnice nalog ne postoji. Skida M1, rađa serije u M2."
    >
      <NaloziClient
        artikli={catalog.artikli}
        sastavnice={catalog.sastavnice}
        stanje={catalog.stanje}
        jediniceOpreme={catalog.jediniceOpreme}
        radnici={radnici}
        initialDocs={docs}
      />
    </OpsShell>
  );
}
