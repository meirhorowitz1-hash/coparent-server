import { Router } from 'express';
import { expensesController } from './expenses.controller.js';
import { familyMemberMiddleware } from '../../middleware/family.middleware.js';

const router = Router();

// All routes require family membership
router.use('/:familyId', familyMemberMiddleware);

// Expenses routes
router.get('/:familyId', (req, res) => expensesController.getAll(req, res));
router.get('/:familyId/summary', (req, res) => expensesController.getSummary(req, res));
router.get('/:familyId/settings', (req, res) => expensesController.getSettings(req, res));
router.put('/:familyId/settings', (req, res) => expensesController.updateSettings(req, res));
router.get('/:familyId/:expenseId', (req, res) => expensesController.getById(req, res));
router.post('/:familyId', (req, res) => expensesController.create(req, res));
router.patch('/:familyId/:expenseId', (req, res) => expensesController.update(req, res));
router.patch('/:familyId/:expenseId/status', (req, res) => expensesController.updateStatus(req, res));
router.patch('/:familyId/:expenseId/paid', (req, res) => expensesController.togglePaid(req, res));
router.delete('/:familyId/:expenseId', (req, res) => expensesController.delete(req, res));

export default router;
