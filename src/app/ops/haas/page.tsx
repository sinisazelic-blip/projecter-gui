import { requireEnterPage } from "@/lib/ops/access";
import { listOpsHaasCjenovnik, listOpsHaasFakture } from "@/lib/ops/haas";
import { listOpsKlijenti, listOpsKompletacije } from "@/lib/ops/queries";
import { OpsShell } from "../OpsShell";
import HaasClient from "./HaasClient";

export const dynamic = "force-dynamic";

export default async function OpsHaasPage() {
  requireEnterPage();
  const [cjenovnik, fakture, kompletacije, klijenti] = await Promise.all([
    listOpsHaasCjenovnik(),
    listOpsHaasFakture(),
    listOpsKompletacije(),
    listOpsKlijenti(),
  ]);
  return (
    <OpsShell
      title="HaaS faktura"
      sub="Najam kompleta s eventa. SaaS licence ovdje ne postoje. Izvod i dalje zatvara fakturu."
    >
      <HaasClient
        initialCjenovnik={cjenovnik}
        initialFakture={fakture}
        kompletacije={kompletacije}
        klijenti={klijenti}
      />
    </OpsShell>
  );
}
