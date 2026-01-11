import { Router } from 'express';
import { usersController } from './users.controller.js';

const router = Router();

// Sync endpoint - creates/updates user from Firebase
router.post('/sync', (req, res) => usersController.syncFromFirebase(req, res));

// Current user routes
router.get('/me', (req, res) => usersController.getMe(req, res));
router.post('/me', (req, res) => usersController.createOrUpdate(req, res));
router.patch('/me', (req, res) => usersController.updateProfile(req, res));
router.get('/me/families', (req, res) => usersController.getMyFamilies(req, res));
router.put('/me/active-family', (req, res) => usersController.setActiveFamily(req, res));
router.post('/me/push-token', (req, res) => usersController.addPushToken(req, res));
router.delete('/me/push-token', (req, res) => usersController.removePushToken(req, res));

// Other user routes
router.get('/:userId', (req, res) => usersController.getById(req, res));

export default router;
