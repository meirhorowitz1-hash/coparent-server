import prisma from '../../config/database.js';
import { emitToFamily, emitToFamilyExceptUser, SocketEvents } from '../../config/socket.js';
import { sendPushToFamilyMembers, sendPushToUser } from '../../utils/push.js';
import { formatDateTimeHebrew, getParentRole } from '../../utils/helpers.js';
import { CreateEventInput, UpdateEventInput, CustodyScheduleInput } from './calendar.schema.js';
import { createError } from '../../middleware/error.middleware.js';

export class CalendarService {
  /**
   * Get all events for a family
   */
  async getEvents(familyId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
  }) {
    return prisma.calendarEvent.findMany({
      where: {
        familyId,
        ...(filters?.type && { type: filters.type }),
        ...(filters?.startDate && filters?.endDate && {
          OR: [
            {
              startDate: { gte: filters.startDate, lte: filters.endDate },
            },
            {
              endDate: { gte: filters.startDate, lte: filters.endDate },
            },
            {
              AND: [
                { startDate: { lte: filters.startDate } },
                { endDate: { gte: filters.endDate } },
              ],
            },
          ],
        }),
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Get event by ID
   */
  async getEventById(eventId: string) {
    return prisma.calendarEvent.findUnique({
      where: { id: eventId },
    });
  }

  /**
   * Create event
   */
  async createEvent(
    familyId: string,
    userId: string,
    userName: string,
    data: CreateEventInput
  ) {
    const childId = await this.resolveChildId(familyId, data.childId);
    // Get target UIDs based on parentId
    const targetUids = await this.resolveTargetUids(familyId, data.parentId);

    const event = await prisma.calendarEvent.create({
      data: {
        familyId,
        title: data.title,
        description: data.description,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        type: data.type,
        parentId: data.parentId,
        targetUids,
        color: data.color,
        location: data.location,
        reminderMinutes: data.reminderMinutes,
        isAllDay: data.isAllDay,
        childId,
        createdById: userId,
        createdByName: userName,
      },
    });

    // Create reminder if specified
    if (data.reminderMinutes != null && data.reminderMinutes > 0) {
      await this.upsertReminder(event);
    }

    // Emit socket event
    emitToFamilyExceptUser(familyId, userId, SocketEvents.CALENDAR_EVENT_NEW, event);
    emitToFamilyExceptUser(familyId, userId, 'event:created', event);

    // Send push notification
    const startDate = new Date(data.startDate);
    await sendPushToFamilyMembers(
      familyId,
      userId,
      {
        title: 'אירוע חדש בלוח המשפחה',
        body: `${data.title} • ${formatDateTimeHebrew(startDate, data.isAllDay)}`,
      },
      {
        type: 'event-created',
        familyId,
        eventId: event.id,
      }
    );

    return event;
  }

  /**
   * Update event
   */
  async updateEvent(
    eventId: string,
    familyId: string,
    data: UpdateEventInput
  ) {
    const existing = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
    });

    if (!existing) {
      throw new Error('event-not-found');
    }

    // Resolve new target UIDs if parentId changed
    let targetUids = existing.targetUids;
    if (data.parentId && data.parentId !== existing.parentId) {
      targetUids = await this.resolveTargetUids(familyId, data.parentId);
    }

    const childId = data.childId !== undefined
      ? await this.resolveChildId(familyId, data.childId)
      : undefined;

    const event = await prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.parentId !== undefined && { parentId: data.parentId, targetUids }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.reminderMinutes !== undefined && { reminderMinutes: data.reminderMinutes }),
        ...(data.isAllDay !== undefined && { isAllDay: data.isAllDay }),
        ...(childId !== undefined && { childId }),
      },
    });

    // Update reminder
    await this.upsertReminder(event);

    // Emit socket event
    emitToFamily(familyId, SocketEvents.CALENDAR_EVENT_UPDATED, event);
    emitToFamily(familyId, 'event:updated', event);

    return event;
  }

  /**
   * Delete event
   */
  async deleteEvent(eventId: string, familyId: string) {
    // Delete reminder first
    await prisma.eventReminder.deleteMany({
      where: { eventId },
    });

    await prisma.calendarEvent.delete({
      where: { id: eventId },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.CALENDAR_EVENT_DELETED, { id: eventId });
    emitToFamily(familyId, 'event:deleted', { id: eventId });
  }

  private async resolveChildId(
    familyId: string,
    childId?: string | null
  ): Promise<string | null> {
    if (!childId) {
      return null;
    }

    const child = await prisma.familyChild.findFirst({
      where: {
        familyId,
        OR: [{ id: childId }, { externalId: childId }],
      },
      select: { id: true },
    });

    if (!child) {
      throw createError(400, 'child-not-found', 'Child not found');
    }

    return child.id;
  }

  /**
   * Get custody schedule
   */
  async getCustodySchedule(familyId: string) {
    return prisma.custodySchedule.findUnique({
      where: { familyId },
      include: { pendingApproval: true },
    });
  }

  /**
   * Save custody schedule
   */
  async saveCustodySchedule(
    familyId: string,
    userId: string,
    userName: string,
    data: CustodyScheduleInput
  ) {
    const existing = await prisma.custodySchedule.findUnique({
      where: { familyId },
    });

    if (data.requestApproval) {
      // Create or update pending approval request without applying changes yet
      const schedule = existing
        ? await prisma.custodySchedule.update({
            where: { familyId },
            data: {
              pendingApproval: {
                upsert: {
                  create: {
                    name: data.name,
                    pattern: data.pattern,
                    startDate: new Date(data.startDate),
                    parent1Days: data.parent1Days,
                    parent2Days: data.parent2Days,
                    requestedById: userId,
                    requestedByName: userName,
                  },
                  update: {
                    name: data.name,
                    pattern: data.pattern,
                    startDate: new Date(data.startDate),
                    parent1Days: data.parent1Days,
                    parent2Days: data.parent2Days,
                    requestedById: userId,
                    requestedByName: userName,
                    requestedAt: new Date(),
                  },
                },
              },
            },
            include: { pendingApproval: true },
          })
        : await prisma.custodySchedule.create({
            data: {
              familyId,
              name: data.name,
              pattern: data.pattern,
              startDate: new Date(data.startDate),
              endDate: data.endDate ? new Date(data.endDate) : null,
              parent1Days: data.parent1Days,
              parent2Days: data.parent2Days,
              biweeklyAltParent1Days: data.biweeklyAltParent1Days || [],
              biweeklyAltParent2Days: data.biweeklyAltParent2Days || [],
              isActive: false,
              pendingApproval: {
                create: {
                  name: data.name,
                  pattern: data.pattern,
                  startDate: new Date(data.startDate),
                  parent1Days: data.parent1Days,
                  parent2Days: data.parent2Days,
                  requestedById: userId,
                  requestedByName: userName,
                },
              },
            },
            include: { pendingApproval: true },
          });

      // Notify other parent
      await sendPushToFamilyMembers(
        familyId,
        userId,
        {
          title: 'בקשת משמורת חדשה',
          body: `${userName} ביקש/ה לאשר תבנית משמורת חדשה`,
        },
        {
          type: 'custody-approval-request',
          familyId,
        }
      );

      emitToFamily(familyId, 'custody:updated', schedule);
      return schedule;
    }

    // Direct save (no approval needed or new schedule)
    const schedule = await prisma.custodySchedule.upsert({
      where: { familyId },
      create: {
        familyId,
        name: data.name,
        pattern: data.pattern,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        parent1Days: data.parent1Days,
        parent2Days: data.parent2Days,
        biweeklyAltParent1Days: data.biweeklyAltParent1Days || [],
        biweeklyAltParent2Days: data.biweeklyAltParent2Days || [],
        isActive: data.isActive,
      },
      update: {
        name: data.name,
        pattern: data.pattern,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        parent1Days: data.parent1Days,
        parent2Days: data.parent2Days,
        biweeklyAltParent1Days: data.biweeklyAltParent1Days || [],
        biweeklyAltParent2Days: data.biweeklyAltParent2Days || [],
        isActive: data.isActive,
      },
      include: { pendingApproval: true },
    });

    emitToFamily(familyId, 'custody:updated', schedule);
    return schedule;
  }

  /**
   * Respond to custody approval request
   */
  async respondToCustodyApproval(
    familyId: string,
    userId: string,
    approve: boolean
  ) {
    const schedule = await prisma.custodySchedule.findUnique({
      where: { familyId },
      include: { pendingApproval: true },
    });

    if (!schedule?.pendingApproval) {
      throw new Error('no-pending-approval');
    }

    if (schedule.pendingApproval.requestedById === userId) {
      throw new Error('requester-cannot-approve');
    }

    if (approve) {
      // Apply the pending changes
      const pending = schedule.pendingApproval;
      const updated = await prisma.custodySchedule.update({
        where: { familyId },
        data: {
          name: pending.name,
          pattern: pending.pattern,
          startDate: pending.startDate,
          parent1Days: pending.parent1Days,
          parent2Days: pending.parent2Days,
          isActive: true,
          pendingApproval: { delete: true },
        },
        include: { pendingApproval: true },
      });

      // Notify requester
      if (pending.requestedById) {
        await sendPushToUser(
          pending.requestedById,
          {
            title: 'בקשת המשמורת אושרה',
            body: 'תבנית המשמורת החדשה אושרה על ידי ההורה השני',
          },
          { type: 'custody-approved', familyId }
        );
      }

      emitToFamily(familyId, 'custody:updated', updated);
      return updated;
    } else {
      // Reject - just delete the pending approval
      const updated = await prisma.custodySchedule.update({
        where: { familyId },
        data: {
          pendingApproval: { delete: true },
        },
        include: { pendingApproval: true },
      });

      // Notify requester
      if (schedule.pendingApproval.requestedById) {
        await sendPushToUser(
          schedule.pendingApproval.requestedById,
          {
            title: 'בקשת המשמורת נדחתה',
            body: 'ההורה השני דחה את בקשת השינוי בתבנית המשמורת',
          },
          { type: 'custody-rejected', familyId }
        );
      }

      emitToFamily(familyId, 'custody:updated', updated);
      return updated;
    }
  }

  /**
   * Cancel custody approval request (by requester)
   */
  async cancelCustodyApprovalRequest(familyId: string, userId: string) {
    const schedule = await prisma.custodySchedule.findUnique({
      where: { familyId },
      include: { pendingApproval: true },
    });

    if (!schedule?.pendingApproval) {
      throw new Error('no-pending-approval');
    }

    if (schedule.pendingApproval.requestedById !== userId) {
      throw new Error('only-requester-can-cancel');
    }

    const updated = await prisma.custodySchedule.update({
      where: { familyId },
      data: {
        pendingApproval: { delete: true },
      },
      include: { pendingApproval: true },
    });

    emitToFamily(familyId, 'custody:updated', updated);
    return updated;
  }

  /**
   * Delete custody schedule
   */
  async deleteCustodySchedule(familyId: string) {
    await prisma.custodySchedule.delete({
      where: { familyId },
    }).catch(() => null);

    // Delete related custody events
    await prisma.calendarEvent.deleteMany({
      where: { familyId, type: 'custody' },
    });

    emitToFamily(familyId, 'custody:deleted', { familyId });
  }

  /**
   * Resolve target UIDs based on parentId
   */
  private async resolveTargetUids(
    familyId: string,
    parentId: 'parent1' | 'parent2' | 'both'
  ): Promise<string[]> {
    const members = await prisma.familyMember.findMany({
      where: { familyId },
      select: { userId: true },
    });

    const sortedUserIds = [...new Set(members.map(m => m.userId))].sort();
    const parent1 = sortedUserIds[0];
    const parent2 = sortedUserIds[1];

    if (parentId === 'both') {
      return sortedUserIds;
    }
    if (parentId === 'parent1' && parent1) {
      return [parent1];
    }
    if (parentId === 'parent2' && parent2) {
      return [parent2];
    }
    return sortedUserIds;
  }

  /**
   * Upsert event reminder
   */
  private async upsertReminder(event: {
    id: string;
    familyId: string;
    title: string;
    startDate: Date;
    reminderMinutes?: number | null;
    targetUids: string[];
  }) {
    if (event.reminderMinutes == null || event.reminderMinutes <= 0) {
      // Delete existing reminder
      await prisma.eventReminder.deleteMany({
        where: { eventId: event.id },
      });
      return;
    }

    const sendAt = new Date(event.startDate.getTime() - event.reminderMinutes * 60 * 1000);
    
    // Don't create reminder for past events
    if (sendAt <= new Date()) {
      await prisma.eventReminder.deleteMany({
        where: { eventId: event.id },
      });
      return;
    }

    await prisma.eventReminder.upsert({
      where: { eventId: event.id },
      create: {
        eventId: event.id,
        familyId: event.familyId,
        title: event.title,
        startDate: event.startDate,
        sendAt,
        targetUids: event.targetUids,
      },
      update: {
        title: event.title,
        startDate: event.startDate,
        sendAt,
        targetUids: event.targetUids,
        sent: false,
        sentAt: null,
      },
    });
  }
}

export const calendarService = new CalendarService();
export default calendarService;
