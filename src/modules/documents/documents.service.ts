import prisma from '../../config/database.js';
import { emitToFamily } from '../../config/socket.js';
import { uploadFile, deleteFile, generateFileKey } from '../../config/s3.js';

export class DocumentsService {
  /**
   * Get all documents for a family
   */
  async getAll(familyId: string, childId?: string | null) {
    return prisma.document.findMany({
      where: {
        familyId,
        ...(childId !== undefined && { childId }),
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /**
   * Get document by ID
   */
  async getById(documentId: string) {
    return prisma.document.findUnique({
      where: { id: documentId },
    });
  }

  /**
   * Upload document
   */
  async upload(
    familyId: string,
    userId: string,
    userName: string,
    title: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    childId?: string | null
  ) {
    // Upload to S3
    const key = generateFileKey(`families/${familyId}/documents`, file.originalname);
    const { url } = await uploadFile(file.buffer, key, file.mimetype);

    // Save to database
    const document = await prisma.document.create({
      data: {
        familyId,
        title,
        fileName: file.originalname,
        fileUrl: url,
        fileSize: file.size,
        mimeType: file.mimetype,
        childId: childId || null,
        uploadedById: userId,
        uploadedByName: userName,
      },
    });

    // Emit socket event
    emitToFamily(familyId, 'document:created', document);

    return document;
  }

  /**
   * Delete document
   */
  async delete(documentId: string, familyId: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('document-not-found');
    }

    // Delete from S3
    if (document.fileUrl) {
      try {
        const key = this.extractKeyFromUrl(document.fileUrl);
        if (key) {
          await deleteFile(key);
        }
      } catch (error) {
        console.error('[Documents] Failed to delete file from S3:', error);
        // Continue with database deletion even if S3 fails
      }
    }

    // Delete from database
    await prisma.document.delete({
      where: { id: documentId },
    });

    // Emit socket event
    emitToFamily(familyId, 'document:deleted', { id: documentId });
  }

  /**
   * Extract S3 key from URL
   */
  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Remove leading slash
      return urlObj.pathname.slice(1);
    } catch {
      return null;
    }
  }
}

export const documentsService = new DocumentsService();
export default documentsService;
