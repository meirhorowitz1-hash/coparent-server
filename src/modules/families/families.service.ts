import prisma from '../../config/database.js';
import { generateShareCode, normalizeEmail } from '../../utils/helpers.js';
import { emitToFamily } from '../../config/socket.js';
import { 
  CreateFamilyInput, 
  UpdateFamilyInput, 
  AddChildInput,
  UpdateChildInput 
} from './families.schema.js';

interface ChildUpdateInput {
  id?: string;
  name: string;
  birthDate?: string | null;
  photoUrl?: string | null;
}

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
    const updateData: any = {};
    
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.photoUrl !== undefined) {
      updateData.photoUrl = data.photoUrl;
    }

    const family = await prisma.family.update({
      where: { id: familyId },
      data: updateData,
      include: {
        children: true,
      },
    });

    // Handle children updates if provided
    if (data.children !== undefined) {
      const updatedChildren = await this.syncChildren(familyId, data.children as ChildUpdateInput[]);
      return {
        ...family,
        children: updatedChildren,
      };
    }

    return family;
  }

  /**
   * Sync children for a family - creates, updates, and removes children as needed
   * Also creates birthday events for children with birth dates
   */
  async syncChildren(familyId: string, children: ChildUpdateInput[]) {
    // Get existing children
    const existingChildren = await prisma.familyChild.findMany({
      where: { familyId },
    });

    const existingMap = new Map(existingChildren.map(c => [c.id, c]));
    const providedIds = new Set(children.filter(c => c.id).map(c => c.id!));

    // Find children to delete (exist in DB but not in provided list)
    const toDelete = existingChildren.filter(c => !providedIds.has(c.id));
    
    // Process each provided child
    const results = [];
    for (const child of children) {
      const birthDate = child.birthDate ? new Date(child.birthDate) : null;
      
      if (child.id && existingMap.has(child.id)) {
        // Update existing child
        const existing = existingMap.get(child.id)!;
        const birthdateChanged = this.hasBirthdateChanged(existing.birthDate, birthDate);
        
        const updated = await prisma.familyChild.update({
          where: { id: child.id },
          data: {
            name: child.name,
            birthDate,
            photoUrl: child.photoUrl ?? null,
          },
        });
        
        // If birthdate changed, update the birthday event
        if (birthdateChanged) {
          await this.upsertBirthdayEvent(familyId, updated);
        }
        
        results.push(updated);
      } else {
        // Create new child
        const created = await prisma.familyChild.create({
          data: {
            familyId,
            name: child.name,
            birthDate,
            photoUrl: child.photoUrl ?? null,
          },
        });
        
        // Create birthday event if birthdate is provided
        if (birthDate) {
          await this.upsertBirthdayEvent(familyId, created);
        }
        
        results.push(created);
      }
    }

    // Delete removed children and their birthday events
    for (const child of toDelete) {
      await this.deleteBirthdayEvent(familyId, child.id);
      await prisma.familyChild.delete({
        where: { id: child.id },
      });
    }

    // Emit socket event with updated family data
    emitToFamily(familyId, 'family:updated', { children: results });

    return results;
  }

  /**
   * Check if birthdate has changed
   */
  private hasBirthdateChanged(oldDate: Date | null, newDate: Date | null): boolean {
    if (!oldDate && !newDate) return false;
    if (!oldDate || !newDate) return true;
    return oldDate.toISOString().split('T')[0] !== newDate.toISOString().split('T')[0];
  }

  /**
   * Create or update birthday event for a child
   * Creates a yearly recurring event that repeats on the child's birthday each year
   */
  private async upsertBirthdayEvent(
    familyId: string,
    child: { id: string; name: string; birthDate: Date | null }
  ) {
    if (!child.birthDate) {
      await this.deleteBirthdayEvent(familyId, child.id);
      return;
    }

    const birthDate = new Date(child.birthDate);
    
    // Use the original birth date as the event start date
    // The recurring pattern will handle showing it every year
    const startDate = new Date(birthDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(birthDate);
    endDate.setHours(23, 59, 59, 999);

    // Use child's actual name for the title
    const title = `🎂 יום הולדת ${child.name}`;
    const description = `יום הולדת של ${child.name}`;
    
    // Yearly recurring pattern
    const recurring = {
      frequency: 'yearly' as const,
    };

    // Find existing birthday event for this child
    const existing = await prisma.calendarEvent.findFirst({
      where: {
        familyId,
        childId: child.id,
        type: 'birthday',
      },
    });

    if (existing) {
      // Update existing event
      const updated = await prisma.calendarEvent.update({
        where: { id: existing.id },
        data: {
          title,
          description,
          startDate,
          endDate,
          recurring,
        },
      });
      
      // Emit socket event for update
      emitToFamily(familyId, 'calendar:event:updated', updated);
      console.log(`[Family] Updated birthday event for ${child.name} (${child.id})`);
    } else {
      // Create new birthday event with yearly recurrence
      const created = await prisma.calendarEvent.create({
        data: {
          familyId,
          title,
          description,
          startDate,
          endDate,
          type: 'birthday',
          parentId: 'both',
          isAllDay: true,
          recurring,
          childId: child.id,
          color: '#FF6B9D',
          targetUids: [],
        },
      });
      
      // Emit socket event for new event
      emitToFamily(familyId, 'calendar:event:new', created);
      console.log(`[Family] Created birthday event for ${child.name} (${child.id}) on ${birthDate.getMonth() + 1}/${birthDate.getDate()}`);
    }
  }

  /**
   * Delete birthday event for a child
   */
  private async deleteBirthdayEvent(familyId: string, childId: string) {
    // Find the event first to get its ID for the socket event
    const event = await prisma.calendarEvent.findFirst({
      where: {
        familyId,
        childId,
        type: 'birthday',
      },
    });
    
    if (event) {
      await prisma.calendarEvent.delete({
        where: { id: event.id },
      });
      
      // Emit socket event for deletion
      emitToFamily(familyId, 'calendar:event:deleted', { id: event.id });
      console.log(`[Family] Deleted birthday event for child ${childId}`);
    }
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
        externalId: data.externalId ?? null,
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
        ...(data.externalId !== undefined && { externalId: data.externalId }),
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
