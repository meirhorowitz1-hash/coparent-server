import prisma from '../../config/database.js';
import { emitToFamily } from '../../config/socket.js';
import { sendPushToUser } from '../../utils/push.js';
import { formatDateHebrew } from '../../utils/helpers.js';
import { CreateSwapRequestInput } from './swap-requests.schema.js';

export class SwapRequestsService {
  /**
   * Get all swap requests for a family
   */
  async getAll(familyId: string, status?: string) {
    return prisma.swapRequest.findMany({
      where: {
        familyId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get swap request by ID
   */
  async getById(requestId: string) {
    return prisma.swapRequest.findUnique({
      where: { id: requestId },
    });
  }

  /**
   * Create swap request
   */
  async create(
    familyId: string,
    userId: string,
    userName: string,
    data: CreateSwapRequestInput
  ) {
    // Find the other parent
    const { requestedToId, requestedToName } = await this.resolveCounterparty(
      familyId,
      userId
    );

    const swapRequest = await prisma.swapRequest.create({
      data: {
        familyId,
        requestedById: userId,
        requestedByName: userName,
        requestedToId,
        requestedToName,
        originalDate: new Date(data.originalDate),
        proposedDate: data.proposedDate ? new Date(data.proposedDate) : null,
        requestType: data.requestType,
        reason: data.reason,
      },
    });

    // Emit socket event
    emitToFamily(familyId, 'swap:created', swapRequest);

    // Send push notification to the other parent
    await sendPushToUser(
      requestedToId,
      {
        title: 'בקשת החלפה חדשה',
        body: `${userName} ביקש/ה להחליף את ${formatDateHebrew(new Date(data.originalDate))}`,
      },
      {
        type: 'swap-request-created',
        familyId,
        requestId: swapRequest.id,
      }
    );

    return swapRequest;
  }

  /**
   * Update swap request status
   */
  async updateStatus(
    requestId: string,
    familyId: string,
    userId: string,
    status: 'approved' | 'rejected' | 'cancelled',
    responseNote?: string | null
  ) {
    const existing = await prisma.swapRequest.findUnique({
      where: { id: requestId },
    });

    if (!existing) {
      throw new Error('swap-request-not-found');
    }

    // Allow responding to pending or final_pending status
    const allowedStatuses = ['pending', 'final_pending'];
    if (!allowedStatuses.includes(existing.status)) {
      throw new Error('swap-request-not-pending');
    }

    // Validate permissions
    if (status === 'cancelled') {
      if (existing.requestedById !== userId) {
        throw new Error('swap-request-cancel-forbidden');
      }
      // Can cancel pending, countered, or final_pending
      if (!['pending', 'countered', 'final_pending'].includes(existing.status)) {
        throw new Error('swap-request-status-not-allowed');
      }
    } else {
      if (existing.requestedToId !== userId) {
        throw new Error('swap-request-response-forbidden');
      }
    }

    const swapRequest = await prisma.swapRequest.update({
      where: { id: requestId },
      data: {
        status,
        responseNote: responseNote?.trim() || null,
        respondedAt: new Date(),
      },
    });

    // Emit socket event
    emitToFamily(familyId, 'swap:updated', swapRequest);

    // Send push notification
    if (status !== 'cancelled') {
      const statusLabel = status === 'approved' ? 'אושרה' : 'נדחתה';
      await sendPushToUser(
        existing.requestedById,
        {
          title: `בקשה ${statusLabel}`,
          body: `${existing.requestedToName || 'ההורה השני'} ${statusLabel} את ההחלפה עבור ${formatDateHebrew(existing.originalDate)}`,
        },
        {
          type: `swap-request-${status}`,
          familyId,
          requestId,
        }
      );
    }

    // If approved, create custody override events
    if (status === 'approved') {
      await this.applySwapToCalendar(swapRequest);
    }

    return swapRequest;
  }

  /**
   * Counter a swap request with a different proposed date
   */
  async counter(
    requestId: string,
    familyId: string,
    userId: string,
    proposedDate: Date,
    counterNote?: string | null
  ) {
    const existing = await prisma.swapRequest.findUnique({
      where: { id: requestId },
    });

    if (!existing) {
      throw new Error('swap-request-not-found');
    }

    if (existing.status !== 'pending') {
      throw new Error('swap-request-not-pending');
    }

    if (existing.requestedToId !== userId) {
      throw new Error('swap-request-response-forbidden');
    }

    if (existing.requestType !== 'swap') {
      throw new Error('swap-counter-not-allowed');
    }

    const swapRequest = await prisma.swapRequest.update({
      where: { id: requestId },
      data: {
        status: 'countered',
        previousProposedDate: existing.proposedDate,
        proposedDate,
        counterNote: counterNote?.trim() || null,
        counteredById: userId,
        counteredAt: new Date(),
        requesterConfirmedAt: null,
        counterResponseNote: null,
        counterRespondedAt: null,
        responseNote: null,
        respondedAt: null,
      },
    });

    // Emit socket event
    emitToFamily(familyId, 'swap:updated', swapRequest);

    // Send push notification
    await sendPushToUser(
      existing.requestedById,
      {
        title: 'הצעת נגד',
        body: `${existing.requestedToName || 'ההורה השני'} הציע/ה תאריך אחר`,
      },
      {
        type: 'swap-request-countered',
        familyId,
        requestId,
      }
    );

    return swapRequest;
  }

  /**
   * Accept a counter offer (requester accepts the new proposed date)
   */
  async acceptCounter(requestId: string, familyId: string, userId: string) {
    const existing = await prisma.swapRequest.findUnique({
      where: { id: requestId },
    });

    if (!existing) {
      throw new Error('swap-request-not-found');
    }

    if (existing.status !== 'countered') {
      throw new Error('swap-counter-not-pending');
    }

    if (existing.requestedById !== userId) {
      throw new Error('swap-counter-accept-forbidden');
    }

    const swapRequest = await prisma.swapRequest.update({
      where: { id: requestId },
      data: {
        status: 'final_pending',
        previousProposedDate: null,
        requesterConfirmedAt: new Date(),
        counterResponseNote: null,
        counterRespondedAt: new Date(),
      },
    });

    // Emit socket event
    emitToFamily(familyId, 'swap:updated', swapRequest);

    // Send push notification to the other parent to finalize
    await sendPushToUser(
      existing.requestedToId,
      {
        title: 'אישור סופי נדרש',
        body: `${existing.requestedByName || 'ההורה'} קיבל/ה את הצעת הנגד. נא לאשר.`,
      },
      {
        type: 'swap-request-counter-accepted',
        familyId,
        requestId,
      }
    );

    return swapRequest;
  }

  /**
   * Reject a counter offer (requester rejects and reverts to original proposal)
   */
  async rejectCounter(
    requestId: string,
    familyId: string,
    userId: string,
    counterResponseNote?: string | null
  ) {
    const existing = await prisma.swapRequest.findUnique({
      where: { id: requestId },
    });

    if (!existing) {
      throw new Error('swap-request-not-found');
    }

    if (existing.status !== 'countered') {
      throw new Error('swap-counter-not-pending');
    }

    if (existing.requestedById !== userId) {
      throw new Error('swap-counter-reject-forbidden');
    }

    const swapRequest = await prisma.swapRequest.update({
      where: { id: requestId },
      data: {
        status: 'pending',
        proposedDate: existing.previousProposedDate,
        previousProposedDate: null,
        counterNote: null,
        counteredById: null,
        counteredAt: null,
        requesterConfirmedAt: null,
        counterResponseNote: counterResponseNote?.trim() || null,
        counterRespondedAt: new Date(),
      },
    });

    // Emit socket event
    emitToFamily(familyId, 'swap:updated', swapRequest);

    // Send push notification
    await sendPushToUser(
      existing.requestedToId,
      {
        title: 'הצעת הנגד נדחתה',
        body: `${existing.requestedByName || 'ההורה'} דחה/תה את הצעת הנגד`,
      },
      {
        type: 'swap-request-counter-rejected',
        familyId,
        requestId,
      }
    );

    return swapRequest;
  }

  /**
   * Apply approved swap to calendar
   */
  private async applySwapToCalendar(swapRequest: {
    id: string;
    familyId: string;
    requestedById: string;
    requestedToId: string;
    originalDate: Date;
    proposedDate: Date | null;
    requestType: string;
    reason: string | null;
  }) {
    // Delete any existing swap events for these dates
    await prisma.calendarEvent.deleteMany({
      where: {
        familyId: swapRequest.familyId,
        swapRequestId: swapRequest.id,
      },
    });

    // Get parent roles
    const members = await prisma.familyMember.findMany({
      where: { familyId: swapRequest.familyId },
      select: { userId: true },
    });

    const sortedMembers = [...new Set(members.map(m => m.userId))].sort();
    const requesterIsParent1 = sortedMembers[0] === swapRequest.requestedById;
    const originalParent = requesterIsParent1 ? 'parent1' : 'parent2';
    const targetParent = requesterIsParent1 ? 'parent2' : 'parent1';

    const eventsToCreate = [];

    // Original date goes to the other parent
    eventsToCreate.push({
      familyId: swapRequest.familyId,
      title: swapRequest.requestType === 'one-way' 
        ? 'החלפת משמורת מאושרת - יום שהועבר ללא החזרה'
        : 'החלפת משמורת מאושרת - יום שהועבר',
      description: swapRequest.reason || 'החלפה שאושרה בין ההורים',
      startDate: this.startOfDay(swapRequest.originalDate),
      endDate: this.endOfDay(swapRequest.originalDate),
      type: 'custody',
      parentId: targetParent,
      isAllDay: true,
      color: '#8b5cf6',
      swapRequestId: swapRequest.id,
      targetUids: sortedMembers,
    });

    // If it's a swap (not one-way), proposed date goes to the requester
    if (swapRequest.requestType === 'swap' && swapRequest.proposedDate) {
      eventsToCreate.push({
        familyId: swapRequest.familyId,
        title: 'החלפת משמורת מאושרת - יום שהתקבל',
        description: swapRequest.reason || 'החלפה שאושרה בין ההורים',
        startDate: this.startOfDay(swapRequest.proposedDate),
        endDate: this.endOfDay(swapRequest.proposedDate),
        type: 'custody',
        parentId: originalParent,
        isAllDay: true,
        color: '#8b5cf6',
        swapRequestId: swapRequest.id,
        targetUids: sortedMembers,
      });
    }

    // Create the events
    await prisma.calendarEvent.createMany({
      data: eventsToCreate,
    });
  }

  /**
   * Resolve the counterparty (other parent) in a family
   */
  private async resolveCounterparty(
    familyId: string,
    requesterId: string
  ): Promise<{ requestedToId: string; requestedToName: string }> {
    const members = await prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    const otherMember = members.find(m => m.userId !== requesterId);

    if (!otherMember) {
      throw new Error('no-other-parent');
    }

    return {
      requestedToId: otherMember.userId,
      requestedToName: otherMember.user.fullName || otherMember.user.email || 'הורה שותף',
    };
  }

  /**
   * Get start of day
   */
  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Get end of day
   */
  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }
}

export const swapRequestsService = new SwapRequestsService();
export default swapRequestsService;
