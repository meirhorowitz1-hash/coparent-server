import prisma from '../../config/database.js';
import { emitToFamily } from '../../config/socket.js';
import { sendPushToFamilyMembers, sendPushToUser, getOtherParentId } from '../../utils/push.js';
import { formatCurrency } from '../../utils/helpers.js';
import { 
  CreateExpenseInput, 
  UpdateExpenseInput, 
  UpdateFinanceSettingsInput 
} from './expenses.schema.js';

export class ExpensesService {
  /**
   * Get all expenses for a family
   */
  async getAll(familyId: string, filters?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    return prisma.expense.findMany({
      where: {
        familyId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.startDate && filters?.endDate && {
          date: {
            gte: filters.startDate,
            lte: filters.endDate,
          },
        }),
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Get expense by ID
   */
  async getById(expenseId: string) {
    return prisma.expense.findUnique({
      where: { id: expenseId },
    });
  }

  /**
   * Create expense
   */
  async create(
    familyId: string,
    userId: string,
    userName: string,
    data: CreateExpenseInput
  ) {
    const expense = await prisma.expense.create({
      data: {
        familyId,
        title: data.title,
        amount: data.amount,
        date: new Date(data.date),
        notes: data.notes,
        splitParent1: data.splitParent1,
        receiptUrl: data.receiptUrl,
        receiptName: data.receiptName,
        createdById: userId,
        createdByName: userName,
      },
    });

    // Emit socket event
    emitToFamily(familyId, 'expense:created', expense);

    // Send push notification
    await sendPushToFamilyMembers(
      familyId,
      userId,
      {
        title: 'הוצאה חדשה',
        body: `${userName} הוסיף/ה: ${data.title} (${formatCurrency(data.amount)})`,
      },
      {
        type: 'expense-created',
        familyId,
        expenseId: expense.id,
      }
    );

    return expense;
  }

  /**
   * Update expense
   */
  async update(
    expenseId: string,
    familyId: string,
    userId: string,
    userName: string,
    data: UpdateExpenseInput
  ) {
    // Check if expense is still pending
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing) {
      throw new Error('expense-not-found');
    }

    if (existing.status !== 'pending') {
      throw new Error('cannot-edit-non-pending');
    }

    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.splitParent1 !== undefined && { splitParent1: data.splitParent1 }),
        ...(data.receiptUrl !== undefined && { receiptUrl: data.receiptUrl }),
        ...(data.receiptName !== undefined && { receiptName: data.receiptName }),
        updatedById: userId,
        updatedByName: userName,
      },
    });

    // Emit socket event
    emitToFamily(familyId, 'expense:updated', expense);

    return expense;
  }

  /**
   * Update expense status
   */
  async updateStatus(
    expenseId: string,
    familyId: string,
    userId: string,
    userName: string,
    status: 'pending' | 'approved' | 'rejected'
  ) {
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing) {
      throw new Error('expense-not-found');
    }

    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status,
        isPaid: status === 'approved' ? existing.isPaid : false,
        updatedById: userId,
        updatedByName: userName,
      },
    });

    // Emit socket event
    emitToFamily(familyId, 'expense:updated', expense);

    // Send push notification to creator
    if (existing.createdById !== userId) {
      const statusLabel = status === 'approved' ? 'אושרה' : 'נדחתה';
      await sendPushToUser(
        existing.createdById,
        {
          title: `הוצאה ${statusLabel}`,
          body: `${userName} ${statusLabel} את ${existing.title} (${formatCurrency(existing.amount)})`,
        },
        {
          type: `expense-${status}`,
          familyId,
          expenseId,
        }
      );
    }

    return expense;
  }

  /**
   * Toggle paid status
   */
  async togglePaid(
    expenseId: string,
    familyId: string,
    userId: string,
    userName: string
  ) {
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing) {
      throw new Error('expense-not-found');
    }

    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        isPaid: !existing.isPaid,
        // Auto-approve if marking as paid
        status: !existing.isPaid && existing.status !== 'approved' ? 'approved' : existing.status,
        updatedById: userId,
        updatedByName: userName,
      },
    });

    // Emit socket event
    emitToFamily(familyId, 'expense:updated', expense);

    return expense;
  }

  /**
   * Delete expense
   */
  async delete(expenseId: string, familyId: string) {
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing) {
      throw new Error('expense-not-found');
    }

    if (existing.status !== 'pending') {
      throw new Error('cannot-delete-non-pending');
    }

    await prisma.expense.delete({
      where: { id: expenseId },
    });

    // Emit socket event
    emitToFamily(familyId, 'expense:deleted', { id: expenseId });
  }

  /**
   * Get finance settings
   */
  async getFinanceSettings(familyId: string) {
    let settings = await prisma.financeSettings.findUnique({
      where: { familyId },
      include: { fixedExpenses: true },
    });

    // Create default settings if not exist
    if (!settings) {
      settings = await prisma.financeSettings.create({
        data: {
          familyId,
          alimonyAmount: 0,
          alimonyPayer: null,
          defaultSplitParent1: 50,
        },
        include: { fixedExpenses: true },
      });
    }

    return settings;
  }

  /**
   * Update finance settings
   */
  async updateFinanceSettings(familyId: string, data: UpdateFinanceSettingsInput) {
    // Upsert settings
    const settings = await prisma.financeSettings.upsert({
      where: { familyId },
      create: {
        familyId,
        alimonyAmount: data.alimonyAmount ?? 0,
        alimonyPayer: data.alimonyPayer ?? null,
        defaultSplitParent1: data.defaultSplitParent1 ?? 50,
      },
      update: {
        ...(data.alimonyAmount !== undefined && { alimonyAmount: data.alimonyAmount }),
        ...(data.alimonyPayer !== undefined && { alimonyPayer: data.alimonyPayer }),
        ...(data.defaultSplitParent1 !== undefined && { defaultSplitParent1: data.defaultSplitParent1 }),
      },
    });

    // Handle fixed expenses
    if (data.fixedExpenses !== undefined) {
      // Delete existing
      await prisma.fixedExpense.deleteMany({
        where: { settingsId: settings.id },
      });

      // Create new
      if (data.fixedExpenses.length > 0) {
        await prisma.fixedExpense.createMany({
          data: data.fixedExpenses.map((exp) => ({
            settingsId: settings.id,
            title: exp.title,
            amount: exp.amount,
            splitParent1: exp.splitParent1,
          })),
        });
      }
    }

    // Return updated settings with fixed expenses
    return this.getFinanceSettings(familyId);
  }

  /**
   * Get expense summary for a family
   */
  async getSummary(familyId: string, userId: string, startDate?: Date, endDate?: Date) {
    const expenses = await prisma.expense.findMany({
      where: {
        familyId,
        ...(startDate && endDate && {
          date: { gte: startDate, lte: endDate },
        }),
      },
    });

    // Get parent role
    const members = await prisma.familyMember.findMany({
      where: { familyId },
      select: { userId: true },
    });
    
    const sortedMembers = [...new Set(members.map(m => m.userId))].sort();
    const isParent1 = sortedMembers[0] === userId;

    let totalExpenses = 0;
    let myShare = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let approvedAmount = 0;

    for (const expense of expenses) {
      totalExpenses += expense.amount;
      
      const myPercentage = isParent1 ? expense.splitParent1 : (100 - expense.splitParent1);
      myShare += (expense.amount * myPercentage) / 100;

      if (expense.status === 'pending') {
        pendingCount++;
        pendingAmount += expense.amount;
      } else if (expense.status === 'approved') {
        approvedAmount += expense.amount;
      }
    }

    return {
      totalExpenses,
      myShare,
      partnerShare: totalExpenses - myShare,
      pendingCount,
      pendingAmount,
      approvedAmount,
      expenseCount: expenses.length,
    };
  }
}

export const expensesService = new ExpensesService();
export default expensesService;
