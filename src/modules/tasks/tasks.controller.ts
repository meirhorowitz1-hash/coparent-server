import { Response } from 'express';
import { FamilyRequest } from '../../middleware/family.middleware.js';
import { tasksService } from './tasks.service.js';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from './tasks.schema.js';

export class TasksController {
  /**
   * GET /api/tasks/:familyId
   * Get all tasks for a family
   */
  async getAll(req: FamilyRequest, res: Response) {
    const { status, assignedTo, category } = req.query;

    const filters = {
      ...(status && { status: status as string }),
      ...(assignedTo && { assignedTo: assignedTo as string }),
      ...(category && { category: category as string }),
    };

    const tasks = await tasksService.getAll(req.familyId!, filters);
    return res.json(tasks);
  }

  /**
   * GET /api/tasks/:familyId/stats
   * Get task statistics
   */
  async getStats(req: FamilyRequest, res: Response) {
    const stats = await tasksService.getStats(req.familyId!);
    return res.json(stats);
  }

  /**
   * GET /api/tasks/:familyId/:taskId
   * Get single task
   */
  async getById(req: FamilyRequest, res: Response) {
    const { taskId } = req.params;
    const task = await tasksService.getById(taskId);

    if (!task) {
      return res.status(404).json({
        error: 'not-found',
        message: 'Task not found',
      });
    }

    return res.json(task);
  }

  /**
   * POST /api/tasks/:familyId
   * Create task
   */
  async create(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;
    const userName = req.body.createdByName || 'הורה';
    const data = createTaskSchema.parse(req.body);

    const task = await tasksService.create(
      req.familyId!,
      userId,
      userName,
      data
    );

    return res.status(201).json(task);
  }

  /**
   * PATCH /api/tasks/:familyId/:taskId
   * Update task
   */
  async update(req: FamilyRequest, res: Response) {
    const { taskId } = req.params;
    const data = updateTaskSchema.parse(req.body);

    const task = await tasksService.update(taskId, req.familyId!, data);
    return res.json(task);
  }

  /**
   * PATCH /api/tasks/:familyId/:taskId/status
   * Update task status
   */
  async updateStatus(req: FamilyRequest, res: Response) {
    const { taskId } = req.params;
    const userId = req.user!.uid;
    const { status } = updateTaskStatusSchema.parse(req.body);

    const task = await tasksService.updateStatus(
      taskId,
      req.familyId!,
      userId,
      status
    );

    return res.json(task);
  }

  /**
   * DELETE /api/tasks/:familyId/:taskId
   * Delete task
   */
  async delete(req: FamilyRequest, res: Response) {
    const { taskId } = req.params;

    await tasksService.delete(taskId, req.familyId!);
    return res.json({ success: true });
  }
}

export const tasksController = new TasksController();
export default tasksController;
