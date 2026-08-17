-- Fix production drift: isPrimary, guardPin, and upiId exist in schema.prisma
-- (isPrimary since the family-member work, guardPin/upiId from earlier work)
-- but were never captured in a migration file, so they were never applied to
-- the production database via `prisma migrate deploy`. Once the Prisma Client
-- is regenerated from the current schema, any unguarded User query (e.g. the
-- phone+OTP login lookup in auth.controller.ts) selects these columns and
-- would fail with "column does not exist" if they're missing. IF NOT EXISTS
-- makes this safe to run even if a column already exists in some environment.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "guardPin" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "upiId" TEXT;

-- Backfill: every currently active resident predates the family-member
-- feature, so each one is effectively the head of their household until they
-- explicitly add family members under themselves.
UPDATE "User" SET "isPrimary" = true WHERE role = 'RESIDENT' AND "isActive" = true;
