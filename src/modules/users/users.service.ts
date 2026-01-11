import prisma from '../../config/database.js';
import { CreateUserInput, UpdateUserInput, AddPushTokenInput } from './users.schema.js';

export class UsersService {
  /**
   * Get user by ID
   */
  async getById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        familyMemberships: {
          include: {
            family: {
              select: {
                id: true,
                name: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get user by email
   */
  async getByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Create or update user (upsert on first login)
   */
  async upsertUser(userId: string, email: string, data?: CreateUserInput) {
    return prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: email.toLowerCase(),
        fullName: data?.fullName,
        phone: data?.phone,
        photoUrl: data?.photoUrl,
        calendarColor: data?.calendarColor,
      },
      update: {
        // Only update if values provided
        ...(data?.fullName && { fullName: data.fullName }),
        ...(data?.phone !== undefined && { phone: data.phone }),
        ...(data?.photoUrl !== undefined && { photoUrl: data.photoUrl }),
      },
    });
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateUserInput) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
        ...(data.calendarColor !== undefined && { calendarColor: data.calendarColor }),
        ...(data.activeFamilyId !== undefined && { activeFamilyId: data.activeFamilyId }),
      },
    });
  }

  /**
   * Set active family
   */
  async setActiveFamily(userId: string, familyId: string | null) {
    // Verify user is member of the family (if not null)
    if (familyId) {
      const membership = await prisma.familyMember.findUnique({
        where: {
          familyId_userId: { familyId, userId },
        },
      });

      if (!membership) {
        throw new Error('not-family-member');
      }
    }

    return prisma.user.update({
      where: { id: userId },
      data: { activeFamilyId: familyId },
    });
  }

  /**
   * Add push token
   */
  async addPushToken(userId: string, data: AddPushTokenInput) {
    return prisma.pushToken.upsert({
      where: { token: data.token },
      create: {
        token: data.token,
        platform: data.platform,
        userId,
      },
      update: {
        userId, // Update ownership if token moved to different user
        platform: data.platform,
      },
    });
  }

  /**
   * Remove push token
   */
  async removePushToken(token: string) {
    return prisma.pushToken.delete({
      where: { token },
    }).catch(() => null); // Ignore if not found
  }

  /**
   * Get user's families
   */
  async getUserFamilies(userId: string) {
    const memberships = await prisma.familyMember.findMany({
      where: { userId },
      include: {
        family: {
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
            invites: true,
            _count: {
              select: {
                expenses: true,
                tasks: true,
                calendarEvents: true,
              },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.family,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * Check if user exists
   */
  async exists(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return !!user;
  }
}

export const usersService = new UsersService();
export default usersService;
