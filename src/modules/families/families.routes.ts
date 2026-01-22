import { Router } from 'express';
import { familiesController } from './families.controller.js';
import { familyMemberMiddleware, familyOwnerMiddleware } from '../../middleware/family.middleware.js';
import chatRoutes from '../chat/chat.routes.js';
import paymentReceiptsRoutes from '../payment-receipts/payment-receipts.routes.js';
import goalsRoutes from '../goals/goals.routes.js';
import monthlySummariesRoutes from '../monthly-summaries/monthly-summaries.routes.js';
import contactsRoutes from '../contacts/contacts.routes.js';

const router = Router();

// Create family
router.post('/', (req, res) => familiesController.create(req, res));

// Join family by code
router.post('/join', (req, res) => familiesController.joinByCode(req, res));

// Accept pending invite
router.post('/accept-invite', (req, res) => familiesController.acceptInvite(req, res));

// Sync membership - auto-creates family and membership from Firebase
router.post('/:familyId/sync-membership', familyMemberMiddleware, (req, res) => 
  familiesController.syncMembership(req, res));

// Family-specific routes (require membership)
router.get('/:familyId', familyMemberMiddleware, (req, res) => 
  familiesController.getById(req, res));

router.patch('/:familyId', familyMemberMiddleware, (req, res) => 
  familiesController.update(req, res));

router.delete('/:familyId', familyOwnerMiddleware, (req, res) => 
  familiesController.delete(req, res));

router.post('/:familyId/invite', familyMemberMiddleware, (req, res) => 
  familiesController.inviteCoParent(req, res));

router.post('/:familyId/leave', familyMemberMiddleware, (req, res) => 
  familiesController.leave(req, res));

router.post('/:familyId/regenerate-code', familyMemberMiddleware, (req, res) => 
  familiesController.regenerateShareCode(req, res));

router.get('/:familyId/members', familyMemberMiddleware, (req, res) => 
  familiesController.getMembers(req, res));

// Children routes
router.post('/:familyId/children', familyMemberMiddleware, (req, res) => 
  familiesController.addChild(req, res));

router.patch('/:familyId/children/:childId', familyMemberMiddleware, (req, res) => 
  familiesController.updateChild(req, res));

router.delete('/:familyId/children/:childId', familyMemberMiddleware, (req, res) => 
  familiesController.removeChild(req, res));

// Chat routes (nested under family)
router.use('/:familyId/chat', familyMemberMiddleware, chatRoutes);

// Payment receipts routes (nested under family)
router.use('/:familyId/payment-receipts', familyMemberMiddleware, paymentReceiptsRoutes);

// Goals routes (nested under family)
router.use('/:familyId/goals', familyMemberMiddleware, goalsRoutes);

// Monthly summaries routes (nested under family)
router.use('/:familyId/monthly-summaries', familyMemberMiddleware, monthlySummariesRoutes);

// Contacts routes (nested under family)
router.use('/:familyId/contacts', familyMemberMiddleware, contactsRoutes);

export default router;
