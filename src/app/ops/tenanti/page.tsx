import { requireEnterPage } from "@/lib/ops/access";
import { listEnterTenantAudit, listEnterTenants } from "@/lib/ops/tenanti";
import { OpsShell } from "../OpsShell";
import TenantiClient from "./TenantiClient";

export const dynamic = "force-dynamic";

export default async function OpsTenantiPage() {
  requireEnterPage();
  const [tenants, audit] = await Promise.all([
    listEnterTenants(),
    listEnterTenantAudit(),
  ]);
  return (
    <OpsShell
      title="Enter tenanti"
      sub="Status licence, produženje i moduli. Novi objekat otvara samo vlasnik na Studiju."
    >
      <TenantiClient initialTenants={tenants} initialAudit={audit} />
    </OpsShell>
  );
}
