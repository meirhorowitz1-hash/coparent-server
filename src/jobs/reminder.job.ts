import cron from 'node-cron';
import prisma from '../config/database.js';
import { sendPushToUsers } from '../utils/push.js';
import { formatDateTimeHebrew } from '../utils/helpers.js';

/**
 * Dispatch due event reminders
 * Runs every minute
 */
async function dispatchDueReminders(): Promise<void> {
  const now = new Date();
  
  console.log('[Reminder Job] Checking for due reminders at', now.toISOString());

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

    console.log(`[Reminder Job] Found ${dueReminders.length} due reminders`);

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

        console.log(`[Reminder Job] Sent reminder for event ${reminder.eventId}`);
      } catch (error) {
        console.error(`[Reminder Job] Failed to send reminder ${reminder.id}:`, error);
        // Don't mark as sent so it will be retried
      }
    }
  } catch (error) {
    console.error('[Reminder Job] Error:', error);
  }
}

/**
 * Clean up old sent reminders (older than 7 days)
 * Runs daily at midnight
 */
async function cleanupOldReminders(): Promise<void> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const result = await prisma.eventReminder.deleteMany({
      where: {
        sent: true,
        sentAt: { lt: sevenDaysAgo },
      },
    });

    if (result.count > 0) {
      console.log(`[Reminder Job] Cleaned up ${result.count} old reminders`);
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
