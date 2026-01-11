import prisma from '../../config/database.js';
import { UpsertMonthlySummaryInput } from './monthly-summaries.schema.js';

export class MonthlySummariesService {
  /**
   * Get all monthly summaries for a family
   */
  async getAll(familyId: string, filters?: {
    year?: number;
  }) {
    const where: any = { familyId };
    
    if (filters?.year) {
      where.year = filters.year;
    }

    return prisma.monthlyExpenseSummary.findMany({
      where,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
    });
  }

  /**
   * Get monthly summary by month/year
   */
  async getByMonth(familyId: string, year: number, month: number) {
    return prisma.monthlyExpenseSummary.findUnique({
      where: {
        familyId_year_month: {
          familyId,
          year,
          month,
        },
      },
    });
  }

  /**
   * Upsert monthly summary
   */
  async upsert(familyId: string, data: UpsertMonthlySummaryInput) {
    return prisma.monthlyExpenseSummary.upsert({
      where: {
        familyId_year_month: {
          familyId,
          year: data.year,
          month: data.month,
        },
      },
      create: {
        familyId,
        month: data.month,
        year: data.year,
        label: data.label,
        totalApproved: data.totalApproved,
        parent1Share: data.parent1Share,
        parent2Share: data.parent2Share,
        approvedCount: data.approvedCount,
      },
      update: {
        label: data.label,
        totalApproved: data.totalApproved,
        parent1Share: data.parent1Share,
        parent2Share: data.parent2Share,
        approvedCount: data.approvedCount,
      },
    });
  }

  /**
   * Calculate and generate summary from expenses
   */
  async calculateFromExpenses(familyId: string, year: number, month: number) {
    // Get all approved expenses for the month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const expenses = await prisma.expense.findMany({
      where: {
        familyId,
        status: 'approved',
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calculate totals
    let totalApproved = 0;
    let parent1Share = 0;
    let parent2Share = 0;

    expenses.forEach((expense) => {
      totalApproved += expense.amount;
      const share1 = expense.amount * (expense.splitParent1 / 100);
      const share2 = expense.amount - share1;
      parent1Share += share1;
      parent2Share += share2;
    });

    // Generate label
    const label = new Date(year, month, 1).toLocaleDateString('he-IL', {
      month: 'long',
      year: 'numeric',
    });

    return this.upsert(familyId, {
      month,
      year,
      label,
      totalApproved,
      parent1Share,
      parent2Share,
      approvedCount: expenses.length,
    });
  }

  /**
   * Delete monthly summary
   */
  async delete(familyId: string, year: number, month: number) {
    return prisma.monthlyExpenseSummary.delete({
      where: {
        familyId_year_month: {
          familyId,
          year,
          month,
        },
      },
    }).catch(() => null);
  }
}

export const monthlySummariesService = new MonthlySummariesService();
export default monthlySummariesService;
