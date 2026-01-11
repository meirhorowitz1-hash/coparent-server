import { Router } from 'express';
import { authMiddleware as authenticate } from '../../middleware/auth.middleware.js';
import { familyMemberMiddleware as requireFamilyMembership } from '../../middleware/family.middleware.js';
import settingsController from './settings.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// User Settings
router.get('/user', (req, res) => settingsController.getUserSettings(req, res));
router.put('/user', (req, res) => settingsController.updateUserSettings(req, res));

// Privacy Settings
router.get('/privacy', (req, res) => settingsController.getPrivacySettings(req, res));
router.put('/privacy', (req, res) => settingsController.updatePrivacySettings(req, res));

// All User Settings (combined)
router.get('/all', (req, res) => settingsController.getAllUserSettings(req, res));

// Family Settings (requires family membership)
router.get('/family/:familyId', requireFamilyMembership, (req, res) => 
  settingsController.getFamilySettings(req, res)
);
router.put('/family/:familyId', requireFamilyMembership, (req, res) => 
  settingsController.updateFamilySettings(req, res)
);

// Finance Settings (requires family membership)
router.get('/finance/:familyId', requireFamilyMembership, (req, res) => 
  settingsController.getFinanceSettings(req, res)
);
router.put('/finance/:familyId', requireFamilyMembership, (req, res) => 
  settingsController.updateFinanceSettings(req, res)
);

// All Family Settings (combined)
router.get('/family/:familyId/all', requireFamilyMembership, (req, res) => 
  settingsController.getAllFamilySettings(req, res)
);

export default router;
