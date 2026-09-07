import { requireEnterPage } from "@/lib/ops/access";
import { listOpsCatalog } from "@/lib/ops/queries";
import { OpsShell } from "../OpsShell";
import ArtikliClient from "./ArtikliClient";

export const dynamic = "force-dynamic";

export default async function OpsArtikliPage() {
  requireEnterPage();
  const catalog = await listOpsCatalog();
  return (
    <OpsShell
      title="Šifarnik"
      sub="Materijal, oprema, sabloni"
    >
      <ArtikliClient initial={catalog} />
    </OpsShell>
  );
}
