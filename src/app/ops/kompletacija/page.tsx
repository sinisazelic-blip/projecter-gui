import { requireEnterPage } from "@/lib/ops/access";
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
  const [events, radnici, klijenti, projekti] = await Promise.all([
    listOpsKompletacije(),
    listOpsRadnici(),
    listOpsKlijenti(),
    listOpsProjekti(),
  ]);
  return (
    <OpsShell
      title="Kompletacija"
      sub="Sken M2 → event → montaža → povrat. Životna knjiga pamti klasu rizika."
    >
      <KompletacijaClient
        initialEvents={events}
        radnici={radnici}
        klijenti={klijenti}
        projekti={projekti}
      />
    </OpsShell>
  );
}
