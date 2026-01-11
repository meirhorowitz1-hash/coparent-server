/**
 * Migration Script: Firestore → PostgreSQL
 * 
 * This script migrates all data from Firebase Firestore to PostgreSQL.
 * 
 * Usage:
 *   1. Set up your .env file with DATABASE_URL and Firebase credentials
 *   2. Run: npm run db:push (to create tables)
 *   3. Run: npm run migrate:firestore
 * 
 * IMPORTANT: 
 *   - Back up your Firestore data before running this script
 *   - Run this script only once
 *   - The script uses upsert, so it's safe to re-run if needed
 */

import 'dotenv/config';
import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const firestore = admin.firestore();

// Statistics
const stats = {
  users: 0,
  families: 0,
  members: 0,
  children: 0,
  invites: 0,
  expenses: 0,
  tasks: 0,
  events: 0,
  messages: 0,
  swapRequests: 0,
  documents: 0,
  custodySchedules: 0,
  errors: [] as string[],
};

/**
 * Convert Firestore timestamp to Date
 */
function toDate(value: admin.firestore.Timestamp | Date | unknown): Date {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return new Date();
}

/**
 * Migrate Users
 */
async function migrateUsers(): Promise<void> {
  console.log('\n📦 Migrating users...');
  
  const usersSnap = await firestore.collection('users').get();
  
  for (const doc of usersSnap.docs) {
    try {
      const data = doc.data();
      
      await prisma.user.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          email: data.email?.toLowerCase() || `${doc.id}@unknown.com`,
          fullName: data.fullName || null,
          phone: data.phone || null,
          photoUrl: data.photoUrl || null,
          calendarColor: data.calendarColor || null,
          activeFamilyId: null, // Will be set later
          createdAt: toDate(data.createdAt),
        },
        update: {},
      });

      // Migrate push tokens
      const pushTokens = data.pushTokens || [];
      for (const token of pushTokens) {
        if (token) {
          await prisma.pushToken.upsert({
            where: { token },
            create: {
              token,
              userId: doc.id,
              platform: 'unknown',
            },
            update: { userId: doc.id },
          });
        }
      }

      stats.users++;
    } catch (error) {
      stats.errors.push(`User ${doc.id}: ${(error as Error).message}`);
    }
  }
  
  console.log(`   ✅ Migrated ${stats.users} users`);
}

/**
 * Migrate Families and subcollections
 */
async function migrateFamilies(): Promise<void> {
  console.log('\n📦 Migrating families...');
  
  const familiesSnap = await firestore.collection('families').get();
  
  for (const doc of familiesSnap.docs) {
    try {
      const data = doc.data();
      const members = data.members || [];
      
      // Determine owner
      let ownerId = data.ownerId || members[0];
      
      // Ensure owner exists
      const ownerExists = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true },
      });
      
      if (!ownerExists && members.length > 0) {
        // Try to find any existing member
        for (const memberId of members) {
          const memberExists = await prisma.user.findUnique({
            where: { id: memberId },
            select: { id: true },
          });
          if (memberExists) {
            ownerId = memberId;
            break;
          }
        }
      }
      
      if (!ownerId) {
        console.log(`   ⚠️ Skipping family ${doc.id} - no valid owner`);
        continue;
      }

      // Create family
      await prisma.family.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          name: data.name || null,
          photoUrl: data.photoUrl || null,
          shareCode: data.shareCode || null,
          shareCodeUpdatedAt: data.shareCodeUpdatedAt ? toDate(data.shareCodeUpdatedAt) : null,
          ownerId,
          createdAt: toDate(data.createdAt),
        },
        update: {},
      });

      stats.families++;

      // Migrate members
      for (const memberId of members) {
        const memberExists = await prisma.user.findUnique({
          where: { id: memberId },
          select: { id: true },
        });
        
        if (memberExists) {
          await prisma.familyMember.upsert({
            where: { familyId_userId: { familyId: doc.id, userId: memberId } },
            create: {
              familyId: doc.id,
              userId: memberId,
              role: memberId === ownerId ? 'owner' : 'member',
            },
            update: {},
          });
          stats.members++;
        }
      }

      // Migrate children (from array to separate table)
      const children = data.children || [];
      for (const childName of children) {
        if (childName && typeof childName === 'string') {
          await prisma.familyChild.create({
            data: {
              familyId: doc.id,
              name: childName,
            },
          });
          stats.children++;
        }
      }

      // Migrate pending invites
      const invites = data.pendingInvites || [];
      for (const invite of invites) {
        if (invite?.email) {
          await prisma.familyInvite.upsert({
            where: { familyId_email: { familyId: doc.id, email: invite.email.toLowerCase() } },
            create: {
              familyId: doc.id,
              email: invite.email.toLowerCase(),
              displayEmail: invite.displayEmail || invite.email,
              invitedById: invite.invitedBy || ownerId,
              invitedByName: invite.invitedByName || null,
              status: invite.status || 'pending',
              createdAt: invite.createdAt ? new Date(invite.createdAt) : new Date(),
            },
            update: {},
          });
          stats.invites++;
        }
      }

      // Migrate subcollections
      await migrateExpenses(doc.id);
      await migrateTasks(doc.id);
      await migrateCalendarEvents(doc.id);
      await migrateMessages(doc.id);
      await migrateSwapRequests(doc.id);
      await migrateDocuments(doc.id);
      await migrateCustodySchedule(doc.id);
      await migrateFinanceSettings(doc.id);

    } catch (error) {
      stats.errors.push(`Family ${doc.id}: ${(error as Error).message}`);
    }
  }
  
  console.log(`   ✅ Migrated ${stats.families} families`);
  console.log(`   ✅ Migrated ${stats.members} members`);
  console.log(`   ✅ Migrated ${stats.children} children`);
  console.log(`   ✅ Migrated ${stats.invites} invites`);
}

