import { Router } from 'express';
import { swapRequestsController } from './swap-requests.controller.js';
import { familyMemberMiddleware } from '../../middleware/family.middleware.js';

const router = Router();

// All routes require family membership
router.use('/:familyId', familyMemberMiddleware);

// Swap requests routes
router.get('/:familyId', (req, res) => swapRequestsController.getAll(req, res));
router.get('/:familyId/:requestId', (req, res) => swapRequestsController.getById(req, res));
router.post('/:familyId', (req, res) => swapRequestsController.create(req, res));
router.patch('/:familyId/:requestId/status', (req, res) => swapRequestsController.updateStatus(req, res));

// Counter flow routes
router.post('/:familyId/:requestId/counter', (req, res) => swapRequestsController.counter(req, res));
router.post('/:familyId/:requestId/accept-counter', (req, res) => swapRequestsController.acceptCounter(req, res));
router.post('/:familyId/:requestId/reject-counter', (req, res) => swapRequestsController.rejectCounter(req, res));

export default router;
