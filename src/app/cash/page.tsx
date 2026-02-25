import CashClient from "./CashClient";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  return (
    <div className="container">
      <CashClient />
    </div>
  );
}
