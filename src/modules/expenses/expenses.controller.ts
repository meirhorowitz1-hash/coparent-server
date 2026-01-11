import { Response } from 'express';
import { FamilyRequest } from '../../middleware/family.middleware.js';
import { expensesService } from './expenses.service.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
  updateExpenseStatusSchema,
  updateFinanceSettingsSchema,
} from './expenses.schema.js';

export class ExpensesController {
  /**
   * GET /api/expenses/:familyId
   * Get all expenses for a family
   */
  async getAll(req: FamilyRequest, res: Response) {
    const { status, startDate, endDate } = req.query;

    const filters = {
      ...(status && { status: status as string }),
      ...(startDate && endDate && {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      }),
    };

    const expenses = await expensesService.getAll(req.familyId!, filters);
    return res.json(expenses);
  }

  /**
   * GET /api/expenses/:familyId/summary
   * Get expense summary
   */
  async getSummary(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;
    const { startDate, endDate } = req.query;

    const summary = await expensesService.getSummary(
      req.familyId!,
      userId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    return res.json(summary);
  }

  /**
   * GET /api/expenses/:familyId/:expenseId
   * Get single expense
   */
  async getById(req: FamilyRequest, res: Response) {
    const { expenseId } = req.params;
    const expense = await expensesService.getById(expenseId);

    if (!expense) {
      return res.status(404).json({
        error: 'not-found',
        message: 'Expense not found',
      });
    }

    return res.json(expense);
  }

  /**
   * POST /api/expenses/:familyId
   * Create expense
   */
  async create(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;
    const userName = req.body.createdByName || 'הורה';
    const data = createExpenseSchema.parse(req.body);

    const expense = await expensesService.create(
      req.familyId!,
      userId,
      userName,
      data
    );

    return res.status(201).json(expense);
  }

  /**
   * PATCH /api/expenses/:familyId/:expenseId
   * Update expense
   */
  async update(req: FamilyRequest, res: Response) {
    const { expenseId } = req.params;
    const userId = req.user!.uid;
    const userName = req.body.updatedByName || 'הורה';
    const data = updateExpenseSchema.parse(req.body);

    try {
      const expense = await expensesService.update(
        expenseId,
        req.familyId!,
        userId,
        userName,
        data
      );
      return res.json(expense);
    } catch (error) {
      const message = (error as Error).message;

      if (message === 'expense-not-found') {
        return res.status(404).json({
          error: 'not-found',
          message: 'Expense not found',
        });
      }

      if (message === 'cannot-edit-non-pending') {
        return res.status(400).json({
          error: 'cannot-edit-non-pending',
          message: 'Only pending expenses can be edited',
        });
      }

      throw error;
    }
  }

  /**
   * PATCH /api/expenses/:familyId/:expenseId/status
   * Update expense status
   */
  async updateStatus(req: FamilyRequest, res: Response) {
    const { expenseId } = req.params;
    const userId = req.user!.uid;
    const userName = req.body.updatedByName || 'הורה';
    const { status } = updateExpenseStatusSchema.parse(req.body);

    try {
      const expense = await expensesService.updateStatus(
        expenseId,
        req.familyId!,
        userId,
        userName,
        status
      );
      return res.json(expense);
    } catch (error) {
      const message = (error as Error).message;

      if (message === 'expense-not-found') {
        return res.status(404).json({
          error: 'not-found',
          message: 'Expense not found',
        });
      }

      throw error;
    }
  }

  /**
   * PATCH /api/expenses/:familyId/:expenseId/paid
   * Toggle paid status
   */
  async togglePaid(req: FamilyRequest, res: Response) {
    const { expenseId } = req.params;
    const userId = req.user!.uid;
    const userName = req.body.updatedByName || 'הורה';

    try {
      const expense = await expensesService.togglePaid(
        expenseId,
        req.familyId!,
        userId,
        userName
      );
      return res.json(expense);
    } catch (error) {
      const message = (error as Error).message;

      if (message === 'expense-not-found') {
        return res.status(404).json({
          error: 'not-found',
          message: 'Expense not found',
        });
      }

      throw error;
    }
  }

  /**
   * DELETE /api/expenses/:familyId/:expenseId
   * Delete expense
   */
  async delete(req: FamilyRequest, res: Response) {
    const { expenseId } = req.params;

    try {
      await expensesService.delete(expenseId, req.familyId!);
      return res.json({ success: true });
    } catch (error) {
      const message = (error as Error).message;

      if (message === 'expense-not-found') {
        return res.status(404).json({
          error: 'not-found',
          message: 'Expense not found',
        });
      }

      if (message === 'cannot-delete-non-pending') {
        return res.status(400).json({
          error: 'cannot-delete-non-pending',
          message: 'Only pending expenses can be deleted',
        });
      }

      throw error;
    }
  }

  /**
   * GET /api/expenses/:familyId/settings
   * Get finance settings
   */
  async getSettings(req: FamilyRequest, res: Response) {
    const settings = await expensesService.getFinanceSettings(req.familyId!);
    return res.json(settings);
  }

  /**
   * PUT /api/expenses/:familyId/settings
   * Update finance settings
   */
  async updateSettings(req: FamilyRequest, res: Response) {
    const data = updateFinanceSettingsSchema.parse(req.body);
    const settings = await expensesService.updateFinanceSettings(req.familyId!, data);
    return res.json(settings);
  }
}

export const expensesController = new ExpensesController();
export default expensesController;
