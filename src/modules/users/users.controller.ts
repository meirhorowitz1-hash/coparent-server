import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { usersService } from './users.service.js';
import { 
  createUserSchema, 
  updateUserSchema, 
  addPushTokenSchema 
} from './users.schema.js';

export class UsersController {
  /**
   * POST /api/users/sync
   * Sync user from Firebase - creates or updates user in PostgreSQL
   */
  async syncFromFirebase(req: AuthRequest, res: Response) {
    const userId = req.user!.uid;
    const email = req.user!.email;
    const { fullName, photoUrl, phone } = req.body;

    try {
      const user = await usersService.upsertUser(userId, email || '', {
        fullName: fullName || undefined,
        photoUrl: photoUrl || undefined,
        phone: phone || undefined,
      });

      console.log(`[Users] Synced user from Firebase: ${userId} (${email})`);
      return res.json({ success: true, user });
    } catch (error) {
      console.error('[Users] Sync failed:', error);
      return res.status(500).json({
        error: 'sync-failed',
        message: 'Failed to sync user',
      });
    }
  }

  /**
   * GET /api/users/me
   * Get current user profile
   */
  async getMe(req: AuthRequest, res: Response) {
    const userId = req.user!.uid;
    const email = req.user!.email;

    // Upsert user on first access
    let user = await usersService.getById(userId);

    if (!user && email) {
      await usersService.upsertUser(userId, email);
      user = await usersService.getById(userId);
    }

    if (!user) {
      return res.status(404).json({
        error: 'not-found',
        message: 'User not found',
      });
    }

    return res.json(user);
  }

  /**
   * POST /api/users/me
   * Create/update user profile (first login)
   */
  async createOrUpdate(req: AuthRequest, res: Response) {
    const userId = req.user!.uid;
    const email = req.user!.email;

    if (!email) {
      return res.status(400).json({
        error: 'bad-request',
        message: 'Email is required',
      });
    }

    const data = createUserSchema.parse(req.body);
    const user = await usersService.upsertUser(userId, email, data);

    return res.json(user);
  }

  /**
   * PATCH /api/users/me
   * Update user profile
   */
  async updateProfile(req: AuthRequest, res: Response) {
    const userId = req.user!.uid;
    const data = updateUserSchema.parse(req.body);

    const user = await usersService.updateProfile(userId, data);
    return res.json(user);
  }

  /**
   * GET /api/users/me/families
   * Get user's families
   */
  async getMyFamilies(req: AuthRequest, res: Response) {
    const userId = req.user!.uid;
    const families = await usersService.getUserFamilies(userId);
    return res.json(families);
  }

  /**
   * PUT /api/users/me/active-family
   * Set active family
   */
  async setActiveFamily(req: AuthRequest, res: Response) {
    const userId = req.user!.uid;
    const { familyId } = req.body;

    try {
      const user = await usersService.setActiveFamily(userId, familyId || null);
      return res.json(user);
    } catch (error) {
      if ((error as Error).message === 'not-family-member') {
        return res.status(403).json({
          error: 'forbidden',
          message: 'You are not a member of this family',
        });
      }
      throw error;
    }
  }

  /**
   * POST /api/users/me/push-token
   * Add push notification token
   */
  async addPushToken(req: AuthRequest, res: Response) {
    const userId = req.user!.uid;
    const data = addPushTokenSchema.parse(req.body);

    const token = await usersService.addPushToken(userId, data);
    return res.json(token);
  }

  /**
   * DELETE /api/users/me/push-token
   * Remove push notification token
   */
  async removePushToken(req: AuthRequest, res: Response) {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'bad-request',
        message: 'Token is required',
      });
    }

    await usersService.removePushToken(token);
    return res.json({ success: true });
  }

  /**
   * GET /api/users/:userId
   * Get user by ID (for viewing other family members)
   */
  async getById(req: AuthRequest, res: Response) {
    const { userId } = req.params;
    
    const user = await usersService.getById(userId);

    if (!user) {
      return res.status(404).json({
        error: 'not-found',
        message: 'User not found',
      });
    }

    // Return limited info for other users
    return res.json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      photoUrl: user.photoUrl,
      calendarColor: user.calendarColor,
    });
  }
}

export const usersController = new UsersController();
export default usersController;
