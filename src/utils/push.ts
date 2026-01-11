import prisma from '../config/database.js';
import { sendPushNotification } from '../config/firebase.js';

export interface PushPayload {
  title: string;
  body: string;
}

/**
 * Send push notification to all members of a family (except sender)
 */
export async function sendPushToFamilyMembers(
  familyId: string,
  excludeUserId: string | null,
  notification: PushPayload,
  data?: Record<string, string>
): Promise<void> {
  try {
    // Get all family members
    const members = await prisma.familyMember.findMany({
      where: { familyId },
      select: { userId: true },
    });

    // Filter out the sender
    const targetUserIds = members
      .map((m) => m.userId)
      .filter((uid) => uid !== excludeUserId);

    if (!targetUserIds.length) return;

    await sendPushToUsers(targetUserIds, notification, data);
  } catch (error) {
    console.error('[Push] Failed to send to family members:', error);
  }
}

/**
 * Send push notification to a specific user
 */
export async function sendPushToUser(
  userId: string,
  notification: PushPayload,
  data?: Record<string, string>
): Promise<void> {
  return sendPushToUsers([userId], notification, data);
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToUsers(
  userIds: string[],
  notification: PushPayload,
  data?: Record<string, string>
): Promise<void> {
  if (!userIds.length) return;

  try {
    // Get all push tokens for these users
    const tokens = await prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true, userId: true },
    });

    if (!tokens.length) {
      console.log('[Push] No tokens found for users:', userIds);
      return;
    }

    const tokenStrings = tokens.map((t) => t.token);

    const result = await sendPushNotification(tokenStrings, notification, data);

    console.log('[Push] Sent:', {
      success: result.successCount,
      failed: result.failureCount,
      users: userIds.length,
    });

    // Remove invalid tokens
    if (result.invalidTokens.length) {
      await prisma.pushToken.deleteMany({
        where: { token: { in: result.invalidTokens } },
      });
      console.log('[Push] Removed invalid tokens:', result.invalidTokens.length);
    }
  } catch (error) {
    console.error('[Push] Failed to send notifications:', error);
  }
}

/**
 * Get the other parent's user ID in a family
 */
export async function getOtherParentId(
  familyId: string,
  currentUserId: string
): Promise<string | null> {
  const members = await prisma.familyMember.findMany({
    where: { familyId },
    select: { userId: true },
  });

  const otherMember = members.find((m) => m.userId !== currentUserId);
  return otherMember?.userId ?? null;
}

export default {
  sendPushToFamilyMembers,
  sendPushToUser,
  sendPushToUsers,
  getOtherParentId,
};
