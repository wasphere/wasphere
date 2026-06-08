-- Per-member granular capability grants for agents (MEMBER role).
-- Owners/admins ignore this column (they have every capability).
ALTER TABLE "workspace_members"
  ADD COLUMN "permissions" JSONB NOT NULL DEFAULT '[]';
