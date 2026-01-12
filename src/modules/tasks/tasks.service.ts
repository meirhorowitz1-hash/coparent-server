import prisma from '../../config/database.js';
import { emitToFamily, emitToFamilyExceptUser, SocketEvents } from '../../config/socket.js';
import { sendPushToFamilyMembers } from '../../utils/push.js';
import { CreateTaskInput, UpdateTaskInput } from './tasks.schema.js';

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
    const task = await prisma.task.create({
      data: {
        familyId,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority,
        assignedTo: data.assignedTo,
        category: data.category,
        childId: data.childId,
        createdById: userId,
        createdByName: userName,
      },
    });

    // Emit socket event
    emitToFamilyExceptUser(familyId, userId, SocketEvents.TASK_NEW, task);
    emitToFamilyExceptUser(familyId, userId, 'task:created', task);

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

    return task;
  }

  /**
   * Update task
   */
  async update(
    taskId: string,
    familyId: string,
    data: UpdateTaskInput
  ) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.dueDate !== undefined && { 
          dueDate: data.dueDate ? new Date(data.dueDate) : null 
        }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.childId !== undefined && { childId: data.childId }),
      },
    });

    // Emit socket event
    emitToFamily(familyId, 'task:updated', task);

    return task;
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
    });

    // Emit socket event
    emitToFamily(familyId, 'task:updated', task);

    return task;
  }

  /**
   * Delete task
   */
  async delete(taskId: string, familyId: string) {
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
}

export const tasksService = new TasksService();
export default tasksService;
