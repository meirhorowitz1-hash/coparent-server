import { Request, Response } from 'express';
import { custodyOverridesService } from './custody-overrides.service.js';
import { createCustodyOverrideSchema, respondCustodyOverrideSchema } from './custody-overrides.schema.js';

interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
  };
}

export class CustodyOverridesController {
  /**
   * GET /api/calendar/:familyId/custody-overrides
   */
  async getAll(req: AuthRequest, res: Response) {
    const { familyId } = req.params;
    const { status, startDate, endDate } = req.query;

    const overrides = await custodyOverridesService.getAll(familyId, {
      status: status as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });

    return res.json(overrides);
  }

  /**
   * GET /api/calendar/:familyId/custody-overrides/:overrideId
   */
  async getById(req: AuthRequest, res: Response) {
    const { overrideId } = req.params;

    const override = await custodyOverridesService.getById(overrideId);

    if (!override) {
      return res.status(404).json({ error: 'custody-override-not-found' });
    }

    return res.json(override);
  }

  /**
   * POST /api/calendar/:familyId/custody-overrides
   */
  async create(req: AuthRequest, res: Response) {
    const { familyId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const validation = createCustodyOverrideSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation-error', details: validation.error.errors });
    }

    try {
      const override = await custodyOverridesService.create(familyId, userId, validation.data);
      return res.status(201).json(override);
    } catch (error: any) {
      if (error.message === 'custody-override-overlap') {
        return res.status(409).json({ error: 'custody-override-overlap' });
      }
      throw error;
    }
  }

  /**
   * POST /api/calendar/:familyId/custody-overrides/:overrideId/respond
   */
  async respond(req: AuthRequest, res: Response) {
    const { overrideId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const validation = respondCustodyOverrideSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation-error', details: validation.error.errors });
    }

    try {
      const override = await custodyOverridesService.respond(overrideId, userId, validation.data);
      return res.json(override);
    } catch (error: any) {
      if (error.message === 'custody-override-not-found') {
        return res.status(404).json({ error: 'custody-override-not-found' });
      }
      if (error.message === 'custody-override-not-pending') {
        return res.status(400).json({ error: 'custody-override-not-pending' });
      }
      if (error.message === 'custody-override-response-forbidden') {
        return res.status(403).json({ error: 'custody-override-response-forbidden' });
      }
      throw error;
    }
  }

  /**
   * POST /api/calendar/:familyId/custody-overrides/:overrideId/cancel
   */
  async cancel(req: AuthRequest, res: Response) {
    const { overrideId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    try {
      await custodyOverridesService.cancel(overrideId, userId);
      return res.json({ success: true });
    } catch (error: any) {
      if (error.message === 'custody-override-not-found') {
        return res.status(404).json({ error: 'custody-override-not-found' });
      }
      if (error.message === 'custody-override-cancel-not-allowed') {
        return res.status(400).json({ error: 'custody-override-cancel-not-allowed' });
      }
      if (error.message === 'custody-override-cancel-forbidden') {
        return res.status(403).json({ error: 'custody-override-cancel-forbidden' });
      }
      throw error;
    }
  }

  /**
   * DELETE /api/calendar/:familyId/custody-overrides/:overrideId
   */
  async delete(req: AuthRequest, res: Response) {
    const { familyId, overrideId } = req.params;

    try {
      await custodyOverridesService.delete(overrideId, familyId);
      return res.json({ success: true });
    } catch (error: any) {
      if (error.message === 'custody-override-not-found') {
        return res.status(404).json({ error: 'custody-override-not-found' });
      }
      throw error;
    }
  }

  /**
   * DELETE /api/calendar/:familyId/custody-overrides
   */
  async deleteAll(req: AuthRequest, res: Response) {
    const { familyId } = req.params;

    const result = await custodyOverridesService.deleteAll(familyId);
    return res.json({ success: true, deletedCount: result.count });
  }
}

export const custodyOverridesController = new CustodyOverridesController();
export default custodyOverridesController;
