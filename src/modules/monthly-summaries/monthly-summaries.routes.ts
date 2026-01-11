import { Router } from 'express';
import { monthlySummariesController } from './monthly-summaries.controller.js';

const router = Router({ mergeParams: true }); // mergeParams to access :familyId from parent router

// Monthly summaries routes
router.get('/', (req, res) => monthlySummariesController.getAll(req as any, res));
router.get('/:year/:month', (req, res) => monthlySummariesController.getByMonth(req as any, res));
router.post('/', (req, res) => monthlySummariesController.upsert(req as any, res));
router.post('/:year/:month/calculate', (req, res) => monthlySummariesController.calculate(req as any, res));
router.delete('/:year/:month', (req, res) => monthlySummariesController.delete(req as any, res));

export default router;
