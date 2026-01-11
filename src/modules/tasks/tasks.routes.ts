import { Router } from 'express';
import { tasksController } from './tasks.controller.js';
import { familyMemberMiddleware } from '../../middleware/family.middleware.js';

const router = Router();

// All routes require family membership
router.use('/:familyId', familyMemberMiddleware);

// Tasks routes
router.get('/:familyId', (req, res) => tasksController.getAll(req, res));
router.get('/:familyId/stats', (req, res) => tasksController.getStats(req, res));
router.get('/:familyId/:taskId', (req, res) => tasksController.getById(req, res));
router.post('/:familyId', (req, res) => tasksController.create(req, res));
router.patch('/:familyId/:taskId', (req, res) => tasksController.update(req, res));
router.patch('/:familyId/:taskId/status', (req, res) => tasksController.updateStatus(req, res));
router.delete('/:familyId/:taskId', (req, res) => tasksController.delete(req, res));

export default router;
