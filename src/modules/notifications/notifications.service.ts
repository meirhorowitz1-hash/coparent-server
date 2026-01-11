import prisma from '../../config/database.js';
import { sendPushToUser } from '../../utils/push.js';
import { 
  CreateNotificationInput, 
  UpdateNotificationPreferencesInput 
} from './notifications.schema.js';

/**
 * Hybrid Notifications Service
 * Works with both PostgreSQL (via Prisma) and Firebase
 * When using Firebase, notifications are stored in Firestore and push is sent via FCM
 */
export class NotificationsService {
  private useFirebase: boolean;

  constructor(useFirebase: boolean = false) {
    this.useFirebase = useFirebase;
  }

  /**
   * Create a notification
   * Stores in DB and optionally sends push notification
   */
  async createNotification(data: CreateNotificationInput) {
    if (this.useFirebase) {
      return this.createNotificationFirebase(data);
    }

    // Check user notification preferences
    const preferences = await this.getUserPreferences(data.userId);
    
    // Check if notifications are enabled
    if (!this.shouldSendNotification(data.type, preferences)) {
      console.log(`[Notifications] Skipping notification for user ${data.userId} (disabled in preferences)`);
      return null;
    }

    // Check quiet hours
    if (preferences?.quietHoursEnabled && this.isInQuietHours(preferences)) {
      console.log(`[Notifications] Skipping notification for user ${data.userId} (quiet hours)`);
      return null;
    }

    // Create notification in DB
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        familyId: data.familyId,
        type: data.type,
        title: data.title,
        body: data.body,
        priority: data.priority,
        data: data.data as any,
        actionUrl: data.actionUrl,
        read: false,
      },
    });

    // Send push notification if requested and enabled
    if (data.sendPush && preferences?.pushNotifications !== false) {
      await this.sendPush(data.userId, {
        title: data.title,
        body: data.body,
        data: {
          notificationId: notification.id,
          type: data.type,
          actionUrl: data.actionUrl,
          ...data.data,
        },
      });
    }

    return notification;
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, options?: {
    familyId?: string;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    if (this.useFirebase) {
      return this.getUserNotificationsFirebase(userId, options);
    }

    const where: any = { userId };
    
    if (options?.familyId) {
      where.familyId = options.familyId;
    }
    
    if (options?.unreadOnly) {
      where.read = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      total,
      unread: options?.unreadOnly ? total : await prisma.notification.count({
        where: { ...where, read: false },
      }),
    };
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string, familyId?: string) {
    if (this.useFirebase) {
      return this.getUnreadCountFirebase(userId, familyId);
    }

    const where: any = { userId, read: false };
    if (familyId) {
      where.familyId = familyId;
    }

    return prisma.notification.count({ where });
  }

  /**
   * Mark notification(s) as read
   */
  async markAsRead(userId: string, notificationIds: string[]) {
    if (this.useFirebase) {
      return this.markAsReadFirebase(userId, notificationIds);
    }

    return prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId,
      },
      data: { read: true },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string, familyId?: string) {
    if (this.useFirebase) {
      return this.markAllAsReadFirebase(userId, familyId);
    }

    const where: any = { userId, read: false };
    if (familyId) {
      where.familyId = familyId;
    }

    return prisma.notification.updateMany({
      where,
      data: { read: true },
    });
  }

  /**
   * Delete notification
   */
  async deleteNotification(userId: string, notificationId: string) {
    if (this.useFirebase) {
      return this.deleteNotificationFirebase(userId, notificationId);
    }

    return prisma.notification.delete({
      where: {
        id: notificationId,
        userId,
      },
    });
  }

  /**
   * Delete all notifications for user
   */
  async deleteAllNotifications(userId: string, familyId?: string) {
    if (this.useFirebase) {
      return this.deleteAllNotificationsFirebase(userId, familyId);
    }

    const where: any = { userId };
    if (familyId) {
      where.familyId = familyId;
    }

    return prisma.notification.deleteMany({ where });
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string) {
    if (this.useFirebase) {
      return this.getUserPreferencesFirebase(userId);
    }

    return prisma.notificationPreferences.findUnique({
      where: { userId },
    });
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(userId: string, data: UpdateNotificationPreferencesInput) {
    if (this.useFirebase) {
      return this.updatePreferencesFirebase(userId, data);
    }

    return prisma.notificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: data,
    });
  }

  /**
   * Send push notification to user
   */
  private async sendPush(userId: string, payload: {
    title: string;
    body: string;
    data?: Record<string, any>;
  }) {
    try {
      const data = payload.data
        ? Object.fromEntries(
            Object.entries(payload.data).map(([key, value]) => [key, String(value)])
          )
        : undefined;

      await sendPushToUser(userId, { title: payload.title, body: payload.body }, data);
    } catch (error) {
      console.error(`[Notifications] Failed to send push:`, error);
    }
  }

  /**
   * Check if should send notification based on user preferences
   */
  private shouldSendNotification(type: string, preferences: any): boolean {
    if (!preferences) return true;

    switch (type) {
      case 'expense_created':
      case 'expense_approved':
      case 'expense_rejected':
      case 'expense_paid':
        return preferences.expenseNotifications !== false;
      
      case 'swap_request_created':
      case 'swap_request_approved':
      case 'swap_request_rejected':
        return preferences.swapRequestNotifications !== false;
      
      case 'task_assigned':
      case 'task_completed':
        return preferences.taskNotifications !== false;
      
      case 'calendar_event_created':
      case 'calendar_event_updated':
      case 'calendar_event_reminder':
        return preferences.calendarNotifications !== false;
      
      case 'chat_message':
        return preferences.chatNotifications !== false;
      
      default:
        return true;
    }
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(preferences: any): boolean {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = preferences.quietHoursStart.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;

    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  // ==================== Firebase Methods ====================
  // These methods will be called when useFirebase = true

  private async createNotificationFirebase(data: CreateNotificationInput) {
    // TODO: Implement Firebase Firestore creation
    // Example structure:
    // await firestore.collection('notifications').add({
    //   userId: data.userId,
    //   familyId: data.familyId,
    //   type: data.type,
    //   title: data.title,
    //   body: data.body,
    //   priority: data.priority,
    //   data: data.data,
    //   actionUrl: data.actionUrl,
    //   read: false,
    //   createdAt: admin.firestore.FieldValue.serverTimestamp(),
    // });
    console.log('[Notifications] Firebase mode not fully implemented yet');
    return null;
  }

  private async getUserNotificationsFirebase(userId: string, options?: any) {
    // TODO: Implement Firebase Firestore query
    console.log('[Notifications] Firebase mode not fully implemented yet');
    return { notifications: [], total: 0, unread: 0 };
  }

  private async getUnreadCountFirebase(userId: string, familyId?: string) {
    // TODO: Implement Firebase Firestore count
    console.log('[Notifications] Firebase mode not fully implemented yet');
    return 0;
  }

  private async markAsReadFirebase(userId: string, notificationIds: string[]) {
    // TODO: Implement Firebase Firestore batch update
    console.log('[Notifications] Firebase mode not fully implemented yet');
    return null;
  }

  private async markAllAsReadFirebase(userId: string, familyId?: string) {
    // TODO: Implement Firebase Firestore batch update
    console.log('[Notifications] Firebase mode not fully implemented yet');
    return null;
  }

  private async deleteNotificationFirebase(userId: string, notificationId: string) {
    // TODO: Implement Firebase Firestore delete
    console.log('[Notifications] Firebase mode not fully implemented yet');
    return null;
  }

  private async deleteAllNotificationsFirebase(userId: string, familyId?: string) {
    // TODO: Implement Firebase Firestore batch delete
    console.log('[Notifications] Firebase mode not fully implemented yet');
    return null;
  }

  private async getUserPreferencesFirebase(userId: string) {
    // TODO: Implement Firebase Firestore get
    console.log('[Notifications] Firebase mode not fully implemented yet');
    return null;
  }

  private async updatePreferencesFirebase(userId: string, data: UpdateNotificationPreferencesInput) {
    // TODO: Implement Firebase Firestore set/update
    console.log('[Notifications] Firebase mode not fully implemented yet');
    return null;
  }
}

// Export singleton instances
export const notificationsService = new NotificationsService(false); // PostgreSQL
export const notificationsServiceFirebase = new NotificationsService(true); // Firebase

export default notificationsService;
