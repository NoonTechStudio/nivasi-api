-- Register the account owner's real phone number as a SUPER_ADMIN so Command
-- Centre login works. Login currently uses a fixed demo OTP (403090, see
-- src/services/otp.service.ts) for every phone number — the actual blocker
-- was that this phone had no User row at all yet (the seed script only
-- creates a placeholder admin on 8000404040, a different number).
-- SUPER_ADMIN routes don't require wingGuard, so wingId/societyId stay NULL —
-- this account manages every society, not one wing.
INSERT INTO "User" (id, name, phone, role, "isActive", "createdAt")
VALUES (substr(md5(random()::text || clock_timestamp()::text), 1, 25), 'Zulfi', '8000403090', 'SUPER_ADMIN', true, now())
ON CONFLICT (phone) DO UPDATE SET role = 'SUPER_ADMIN', "isActive" = true;
