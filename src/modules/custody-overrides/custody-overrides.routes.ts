import { Router } from 'express';
import { custodyOverridesController } from './custody-overrides.controller.js';

const router = Router({ mergeParams: true }); // mergeParams to access :familyId from parent router

// Custody overrides routes
router.get('/', (req, res) => custodyOverridesController.getAll(req as any, res));
router.get('/:overrideId', (req, res) => custodyOverridesController.getById(req as any, res));
router.post('/', (req, res) => custodyOverridesController.create(req as any, res));
router.post('/:overrideId/respond', (req, res) => custodyOverridesController.respond(req as any, res));
router.post('/:overrideId/cancel', (req, res) => custodyOverridesController.cancel(req as any, res));
router.delete('/:overrideId', (req, res) => custodyOverridesController.delete(req as any, res));
router.delete('/', (req, res) => custodyOverridesController.deleteAll(req as any, res));

export default router;
