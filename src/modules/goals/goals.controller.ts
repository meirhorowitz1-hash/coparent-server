import { Request, Response } from 'express';
import { GoalsService } from './goals.service.js';
import {
  createGoalTableSchema,
  updateGoalTableSchema,
  upsertDailyProgressSchema,
} from './goals.schema.js';

const goalsService = new GoalsService();

function normalizeGoalTablePayload(payload: any) {
  const rawGoals = payload?.goals ?? payload?.items;
  const goals = Array.isArray(rawGoals)
    ? rawGoals.map((goal) => ({
        ...goal,
        title: goal?.title ?? goal?.name ?? goal?.label,
      }))
    : rawGoals;

  const child = payload?.child;

  return {
    ...payload,
    childId: payload?.childId ?? child?.id ?? child?.childId,
    childName: payload?.childName ?? payload?.name ?? child?.name ?? child?.fullName,
    title: payload?.title ?? payload?.name ?? payload?.tableTitle,
    goals,
  };
}

function mapGoalTableResponse(goalTable: any) {
  return {
    ...goalTable,
    goals: Array.isArray(goalTable?.goals)
      ? goalTable.goals.map((goal: any) => ({
          ...goal,
          name: goal?.name ?? goal?.title,
        }))
      : goalTable?.goals,
  };
}

export class GoalsController {
  /**
   * GET /api/families/:familyId/goals
   * Get all goal tables for a family
   */
  async getAll(req: Request, res: Response) {
    try {
      const { familyId } = req.params;
      const { childId, active } = req.query;

      const goalTables = await goalsService.getAll(familyId, {
        childId: childId as string,
        active: active === 'true',
      });

      return res.json(goalTables.map(mapGoalTableResponse));
    } catch (error) {
      console.error('Error getting goal tables:', error);
      return res.status(500).json({ error: 'Failed to get goal tables' });
    }
  }

  /**
   * GET /api/families/:familyId/goals/:tableId
   * Get goal table by ID
   */
  async getById(req: Request, res: Response) {
    try {
      const { tableId } = req.params;

      const goalTable = await goalsService.getById(tableId);

      if (!goalTable) {
        return res.status(404).json({ error: 'Goal table not found' });
      }

      return res.json(mapGoalTableResponse(goalTable));
    } catch (error) {
      console.error('Error getting goal table:', error);
      return res.status(500).json({ error: 'Failed to get goal table' });
    }
  }

  /**
   * POST /api/families/:familyId/goals
   * Create goal table
   */
  async create(req: Request, res: Response) {
    try {
      const { familyId } = req.params;

      const validatedData = createGoalTableSchema.parse(
        normalizeGoalTablePayload(req.body)
      );

      const goalTable = await goalsService.create(familyId, validatedData);

      return res.status(201).json(mapGoalTableResponse(goalTable));
    } catch (error: any) {
      console.error('Error creating goal table:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }

      return res.status(500).json({ error: 'Failed to create goal table' });
    }
  }

  /**
   * PUT /api/families/:familyId/goals/:tableId
   * Update goal table
   */
  async update(req: Request, res: Response) {
    try {
      const { familyId, tableId } = req.params;

      const validatedData = updateGoalTableSchema.parse(
        normalizeGoalTablePayload(req.body)
      );

      const goalTable = await goalsService.update(tableId, familyId, validatedData);

      return res.json(mapGoalTableResponse(goalTable));
    } catch (error: any) {
      console.error('Error updating goal table:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }

      return res.status(500).json({ error: 'Failed to update goal table' });
    }
  }

  /**
   * DELETE /api/families/:familyId/goals/:tableId
   * Delete goal table
   */
  async delete(req: Request, res: Response) {
    try {
      const { familyId, tableId } = req.params;

      await goalsService.delete(tableId, familyId);

      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting goal table:', error);
      return res.status(500).json({ error: 'Failed to delete goal table' });
    }
  }

  /**
   * GET /api/families/:familyId/goals/:tableId/progress
   * Get daily progress for a goal table
   */
  async getProgress(req: Request, res: Response) {
    try {
      const { tableId } = req.params;
      const { startDate, endDate } = req.query;

      const progress = await goalsService.getProgress(
        tableId,
        startDate as string,
        endDate as string
      );

      return res.json(progress);
    } catch (error) {
      console.error('Error getting progress:', error);
      return res.status(500).json({ error: 'Failed to get progress' });
    }
  }

  /**
   * POST /api/families/:familyId/goals/:tableId/progress
   * Upsert daily progress
   */
  async upsertProgress(req: Request, res: Response) {
    try {
      const { familyId, tableId } = req.params;

      const normalizedBody = {
        ...req.body,
        date: req.body?.date ? new Date(req.body.date).toISOString() : req.body?.date,
      };
      const validatedData = upsertDailyProgressSchema.parse(normalizedBody);

      const progress = await goalsService.upsertProgress(tableId, familyId, validatedData);

      return res.json(progress);
    } catch (error: any) {
      console.error('Error upserting progress:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }

      return res.status(500).json({ error: 'Failed to update progress' });
    }
  }

  /**
   * GET /api/families/:familyId/goals/:tableId/stats
   * Get statistics for a goal table
   */
  async getStats(req: Request, res: Response) {
    try {
      const { tableId } = req.params;

      const stats = await goalsService.getStats(tableId);

      return res.json(stats);
    } catch (error) {
      console.error('Error getting stats:', error);
      return res.status(500).json({ error: 'Failed to get stats' });
    }
  }
}
