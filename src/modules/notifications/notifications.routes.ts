import { Router } from 'express';
import { authMiddleware as authenticate } from '../../middleware/auth.middleware.js';
import notificationsController from './notifications.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get notifications
router.get('/', (req, res) => notificationsController.getNotifications(req, res));

// Get unread count
router.get('/unread-count', (req, res) => notificationsController.getUnreadCount(req, res));

// Get preferences
router.get('/preferences', (req, res) => notificationsController.getPreferences(req, res));

// Update preferences
router.put('/preferences', (req, res) => notificationsController.updatePreferences(req, res));

// Mark as read
router.put('/read', (req, res) => notificationsController.markAsRead(req, res));

// Mark all as read
router.put('/read-all', (req, res) => notificationsController.markAllAsRead(req, res));

// Create notification (internal/admin use)
router.post('/', (req, res) => notificationsController.createNotification(req, res));

// Delete notification
router.delete('/:id', (req, res) => notificationsController.deleteNotification(req, res));

// Delete all notifications
router.delete('/', (req, res) => notificationsController.deleteAllNotifications(req, res));

export default router;
