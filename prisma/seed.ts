import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const TEST_OTP = '123456';
const GUARD_PIN = '1234';

async function main() {
  console.log('🌱 Seeding Nivasi...\n');

  // Find existing society — do NOT create if exists
  let society = await prisma.society.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!society) {
    society = await prisma.society.create({
      data: { name: 'Swastik Heights', address: 'Vadodara', city: 'Vadodara', state: 'Gujarat', pinCode: '390001' },
    });
    console.log(`  ✓ Created society: ${society.name}`);
  } else {
    console.log(`  ✓ Using existing society: ${society.name}`);
  }

  // Find existing wing — do NOT create if exists
  let wing = await prisma.wing.findFirst({ where: { societyId: society.id }, orderBy: { createdAt: 'asc' } });
  if (!wing) {
    wing = await prisma.wing.create({ data: { name: 'Tower-D', societyId: society.id } });
    console.log(`  ✓ Created wing: ${wing.name}`);
  } else {
    console.log(`  ✓ Using existing wing: ${wing.name}`);
  }

  // Upsert system users only — never delete anything
  const superAdmin = await prisma.user.upsert({
    where: { phone: '8000404040' },
    update: { name: 'Super Admin', role: 'SUPER_ADMIN', societyId: society.id, wingId: wing.id },
    create: { name: 'Super Admin', phone: '8000404040', role: 'SUPER_ADMIN', societyId: society.id, wingId: wing.id },
  });
  console.log(`  ✓ Super Admin: ${superAdmin.phone}`);

  const secretary = await prisma.user.upsert({
    where: { phone: '9898426416' },
    update: { name: 'Zahir Kachwala', role: 'WING_ADMIN', societyId: society.id, wingId: wing.id },
    create: { name: 'Zahir Kachwala', phone: '9898426416', role: 'WING_ADMIN', societyId: society.id, wingId: wing.id },
  });
  console.log(`  ✓ Secretary: ${secretary.phone}`);

  const guard = await prisma.user.upsert({
    where: { phone: '8000404070' },
    update: { name: 'Tower D Guard', role: 'GUARD', guardPin: GUARD_PIN, societyId: society.id, wingId: wing.id },
    create: { name: 'Tower D Guard', phone: '8000404070', role: 'GUARD', guardPin: GUARD_PIN, societyId: society.id, wingId: wing.id },
  });
  console.log(`  ✓ Guard: ${guard.phone} | PIN: ${GUARD_PIN}`);

  // Redis: OTPs only — guard login now uses DB (wing name + guardPin), not Redis
  for (const phone of [superAdmin.phone, secretary.phone, guard.phone]) {
    await redis.set(`otp:${phone}`, TEST_OTP, 'EX', 600);
  }
  console.log(`  ✓ Redis OTP "${TEST_OTP}" set (valid 10 min)`);

  // Verify all system users
  const systemUsers = await prisma.user.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'GUARD', 'WING_ADMIN'] } },
    select: { name: true, phone: true, role: true },
  });
  console.log('\n  System users:', JSON.stringify(systemUsers, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });
