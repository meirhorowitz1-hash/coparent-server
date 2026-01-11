import { Router } from 'express';
import { paymentReceiptsController } from './payment-receipts.controller.js';

const router = Router({ mergeParams: true });

// Payment receipts routes
router.get('/', (req, res) => paymentReceiptsController.getReceipts(req as any, res));
router.get('/grouped', (req, res) => paymentReceiptsController.getReceiptsGrouped(req as any, res));
router.get('/:receiptId', (req, res) => paymentReceiptsController.getReceipt(req as any, res));
router.post('/', (req, res) => paymentReceiptsController.createReceipt(req as any, res));
router.put('/:receiptId', (req, res) => paymentReceiptsController.updateReceipt(req as any, res));
router.delete('/:receiptId', (req, res) => paymentReceiptsController.deleteReceipt(req as any, res));

export default router;
