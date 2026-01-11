import { Router } from 'express';
import { GoalsController } from './goals.controller.js';

const router = Router({ mergeParams: true }); // mergeParams to access familyId from parent router
const goalsController = new GoalsController();

// Goal Tables
router.get('/', goalsController.getAll.bind(goalsController));
router.get('/:tableId', goalsController.getById.bind(goalsController));
router.post('/', goalsController.create.bind(goalsController));
router.put('/:tableId', goalsController.update.bind(goalsController));
router.delete('/:tableId', goalsController.delete.bind(goalsController));

// Progress
router.get('/:tableId/progress', goalsController.getProgress.bind(goalsController));
router.post('/:tableId/progress', goalsController.upsertProgress.bind(goalsController));

// Stats
router.get('/:tableId/stats', goalsController.getStats.bind(goalsController));

export default router;
