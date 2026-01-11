import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed script to create test data or sync from Firebase
 * 
 * Usage: npx ts-node prisma/seed.ts
 * 
 * You can also run with environment variables:
 * FIREBASE_UID=xxx FIREBASE_EMAIL=xxx FAMILY_ID=xxx npx ts-node prisma/seed.ts
 */
async function main() {
  // Get from environment or use defaults for testing
  const firebaseUid = process.env.FIREBASE_UID || 'YOUR_FIREBASE_UID';
  const email = process.env.FIREBASE_EMAIL || 'test@example.com';
  const familyId = process.env.FAMILY_ID || 'e4M6BqlwKXh0bNW0RDtY';
  const fullName = process.env.FULL_NAME || 'Test User';

  console.log('🌱 Starting seed...');
  console.log(`   Firebase UID: ${firebaseUid}`);
  console.log(`   Email: ${email}`);
  console.log(`   Family ID: ${familyId}`);

  // Create or update user
  const user = await prisma.user.upsert({
    where: { id: firebaseUid },
    update: { email, fullName },
    create: {
      id: firebaseUid,
      email,
      fullName,
    },
  });
  console.log(`✅ User created/updated: ${user.id}`);

  // Create or update family
  const family = await prisma.family.upsert({
    where: { id: familyId },
    update: {},
    create: {
      id: familyId,
      ownerId: firebaseUid,
      shareCode: Math.floor(100000 + Math.random() * 900000).toString(),
    },
  });
  console.log(`✅ Family created/updated: ${family.id}`);

  // Create family membership
  const membership = await prisma.familyMember.upsert({
    where: {
      familyId_userId: {
        familyId: familyId,
        userId: firebaseUid,
      },
    },
    update: {},
    create: {
      familyId: familyId,
      userId: firebaseUid,
      role: 'owner',
    },
  });
  console.log(`✅ Family membership created/updated`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('\nYou can now use the server with:');
  console.log(`   Family ID: ${familyId}`);
  console.log(`   User ID: ${firebaseUid}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
