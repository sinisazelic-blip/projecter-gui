import { requireEnterPage } from "@/lib/ops/access";
import { listOpsHaasCjenovnik, listOpsHaasFakture } from "@/lib/ops/haas";
import { OpsShell } from "../OpsShell";
import HaasClient from "./HaasClient";

export const dynamic = "force-dynamic";

export default async function OpsHaasPage() {
  requireEnterPage();
  const [cjenovnik, fakture] = await Promise.all([
    listOpsHaasCjenovnik(),
    listOpsHaasFakture(),
  ]);
  return (
    <OpsShell
      title="Cjenovnik"
      sub="HaaS cjenovnik"
    >
      <HaasClient initialCjenovnik={cjenovnik} initialFakture={fakture} />
    </OpsShell>
  );
}
