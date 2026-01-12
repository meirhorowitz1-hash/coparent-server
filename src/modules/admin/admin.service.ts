import prisma from '../../config/database.js';

// List of all tables in the database
export const TABLES = [
  'User',
  'PushToken',
  'Family',
  'FamilyMember',
  'FamilyChild',
  'FamilyInvite',
  'Notification',
  'NotificationPreferences',
  'UserSettings',
  'FamilySettings',
  'PrivacySettings',
  'CustodySchedule',
  'CustodyApprovalRequest',
  'CustodyOverride',
  'CalendarEvent',
  'EventReminder',
  'Expense',
  'FinanceSettings',
  'FixedExpense',
  'Task',
  'Document',
  'SwapRequest',
  'PaymentReceipt',
  'ChatMessage',
  'GoalTable',
  'Goal',
  'DailyProgress',
  'MonthlyExpenseSummary',
] as const;

export type TableName = typeof TABLES[number];

// Admin emails that have full access
const ADMIN_EMAILS = [
  'meirhorowitz1@gmail.com',
  'meir.horowitz@example.com', // Add more as needed
];

export function isAdminUser(email?: string): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function getTableData(
  tableName: TableName,
  options: {
    page?: number;
    limit?: number;
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
    search?: string;
    searchField?: string;
  } = {}
) {
  const { page = 1, limit = 50, orderBy = 'createdAt', orderDir = 'desc', search, searchField } = options;
  const skip = (page - 1) * limit;

  // Get the Prisma model dynamically
  const model = (prisma as any)[tableName.charAt(0).toLowerCase() + tableName.slice(1)];
  
  if (!model) {
    throw new Error(`Table ${tableName} not found`);
  }

  // Build where clause for search
  let where: any = {};
  if (search && searchField) {
    where[searchField] = { contains: search, mode: 'insensitive' };
  }

  // Build orderBy clause - handle cases where field might not exist
  let orderByClause: any = {};
  try {
    orderByClause[orderBy] = orderDir;
  } catch {
    orderByClause = { id: 'desc' };
  }

  try {
    const [data, total] = await Promise.all([
      model.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderByClause,
      }),
      model.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error: any) {
    // If orderBy field doesn't exist, try without it
    if (error.message?.includes('Unknown field')) {
      const [data, total] = await Promise.all([
        model.findMany({
          where,
          skip,
          take: limit,
        }),
        model.count({ where }),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }
    throw error;
  }
}

export async function getRecordById(tableName: TableName, id: string) {
  const model = (prisma as any)[tableName.charAt(0).toLowerCase() + tableName.slice(1)];
  
  if (!model) {
    throw new Error(`Table ${tableName} not found`);
  }

  return model.findUnique({
    where: { id },
  });
}

export async function createRecord(tableName: TableName, data: any) {
  const model = (prisma as any)[tableName.charAt(0).toLowerCase() + tableName.slice(1)];
  
  if (!model) {
    throw new Error(`Table ${tableName} not found`);
  }

  // Remove undefined values and handle special fields
  const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== '') {
      // Convert date strings to Date objects
      if (key.includes('At') || key.includes('Date') || key === 'createdAt' || key === 'updatedAt') {
        if (value && typeof value === 'string') {
          acc[key] = new Date(value);
        } else if (value instanceof Date) {
          acc[key] = value;
        }
      } 
      // Handle arrays
      else if (Array.isArray(value)) {
        acc[key] = value;
      }
      // Handle JSON fields
      else if (typeof value === 'object' && value !== null) {
        acc[key] = value;
      }
      // Handle booleans
      else if (value === 'true' || value === 'false') {
        acc[key] = value === 'true';
      }
      // Handle numbers
      else if (!isNaN(Number(value)) && typeof value === 'string' && value.trim() !== '') {
        acc[key] = Number(value);
      }
      else {
        acc[key] = value;
      }
    }
    return acc;
  }, {} as any);

  return model.create({
    data: cleanData,
  });
}

