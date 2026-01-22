import prisma from '../../config/database.js';
import { emitToFamily, SocketEvents } from '../../config/socket.js';
import { storageService, storageServiceFirebase, extractStorageKeyFromUrl } from '../../services/storage.service.js';

export class DocumentsService {
  private storageMode = (process.env.DOCUMENTS_STORAGE || '').toLowerCase();
  private storage = this.storageMode === 'firebase' || (
    this.storageMode !== 'db' && process.env.USE_FIREBASE_STORAGE === 'true'
  )
    ? storageServiceFirebase
    : storageService;

  private shouldStoreInDb(): boolean {
    return this.storageMode === 'db';
  }

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
    const fileUrl = this.shouldStoreInDb()
      ? `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
      : (await this.storage.uploadFile(
          file.buffer,
          `families/${familyId}/documents`,
          file.originalname,
          file.mimetype
        )).url;

    // Save to database
    const document = await prisma.document.create({
      data: {
        familyId,
        title,
        fileName: file.originalname,
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        childId: childId || null,
        uploadedById: userId,
        uploadedByName: userName,
      },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.DOCUMENT_NEW, document);

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
    if (document.fileUrl && !this.shouldStoreInDb()) {
      try {
        const key = extractStorageKeyFromUrl(document.fileUrl);
        if (key) {
          await this.storage.deleteFile(key);
        }
      } catch (error) {
        console.error('[Documents] Failed to delete file from storage provider:', error);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete from database
    await prisma.document.delete({
      where: { id: documentId },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.DOCUMENT_DELETED, { id: documentId });
  }
}

export const documentsService = new DocumentsService();
export default documentsService;
