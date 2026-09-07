import { requireEnterPage } from "@/lib/ops/access";
import { listOpsNaloziPosla } from "@/lib/ops/nalozi";
import { listOpsCatalog, listOpsProjekti, listOpsRadnici } from "@/lib/ops/queries";
import { OpsShell } from "../OpsShell";
import RnClient from "./RnClient";

export const dynamic = "force-dynamic";

export default async function OpsRnPage() {
  requireEnterPage();
  const [projekti, catalog, radnici, nalozi] = await Promise.all([
    listOpsProjekti(),
    listOpsCatalog(),
    listOpsRadnici(),
    listOpsNaloziPosla(),
  ]);
  return (
    <OpsShell
      title="Radni nalozi"
      sub="Specifikacija posla"
    >
      <RnClient
        projekti={projekti}
        artikli={catalog.artikli}
        radnici={radnici}
        initialNalozi={nalozi}
      />
    </OpsShell>
  );
}
