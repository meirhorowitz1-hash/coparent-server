import { Response } from 'express';
import { FamilyRequest } from '../../middleware/family.middleware.js';
import { swapRequestsService } from './swap-requests.service.js';
import {
  createSwapRequestSchema,
  updateSwapStatusSchema,
} from './swap-requests.schema.js';

export class SwapRequestsController {
  /**
   * GET /api/swap-requests/:familyId
   * Get all swap requests
   */
  async getAll(req: FamilyRequest, res: Response) {
    const { status } = req.query;

    const requests = await swapRequestsService.getAll(
      req.familyId!,
      status as string | undefined
    );

    return res.json(requests);
  }

  /**
   * GET /api/swap-requests/:familyId/:requestId
   * Get single swap request
   */
  async getById(req: FamilyRequest, res: Response) {
    const { requestId } = req.params;
    const request = await swapRequestsService.getById(requestId);

    if (!request) {
      return res.status(404).json({
        error: 'not-found',
        message: 'Swap request not found',
      });
    }

    return res.json(request);
  }

  /**
   * POST /api/swap-requests/:familyId
   * Create swap request
   */
  async create(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;
    const userName = req.body.requestedByName || 'הורה';
    const data = createSwapRequestSchema.parse(req.body);

    try {
      const request = await swapRequestsService.create(
        req.familyId!,
        userId,
        userName,
        data
      );

      return res.status(201).json(request);
    } catch (error) {
      if ((error as Error).message === 'no-other-parent') {
        return res.status(400).json({
          error: 'no-other-parent',
          message: 'No other parent in this family to send the request to',
        });
      }
      throw error;
    }
  }

  /**
   * PATCH /api/swap-requests/:familyId/:requestId/status
   * Update swap request status
   */
  async updateStatus(req: FamilyRequest, res: Response) {
    const { requestId } = req.params;
    const userId = req.user!.uid;
    const { status, responseNote } = updateSwapStatusSchema.parse(req.body);

    try {
      const request = await swapRequestsService.updateStatus(
        requestId,
        req.familyId!,
        userId,
        status,
        responseNote
      );

      return res.json(request);
    } catch (error) {
      const message = (error as Error).message;

      if (message === 'swap-request-not-found') {
        return res.status(404).json({
          error: 'not-found',
          message: 'Swap request not found',
        });
      }

      if (message === 'swap-request-not-pending') {
        return res.status(400).json({
          error: 'swap-request-not-pending',
          message: 'Swap request is not pending',
        });
      }

      if (message === 'swap-request-cancel-forbidden') {
        return res.status(403).json({
          error: 'swap-request-cancel-forbidden',
          message: 'Only the requester can cancel this request',
        });
      }

      if (message === 'swap-request-response-forbidden') {
        return res.status(403).json({
          error: 'swap-request-response-forbidden',
          message: 'Only the recipient can approve or reject this request',
        });
      }

      throw error;
    }
  }

  /**
   * POST /api/swap-requests/:familyId/:requestId/counter
   * Counter swap request with different proposed date
   */
  async counter(req: FamilyRequest, res: Response) {
    const { requestId } = req.params;
    const userId = req.user!.uid;
    const { proposedDate, counterNote } = req.body;

    if (!proposedDate) {
      return res.status(400).json({
        error: 'validation-error',
        message: 'proposedDate is required',
      });
    }

    try {
      const request = await swapRequestsService.counter(
        requestId,
        req.familyId!,
        userId,
        new Date(proposedDate),
        counterNote
      );

      return res.json(request);
    } catch (error) {
      const message = (error as Error).message;

      if (message === 'swap-request-not-found') {
        return res.status(404).json({ error: 'swap-request-not-found' });
      }
      if (message === 'swap-request-not-pending') {
        return res.status(400).json({ error: 'swap-request-not-pending' });
      }
      if (message === 'swap-request-response-forbidden') {
        return res.status(403).json({ error: 'swap-request-response-forbidden' });
      }
      if (message === 'swap-counter-not-allowed') {
        return res.status(400).json({ error: 'swap-counter-not-allowed' });
      }

      throw error;
    }
  }

  /**
   * POST /api/swap-requests/:familyId/:requestId/accept-counter
   * Accept counter offer
   */
  async acceptCounter(req: FamilyRequest, res: Response) {
    const { requestId } = req.params;
    const userId = req.user!.uid;

    try {
      const request = await swapRequestsService.acceptCounter(
        requestId,
        req.familyId!,
        userId
      );

      return res.json(request);
    } catch (error) {
      const message = (error as Error).message;

      if (message === 'swap-request-not-found') {
        return res.status(404).json({ error: 'swap-request-not-found' });
      }
      if (message === 'swap-counter-not-pending') {
        return res.status(400).json({ error: 'swap-counter-not-pending' });
      }
      if (message === 'swap-counter-accept-forbidden') {
        return res.status(403).json({ error: 'swap-counter-accept-forbidden' });
      }

      throw error;
    }
  }

  /**
   * POST /api/swap-requests/:familyId/:requestId/reject-counter
   * Reject counter offer
   */
  async rejectCounter(req: FamilyRequest, res: Response) {
    const { requestId } = req.params;
    const userId = req.user!.uid;
    const { counterResponseNote } = req.body;

    try {
      const request = await swapRequestsService.rejectCounter(
        requestId,
        req.familyId!,
        userId,
        counterResponseNote
      );

      return res.json(request);
    } catch (error) {
      const message = (error as Error).message;

      if (message === 'swap-request-not-found') {
        return res.status(404).json({ error: 'swap-request-not-found' });
      }
      if (message === 'swap-counter-not-pending') {
        return res.status(400).json({ error: 'swap-counter-not-pending' });
      }
      if (message === 'swap-counter-reject-forbidden') {
        return res.status(403).json({ error: 'swap-counter-reject-forbidden' });
      }

      throw error;
    }
  }
}

export const swapRequestsController = new SwapRequestsController();
export default swapRequestsController;
