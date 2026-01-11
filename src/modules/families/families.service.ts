import prisma from '../../config/database.js';
import { generateShareCode, normalizeEmail } from '../../utils/helpers.js';
import { 
  CreateFamilyInput, 
  UpdateFamilyInput, 
  AddChildInput,
  UpdateChildInput 
} from './families.schema.js';

export class FamiliesService {
  /**
   * Create a new family
   */
  async createFamily(ownerId: string, data?: CreateFamilyInput) {
    const shareCode = await this.generateUniqueShareCode();

    const family = await prisma.family.create({
      data: {
        name: data?.name,
        ownerId,
        shareCode,
        members: {
          create: {
            userId: ownerId,
            role: 'owner',
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                photoUrl: true,
              },
            },
          },
        },
        children: true,
      },
    });

    // Set as active family for owner
    await prisma.user.update({
      where: { id: ownerId },
      data: { activeFamilyId: family.id },
    });

    return family;
  }

  /**
   * Get family by ID with all related data
   */
  async getById(familyId: string) {
    return prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                photoUrl: true,
                calendarColor: true,
              },
            },
          },
        },
        children: true,
        invites: {
          where: { status: 'pending' },
        },
        custodySchedule: {
          include: {
            pendingApproval: true,
          },
        },
        financeSettings: {
          include: {
            fixedExpenses: true,
          },
        },
      },
    });
  }

  /**
   * Update family
   */
  async updateFamily(familyId: string, data: UpdateFamilyInput) {
    return prisma.family.update({
      where: { id: familyId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
      },
    });
  }

  /**
   * Generate new share code
   */
  async regenerateShareCode(familyId: string) {
    const shareCode = await this.generateUniqueShareCode();

    return prisma.family.update({
      where: { id: familyId },
      data: {
        shareCode,
        shareCodeUpdatedAt: new Date(),
      },
    });
  }

  /**
   * Invite co-parent by email
   */
  async inviteCoParent(
    familyId: string,
    email: string,
    inviterId: string,
    inviterName?: string
  ) {
    const normalizedEmail = normalizeEmail(email);

    // Check family member count
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: true,
        invites: { where: { status: 'pending' } },
      },
    });

    if (!family) {
      throw new Error('family-not-found');
    }

    if (family.members.length >= 2) {
      throw new Error('family-full');
    }

    // Check if already invited
    const existingInvite = await prisma.familyInvite.findUnique({
      where: {
        familyId_email: { familyId, email: normalizedEmail },
      },
    });

    if (existingInvite) {
      throw new Error('already-invited');
    }

    // Check if inviting self
    const inviter = await prisma.user.findUnique({
      where: { id: inviterId },
      select: { email: true },
    });

    if (inviter?.email === normalizedEmail) {
      throw new Error('self-invite');
    }

    return prisma.familyInvite.create({
      data: {
        familyId,
        email: normalizedEmail,
        displayEmail: email.trim(),
        invitedById: inviterId,
        invitedByName: inviterName,
      },
    });
  }

  /**
   * Accept invite by email (called during signup/login)
   */
  async acceptInviteByEmail(email: string, userId: string) {
    const normalizedEmail = normalizeEmail(email);

    const invite = await prisma.familyInvite.findFirst({
      where: {
        email: normalizedEmail,
        status: 'pending',
      },
      include: {
        family: {
          include: { members: true },
        },
      },
    });

    if (!invite) {
      return null;
    }

    if (invite.family.members.length >= 2) {
      throw new Error('family-full');
    }

    // Add user to family
    await prisma.$transaction([
      // Update invite status
      prisma.familyInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted' },
      }),
      // Add as member
      prisma.familyMember.create({
        data: {
          familyId: invite.familyId,
          userId,
          role: 'member',
        },
      }),
      // Set as active family
      prisma.user.update({
        where: { id: userId },
        data: { activeFamilyId: invite.familyId },
      }),
    ]);

    return invite.familyId;
  }

  /**
   * Join family by share code
   */
  async joinByShareCode(shareCode: string, userId: string) {
    const family = await prisma.family.findUnique({
      where: { shareCode },
      include: { members: true },
    });

    if (!family) {
      throw new Error('invalid-share-code');
    }

    // Check if already a member
    const isMember = family.members.some((m) => m.userId === userId);
    if (isMember) {
      return family;
    }

    if (family.members.length >= 2) {
      throw new Error('family-full');
    }

    await prisma.$transaction([
      prisma.familyMember.create({
        data: {
          familyId: family.id,
          userId,
          role: 'member',
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { activeFamilyId: family.id },
      }),
    ]);

    return this.getById(family.id);
  }

  /**
   * Leave family
   * If owner leaves: transfer ownership to another member, or remove all members but keep family
   */
  async leaveFamily(familyId: string, userId: string) {
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: { members: true },
    });

    if (!family) {
      throw new Error('family-not-found');
    }

    const isOwner = family.ownerId === userId;
    const otherMembers = family.members.filter(m => m.userId !== userId);

    if (isOwner) {
      if (otherMembers.length > 0) {
        // Transfer ownership to another member
        const newOwner = otherMembers[0];
        await prisma.$transaction([
          // Update family owner
          prisma.family.update({
            where: { id: familyId },
            data: { ownerId: newOwner.userId },
          }),
          // Update new owner's role
          prisma.familyMember.update({
            where: { id: newOwner.id },
            data: { role: 'owner' },
          }),
          // Remove old owner from family
          prisma.familyMember.delete({
            where: {
              familyId_userId: { familyId, userId },
            },
          }),
          // Clear active family for leaving user
          prisma.user.update({
            where: { id: userId },
            data: { activeFamilyId: null },
          }),
        ]);
        console.log(`[Family] Transferred ownership of ${familyId} from ${userId} to ${newOwner.userId}`);
      } else {
        // No other members - keep family but remove membership and clear owner
        await prisma.$transaction([
          // Remove membership
          prisma.familyMember.delete({
            where: {
              familyId_userId: { familyId, userId },
            },
          }),
          // Clear active family for leaving user
          prisma.user.update({
            where: { id: userId },
            data: { activeFamilyId: null },
          }),
        ]);
        console.log(`[Family] Owner ${userId} left family ${familyId} (family preserved with no members)`);
      }
    } else {
      // Regular member leaving
      await prisma.$transaction([
        prisma.familyMember.delete({
          where: {
            familyId_userId: { familyId, userId },
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: { activeFamilyId: null },
        }),
      ]);
    }
  }

  /**
   * Delete family (owner only)
   */
  async deleteFamily(familyId: string) {
    // Reset active family for all members
    await prisma.user.updateMany({
      where: { activeFamilyId: familyId },
      data: { activeFamilyId: null },
    });

    // Delete family (cascades to all related data)
    return prisma.family.delete({
      where: { id: familyId },
    });
  }

  /**
   * Add child to family
   */
  async addChild(familyId: string, data: AddChildInput) {
    return prisma.familyChild.create({
      data: {
        familyId,
        name: data.name,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        photoUrl: data.photoUrl,
      },
    });
  }

  /**
   * Update child
   */
  async updateChild(childId: string, data: UpdateChildInput) {
    return prisma.familyChild.update({
      where: { id: childId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.birthDate !== undefined && { 
          birthDate: data.birthDate ? new Date(data.birthDate) : null 
        }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
      },
    });
  }

  /**
   * Remove child
   */
  async removeChild(childId: string) {
    return prisma.familyChild.delete({
      where: { id: childId },
    });
  }

  /**
   * Get family members
   */
  async getMembers(familyId: string) {
    return prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            photoUrl: true,
            calendarColor: true,
          },
        },
      },
    });
  }

  /**
   * Generate unique share code
   */
  private async generateUniqueShareCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = generateShareCode();
      const existing = await prisma.family.findUnique({
        where: { shareCode: code },
      });
      if (!existing) {
        return code;
      }
    }
    throw new Error('share-code-generation-failed');
  }
}

export const familiesService = new FamiliesService();
export default familiesService;