export async function updateRecord(tableName: TableName, id: string, data: any) {
  const model = (prisma as any)[tableName.charAt(0).toLowerCase() + tableName.slice(1)];
  
  if (!model) {
    throw new Error(`Table ${tableName} not found`);
  }

  // Remove id from update data and clean values
  const { id: _, ...updateData } = data;
  const cleanData = Object.entries(updateData).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      // Convert date strings to Date objects
      if (key.includes('At') || key.includes('Date') || key === 'createdAt' || key === 'updatedAt') {
        if (value && typeof value === 'string') {
          acc[key] = new Date(value);
        } else if (value instanceof Date) {
          acc[key] = value;
        } else if (value === null || value === '') {
          acc[key] = null;
        }
      }
      // Handle arrays
      else if (Array.isArray(value)) {
        acc[key] = value;
      }
      // Handle JSON fields
      else if (typeof value === 'object' && value !== null) {
        acc[key] = value;
      }
      // Handle booleans
      else if (value === 'true' || value === 'false') {
        acc[key] = value === 'true';
      }
      else if (typeof value === 'boolean') {
        acc[key] = value;
      }
      // Handle numbers
      else if (!isNaN(Number(value)) && typeof value === 'string' && value.trim() !== '') {
        acc[key] = Number(value);
      }
      else if (value === '' || value === null) {
        acc[key] = null;
      }
      else {
        acc[key] = value;
      }
    }
    return acc;
  }, {} as any);

  return model.update({
    where: { id },
    data: cleanData,
  });
}

export async function deleteRecord(tableName: TableName, id: string) {
  const model = (prisma as any)[tableName.charAt(0).toLowerCase() + tableName.slice(1)];
  
  if (!model) {
    throw new Error(`Table ${tableName} not found`);
  }

  return model.delete({
    where: { id },
  });
}

export async function deleteMultipleRecords(tableName: TableName, ids: string[]) {
  const model = (prisma as any)[tableName.charAt(0).toLowerCase() + tableName.slice(1)];
  
  if (!model) {
    throw new Error(`Table ${tableName} not found`);
  }

  return model.deleteMany({
    where: {
      id: { in: ids },
    },
  });
}

