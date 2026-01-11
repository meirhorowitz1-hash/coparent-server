/**
 * Migration Script: Firebase Firestore → PostgreSQL
 *
 * מעביר Users ו-Families מ-Firestore ל-PostgreSQL
 *
 * Usage:
 *   npx ts-node scripts/migrate-from-firebase.ts
 *
 * Prerequisites:
 *   - Firebase Admin SDK configured (.env with FIREBASE_* variables)
 *   - PostgreSQL running with Prisma schema applied
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
const prisma = new PrismaClient();
// Initialize Firebase Admin
function initFirebase() {
    if (getApps().length > 0)
        return;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing Firebase Admin credentials in .env');
    }
    initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
    });
}
async function migrateUsers() {
    console.log('\n📦 Migrating Users...');
    const firestore = getFirestore();
    const usersSnapshot = await firestore.collection('users').get();
    let created = 0;
    let skipped = 0;
    let errors = 0;
    for (const doc of usersSnapshot.docs) {
        const data = doc.data();
        const uid = doc.id;
        try {
            await prisma.user.upsert({
                where: { id: uid },
                update: {
                    email: data.email || '',
                    fullName: data.fullName || data.displayName || null,
                    photoUrl: data.photoUrl || data.photoURL || null,
                    phone: data.phone || null,
                },
                create: {
                    id: uid,
                    email: data.email || '',
                    fullName: data.fullName || data.displayName || null,
                    photoUrl: data.photoUrl || data.photoURL || null,
                    phone: data.phone || null,
                },
            });
            created++;
            console.log(`  ✅ User: ${uid} (${data.email})`);
        }
        catch (error) {
            errors++;
            console.error(`  ❌ User ${uid}:`, error);
        }
    }
    console.log(`\n  Users: ${created} migrated, ${skipped} skipped, ${errors} errors`);
    return created;
}
async function migrateFamilies() {
    console.log('\n👨‍👩‍👧‍👦 Migrating Families...');
    const firestore = getFirestore();
    const familiesSnapshot = await firestore.collection('families').get();
    let created = 0;
    let memberships = 0;
    let errors = 0;
    for (const doc of familiesSnapshot.docs) {
        const data = doc.data();
        const familyId = doc.id;
        try {
            // Create family
            await prisma.family.upsert({
                where: { id: familyId },
                update: {
                    name: data.name || null,
                    shareCode: data.shareCode || Math.floor(100000 + Math.random() * 900000).toString(),
                    photoUrl: data.photoUrl || null,
                },
                create: {
                    id: familyId,
                    ownerId: data.ownerId || (data.members?.[0]) || 'unknown',
                    name: data.name || null,
                    shareCode: data.shareCode || Math.floor(100000 + Math.random() * 900000).toString(),
                    photoUrl: data.photoUrl || null,
                },
            });
            created++;
            console.log(`  ✅ Family: ${familyId} (${data.name || 'unnamed'})`);
            // Create memberships
            const members = data.members || [];
            for (let i = 0; i < members.length; i++) {
                const userId = members[i];
                // Ensure user exists first
                const userExists = await prisma.user.findUnique({ where: { id: userId } });
                if (!userExists) {
                    console.log(`    ⚠️ User ${userId} not found, creating placeholder...`);
                    await prisma.user.create({
                        data: {
                            id: userId,
                            email: `${userId}@placeholder.local`,
                        },
                    });
                }
                try {
                    await prisma.familyMember.upsert({
                        where: {
                            familyId_userId: { familyId, userId },
                        },
                        update: {},
                        create: {
                            familyId,
                            userId,
                            role: i === 0 || userId === data.ownerId ? 'owner' : 'member',
                        },
                    });
                    memberships++;
                    console.log(`    👤 Member: ${userId} (${i === 0 ? 'owner' : 'member'})`);
                }
                catch (memberError) {
                    console.error(`    ❌ Membership ${userId}:`, memberError);
                }
            }
            // Migrate children if present
            if (data.children && Array.isArray(data.children)) {
                for (const childName of data.children) {
                    if (typeof childName === 'string' && childName.trim()) {
                        try {
                            await prisma.familyChild.create({
                                data: {
                                    familyId,
                                    name: childName.trim(),
                                },
                            });
                            console.log(`    👶 Child: ${childName}`);
                        }
                        catch {
                            // Child might already exist
                        }
                    }
                }
            }
        }
        catch (error) {
            errors++;
            console.error(`  ❌ Family ${familyId}:`, error);
        }
    }
    console.log(`\n  Families: ${created} migrated, ${memberships} memberships, ${errors} errors`);
    return created;
}
async function main() {
    console.log('🚀 Starting Firebase → PostgreSQL Migration\n');
    console.log('='.repeat(50));
    try {
        initFirebase();
        const users = await migrateUsers();
        const families = await migrateFamilies();
        console.log('\n' + '='.repeat(50));
        console.log('✅ Migration Complete!');
        console.log(`   ${users} users migrated`);
        console.log(`   ${families} families migrated`);
    }
    catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
//# sourceMappingURL=migrate-from-firebase.js.map