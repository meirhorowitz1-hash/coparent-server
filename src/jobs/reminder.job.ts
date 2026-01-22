import cron from 'node-cron';
import prisma from '../config/database.js';
import { sendPushToUsers } from '../utils/push.js';
import { formatDateTimeHebrew, formatDateHebrew } from '../utils/helpers.js';

/**
 * Dispatch due event reminders
 * Runs every minute
 */
async function dispatchDueEventReminders(): Promise<void> {
  const now = new Date();

  try {
    // Find reminders that are due and not yet sent
    const dueReminders = await prisma.eventReminder.findMany({
      where: {
        sent: false,
        sendAt: { lte: now },
      },
      take: 50, // Process in batches
    });

    if (dueReminders.length === 0) {
      return;
    }

    console.log(`[Reminder Job] Found ${dueReminders.length} due event reminders`);

    for (const reminder of dueReminders) {
      try {
        // Send push notification
        await sendPushToUsers(
          reminder.targetUids,
          {
            title: `תזכורת: ${reminder.title}`,
            body: formatDateTimeHebrew(reminder.startDate),
          },
          {
            type: 'calendar-event-reminder',
            familyId: reminder.familyId,
            eventId: reminder.eventId,
          }
        );

        // Mark as sent
        await prisma.eventReminder.update({
          where: { id: reminder.id },
          data: {
            sent: true,
            sentAt: new Date(),
          },
        });

        console.log(`[Reminder Job] Sent event reminder for ${reminder.eventId}`);
      } catch (error) {
        console.error(`[Reminder Job] Failed to send event reminder ${reminder.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Reminder Job] Event reminders error:', error);
  }
}

/**
 * Dispatch due task reminders
 * Runs every minute
 */
async function dispatchDueTaskReminders(): Promise<void> {
  const now = new Date();

  try {
    // Find task reminders that are due and not yet sent
    const dueReminders = await prisma.taskReminder.findMany({
      where: {
        sent: false,
        sendAt: { lte: now },
      },
      include: {
        task: true,
      },
      take: 50, // Process in batches
    });

    if (dueReminders.length === 0) {
      return;
    }

    console.log(`[Reminder Job] Found ${dueReminders.length} due task reminders`);

    for (const reminder of dueReminders) {
      try {
        // Skip if task is already completed
        if (reminder.task?.status === 'completed' || reminder.task?.status === 'cancelled') {
          // Mark as sent without sending
          await prisma.taskReminder.update({
            where: { id: reminder.id },
            data: {
              sent: true,
              sentAt: new Date(),
            },
          });
          continue;
        }

        // Send push notification
        await sendPushToUsers(
          reminder.targetUids,
          {
            title: `תזכורת למשימה: ${reminder.title}`,
            body: reminder.dueDate ? formatDateHebrew(reminder.dueDate) : 'ללא תאריך',
          },
          {
            type: 'task-reminder',
            familyId: reminder.familyId,
            taskId: reminder.taskId,
          }
        );

        // Mark as sent
        await prisma.taskReminder.update({
          where: { id: reminder.id },
          data: {
            sent: true,
            sentAt: new Date(),
          },
        });

        console.log(`[Reminder Job] Sent task reminder for ${reminder.taskId}`);
      } catch (error) {
        console.error(`[Reminder Job] Failed to send task reminder ${reminder.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Reminder Job] Task reminders error:', error);
  }
}

/**
 * Dispatch all due reminders (events + tasks)
 * Runs every minute
 */
async function dispatchDueReminders(): Promise<void> {
  const now = new Date();
  console.log('[Reminder Job] Checking for due reminders at', now.toISOString());

  await Promise.all([
    dispatchDueEventReminders(),
    dispatchDueTaskReminders(),
  ]);
}

/**
 * Clean up old sent reminders (older than 7 days)
 * Runs daily at midnight
 */
async function cleanupOldReminders(): Promise<void> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    // Clean up event reminders
    const eventResult = await prisma.eventReminder.deleteMany({
      where: {
        sent: true,
        sentAt: { lt: sevenDaysAgo },
      },
    });

    // Clean up task reminders
    const taskResult = await prisma.taskReminder.deleteMany({
      where: {
        sent: true,
        sentAt: { lt: sevenDaysAgo },
      },
    });

    const totalCleaned = eventResult.count + taskResult.count;
    if (totalCleaned > 0) {
      console.log(`[Reminder Job] Cleaned up ${totalCleaned} old reminders (${eventResult.count} events, ${taskResult.count} tasks)`);
    }
  } catch (error) {
    console.error('[Reminder Job] Cleanup error:', error);
  }
}

// Schedule the jobs
if (process.env.NODE_ENV !== 'test') {
  // Every minute - dispatch due reminders
  cron.schedule('* * * * *', async () => {
    await dispatchDueReminders();
  });

  // Daily at midnight - cleanup old reminders
  cron.schedule('0 0 * * *', async () => {
    await cleanupOldReminders();
  });

  console.log('[Reminder Job] Scheduled jobs initialized');
}

export { dispatchDueReminders, cleanupOldReminders };
