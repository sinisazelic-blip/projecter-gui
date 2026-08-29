import { requireEnterPage } from "@/lib/ops/access";
import { listOpsCatalog } from "@/lib/ops/queries";
import { OpsShell } from "../OpsShell";
import QrClient from "./QrClient";

export const dynamic = "force-dynamic";

export default async function OpsQrPage() {
  requireEnterPage();
  const { artikli, jediniceOpreme } = await listOpsCatalog();
  return (
    <OpsShell
      title="QR naljepnice"
      sub="Šifra artikla ili serija komada (kad je oprema primljena)."
    >
      <QrClient artikli={artikli} jediniceOpreme={jediniceOpreme} />
    </OpsShell>
  );
}
