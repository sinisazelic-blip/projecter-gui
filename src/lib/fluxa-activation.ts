import { query } from "@/lib/db";

export type FluxaActivationState = {
  id: string;
  company_name: string | null;
  licence_token: string | null;
  licence_check_url: string | null;
  activated_at: string | null;
};

export async function ensureFluxaActivationTable(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS fluxa_activation_state (
      id VARCHAR(20) PRIMARY KEY,
      company_name VARCHAR(255) NULL,
      licence_token VARCHAR(255) NULL,
      licence_check_url VARCHAR(500) NULL,
      activated_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

export async function getFluxaActivationState(): Promise<FluxaActivationState | null> {
  await ensureFluxaActivationTable();
  const rows = await query<FluxaActivationState>(
    `SELECT id, company_name, licence_token, licence_check_url,
            DATE_FORMAT(activated_at, '%Y-%m-%d %H:%i:%s') AS activated_at
     FROM fluxa_activation_state
     WHERE id = 'singleton'
     LIMIT 1`,
  );
  return rows?.[0] ?? null;
}

export async function isFluxaActivated(): Promise<boolean> {
  const row = await getFluxaActivationState();
  return Boolean(row?.licence_token && row?.licence_check_url);
}

export async function saveFluxaActivation(input: {
  companyName: string;
  licenceToken: string;
  licenceCheckUrl: string;
}): Promise<void> {
  await ensureFluxaActivationTable();
  await query(
    `INSERT INTO fluxa_activation_state
      (id, company_name, licence_token, licence_check_url, activated_at, created_at, updated_at)
     VALUES ('singleton', ?, ?, ?, NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       company_name = VALUES(company_name),
       licence_token = VALUES(licence_token),
       licence_check_url = VALUES(licence_check_url),
       activated_at = NOW(),
       updated_at = NOW()`,
    [input.companyName, input.licenceToken, input.licenceCheckUrl],
  );
}
