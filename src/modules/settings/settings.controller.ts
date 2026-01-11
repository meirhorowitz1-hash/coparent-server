import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import settingsService from './settings.service.js';
import {
  updateUserSettingsSchema,
  updateFamilySettingsSchema,
  updatePrivacySettingsSchema,
  updateFinanceSettingsSchema,
} from './settings.schema.js';

export class SettingsController {
  /**
   * GET /api/settings/user
   * Get user settings
   */
  async getUserSettings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const settings = await settingsService.getUserSettings(userId);
      return res.json(settings);
    } catch (error) {
      console.error('[SettingsController] getUserSettings error:', error);
      return res.status(500).json({ error: 'failed-to-get-settings' });
    }
  }

  /**
   * PUT /api/settings/user
   * Update user settings
   */
  async updateUserSettings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const validation = updateUserSettingsSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'validation-error',
          details: validation.error.issues,
        });
      }

      const settings = await settingsService.updateUserSettings(userId, validation.data);
      return res.json(settings);
    } catch (error) {
      console.error('[SettingsController] updateUserSettings error:', error);
      return res.status(500).json({ error: 'failed-to-update-settings' });
    }
  }

  /**
   * GET /api/settings/family/:familyId
   * Get family settings
   */
  async getFamilySettings(req: AuthRequest, res: Response) {
    try {
      const { familyId } = req.params;
      const settings = await settingsService.getFamilySettings(familyId);
      return res.json(settings);
    } catch (error) {
      console.error('[SettingsController] getFamilySettings error:', error);
      return res.status(500).json({ error: 'failed-to-get-settings' });
    }
  }

  /**
   * PUT /api/settings/family/:familyId
   * Update family settings
   */
  async updateFamilySettings(req: AuthRequest, res: Response) {
    try {
      const { familyId } = req.params;
      const validation = updateFamilySettingsSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'validation-error',
          details: validation.error.issues,
        });
      }

      const settings = await settingsService.updateFamilySettings(familyId, validation.data);
      return res.json(settings);
    } catch (error: any) {
      console.error('[SettingsController] updateFamilySettings error:', error);
      
      if (error.message === 'Percentages must sum to 100') {
        return res.status(400).json({ error: error.message });
      }
      
      return res.status(500).json({ error: 'failed-to-update-settings' });
    }
  }

  /**
   * GET /api/settings/privacy
   * Get privacy settings
   */
  async getPrivacySettings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const settings = await settingsService.getPrivacySettings(userId);
      return res.json(settings);
    } catch (error) {
      console.error('[SettingsController] getPrivacySettings error:', error);
      return res.status(500).json({ error: 'failed-to-get-settings' });
    }
  }

  /**
   * PUT /api/settings/privacy
   * Update privacy settings
   */
  async updatePrivacySettings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const validation = updatePrivacySettingsSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'validation-error',
          details: validation.error.issues,
        });
      }

      const settings = await settingsService.updatePrivacySettings(userId, validation.data);
      return res.json(settings);
    } catch (error: any) {
      console.error('[SettingsController] updatePrivacySettings error:', error);
      
      if (error.message === 'Cannot block yourself' || error.message === 'User is not blocked') {
        return res.status(400).json({ error: error.message });
      }
      
      return res.status(500).json({ error: 'failed-to-update-settings' });
    }
  }

  /**
   * GET /api/settings/finance/:familyId
   * Get finance settings
   */
  async getFinanceSettings(req: AuthRequest, res: Response) {
    try {
      const { familyId } = req.params;
      const settings = await settingsService.getFinanceSettings(familyId);
      return res.json(settings);
    } catch (error) {
      console.error('[SettingsController] getFinanceSettings error:', error);
      return res.status(500).json({ error: 'failed-to-get-settings' });
    }
  }

  /**
   * PUT /api/settings/finance/:familyId
   * Update finance settings
   */
  async updateFinanceSettings(req: AuthRequest, res: Response) {
    try {
      const { familyId } = req.params;
      const validation = updateFinanceSettingsSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'validation-error',
          details: validation.error.issues,
        });
      }

      const settings = await settingsService.updateFinanceSettings(familyId, validation.data);
      return res.json(settings);
    } catch (error) {
      console.error('[SettingsController] updateFinanceSettings error:', error);
      return res.status(500).json({ error: 'failed-to-update-settings' });
    }
  }

  /**
   * GET /api/settings/all
   * Get all user settings (combined)
   */
  async getAllUserSettings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const settings = await settingsService.getAllUserSettings(userId);
      return res.json(settings);
    } catch (error) {
      console.error('[SettingsController] getAllUserSettings error:', error);
      return res.status(500).json({ error: 'failed-to-get-settings' });
    }
  }

  /**
   * GET /api/settings/family/:familyId/all
   * Get all family settings (combined)
   */
  async getAllFamilySettings(req: AuthRequest, res: Response) {
    try {
      const { familyId } = req.params;
      const settings = await settingsService.getAllFamilySettings(familyId);
      return res.json(settings);
    } catch (error) {
      console.error('[SettingsController] getAllFamilySettings error:', error);
      return res.status(500).json({ error: 'failed-to-get-settings' });
    }
  }
}

export const settingsController = new SettingsController();
export default settingsController;
