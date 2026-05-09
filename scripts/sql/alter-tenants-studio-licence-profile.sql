-- Jednokratno na master bazi (Studio / tenant admin).
-- Iz terminala (bez Workbench): npm run migrate:studio-licence-profile
-- (vidi scripts/run-migration-studio-licence-profile.cjs)
-- 1) Stub plan za tenante koji nemaju Fluxa pretplatu (samo SOCCS/SwimVoice).
-- 2) Kolona studio_licence_profile — šta čarobnjak definiše pri unosu.

INSERT IGNORE INTO plans (naziv, max_users, max_saradnici)
VALUES ('— (bez Fluxa paketa)', 1, 0);

ALTER TABLE tenants
  ADD COLUMN studio_licence_profile VARCHAR(32) NULL
    COMMENT 'FLUXA_ONLY | SOCCS_SWIMVOICE | FLUXA_AND_SOCCS'
    AFTER tenant_public_id;
