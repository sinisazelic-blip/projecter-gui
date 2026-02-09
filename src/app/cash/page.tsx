import CashClient from "./CashClient";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  return (
    <div className="min-h-[calc(100vh-0px)]">
      <CashClient />
    </div>
  );
}
