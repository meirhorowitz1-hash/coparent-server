import prisma from '../../config/database.js';
import { emitToFamily, SocketEvents } from '../../config/socket.js';
import { CreateCustodyOverrideInput, RespondCustodyOverrideInput } from './custody-overrides.schema.js';

export class CustodyOverridesService {
  /**
   * Get all custody overrides for a family
   */
  async getAll(familyId: string, filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = { familyId };
    
    if (filters?.status) {
      where.status = filters.status;
    }
    
    if (filters?.startDate) {
      where.startDate = { gte: new Date(filters.startDate) };
    }
    
    if (filters?.endDate) {
      where.endDate = { lte: new Date(filters.endDate) };
    }

    return prisma.custodyOverride.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Get active/approved overrides that overlap with a date range
   */
  async getActiveOverrides(familyId: string, startDate: Date, endDate: Date) {
    return prisma.custodyOverride.findMany({
      where: {
        familyId,
        status: 'approved',
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Get custody override by ID
   */
  async getById(overrideId: string) {
    return prisma.custodyOverride.findUnique({
      where: { id: overrideId },
    });
  }

  /**
   * Create custody override
   */
  async create(
    familyId: string,
    userId: string,
    data: CreateCustodyOverrideInput
  ) {
    // Get counterparty info
    const { requestedToId, requestedToName } = await this.resolveCounterparty(familyId, userId);
    
    // Determine status based on whether approval is needed
    const needsApproval = data.requestApproval !== false && !!requestedToId;
    const status = needsApproval ? 'pending' : 'approved';

    // Check for overlapping overrides
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    
    const overlapping = await prisma.custodyOverride.findFirst({
      where: {
        familyId,
        status: { in: ['pending', 'approved'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlapping) {
      throw new Error('custody-override-overlap');
    }

    const override = await prisma.custodyOverride.create({
      data: {
        familyId,
        name: data.name?.trim() || null,
        type: data.type,
        startDate,
        endDate,
        assignments: data.assignments,
        note: data.note?.trim() || null,
        status,
        requestedById: userId,
        requestedByName: data.requestedByName || null,
        requestedToId: needsApproval ? requestedToId : null,
        requestedToName: needsApproval ? requestedToName : null,
      },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.CUSTODY_OVERRIDE_CREATED, override);

    return override;
  }

  /**
   * Respond to custody override (approve/reject)
   */
  async respond(
    overrideId: string,
    userId: string,
    data: RespondCustodyOverrideInput
  ) {
    const override = await prisma.custodyOverride.findUnique({
      where: { id: overrideId },
    });

    if (!override) {
      throw new Error('custody-override-not-found');
    }

    if (override.status !== 'pending') {
      throw new Error('custody-override-not-pending');
    }

    if (override.requestedToId && override.requestedToId !== userId) {
      throw new Error('custody-override-response-forbidden');
    }

    const updated = await prisma.custodyOverride.update({
      where: { id: overrideId },
      data: {
        status: data.approve ? 'approved' : 'rejected',
        responseNote: data.responseNote?.trim() || null,
        respondedById: userId,
        respondedAt: new Date(),
      },
    });

    // Emit socket event
    emitToFamily(override.familyId, SocketEvents.CUSTODY_OVERRIDE_UPDATED, updated);

    return updated;
  }

  /**
   * Cancel custody override request (only requester can cancel)
   */
  async cancel(overrideId: string, userId: string) {
    const override = await prisma.custodyOverride.findUnique({
      where: { id: overrideId },
    });

    if (!override) {
      throw new Error('custody-override-not-found');
    }

    if (override.status !== 'pending') {
      throw new Error('custody-override-cancel-not-allowed');
    }

    if (override.requestedById !== userId) {
      throw new Error('custody-override-cancel-forbidden');
    }

    // Delete the override completely
    await prisma.custodyOverride.delete({
      where: { id: overrideId },
    });

    // Emit socket event
    emitToFamily(override.familyId, SocketEvents.CUSTODY_OVERRIDE_DELETED, { id: overrideId });
  }

  /**
   * Delete custody override
   */
  async delete(overrideId: string, familyId: string) {
    const override = await prisma.custodyOverride.findUnique({
      where: { id: overrideId },
    });

    if (!override) {
      throw new Error('custody-override-not-found');
    }

    await prisma.custodyOverride.delete({
      where: { id: overrideId },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.CUSTODY_OVERRIDE_DELETED, { id: overrideId });
  }

  /**
   * Delete all custody overrides for a family
   */
  async deleteAll(familyId: string) {
    const deleted = await prisma.custodyOverride.deleteMany({
      where: { familyId },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.CUSTODY_OVERRIDE_DELETED_ALL, { count: deleted.count });

    return deleted;
  }

  /**
   * Resolve the counterparty (co-parent) for override requests
   */
  private async resolveCounterparty(familyId: string, requesterId: string): Promise<{
    requestedToId?: string;
    requestedToName?: string;
  }> {
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

    const counterparty = members.find(m => m.userId !== requesterId);
    
    if (!counterparty) {
      return {};
    }

    return {
      requestedToId: counterparty.userId,
      requestedToName: counterparty.user.fullName || counterparty.user.email || undefined,
    };
  }
}

export const custodyOverridesService = new CustodyOverridesService();
export default custodyOverridesService;
