import { requireEnterPage } from "@/lib/ops/access";
import { listOpsNaloziPosla } from "@/lib/ops/nalozi";
import {
  listOpsKlijenti,
  listOpsKompletacije,
  listOpsProjekti,
  listOpsRadnici,
} from "@/lib/ops/queries";
import { OpsShell } from "../OpsShell";
import KompletacijaClient from "./KompletacijaClient";

export const dynamic = "force-dynamic";

export default async function OpsKompletacijaPage() {
  requireEnterPage();
  const [events, naloziPosla, radnici, klijenti, projekti] = await Promise.all([
    listOpsKompletacije(),
    listOpsNaloziPosla(),
    listOpsRadnici(),
    listOpsKlijenti(),
    listOpsProjekti(),
  ]);
  return (
    <OpsShell
      title="KC"
      sub="Kompletacioni centar"
    >
      <KompletacijaClient
        initialEvents={events}
        naloziPosla={naloziPosla}
        radnici={radnici}
        klijenti={klijenti}
        projekti={projekti}
      />
    </OpsShell>
  );
}
