import { Response } from 'express';
import { FamilyRequest } from '../../middleware/family.middleware.js';
import { paymentReceiptsService } from './payment-receipts.service.js';
import { 
  createPaymentReceiptSchema, 
  updatePaymentReceiptSchema,
  listPaymentReceiptsQuerySchema 
} from './payment-receipts.schema.js';

export class PaymentReceiptsController {
  /**
   * GET /api/families/:familyId/payment-receipts
   * Get all payment receipts
   */
  async getReceipts(req: FamilyRequest, res: Response) {
    const query = listPaymentReceiptsQuerySchema.parse(req.query);
    
    const receipts = await paymentReceiptsService.getReceipts(req.familyId!, query);
    
    res.json(receipts);
  }

  /**
   * GET /api/families/:familyId/payment-receipts/grouped
   * Get receipts grouped by month
   */
  async getReceiptsGrouped(req: FamilyRequest, res: Response) {
    const grouped = await paymentReceiptsService.getReceiptsGroupedByMonth(req.familyId!);
    
    res.json(grouped);
  }

  /**
   * GET /api/families/:familyId/payment-receipts/:receiptId
   * Get a single receipt
   */
  async getReceipt(req: FamilyRequest, res: Response) {
    const { receiptId } = req.params;
    
    const receipt = await paymentReceiptsService.getById(receiptId);
    
    if (!receipt) {
      res.status(404).json({ error: 'receipt-not-found' });
      return;
    }
    
    if (receipt.familyId !== req.familyId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    
    res.json(receipt);
  }

  /**
   * POST /api/families/:familyId/payment-receipts
   * Create a new receipt
   */
  async createReceipt(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;
    const userName = req.user!.name || 'הורה';
    
    const data = createPaymentReceiptSchema.parse(req.body);
    
    const receipt = await paymentReceiptsService.createReceipt(
      req.familyId!,
      userId,
      userName,
      data
    );
    
    res.status(201).json(receipt);
  }

  /**
   * PUT /api/families/:familyId/payment-receipts/:receiptId
   * Update a receipt
   */
  async updateReceipt(req: FamilyRequest, res: Response) {
    const { receiptId } = req.params;
    const userId = req.user!.uid;
    
    const data = updatePaymentReceiptSchema.parse(req.body);
    
    const receipt = await paymentReceiptsService.updateReceipt(
      receiptId,
      userId,
      req.familyId!,
      data
    );
    
    res.json(receipt);
  }

  /**
   * DELETE /api/families/:familyId/payment-receipts/:receiptId
   * Delete a receipt
   */
  async deleteReceipt(req: FamilyRequest, res: Response) {
    const { receiptId } = req.params;
    const userId = req.user!.uid;
    
    const result = await paymentReceiptsService.deleteReceipt(
      receiptId,
      userId,
      req.familyId!
    );
    
    res.json(result);
  }
}

export const paymentReceiptsController = new PaymentReceiptsController();
export default paymentReceiptsController;