/**
 * Migrate Expenses
 */
async function migrateExpenses(familyId: string): Promise<void> {
  const snap = await firestore
    .collection('families')
    .doc(familyId)
    .collection('expenses')
    .get();

  for (const doc of snap.docs) {
    try {
      const data = doc.data();
      
      // Ensure creator exists
      let createdById = data.createdBy || 'unknown';
      const creatorExists = await prisma.user.findUnique({
        where: { id: createdById },
        select: { id: true },
      });
      
      if (!creatorExists) {
        // Create placeholder user
        await prisma.user.upsert({
          where: { id: createdById },
          create: {
            id: createdById,
            email: `${createdById}@migrated.local`,
            fullName: data.createdByName || 'Migrated User',
          },
          update: {},
        });
      }

      await prisma.expense.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          familyId,
          title: data.title || 'הוצאה',
          amount: data.amount || 0,
          date: toDate(data.date),
          notes: data.notes || null,
          receiptUrl: data.receiptPreview || data.downloadUrl || null,
          receiptName: data.receiptName || null,
          splitParent1: data.splitParent1 ?? 50,
          status: data.status || 'pending',
          isPaid: data.isPaid || false,
          createdById,
          createdByName: data.createdByName || null,
          updatedById: data.updatedBy || null,
          updatedByName: data.updatedByName || null,
          createdAt: toDate(data.createdAt),
        },
        update: {},
      });
      stats.expenses++;
    } catch (error) {
      stats.errors.push(`Expense ${doc.id}: ${(error as Error).message}`);
    }
  }
}

/**
 * Migrate Tasks
 */
async function migrateTasks(familyId: string): Promise<void> {
  const snap = await firestore
    .collection('families')
    .doc(familyId)
    .collection('tasks')
    .get();

  for (const doc of snap.docs) {
    try {
      const data = doc.data();
      
      let createdById = data.createdBy || 'unknown';
      const creatorExists = await prisma.user.findUnique({
        where: { id: createdById },
        select: { id: true },
      });
      
      if (!creatorExists) {
        await prisma.user.upsert({
          where: { id: createdById },
          create: {
            id: createdById,
            email: `${createdById}@migrated.local`,
          },
          update: {},
        });
      }

      await prisma.task.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          familyId,
          title: data.title || 'משימה',
          description: data.description || null,
          dueDate: data.dueDate ? toDate(data.dueDate) : null,
          priority: data.priority || 'medium',
          status: data.status || 'pending',
          assignedTo: data.assignedTo || 'both',
          category: data.category || 'other',
          childId: data.childId || null,
          createdById,
          createdByName: data.createdByName || null,
          completedAt: data.completedAt ? toDate(data.completedAt) : null,
          createdAt: toDate(data.createdAt),
        },
        update: {},
      });
      stats.tasks++;
    } catch (error) {
      stats.errors.push(`Task ${doc.id}: ${(error as Error).message}`);
    }
  }
}

/**
 * Migrate Calendar Events
 */
