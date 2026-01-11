import { Router } from 'express';
import { calendarController } from './calendar.controller.js';
import { familyMemberMiddleware } from '../../middleware/family.middleware.js';
import custodyOverridesRoutes from '../custody-overrides/custody-overrides.routes.js';

const router = Router();

// All routes require family membership
router.use('/:familyId', familyMemberMiddleware);

// Events routes
router.get('/:familyId/events', (req, res) => calendarController.getEvents(req, res));
router.get('/:familyId/events/:eventId', (req, res) => calendarController.getEventById(req, res));
router.post('/:familyId/events', (req, res) => calendarController.createEvent(req, res));
router.patch('/:familyId/events/:eventId', (req, res) => calendarController.updateEvent(req, res));
router.delete('/:familyId/events/:eventId', (req, res) => calendarController.deleteEvent(req, res));

// Custody schedule routes
router.get('/:familyId/custody', (req, res) => calendarController.getCustodySchedule(req, res));
router.put('/:familyId/custody', (req, res) => calendarController.saveCustodySchedule(req, res));
router.post('/:familyId/custody/approve', (req, res) => calendarController.respondToCustodyApproval(req, res));
router.post('/:familyId/custody/cancel', (req, res) => calendarController.cancelCustodyApprovalRequest(req, res));
router.delete('/:familyId/custody', (req, res) => calendarController.deleteCustodySchedule(req, res));

// Custody overrides routes (nested under calendar)
router.use('/:familyId/custody-overrides', custodyOverridesRoutes);

export default router;
