-- Each society gets its own demo login code instead of one shared code for
-- the whole platform. Existing societies are backfilled with a random
-- 6-digit code so nobody's login breaks when this deploys.

ALTER TABLE "Society" ADD COLUMN IF NOT EXISTS "demoOtpCode" TEXT;

UPDATE "Society"
SET "demoOtpCode" = lpad(floor(random() * 1000000)::text, 6, '0')
WHERE "demoOtpCode" IS NULL;
