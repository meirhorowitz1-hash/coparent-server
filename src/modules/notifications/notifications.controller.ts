import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import notificationsService from './notifications.service.js';
import {
  createNotificationSchema,
  updateNotificationPreferencesSchema,
  markAsReadSchema,
  markAllAsReadSchema,
} from './notifications.schema.js';

export class NotificationsController {
  /**
   * GET /api/notifications
   * Get user notifications with pagination and filters
   */
  async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const { familyId, unreadOnly, limit, offset } = req.query;

      const result = await notificationsService.getUserNotifications(userId, {
        familyId: familyId as string,
        unreadOnly: unreadOnly === 'true',
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });

      return res.json(result);
    } catch (error) {
      console.error('[NotificationsController] getNotifications error:', error);
      return res.status(500).json({ error: 'failed-to-get-notifications' });
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Get unread notification count
   */
  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const { familyId } = req.query;

      const count = await notificationsService.getUnreadCount(
        userId,
        familyId as string
      );

      return res.json({ count });
    } catch (error) {
      console.error('[NotificationsController] getUnreadCount error:', error);
      return res.status(500).json({ error: 'failed-to-get-count' });
    }
  }

  /**
   * POST /api/notifications
   * Create a notification (internal/admin use)
   */
  async createNotification(req: AuthRequest, res: Response) {
    try {
      const validation = createNotificationSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'validation-error',
          details: validation.error.issues,
        });
      }

      const notification = await notificationsService.createNotification(validation.data);

      return res.status(201).json(notification);
    } catch (error) {
      console.error('[NotificationsController] createNotification error:', error);
      return res.status(500).json({ error: 'failed-to-create-notification' });
    }
  }

  /**
   * PUT /api/notifications/read
   * Mark specific notifications as read
   */
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const validation = markAsReadSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'validation-error',
          details: validation.error.issues,
        });
      }

      await notificationsService.markAsRead(userId, validation.data.notificationIds);

      return res.json({ success: true });
    } catch (error) {
      console.error('[NotificationsController] markAsRead error:', error);
      return res.status(500).json({ error: 'failed-to-mark-as-read' });
    }
  }

  /**
   * PUT /api/notifications/read-all
   * Mark all notifications as read
   */
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const validation = markAllAsReadSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'validation-error',
          details: validation.error.issues,
        });
      }

      await notificationsService.markAllAsRead(userId, validation.data.familyId);

      return res.json({ success: true });
    } catch (error) {
      console.error('[NotificationsController] markAllAsRead error:', error);
      return res.status(500).json({ error: 'failed-to-mark-all-as-read' });
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Delete a notification
   */
  async deleteNotification(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const { id } = req.params;

      await notificationsService.deleteNotification(userId, id);

      return res.json({ success: true });
    } catch (error) {
      console.error('[NotificationsController] deleteNotification error:', error);
      return res.status(500).json({ error: 'failed-to-delete-notification' });
    }
  }

  /**
   * DELETE /api/notifications
   * Delete all notifications for user
   */
  async deleteAllNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const { familyId } = req.query;

      await notificationsService.deleteAllNotifications(userId, familyId as string);

      return res.json({ success: true });
    } catch (error) {
      console.error('[NotificationsController] deleteAllNotifications error:', error);
      return res.status(500).json({ error: 'failed-to-delete-all-notifications' });
    }
  }

  /**
   * GET /api/notifications/preferences
   * Get user notification preferences
   */
  async getPreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;

      const preferences = await notificationsService.getUserPreferences(userId);

      return res.json(preferences || {
        expenseNotifications: true,
        swapRequestNotifications: true,
        taskNotifications: true,
        calendarNotifications: true,
        chatNotifications: true,
        emailNotifications: true,
        pushNotifications: true,
        quietHoursEnabled: false,
      });
    } catch (error) {
      console.error('[NotificationsController] getPreferences error:', error);
      return res.status(500).json({ error: 'failed-to-get-preferences' });
    }
  }

  /**
   * PUT /api/notifications/preferences
   * Update user notification preferences
   */
  async updatePreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const validation = updateNotificationPreferencesSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'validation-error',
          details: validation.error.issues,
        });
      }

      const preferences = await notificationsService.updatePreferences(
        userId,
        validation.data
      );

      return res.json(preferences);
    } catch (error) {
      console.error('[NotificationsController] updatePreferences error:', error);
      return res.status(500).json({ error: 'failed-to-update-preferences' });
    }
  }
}

export const notificationsController = new NotificationsController();
export default notificationsController;