export async function getTableSchema(tableName: TableName) {
  // Return schema info based on Prisma model
  const schemaMap: Record<TableName, { fields: Array<{ name: string; type: string; required: boolean; isId?: boolean; isArray?: boolean; isRelation?: boolean }> }> = {
    User: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'email', type: 'string', required: true },
        { name: 'fullName', type: 'string', required: false },
        { name: 'phone', type: 'string', required: false },
        { name: 'photoUrl', type: 'string', required: false },
        { name: 'calendarColor', type: 'string', required: false },
        { name: 'activeFamilyId', type: 'string', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    PushToken: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'token', type: 'string', required: true },
        { name: 'platform', type: 'string', required: false },
        { name: 'userId', type: 'string', required: true },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    Family: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'name', type: 'string', required: false },
        { name: 'photoUrl', type: 'string', required: false },
        { name: 'shareCode', type: 'string', required: false },
        { name: 'shareCodeUpdatedAt', type: 'datetime', required: false },
        { name: 'ownerId', type: 'string', required: true },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    FamilyMember: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'userId', type: 'string', required: true },
        { name: 'role', type: 'string', required: false },
        { name: 'joinedAt', type: 'datetime', required: false },
      ],
    },
    FamilyChild: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'birthDate', type: 'datetime', required: false },
        { name: 'photoUrl', type: 'string', required: false },
        { name: 'externalId', type: 'string', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    FamilyInvite: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
        { name: 'displayEmail', type: 'string', required: true },
        { name: 'invitedById', type: 'string', required: true },
        { name: 'invitedByName', type: 'string', required: false },
        { name: 'status', type: 'string', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'expiresAt', type: 'datetime', required: false },
      ],
    },
    Notification: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'userId', type: 'string', required: true },
        { name: 'familyId', type: 'string', required: false },
        { name: 'type', type: 'string', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'body', type: 'string', required: true },
        { name: 'priority', type: 'string', required: false },
        { name: 'data', type: 'json', required: false },
        { name: 'actionUrl', type: 'string', required: false },
        { name: 'read', type: 'boolean', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
      ],
    },
    NotificationPreferences: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'userId', type: 'string', required: true },
        { name: 'expenseNotifications', type: 'boolean', required: false },
        { name: 'swapRequestNotifications', type: 'boolean', required: false },
        { name: 'taskNotifications', type: 'boolean', required: false },
        { name: 'calendarNotifications', type: 'boolean', required: false },
        { name: 'chatNotifications', type: 'boolean', required: false },
        { name: 'emailNotifications', type: 'boolean', required: false },
        { name: 'pushNotifications', type: 'boolean', required: false },
        { name: 'quietHoursEnabled', type: 'boolean', required: false },
        { name: 'quietHoursStart', type: 'string', required: false },
        { name: 'quietHoursEnd', type: 'string', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    UserSettings: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'userId', type: 'string', required: true },
        { name: 'language', type: 'string', required: false },
        { name: 'timezone', type: 'string', required: false },
        { name: 'dateFormat', type: 'string', required: false },
        { name: 'timeFormat', type: 'string', required: false },
        { name: 'weekStart', type: 'string', required: false },
        { name: 'theme', type: 'string', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    FamilySettings: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'defaultCurrency', type: 'string', required: false },
        { name: 'expenseSplitDefault', type: 'string', required: false },
        { name: 'parent1Percentage', type: 'number', required: false },
        { name: 'parent2Percentage', type: 'number', required: false },
        { name: 'requireApprovalForExpenses', type: 'boolean', required: false },
        { name: 'expenseApprovalThreshold', type: 'number', required: false },
        { name: 'allowSwapRequests', type: 'boolean', required: false },
        { name: 'requireApprovalForSwaps', type: 'boolean', required: false },
        { name: 'reminderDefaultTime', type: 'string', required: false },
        { name: 'enableCalendarReminders', type: 'boolean', required: false },
        { name: 'calendarReminderMinutes', type: 'number', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    PrivacySettings: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'userId', type: 'string', required: true },
        { name: 'profileVisibility', type: 'string', required: false },
        { name: 'shareCalendarWithCoParent', type: 'boolean', required: false },
        { name: 'shareExpensesWithCoParent', type: 'boolean', required: false },
        { name: 'shareDocumentsWithCoParent', type: 'boolean', required: false },
        { name: 'allowCoParentMessaging', type: 'boolean', required: false },
        { name: 'blockedUserIds', type: 'string', required: false, isArray: true },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    CustodySchedule: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'name', type: 'string', required: false },
        { name: 'pattern', type: 'string', required: true },
        { name: 'startDate', type: 'datetime', required: true },
        { name: 'endDate', type: 'datetime', required: false },
        { name: 'parent1Days', type: 'number', required: true, isArray: true },
        { name: 'parent2Days', type: 'number', required: true, isArray: true },
        { name: 'biweeklyAltParent1Days', type: 'number', required: false, isArray: true },
        { name: 'biweeklyAltParent2Days', type: 'number', required: false, isArray: true },
        { name: 'isActive', type: 'boolean', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    CustodyApprovalRequest: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'scheduleId', type: 'string', required: true },
        { name: 'name', type: 'string', required: false },
        { name: 'pattern', type: 'string', required: true },
        { name: 'startDate', type: 'datetime', required: true },
        { name: 'parent1Days', type: 'number', required: true, isArray: true },
        { name: 'parent2Days', type: 'number', required: true, isArray: true },
        { name: 'requestedById', type: 'string', required: false },
        { name: 'requestedByName', type: 'string', required: false },
        { name: 'requestedAt', type: 'datetime', required: false },
      ],
    },
    CustodyOverride: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'name', type: 'string', required: false },
        { name: 'type', type: 'string', required: true },
        { name: 'startDate', type: 'datetime', required: true },
        { name: 'endDate', type: 'datetime', required: true },
        { name: 'assignments', type: 'json', required: true },
        { name: 'note', type: 'string', required: false },
        { name: 'status', type: 'string', required: false },
        { name: 'requestedById', type: 'string', required: true },
        { name: 'requestedByName', type: 'string', required: false },
        { name: 'requestedToId', type: 'string', required: false },
        { name: 'requestedToName', type: 'string', required: false },
        { name: 'responseNote', type: 'string', required: false },
        { name: 'respondedById', type: 'string', required: false },
        { name: 'respondedAt', type: 'datetime', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    CalendarEvent: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'description', type: 'string', required: false },
        { name: 'startDate', type: 'datetime', required: true },
        { name: 'endDate', type: 'datetime', required: true },
        { name: 'type', type: 'string', required: true },
        { name: 'parentId', type: 'string', required: true },
        { name: 'targetUids', type: 'string', required: false, isArray: true },
        { name: 'color', type: 'string', required: false },
        { name: 'location', type: 'string', required: false },
        { name: 'reminderMinutes', type: 'number', required: false },
        { name: 'isAllDay', type: 'boolean', required: false },
        { name: 'childId', type: 'string', required: false },
        { name: 'swapRequestId', type: 'string', required: false },
        { name: 'recurring', type: 'json', required: false },
        { name: 'createdById', type: 'string', required: false },
        { name: 'createdByName', type: 'string', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    EventReminder: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'eventId', type: 'string', required: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'startDate', type: 'datetime', required: true },
        { name: 'sendAt', type: 'datetime', required: true },
        { name: 'sent', type: 'boolean', required: false },
        { name: 'sentAt', type: 'datetime', required: false },
        { name: 'targetUids', type: 'string', required: false, isArray: true },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    Expense: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'amount', type: 'number', required: true },
        { name: 'date', type: 'datetime', required: true },
        { name: 'notes', type: 'string', required: false },
        { name: 'receiptUrl', type: 'string', required: false },
        { name: 'receiptName', type: 'string', required: false },
        { name: 'splitParent1', type: 'number', required: false },
        { name: 'status', type: 'string', required: false },
        { name: 'isPaid', type: 'boolean', required: false },
        { name: 'createdById', type: 'string', required: true },
        { name: 'createdByName', type: 'string', required: false },
        { name: 'updatedById', type: 'string', required: false },
        { name: 'updatedByName', type: 'string', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    FinanceSettings: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'alimonyAmount', type: 'number', required: false },
        { name: 'alimonyPayer', type: 'string', required: false },
        { name: 'defaultSplitParent1', type: 'number', required: false },
        { name: 'autoCalculateSplit', type: 'boolean', required: false },
        { name: 'defaultExpenseCategory', type: 'string', required: false },
        { name: 'enableReceiptScanning', type: 'boolean', required: false },
        { name: 'paymentReminderDays', type: 'number', required: false },
        { name: 'sendPaymentReminders', type: 'boolean', required: false },
        { name: 'trackPaymentStatus', type: 'boolean', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    FixedExpense: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'settingsId', type: 'string', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'amount', type: 'number', required: true },
        { name: 'splitParent1', type: 'number', required: true },
      ],
    },
    Task: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'description', type: 'string', required: false },
        { name: 'dueDate', type: 'datetime', required: false },
        { name: 'priority', type: 'string', required: false },
        { name: 'status', type: 'string', required: false },
        { name: 'assignedTo', type: 'string', required: false },
        { name: 'category', type: 'string', required: false },
        { name: 'childId', type: 'string', required: false },
        { name: 'createdById', type: 'string', required: true },
        { name: 'createdByName', type: 'string', required: false },
        { name: 'completedAt', type: 'datetime', required: false },
        { name: 'completedById', type: 'string', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    Document: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'fileName', type: 'string', required: true },
        { name: 'fileUrl', type: 'string', required: true },
        { name: 'fileSize', type: 'number', required: false },
        { name: 'mimeType', type: 'string', required: false },
        { name: 'childId', type: 'string', required: false },
        { name: 'uploadedById', type: 'string', required: false },
        { name: 'uploadedByName', type: 'string', required: false },
        { name: 'uploadedAt', type: 'datetime', required: false },
      ],
    },
    SwapRequest: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'requestedById', type: 'string', required: true },
        { name: 'requestedByName', type: 'string', required: false },
        { name: 'requestedToId', type: 'string', required: true },
        { name: 'requestedToName', type: 'string', required: false },
        { name: 'originalDate', type: 'datetime', required: true },
        { name: 'proposedDate', type: 'datetime', required: false },
        { name: 'requestType', type: 'string', required: false },
        { name: 'reason', type: 'string', required: false },
        { name: 'status', type: 'string', required: false },
        { name: 'responseNote', type: 'string', required: false },
        { name: 'respondedAt', type: 'datetime', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'counterNote', type: 'string', required: false },
        { name: 'counterRespondedAt', type: 'datetime', required: false },
        { name: 'counterResponseNote', type: 'string', required: false },
        { name: 'counteredAt', type: 'datetime', required: false },
        { name: 'counteredById', type: 'string', required: false },
        { name: 'previousProposedDate', type: 'datetime', required: false },
        { name: 'requesterConfirmedAt', type: 'datetime', required: false },
      ],
    },
    PaymentReceipt: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'month', type: 'number', required: true },
        { name: 'year', type: 'number', required: true },
        { name: 'imageUrl', type: 'string', required: true },
        { name: 'imageName', type: 'string', required: false },
        { name: 'amount', type: 'number', required: false },
        { name: 'paidTo', type: 'string', required: true },
        { name: 'description', type: 'string', required: false },
        { name: 'uploadedById', type: 'string', required: true },
        { name: 'uploadedByName', type: 'string', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
      ],
    },
    ChatMessage: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'senderId', type: 'string', required: true },
        { name: 'senderName', type: 'string', required: false },
        { name: 'text', type: 'string', required: false },
        { name: 'imageData', type: 'string', required: false },
        { name: 'imageWidth', type: 'number', required: false },
        { name: 'imageHeight', type: 'number', required: false },
        { name: 'edited', type: 'boolean', required: false },
        { name: 'editedAt', type: 'datetime', required: false },
        { name: 'deleted', type: 'boolean', required: false },
        { name: 'deletedAt', type: 'datetime', required: false },
        { name: 'sentAt', type: 'datetime', required: false },
      ],
    },
    GoalTable: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'childId', type: 'string', required: true },
        { name: 'childName', type: 'string', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'startDate', type: 'datetime', required: true },
        { name: 'endDate', type: 'datetime', required: true },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    Goal: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'goalTableId', type: 'string', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'icon', type: 'string', required: false },
        { name: 'order', type: 'number', required: false },
      ],
    },
    DailyProgress: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'goalTableId', type: 'string', required: true },
        { name: 'date', type: 'datetime', required: true },
        { name: 'completedGoals', type: 'string', required: true, isArray: true },
        { name: 'notes', type: 'string', required: false },
        { name: 'completionPercentage', type: 'number', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
    MonthlyExpenseSummary: {
      fields: [
        { name: 'id', type: 'string', required: true, isId: true },
        { name: 'familyId', type: 'string', required: true },
        { name: 'month', type: 'number', required: true },
        { name: 'year', type: 'number', required: true },
        { name: 'label', type: 'string', required: true },
        { name: 'totalApproved', type: 'number', required: false },
        { name: 'parent1Share', type: 'number', required: false },
        { name: 'parent2Share', type: 'number', required: false },
        { name: 'approvedCount', type: 'number', required: false },
        { name: 'createdAt', type: 'datetime', required: false },
        { name: 'updatedAt', type: 'datetime', required: false },
      ],
    },
  };

  return schemaMap[tableName] || { fields: [] };
}

export async function getDbStats() {
  const stats = await Promise.all(
    TABLES.map(async (table) => {
      const model = (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)];
      if (!model) return { table, count: 0 };
      try {
        const count = await model.count();
        return { table, count };
      } catch {
        return { table, count: 0 };
      }
    })
  );

  return stats;
}

export async function executeRawQuery(query: string) {
  // Only allow SELECT queries for safety
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery.startsWith('select')) {
    throw new Error('Only SELECT queries are allowed');
  }

  return prisma.$queryRawUnsafe(query);
}
