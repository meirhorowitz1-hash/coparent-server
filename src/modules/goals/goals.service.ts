import prisma from '../../config/database.js';
import { emitToFamily, SocketEvents } from '../../config/socket.js';
import { CreateGoalTableInput, UpdateGoalTableInput, UpsertDailyProgressInput } from './goals.schema.js';

export class GoalsService {
  /**
   * Get all goal tables for a family
   */
  async getAll(familyId: string, filters?: {
    childId?: string;
    active?: boolean; // Filter for tables that are currently active
  }) {
    const now = new Date();

    return prisma.goalTable.findMany({
      where: {
        familyId,
        ...(filters?.childId && { childId: filters.childId }),
        ...(filters?.active && {
          startDate: { lte: now },
          endDate: { gte: now },
        }),
      },
      include: {
        goals: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: [
        { startDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Get goal table by ID
   */
  async getById(tableId: string) {
    return prisma.goalTable.findUnique({
      where: { id: tableId },
      include: {
        goals: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  /**
   * Create goal table
   */
  async create(
    familyId: string,
    data: CreateGoalTableInput
  ) {
    const goalTable = await prisma.goalTable.create({
      data: {
        familyId,
        childId: data.childId,
        childName: data.childName,
        title: data.title,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        goals: {
          create: data.goals.map((goal, index) => ({
            title: goal.title,
            icon: goal.icon,
            order: goal.order !== undefined ? goal.order : index,
          })),
        },
      },
      include: {
        goals: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.GOAL_TABLE_CREATED, goalTable);

    return goalTable;
  }

  /**
   * Update goal table
   */
  async update(
    tableId: string,
    familyId: string,
    data: UpdateGoalTableInput
  ) {
    // If goals are provided, replace them
    if (data.goals) {
      // Delete existing goals
      await prisma.goal.deleteMany({
        where: { goalTableId: tableId },
      });
    }

    const goalTable = await prisma.goalTable.update({
      where: { id: tableId },
      data: {
        ...(data.childId !== undefined && { childId: data.childId }),
        ...(data.childName !== undefined && { childName: data.childName }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
        ...(data.goals && {
          goals: {
            create: data.goals.map((goal, index) => ({
              title: goal.title,
              icon: goal.icon,
              order: goal.order !== undefined ? goal.order : index,
            })),
          },
        }),
      },
      include: {
        goals: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.GOAL_TABLE_UPDATED, goalTable);

    return goalTable;
  }

  /**
   * Delete goal table
   */
  async delete(tableId: string, familyId: string) {
    await prisma.goalTable.delete({
      where: { id: tableId },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.GOAL_TABLE_DELETED, { id: tableId });
  }

  /**
   * Get daily progress for a goal table
   */
  async getProgress(tableId: string, startDate?: string, endDate?: string) {
    return prisma.dailyProgress.findMany({
      where: {
        goalTableId: tableId,
        ...(startDate && { date: { gte: new Date(startDate) } }),
        ...(endDate && { date: { lte: new Date(endDate) } }),
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Upsert daily progress (create or update)
   */
  async upsertProgress(
    tableId: string,
    familyId: string,
    data: UpsertDailyProgressInput
  ) {
    const date = new Date(data.date);
    date.setHours(0, 0, 0, 0); // Normalize to start of day

    // Get the goal table to calculate completion percentage
    const goalTable = await prisma.goalTable.findUnique({
      where: { id: tableId },
      include: { goals: true },
    });

    if (!goalTable) {
      throw new Error('Goal table not found');
    }

    const totalGoals = goalTable.goals.length;
    const completedCount = data.completedGoals.length;
    const completionPercentage = totalGoals > 0 
      ? Math.round((completedCount / totalGoals) * 100)
      : 0;

    const progress = await prisma.dailyProgress.upsert({
      where: {
        goalTableId_date: {
          goalTableId: tableId,
          date,
        },
      },
      update: {
        completedGoals: data.completedGoals,
        notes: data.notes,
        completionPercentage,
      },
      create: {
        goalTableId: tableId,
        date,
        completedGoals: data.completedGoals,
        notes: data.notes,
        completionPercentage,
      },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.GOAL_PROGRESS_UPDATED, {
      goalTableId: tableId,
      progress,
    });

    return progress;
  }

  /**
   * Get statistics for a goal table
   */
  async getStats(tableId: string) {
    const goalTable = await prisma.goalTable.findUnique({
      where: { id: tableId },
      include: {
        goals: true,
        progress: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!goalTable) {
      throw new Error('Goal table not found');
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const start = new Date(goalTable.startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(goalTable.endDate);
    end.setHours(0, 0, 0, 0);

    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysPassed = Math.min(
      Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      totalDays
    );

    const completedDays = goalTable.progress.filter(p => p.completionPercentage > 0).length;
    const perfectDays = goalTable.progress.filter(p => p.completionPercentage === 100).length;

    const avgCompletion = completedDays > 0
      ? Math.round(
          goalTable.progress.reduce((sum, p) => sum + p.completionPercentage, 0) / completedDays
        )
      : 0;

    // Calculate current streak
    let currentStreak = 0;
    let checkDate = new Date(now);
    
    while (checkDate >= start) {
      const progress = goalTable.progress.find(
        p => new Date(p.date).toDateString() === checkDate.toDateString()
      );
      
      if (!progress || progress.completionPercentage < 100) {
        break;
      }
      
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    
    for (const progress of goalTable.progress) {
      if (progress.completionPercentage === 100) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    return {
      totalDays: daysPassed > 0 ? daysPassed : totalDays,
      completedDays,
      perfectDays,
      currentStreak,
      longestStreak,
      averageCompletion: avgCompletion,
    };
  }
}

export const goalsService = new GoalsService();
export default goalsService;
