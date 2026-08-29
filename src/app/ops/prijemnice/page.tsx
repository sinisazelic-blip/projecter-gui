import { requireEnterPage } from "@/lib/ops/access";
import {
  listOpsCatalog,
  listOpsDobavljaci,
  listOpsPrijemnice,
} from "@/lib/ops/queries";
import { OpsShell } from "../OpsShell";
import PrijemniceClient from "./PrijemniceClient";

export const dynamic = "force-dynamic";

export default async function OpsPrijemnicePage() {
  requireEnterPage();
  const [catalog, dobavljaci, docs] = await Promise.all([
    listOpsCatalog(),
    listOpsDobavljaci(),
    listOpsPrijemnice(),
  ]);
  return (
    <OpsShell
      title="Prijemnice"
      sub="Ulaz s carine / dobavljača. Materijal na količinu, oprema dobija ime (seriju)."
    >
      <PrijemniceClient
        artikli={catalog.artikli}
        dobavljaci={dobavljaci}
        initialDocs={docs}
      />
    </OpsShell>
  );
}
