-- Custom roles: named, reusable permission sets for agents (MEMBER tier).
-- Replaces the per-member `permissions` column with role-based capabilities.

-- 1. Roles table
CREATE TABLE "custom_roles" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "name"         TEXT NOT NULL,
  "capabilities" JSONB NOT NULL DEFAULT '[]',
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "custom_roles_workspace_id_name_key" ON "custom_roles" ("workspace_id", "name");
CREATE INDEX "custom_roles_workspace_id_idx" ON "custom_roles" ("workspace_id");
ALTER TABLE "custom_roles"
  ADD CONSTRAINT "custom_roles_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Member / invite columns
ALTER TABLE "workspace_members" ADD COLUMN "custom_role_id" UUID;
ALTER TABLE "workspace_invites" ADD COLUMN "custom_role_id" UUID;

CREATE INDEX "workspace_members_custom_role_id_idx" ON "workspace_members" ("custom_role_id");
ALTER TABLE "workspace_members"
  ADD CONSTRAINT "workspace_members_custom_role_id_fkey"
  FOREIGN KEY ("custom_role_id") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workspace_invites"
  ADD CONSTRAINT "workspace_invites_custom_role_id_fkey"
  FOREIGN KEY ("custom_role_id") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Seed a default "Agent" role (inbox+contacts) for every existing workspace
INSERT INTO "custom_roles" ("workspace_id", "name", "capabilities")
SELECT "id", 'Agent', '["inbox","contacts"]'::jsonb FROM "workspaces"
ON CONFLICT ("workspace_id", "name") DO NOTHING;

-- 4. Point existing agents (members + pending invites) at their Agent role
UPDATE "workspace_members" m
SET "custom_role_id" = r."id"
FROM "custom_roles" r
WHERE r."workspace_id" = m."workspace_id" AND r."name" = 'Agent' AND m."role" = 'MEMBER';

UPDATE "workspace_invites" i
SET "custom_role_id" = r."id"
FROM "custom_roles" r
WHERE r."workspace_id" = i."workspace_id" AND r."name" = 'Agent'
  AND i."role" = 'MEMBER' AND i."accepted_at" IS NULL;

-- 5. Drop the now-unused per-member permissions column
ALTER TABLE "workspace_members" DROP COLUMN "permissions";
