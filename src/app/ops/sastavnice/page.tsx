import { requireEnterPage } from "@/lib/ops/access";
import { listOpsCatalog } from "@/lib/ops/queries";
import { OpsShell } from "../OpsShell";
import SastavniceClient from "./SastavniceClient";

export const dynamic = "force-dynamic";

export default async function OpsSastavnicePage() {
  requireEnterPage();
  const catalog = await listOpsCatalog();
  return (
    <OpsShell
      title="Sastavnice"
      sub="Obavezna receptura sablona. Bez ovoga nema radnog naloga."
    >
      <SastavniceClient
        initial={{ artikli: catalog.artikli, sastavnice: catalog.sastavnice }}
      />
    </OpsShell>
  );
}
