import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { FamilyRequest } from '../../middleware/family.middleware.js';
import { familiesService } from './families.service.js';
import {
  createFamilySchema,
  updateFamilySchema,
  inviteCoParentSchema,
  joinByCodeSchema,
  addChildSchema,
  updateChildSchema,
} from './families.schema.js';

export class FamiliesController {
  /**
   * POST /api/families
   * Create a new family
   */
  async create(req: AuthRequest, res: Response) {
    const userId = req.user!.uid;
    const data = createFamilySchema.parse(req.body);

    const family = await familiesService.createFamily(userId, data);
    return res.status(201).json(family);
  }

  /**
   * GET /api/families/:familyId
   * Get family details
   */
  async getById(req: FamilyRequest, res: Response) {
    const family = await familiesService.getById(req.familyId!);

    if (!family) {
      return res.status(404).json({
        error: 'not-found',
        message: 'Family not found',
      });
    }

    return res.json(family);
  }

  /**
   * PATCH /api/families/:familyId
   * Update family
   */
  async update(req: FamilyRequest, res: Response) {
    const data = updateFamilySchema.parse(req.body);
    const family = await familiesService.updateFamily(req.familyId!, data);
    return res.json(family);
  }

  /**
   * DELETE /api/families/:familyId
   * Delete family (owner only)
   */
  async delete(req: FamilyRequest, res: Response) {
    if (req.familyRole !== 'owner') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Only the owner can delete the family',
      });
    }

    await familiesService.deleteFamily(req.familyId!);
    return res.json({ success: true });
  }

  /**
   * POST /api/families/:familyId/invite
   * Invite co-parent by email
   */
  async inviteCoParent(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;
    const { email } = inviteCoParentSchema.parse(req.body);

    try {
      const invite = await familiesService.inviteCoParent(
        req.familyId!,
        email,
        userId,
        req.body.inviterName
      );
      return res.status(201).json(invite);
    } catch (error) {
      const message = (error as Error).message;
      
      if (message === 'family-full') {
        return res.status(400).json({
          error: 'family-full',
          message: 'Family already has 2 members',
        });
      }
      
      if (message === 'already-invited') {
        return res.status(409).json({
          error: 'already-invited',
          message: 'This email has already been invited',
        });
      }
      
      if (message === 'self-invite') {
        return res.status(400).json({
          error: 'self-invite',
          message: 'You cannot invite yourself',
        });
      }
      
      throw error;
    }
  }

  /**
   * POST /api/families/join
   * Join family by share code
   */
  async joinByCode(req: AuthRequest, res: Response) {
    const userId = req.user!.uid;
    const { shareCode } = joinByCodeSchema.parse(req.body);

    try {
      const family = await familiesService.joinByShareCode(shareCode, userId);
      return res.json(family);
    } catch (error) {
      const message = (error as Error).message;
      
      if (message === 'invalid-share-code') {
        return res.status(404).json({
          error: 'invalid-share-code',
          message: 'Invalid share code',
        });
      }
      
      if (message === 'family-full') {
        return res.status(400).json({
          error: 'family-full',
          message: 'Family already has 2 members',
        });
      }
      
      throw error;
    }
  }

  /**
   * POST /api/families/:familyId/leave
   * Leave family
   */
  async leave(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;

    try {
      await familiesService.leaveFamily(req.familyId!, userId);
      return res.json({ success: true });
    } catch (error) {
      const message = (error as Error).message;
      
      if (message === 'owner-cannot-leave') {
        return res.status(400).json({
          error: 'owner-cannot-leave',
          message: 'Owner cannot leave the family. Transfer ownership or delete.',
        });
      }
      
      throw error;
    }
  }

  /**
   * POST /api/families/:familyId/regenerate-code
   * Generate new share code
   */
  async regenerateShareCode(req: FamilyRequest, res: Response) {
    const family = await familiesService.regenerateShareCode(req.familyId!);
    return res.json({ shareCode: family.shareCode });
  }

  /**
   * GET /api/families/:familyId/members
   * Get family members
   */
  async getMembers(req: FamilyRequest, res: Response) {
    const members = await familiesService.getMembers(req.familyId!);
    return res.json(members);
  }

  /**
   * POST /api/families/:familyId/children
   * Add child
   */
  async addChild(req: FamilyRequest, res: Response) {
    const data = addChildSchema.parse(req.body);
    const child = await familiesService.addChild(req.familyId!, data);
    return res.status(201).json(child);
  }

  /**
   * PATCH /api/families/:familyId/children/:childId
   * Update child
   */
  async updateChild(req: FamilyRequest, res: Response) {
    const { childId } = req.params;
    const data = updateChildSchema.parse(req.body);
    const child = await familiesService.updateChild(childId, data);
    return res.json(child);
  }

  /**
   * DELETE /api/families/:familyId/children/:childId
   * Remove child
   */
  async removeChild(req: FamilyRequest, res: Response) {
    const { childId } = req.params;
    await familiesService.removeChild(childId);
    return res.json({ success: true });
  }

  /**
   * POST /api/families/:familyId/sync-membership
   * Sync membership from Firebase - confirms the auto-created membership
   * Called by Angular client when joining a family
   */
  async syncMembership(req: FamilyRequest, res: Response) {
    // The familyMemberMiddleware already auto-created the family and membership
    // This endpoint just confirms it was successful
    const userId = req.user!.uid;
    const familyId = req.familyId!;
    
    console.log(`[Families] Membership synced: user ${userId} in family ${familyId}`);
    
    const family = await familiesService.getById(familyId);
    return res.json({ 
      success: true, 
      familyId, 
      role: req.familyRole,
      family 
    });
  }

  /**
   * POST /api/families/accept-invite
   * Accept pending invite (called after login/signup)
   */
  async acceptInvite(req: AuthRequest, res: Response) {
    const userId = req.user!.uid;
    const email = req.user!.email;

    if (!email) {
      return res.status(400).json({
        error: 'bad-request',
        message: 'Email is required',
      });
    }

    try {
      const familyId = await familiesService.acceptInviteByEmail(email, userId);

      if (!familyId) {
        return res.json({ familyId: null, message: 'No pending invite found' });
      }

      const family = await familiesService.getById(familyId);
      return res.json({ familyId, family });
    } catch (error) {
      const message = (error as Error).message;
      
      if (message === 'family-full') {
        return res.status(400).json({
          error: 'family-full',
          message: 'Family already has 2 members',
        });
      }
      
      throw error;
    }
  }
}

export const familiesController = new FamiliesController();
export default familiesController;