async function migrateCalendarEvents(familyId: string): Promise<void> {
  const snap = await firestore
    .collection('families')
    .doc(familyId)
    .collection('calendarEvents')
    .get();

  for (const doc of snap.docs) {
    try {
      const data = doc.data();

      await prisma.calendarEvent.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          familyId,
          title: data.title || 'אירוע',
          description: data.description || null,
          startDate: toDate(data.startDate),
          endDate: toDate(data.endDate),
          type: data.type || 'other',
          parentId: data.parentId || 'both',
          targetUids: data.targetUids || [],
          color: data.color || null,
          location: data.location || null,
          reminderMinutes: data.reminderMinutes || null,
          isAllDay: data.isAllDay || false,
          childId: data.childId || null,
          swapRequestId: data.swapRequestId || null,
          createdById: data.createdBy || null,
          createdByName: data.createdByName || null,
          createdAt: toDate(data.createdAt),
        },
        update: {},
      });
      stats.events++;
    } catch (error) {
      stats.errors.push(`Event ${doc.id}: ${(error as Error).message}`);
    }
  }
}

/**
 * Migrate Chat Messages
 */
async function migrateMessages(familyId: string): Promise<void> {
  const snap = await firestore
    .collection('families')
    .doc(familyId)
    .collection('messages')
    .get();

  for (const doc of snap.docs) {
    try {
      const data = doc.data();
      
      let senderId = data.senderId || 'unknown';
      const senderExists = await prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true },
      });
      
      if (!senderExists) {
        await prisma.user.upsert({
          where: { id: senderId },
          create: {
            id: senderId,
            email: `${senderId}@migrated.local`,
          },
          update: {},
        });
      }

      await prisma.chatMessage.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          familyId,
          senderId,
          senderName: data.senderName || null,
          text: data.text || '',
          sentAt: toDate(data.sentAt),
        },
        update: {},
      });
      stats.messages++;
    } catch (error) {
      stats.errors.push(`Message ${doc.id}: ${(error as Error).message}`);
    }
  }
}

/**
 * Migrate Swap Requests
 */
async function migrateSwapRequests(familyId: string): Promise<void> {
  const snap = await firestore
    .collection('families')
    .doc(familyId)
    .collection('swapRequests')
    .get();

  for (const doc of snap.docs) {
    try {
      const data = doc.data();
      
      // Ensure users exist
      for (const userId of [data.requestedBy, data.requestedTo]) {
        if (userId) {
          const exists = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
          });
          if (!exists) {
            await prisma.user.upsert({
              where: { id: userId },
              create: {
                id: userId,
                email: `${userId}@migrated.local`,
              },
              update: {},
            });
          }
        }
      }

      await prisma.swapRequest.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          familyId,
          requestedById: data.requestedBy || 'unknown',
          requestedByName: data.requestedByName || null,
          requestedToId: data.requestedTo || 'unknown',
          requestedToName: data.requestedToName || null,
          originalDate: toDate(data.originalDate),
          proposedDate: data.proposedDate ? toDate(data.proposedDate) : null,
          requestType: data.requestType || 'swap',
          reason: data.reason || null,
          status: data.status || 'pending',
          responseNote: data.responseNote || null,
          respondedAt: data.respondedAt ? toDate(data.respondedAt) : null,
          createdAt: toDate(data.createdAt),
        },
        update: {},
      });
      stats.swapRequests++;
    } catch (error) {
      stats.errors.push(`SwapRequest ${doc.id}: ${(error as Error).message}`);
    }
  }
}

/**
 * Migrate Documents
 */
async function migrateDocuments(familyId: string): Promise<void> {
  const snap = await firestore
    .collection('families')
    .doc(familyId)
    .collection('documents')
    .get();

  for (const doc of snap.docs) {
    try {
      const data = doc.data();
      
      // Skip if no URL (dataUrl documents can't be migrated to S3)
      const fileUrl = data.downloadUrl || data.storagePath;
      if (!fileUrl && data.dataUrl) {
        console.log(`   ⚠️ Document ${doc.id} has dataUrl only - manual migration needed`);
        continue;
      }

      await prisma.document.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          familyId,
          title: data.title || 'מסמך',
          fileName: data.fileName || 'unknown',
          fileUrl: fileUrl || 'migration-pending',
          childId: data.childId || null,
          uploadedById: data.uploadedBy || null,
          uploadedByName: data.uploadedByName || null,
          uploadedAt: toDate(data.uploadedAt),
        },
        update: {},
      });
      stats.documents++;
    } catch (error) {
      stats.errors.push(`Document ${doc.id}: ${(error as Error).message}`);
    }
  }
}

/**
 * Migrate Custody Schedule
 */
