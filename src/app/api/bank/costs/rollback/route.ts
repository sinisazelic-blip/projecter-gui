import { withApiErrorBoundary } from "@/lib/api/routeWrap";
import { handleBankCostsRollback } from "@/lib/bank/routes/costs/rollback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiErrorBoundary(handleBankCostsRollback);
