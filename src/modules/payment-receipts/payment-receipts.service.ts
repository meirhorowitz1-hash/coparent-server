import prisma from '../../config/database.js';
import { emitToFamily, SocketEvents } from '../../config/socket.js';
import { 
  CreatePaymentReceiptInput, 
  UpdatePaymentReceiptInput,
  ListPaymentReceiptsQuery 
} from './payment-receipts.schema.js';

// Add socket event for payment receipts
const PAYMENT_RECEIPT_NEW = 'payment-receipt:new';
const PAYMENT_RECEIPT_UPDATED = 'payment-receipt:updated';
const PAYMENT_RECEIPT_DELETED = 'payment-receipt:deleted';

export interface MonthlyPaymentSummary {
  month: number;
  year: number;
  label: string;
  receipts: any[];
}

export class PaymentReceiptsService {
  /**
   * Get all payment receipts for a family
   */
  async getReceipts(familyId: string, query?: ListPaymentReceiptsQuery) {
    const where: any = { familyId };

    if (query?.year !== undefined) {
      where.year = query.year;
    }

    if (query?.month !== undefined) {
      where.month = query.month;
    }

    return prisma.paymentReceipt.findMany({
      where,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Get receipts grouped by month
   */
  async getReceiptsGroupedByMonth(familyId: string): Promise<MonthlyPaymentSummary[]> {
    const receipts = await this.getReceipts(familyId);

    // Group by year-month
    const grouped = new Map<string, any[]>();

    for (const receipt of receipts) {
      const key = `${receipt.year}-${receipt.month}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(receipt);
    }

    // Convert to array with labels
    const result: MonthlyPaymentSummary[] = [];

    for (const [key, receipts] of grouped) {
      const [year, month] = key.split('-').map(Number);
      const date = new Date(year, month, 1);
      const label = date.toLocaleDateString('he-IL', { 
        month: 'long', 
        year: 'numeric' 
      });

      result.push({
        month,
        year,
        label,
        receipts,
      });
    }

    // Sort by date descending
    result.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    return result;
  }

  /**
   * Get a single receipt by ID
   */
  async getById(receiptId: string) {
    return prisma.paymentReceipt.findUnique({
      where: { id: receiptId },
    });
  }

  /**
   * Create a new payment receipt
   */
  async createReceipt(
    familyId: string,
    userId: string,
    userName: string,
    data: CreatePaymentReceiptInput
  ) {
    const receipt = await prisma.paymentReceipt.create({
      data: {
        familyId,
        month: data.month,
        year: data.year,
        imageUrl: data.imageUrl,
        imageName: data.imageName,
        amount: data.amount,
        paidTo: data.paidTo,
        description: data.description,
        uploadedById: userId,
        uploadedByName: userName,
      },
    });

    // Emit socket event
    emitToFamily(familyId, PAYMENT_RECEIPT_NEW, receipt);

    return receipt;
  }

  /**
   * Update a payment receipt
   */
  async updateReceipt(
    receiptId: string,
    userId: string,
    familyId: string,
    data: UpdatePaymentReceiptInput
  ) {
    // Verify ownership
    const existing = await prisma.paymentReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!existing) {
      throw new Error('receipt-not-found');
    }

    if (existing.familyId !== familyId) {
      throw new Error('receipt-not-in-family');
    }

    // Only uploader can update
    if (existing.uploadedById !== userId) {
      throw new Error('not-receipt-owner');
    }

    const receipt = await prisma.paymentReceipt.update({
      where: { id: receiptId },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });

    // Emit socket event
    emitToFamily(familyId, PAYMENT_RECEIPT_UPDATED, receipt);

    return receipt;
  }

  /**
   * Delete a payment receipt
   */
  async deleteReceipt(
    receiptId: string,
    userId: string,
    familyId: string
  ) {
    // Verify ownership
    const existing = await prisma.paymentReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!existing) {
      throw new Error('receipt-not-found');
    }

    if (existing.familyId !== familyId) {
      throw new Error('receipt-not-in-family');
    }

    // Only uploader can delete
    if (existing.uploadedById !== userId) {
      throw new Error('not-receipt-owner');
    }

    await prisma.paymentReceipt.delete({
      where: { id: receiptId },
    });

    // Emit socket event
    emitToFamily(familyId, PAYMENT_RECEIPT_DELETED, { id: receiptId });

    return { id: receiptId, deleted: true };
  }
}

export const paymentReceiptsService = new PaymentReceiptsService();
export default paymentReceiptsService;
