import prisma from '../../config/database.js';
import {
  UpdateUserSettingsInput,
  UpdateFamilySettingsInput,
  UpdatePrivacySettingsInput,
  UpdateFinanceSettingsInput,
} from './settings.schema.js';

/**
 * Hybrid Settings Service
 * Manages user, family, privacy, and finance settings
 * Works with both PostgreSQL and Firebase
 */
export class SettingsService {
  private useFirebase: boolean;

  constructor(useFirebase: boolean = false) {
    this.useFirebase = useFirebase;
  }

  // ==================== User Settings ====================

  /**
   * Get user settings
   */
  async getUserSettings(userId: string) {
    if (this.useFirebase) {
      return this.getUserSettingsFirebase(userId);
    }

    return prisma.userSettings.findUnique({
      where: { userId },
    });
  }

  /**
   * Update user settings
   */
  async updateUserSettings(userId: string, data: UpdateUserSettingsInput) {
    if (this.useFirebase) {
      return this.updateUserSettingsFirebase(userId, data);
    }

    return prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: data,
    });
  }

  // ==================== Family Settings ====================

  /**
   * Get family settings
   */
  async getFamilySettings(familyId: string) {
    if (this.useFirebase) {
      return this.getFamilySettingsFirebase(familyId);
    }

    return prisma.familySettings.findUnique({
      where: { familyId },
    });
  }

  /**
   * Update family settings
   */
  async updateFamilySettings(familyId: string, data: UpdateFamilySettingsInput) {
    if (this.useFirebase) {
      return this.updateFamilySettingsFirebase(familyId, data);
    }

    // Validate percentage split
    if (data.parent1Percentage !== undefined || data.parent2Percentage !== undefined) {
      const settings = await prisma.familySettings.findUnique({
        where: { familyId },
      });

      const p1 = data.parent1Percentage ?? settings?.parent1Percentage ?? 50;
      const p2 = data.parent2Percentage ?? settings?.parent2Percentage ?? 50;

      if (p1 + p2 !== 100) {
        throw new Error('Percentages must sum to 100');
      }
    }

    return prisma.familySettings.upsert({
      where: { familyId },
      create: {
        familyId,
        ...data,
      },
      update: data,
    });
  }

  // ==================== Privacy Settings ====================

  /**
   * Get privacy settings
   */
  async getPrivacySettings(userId: string) {
    if (this.useFirebase) {
      return this.getPrivacySettingsFirebase(userId);
    }

    const settings = await prisma.privacySettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return null;
    }

    const blockedUsers = settings.blockedUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: settings.blockedUserIds } },
          select: {
            id: true,
            fullName: true,
            email: true,
            photoUrl: true,
          },
        })
      : [];

    return {
      ...settings,
      blockedUsers,
    };
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(userId: string, data: UpdatePrivacySettingsInput) {
    if (this.useFirebase) {
      return this.updatePrivacySettingsFirebase(userId, data);
    }

    const { blockUser, unblockUser, ...settingsData } = data;

    // Handle blocking/unblocking separately
    if (blockUser) {
      await this.blockUser(userId, blockUser);
    }
    if (unblockUser) {
      await this.unblockUser(userId, unblockUser);
    }

    // Update settings if any provided
    if (Object.keys(settingsData).length > 0) {
      return prisma.privacySettings.upsert({
        where: { userId },
        create: {
          userId,
          ...settingsData,
        },
        update: settingsData,
      });
    }

    return this.getPrivacySettings(userId);
  }

  /**
   * Block a user
   */
  private async blockUser(userId: string, blockedUserId: string) {
    if (userId === blockedUserId) {
      throw new Error('Cannot block yourself');
    }

    const settings = await prisma.privacySettings.upsert({
      where: { userId },
      create: {
        userId,
        blockedUserIds: [blockedUserId],
      },
      update: {
        blockedUserIds: {
          push: blockedUserId,
        },
      },
    });

    return settings;
  }

  /**
   * Unblock a user
   */
  private async unblockUser(userId: string, unblockedUserId: string) {
    const settings = await prisma.privacySettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.blockedUserIds.includes(unblockedUserId)) {
      throw new Error('User is not blocked');
    }

    return prisma.privacySettings.update({
      where: { userId },
      data: {
        blockedUserIds: {
          set: settings.blockedUserIds.filter((id: string) => id !== unblockedUserId),
        },
      },
    });
  }

  /**
   * Check if user is blocked
   */
  async isUserBlocked(userId: string, targetUserId: string): Promise<boolean> {
    if (this.useFirebase) {
      return this.isUserBlockedFirebase(userId, targetUserId);
    }

    const settings = await prisma.privacySettings.findUnique({
      where: { userId },
      select: { blockedUserIds: true },
    });

    return settings?.blockedUserIds.includes(targetUserId) || false;
  }

  // ==================== Finance Settings ====================

  /**
   * Get finance settings
   */
  async getFinanceSettings(familyId: string) {
    if (this.useFirebase) {
      return this.getFinanceSettingsFirebase(familyId);
    }

    return prisma.financeSettings.findUnique({
      where: { familyId },
    });
  }

  /**
   * Update finance settings
   */
  async updateFinanceSettings(familyId: string, data: UpdateFinanceSettingsInput) {
    if (this.useFirebase) {
      return this.updateFinanceSettingsFirebase(familyId, data);
    }

    return prisma.financeSettings.upsert({
      where: { familyId },
      create: {
        familyId,
        ...data,
      },
      update: data,
    });
  }

  // ==================== All Settings (Combined) ====================

  /**
   * Get all settings for a user
   */
  async getAllUserSettings(userId: string) {
    if (this.useFirebase) {
      return this.getAllUserSettingsFirebase(userId);
    }

    const [userSettings, privacySettings] = await Promise.all([
      this.getUserSettings(userId),
      this.getPrivacySettings(userId),
    ]);

    return {
      user: userSettings || {
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        weekStart: 'sunday',
        theme: 'auto',
      },
      privacy: privacySettings || {
        profileVisibility: 'family',
        shareCalendarWithCoParent: true,
        shareExpensesWithCoParent: true,
        shareDocumentsWithCoParent: true,
        allowCoParentMessaging: true,
        blockedUserIds: [],
        blockedUsers: [],
      },
    };
  }

  /**
   * Get all settings for a family
   */
  async getAllFamilySettings(familyId: string) {
    if (this.useFirebase) {
      return this.getAllFamilySettingsFirebase(familyId);
    }

    const [familySettings, financeSettings] = await Promise.all([
      this.getFamilySettings(familyId),
      this.getFinanceSettings(familyId),
    ]);

    return {
      family: familySettings || {
        defaultCurrency: 'USD',
        expenseSplitDefault: 'equal',
        parent1Percentage: 50,
        parent2Percentage: 50,
        requireApprovalForExpenses: true,
        expenseApprovalThreshold: null,
        allowSwapRequests: true,
        requireApprovalForSwaps: true,
        reminderDefaultTime: '09:00',
        enableCalendarReminders: true,
        calendarReminderMinutes: 30,
      },
      finance: financeSettings || {
        defaultExpenseCategory: null,
        enableReceiptScanning: true,
        autoCalculateSplit: true,
        trackPaymentStatus: true,
        sendPaymentReminders: true,
        paymentReminderDays: 7,
      },
    };
  }

  // ==================== Firebase Methods ====================

  private async getUserSettingsFirebase(userId: string) {
    console.log('[Settings] Firebase mode not fully implemented yet');
    return null;
  }

  private async updateUserSettingsFirebase(userId: string, data: UpdateUserSettingsInput) {
    console.log('[Settings] Firebase mode not fully implemented yet');
    return null;
  }

  private async getFamilySettingsFirebase(familyId: string) {
    console.log('[Settings] Firebase mode not fully implemented yet');
    return null;
  }

  private async updateFamilySettingsFirebase(familyId: string, data: UpdateFamilySettingsInput) {
    console.log('[Settings] Firebase mode not fully implemented yet');
    return null;
  }

  private async getPrivacySettingsFirebase(userId: string) {
    console.log('[Settings] Firebase mode not fully implemented yet');
    return null;
  }

  private async updatePrivacySettingsFirebase(userId: string, data: UpdatePrivacySettingsInput) {
    console.log('[Settings] Firebase mode not fully implemented yet');
    return null;
  }

  private async isUserBlockedFirebase(userId: string, targetUserId: string) {
    console.log('[Settings] Firebase mode not fully implemented yet');
    return false;
  }

  private async getFinanceSettingsFirebase(familyId: string) {
    console.log('[Settings] Firebase mode not fully implemented yet');
    return null;
  }

  private async updateFinanceSettingsFirebase(familyId: string, data: UpdateFinanceSettingsInput) {
    console.log('[Settings] Firebase mode not fully implemented yet');
    return null;
  }

  private async getAllUserSettingsFirebase(userId: string) {
    console.log('[Settings] Firebase mode not fully implemented yet');
    return null;
  }

  private async getAllFamilySettingsFirebase(familyId: string) {
    console.log('[Settings] Firebase mode not fully implemented yet');
    return null;
  }
}

export const settingsService = new SettingsService(false); // PostgreSQL
export const settingsServiceFirebase = new SettingsService(true); // Firebase

export default settingsService;
