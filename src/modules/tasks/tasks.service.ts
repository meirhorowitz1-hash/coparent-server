import prisma from '../../config/database.js';
import { emitToFamily, emitToFamilyExceptUser, SocketEvents } from '../../config/socket.js';
import { sendPushToFamilyMembers } from '../../utils/push.js';
import { CreateTaskInput, UpdateTaskInput } from './tasks.schema.js';

interface TaskReminderInput {
  minutes: number;
  sent?: boolean;
}

export class TasksService {
  /**
   * Get all tasks for a family
   */
  async getAll(familyId: string, filters?: {
    status?: string;
    assignedTo?: string;
    category?: string;
  }) {
    return prisma.task.findMany({
      where: {
        familyId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.assignedTo && { assignedTo: filters.assignedTo }),
        ...(filters?.category && { category: filters.category }),
      },
      include: {
        reminder: true,
      },
      orderBy: [
        { dueDate: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Get task by ID
   */
  async getById(taskId: string) {
    return prisma.task.findUnique({
      where: { id: taskId },
      include: {
        reminder: true,
      },
    });
  }

  /**
   * Create task
   */
  async create(
    familyId: string,
    userId: string,
    userName: string,
    data: CreateTaskInput
  ) {
    const dueDate = data.dueDate ? new Date(data.dueDate) : null;

    const task = await prisma.task.create({
      data: {
        familyId,
        title: data.title,
        description: data.description,
        dueDate,
        priority: data.priority,
        assignedTo: data.assignedTo,
        category: data.category,
        childId: data.childId,
        createdById: userId,
        createdByName: userName,
      },
      include: {
        reminder: true,
      },
    });

    // Create reminder if provided and dueDate exists
    if (dueDate && data.reminders?.length) {
      await this.createOrUpdateReminder(task.id, familyId, data.title, dueDate, data.reminders[0]);
    }

    // Fetch task with reminder
    const taskWithReminder = await this.getById(task.id);

    // Emit socket event
    emitToFamilyExceptUser(familyId, userId, SocketEvents.TASK_NEW, taskWithReminder);
    emitToFamilyExceptUser(familyId, userId, 'task:created', taskWithReminder);

    // Send push notification
    await sendPushToFamilyMembers(
      familyId,
      userId,
      {
        title: 'משימה חדשה',
        body: `${userName} הוסיף/ה: ${data.title}`,
      },
      {
        type: 'task-created',
        familyId,
        taskId: task.id,
      }
    );

    return taskWithReminder;
  }

  /**
   * Update task
   */
  async update(
    taskId: string,
    familyId: string,
    data: UpdateTaskInput
  ) {
    const dueDate = data.dueDate !== undefined 
      ? (data.dueDate ? new Date(data.dueDate) : null) 
      : undefined;

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(dueDate !== undefined && { dueDate }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.childId !== undefined && { childId: data.childId }),
      },
      include: {
        reminder: true,
      },
    });

    // Handle reminder updates
    const finalDueDate = dueDate !== undefined ? dueDate : task.dueDate;
    const title = data.title ?? task.title;

    if (data.reminders !== undefined) {
      if (finalDueDate && data.reminders?.length) {
        // Create or update reminder
        await this.createOrUpdateReminder(taskId, familyId, title, finalDueDate, data.reminders[0]);
      } else {
        // Delete reminder if no reminders or no dueDate
        await this.deleteReminder(taskId);
      }
    } else if (dueDate !== undefined) {
      // dueDate changed, update existing reminder if present
      if (task.reminder && finalDueDate) {
        await this.createOrUpdateReminder(taskId, familyId, title, finalDueDate, { minutes: task.reminder.minutes });
      } else if (!finalDueDate) {
        // dueDate removed, delete reminder
        await this.deleteReminder(taskId);
      }
    }

    // Fetch updated task with reminder
    const updatedTask = await this.getById(taskId);

    // Emit socket event
    emitToFamily(familyId, 'task:updated', updatedTask);

    return updatedTask;
  }

  /**
   * Update task status
   */
  async updateStatus(
    taskId: string,
    familyId: string,
    userId: string,
    status: string
  ) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: status === 'completed' ? new Date() : null,
        completedById: status === 'completed' ? userId : null,
      },
      include: {
        reminder: true,
      },
    });

    // Delete reminder if task is completed or cancelled
    if (status === 'completed' || status === 'cancelled') {
      await this.deleteReminder(taskId);
    }

    // Fetch updated task
    const updatedTask = await this.getById(taskId);

    // Emit socket event
    emitToFamily(familyId, 'task:updated', updatedTask);

    return updatedTask;
  }

  /**
   * Delete task
   */
  async delete(taskId: string, familyId: string) {
    // Delete reminder first (cascade should handle this, but being explicit)
    await this.deleteReminder(taskId);

    await prisma.task.delete({
      where: { id: taskId },
    });

    // Emit socket event
    emitToFamily(familyId, 'task:deleted', { id: taskId });
  }

  /**
   * Get task statistics
   */
  async getStats(familyId: string) {
    const [total, pending, inProgress, completed, overdue] = await Promise.all([
      prisma.task.count({ where: { familyId } }),
      prisma.task.count({ where: { familyId, status: 'pending' } }),
      prisma.task.count({ where: { familyId, status: 'in_progress' } }),
      prisma.task.count({ where: { familyId, status: 'completed' } }),
      prisma.task.count({
        where: {
          familyId,
          status: { in: ['pending', 'in_progress'] },
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    return { total, pending, inProgress, completed, overdue };
  }

  // ==================== REMINDER HELPERS ====================

  /**
   * Create or update task reminder
   */
  private async createOrUpdateReminder(
    taskId: string,
    familyId: string,
    title: string,
    dueDate: Date,
    reminderInput: TaskReminderInput
  ): Promise<void> {
    const minutes = reminderInput.minutes;
    const sendAt = this.calculateSendAt(dueDate, minutes);

    // Get target users (family members)
    const targetUids = await this.getFamilyMemberUids(familyId);

    await prisma.taskReminder.upsert({
      where: { taskId },
      create: {
        taskId,
        familyId,
        title,
        dueDate,
        sendAt,
        minutes,
        sent: false,
        targetUids,
      },
      update: {
        title,
        dueDate,
        sendAt,
        minutes,
        sent: false, // Reset sent status when updated
        sentAt: null,
        targetUids,
      },
    });
  }

  /**
   * Delete task reminder
   */
  private async deleteReminder(taskId: string): Promise<void> {
    try {
      await prisma.taskReminder.delete({
        where: { taskId },
      });
    } catch (error: any) {
      // Ignore not found errors
      if (error?.code !== 'P2025') {
        throw error;
      }
    }
  }

  /**
   * Calculate when to send the reminder
   */
  private calculateSendAt(dueDate: Date, minutes: number): Date {
    const sendAt = new Date(dueDate);
    sendAt.setMinutes(sendAt.getMinutes() - minutes);
    return sendAt;
  }

  /**
   * Get family member UIDs for targeting reminders
   */
  private async getFamilyMemberUids(familyId: string): Promise<string[]> {
    const members = await prisma.familyMember.findMany({
      where: { familyId },
      select: { userId: true },
    });
    return members.map(m => m.userId);
  }
}

export const tasksService = new TasksService();
export default tasksService;