async function migrateCustodySchedule(familyId: string): Promise<void> {
  const snap = await firestore
    .collection('families')
    .doc(familyId)
    .collection('settings')
    .doc('custodySchedule')
    .get();

  if (!snap.exists) return;

  try {
    const data = snap.data()!;

    const schedule = await prisma.custodySchedule.upsert({
      where: { familyId },
      create: {
        familyId,
        name: data.name || null,
        pattern: data.pattern || 'weekly',
        startDate: toDate(data.startDate),
        endDate: data.endDate ? toDate(data.endDate) : null,
        parent1Days: data.parent1Days || [],
        parent2Days: data.parent2Days || [],
        biweeklyAltParent1Days: data.biweeklyAltParent1Days || [],
        biweeklyAltParent2Days: data.biweeklyAltParent2Days || [],
        isActive: data.isActive ?? true,
      },
      update: {},
    });

    // Migrate pending approval if exists
    if (data.pendingApproval) {
      await prisma.custodyApprovalRequest.upsert({
        where: { scheduleId: schedule.id },
        create: {
          scheduleId: schedule.id,
          name: data.pendingApproval.name || null,
          pattern: data.pendingApproval.pattern || 'weekly',
          startDate: toDate(data.pendingApproval.startDate),
          parent1Days: data.pendingApproval.parent1Days || [],
          parent2Days: data.pendingApproval.parent2Days || [],
          requestedById: data.pendingApproval.requestedBy || null,
          requestedByName: data.pendingApproval.requestedByName || null,
          requestedAt: toDate(data.pendingApproval.requestedAt),
        },
        update: {},
      });
    }

    stats.custodySchedules++;
  } catch (error) {
    stats.errors.push(`CustodySchedule ${familyId}: ${(error as Error).message}`);
  }
}

/**
 * Migrate Finance Settings
 */
async function migrateFinanceSettings(familyId: string): Promise<void> {
  const snap = await firestore
    .collection('families')
    .doc(familyId)
    .collection('settings')
    .doc('finance')
    .get();

  if (!snap.exists) return;

  try {
    const data = snap.data()!;

    const settings = await prisma.financeSettings.upsert({
      where: { familyId },
      create: {
        familyId,
        alimonyAmount: data.alimonyAmount || 0,
        alimonyPayer: data.alimonyPayer || null,
        defaultSplitParent1: data.defaultSplitParent1 ?? 50,
      },
      update: {},
    });

    // Migrate fixed expenses
    const fixedExpenses = data.fixedExpenses || [];
    for (const expense of fixedExpenses) {
      if (expense?.title) {
        await prisma.fixedExpense.create({
          data: {
            settingsId: settings.id,
            title: expense.title,
            amount: expense.amount || 0,
            splitParent1: expense.splitParent1 ?? 50,
          },
        });
      }
    }
  } catch (error) {
    stats.errors.push(`FinanceSettings ${familyId}: ${(error as Error).message}`);
  }
}

/**
 * Update user's active family
 */
async function updateActiveFamily(): Promise<void> {
  console.log('\n📦 Updating active family references...');
  
  const usersSnap = await firestore.collection('users').get();
  
  for (const doc of usersSnap.docs) {
    try {
      const data = doc.data();
      const activeFamilyId = data.activeFamilyId || data.ownedFamilyId;
      
      if (activeFamilyId) {
        // Verify family exists
        const familyExists = await prisma.family.findUnique({
          where: { id: activeFamilyId },
          select: { id: true },
        });
        
        if (familyExists) {
          await prisma.user.update({
            where: { id: doc.id },
            data: { activeFamilyId },
          });
        }
      }
    } catch (error) {
      // Ignore errors - user might not exist
    }
  }
  
  console.log('   ✅ Updated active family references');
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  console.log('🚀 Starting migration from Firestore to PostgreSQL...');
  console.log('================================================\n');

  const startTime = Date.now();

  try {
    await migrateUsers();
    await migrateFamilies();
    await updateActiveFamily();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n================================================');
    console.log('📊 Migration Summary:');
    console.log('================================================');
    console.log(`   Users:            ${stats.users}`);
    console.log(`   Families:         ${stats.families}`);
    console.log(`   Members:          ${stats.members}`);
    console.log(`   Children:         ${stats.children}`);
    console.log(`   Invites:          ${stats.invites}`);
    console.log(`   Expenses:         ${stats.expenses}`);
    console.log(`   Tasks:            ${stats.tasks}`);
    console.log(`   Events:           ${stats.events}`);
    console.log(`   Messages:         ${stats.messages}`);
    console.log(`   Swap Requests:    ${stats.swapRequests}`);
    console.log(`   Documents:        ${stats.documents}`);
    console.log(`   Custody Schedules: ${stats.custodySchedules}`);
    console.log(`   Errors:           ${stats.errors.length}`);
    console.log(`   Duration:         ${duration}s`);
    console.log('================================================\n');

    if (stats.errors.length > 0) {
      console.log('⚠️ Errors encountered:');
      stats.errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
    }

    console.log('\n✅ Migration completed!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
