import FinanceToolsClient from "./FinanceToolsClient";

export const dynamic = "force-dynamic";

export default function FinanceToolsPage() {
  return (
    <div className="container">
      <div className="topbar">
        <div>
          <div className="title">Finance Tools</div>
          <div className="subtitle">
            Bank postings → meaning (bez Workbench-a, bez PowerShell-a).
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">⚠️ Operativni alati</div>
        <div className="card-subtitle">
          Ovo je “tools” ekran. Koristi se pažljivo. Ništa se ne briše — linkovi
          se mogu samo deaktivirati (storno).
        </div>
      </div>

      <FinanceToolsClient />
    </div>
  );
}
