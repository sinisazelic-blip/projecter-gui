"use client";

import { useEffect, useState } from "react";

/**
 * ⚠️ DISABLED (OWNER DECISION)
 * - Manual status dropdown is turned OFF.
 * - Reason: prevent staff from changing/closing live projects.
 * - This file stays in codebase (no deletion) to avoid regressions.
 * - Possible future: re-enable only with explicit owner/admin permission after user management/roles.
 */
export default function StatusSelect({ projekatId, initialStatusId }) {
  // keep previous logic scaffolded but unused (no heavy work, no fetch)
  const [_statuses] = useState([]);
  const [_value] = useState(initialStatusId ?? "");
  const [_loading] = useState(false);
  const [_err] = useState(null);

  useEffect(() => {
    // intentionally no-op
  }, []);

  // ✅ Hidden completely
  return null;
}
