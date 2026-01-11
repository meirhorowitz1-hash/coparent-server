import { Response } from 'express';
import { FamilyRequest } from '../../middleware/family.middleware.js';
import { calendarService } from './calendar.service.js';
import {
  createEventSchema,
  updateEventSchema,
  custodyScheduleSchema,
  approvalResponseSchema,
} from './calendar.schema.js';

export class CalendarController {
  /**
   * GET /api/calendar/:familyId/events
   * Get all events
   */
  async getEvents(req: FamilyRequest, res: Response) {
    const { startDate, endDate, type } = req.query;

    const filters = {
      ...(type && { type: type as string }),
      ...(startDate && endDate && {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      }),
    };

    const events = await calendarService.getEvents(req.familyId!, filters);
    return res.json(events);
  }

  /**
   * GET /api/calendar/:familyId/events/:eventId
   * Get single event
   */
  async getEventById(req: FamilyRequest, res: Response) {
    const { eventId } = req.params;
    const event = await calendarService.getEventById(eventId);

    if (!event) {
      return res.status(404).json({
        error: 'not-found',
        message: 'Event not found',
      });
    }

    return res.json(event);
  }

  /**
   * POST /api/calendar/:familyId/events
   * Create event
   */
  async createEvent(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;
    const userName = req.body.createdByName || 'הורה';
    
    // Debug: log incoming data
    console.log('[Calendar] Creating event, raw body:', JSON.stringify(req.body, null, 2));
    
    const data = createEventSchema.parse(req.body);

    const event = await calendarService.createEvent(
      req.familyId!,
      userId,
      userName,
      data
    );

    return res.status(201).json(event);
  }

  /**
   * PATCH /api/calendar/:familyId/events/:eventId
   * Update event
   */
  async updateEvent(req: FamilyRequest, res: Response) {
    const { eventId } = req.params;
    const data = updateEventSchema.parse(req.body);

    try {
      const event = await calendarService.updateEvent(eventId, req.familyId!, data);
      return res.json(event);
    } catch (error) {
      if ((error as Error).message === 'event-not-found') {
        return res.status(404).json({
          error: 'not-found',
          message: 'Event not found',
        });
      }
      throw error;
    }
  }

  /**
   * DELETE /api/calendar/:familyId/events/:eventId
   * Delete event
   */
  async deleteEvent(req: FamilyRequest, res: Response) {
    const { eventId } = req.params;

    await calendarService.deleteEvent(eventId, req.familyId!);
    return res.json({ success: true });
  }

  /**
   * GET /api/calendar/:familyId/custody
   * Get custody schedule
   */
  async getCustodySchedule(req: FamilyRequest, res: Response) {
    const schedule = await calendarService.getCustodySchedule(req.familyId!);
    return res.json(schedule);
  }

  /**
   * PUT /api/calendar/:familyId/custody
   * Save custody schedule
   */
  async saveCustodySchedule(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;
    const userName = req.body.requestedByName || 'הורה';
    const data = custodyScheduleSchema.parse(req.body);

    const schedule = await calendarService.saveCustodySchedule(
      req.familyId!,
      userId,
      userName,
      data
    );

    return res.json(schedule);
  }

  /**
   * POST /api/calendar/:familyId/custody/approve
   * Respond to custody approval request
   */
  async respondToCustodyApproval(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;
    const { approve } = approvalResponseSchema.parse(req.body);

    try {
      const schedule = await calendarService.respondToCustodyApproval(
        req.familyId!,
        userId,
        approve
      );
      return res.json(schedule);
    } catch (error) {
      const message = (error as Error).message;

      if (message === 'no-pending-approval') {
        return res.status(400).json({
          error: 'no-pending-approval',
          message: 'No pending approval request found',
        });
      }

      if (message === 'requester-cannot-approve') {
        return res.status(403).json({
          error: 'requester-cannot-approve',
          message: 'The requester cannot approve their own request',
        });
      }

      throw error;
    }
  }

  /**
   * POST /api/calendar/:familyId/custody/cancel
   * Cancel custody approval request
   */
  async cancelCustodyApprovalRequest(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;

    try {
      const schedule = await calendarService.cancelCustodyApprovalRequest(
        req.familyId!,
        userId
      );
      return res.json(schedule);
    } catch (error) {
      const message = (error as Error).message;

      if (message === 'no-pending-approval') {
        return res.status(400).json({
          error: 'no-pending-approval',
          message: 'No pending approval request found',
        });
      }

      if (message === 'only-requester-can-cancel') {
        return res.status(403).json({
          error: 'only-requester-can-cancel',
          message: 'Only the requester can cancel the request',
        });
      }

      throw error;
    }
  }

  /**
   * DELETE /api/calendar/:familyId/custody
   * Delete custody schedule
   */
  async deleteCustodySchedule(req: FamilyRequest, res: Response) {
    await calendarService.deleteCustodySchedule(req.familyId!);
    return res.json({ success: true });
  }
}

export const calendarController = new CalendarController();
export default calendarController;
