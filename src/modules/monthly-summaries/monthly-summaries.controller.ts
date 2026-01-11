import { Request, Response } from 'express';
import { monthlySummariesService } from './monthly-summaries.service.js';
import { upsertMonthlySummarySchema } from './monthly-summaries.schema.js';

interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
  };
}

export class MonthlySummariesController {
  /**
   * GET /api/families/:familyId/monthly-summaries
   */
  async getAll(req: AuthRequest, res: Response) {
    const { familyId } = req.params;
    const { year } = req.query;

    const summaries = await monthlySummariesService.getAll(familyId, {
      year: year ? parseInt(year as string, 10) : undefined,
    });

    res.json(summaries);
  }

  /**
   * GET /api/families/:familyId/monthly-summaries/:year/:month
   */
  async getByMonth(req: AuthRequest, res: Response) {
    const { familyId, year, month } = req.params;

    const summary = await monthlySummariesService.getByMonth(
      familyId,
      parseInt(year, 10),
      parseInt(month, 10)
    );

    if (!summary) {
      return res.status(404).json({ error: 'summary-not-found' });
    }

    res.json(summary);
  }

  /**
   * POST /api/families/:familyId/monthly-summaries
   */
  async upsert(req: AuthRequest, res: Response) {
    const { familyId } = req.params;

    const validation = upsertMonthlySummarySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation-error', details: validation.error.errors });
    }

    const summary = await monthlySummariesService.upsert(familyId, validation.data);
    res.json(summary);
  }

  /**
   * POST /api/families/:familyId/monthly-summaries/:year/:month/calculate
   * Recalculate summary from actual expenses
   */
  async calculate(req: AuthRequest, res: Response) {
    const { familyId, year, month } = req.params;

    const summary = await monthlySummariesService.calculateFromExpenses(
      familyId,
      parseInt(year, 10),
      parseInt(month, 10)
    );

    res.json(summary);
  }

  /**
   * DELETE /api/families/:familyId/monthly-summaries/:year/:month
   */
  async delete(req: AuthRequest, res: Response) {
    const { familyId, year, month } = req.params;

    await monthlySummariesService.delete(
      familyId,
      parseInt(year, 10),
      parseInt(month, 10)
    );

    res.json({ success: true });
  }
}

export const monthlySummariesController = new MonthlySummariesController();
export default monthlySummariesController;
