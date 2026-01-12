import { Response } from 'express';
import { FamilyRequest } from '../../middleware/family.middleware.js';
import { documentsService } from './documents.service.js';
import { uploadDocumentSchema } from './documents.schema.js';

export class DocumentsController {
  /**
   * GET /api/documents/:familyId
   * Get all documents
   */
  async getAll(req: FamilyRequest, res: Response) {
    const { childId } = req.query;

    const documents = await documentsService.getAll(
      req.familyId!,
      childId === 'null' ? null : (childId as string | undefined)
    );

    return res.json(documents);
  }

  /**
   * GET /api/documents/:familyId/:documentId
   * Get single document
   */
  async getById(req: FamilyRequest, res: Response) {
    const { documentId } = req.params;
    const document = await documentsService.getById(documentId);

    if (!document) {
      return res.status(404).json({
        error: 'not-found',
        message: 'Document not found',
      });
    }

    return res.json(document);
  }

  /**
   * POST /api/documents/:familyId
   * Upload document
   */
  async upload(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;
    const userName = req.body.uploaderName || 'הורה';

    // Validate body
    const { title, childId } = uploadDocumentSchema.parse(req.body);

    // Check if file was uploaded
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        error: 'bad-request',
        message: 'No file uploaded',
      });
    }

    const maxSizeMb = Number(process.env.DOCUMENTS_MAX_MB ?? '10');
    if (Number.isFinite(maxSizeMb) && file.size > maxSizeMb * 1024 * 1024) {
      return res.status(413).json({
        error: 'file-too-large',
        message: `File exceeds ${maxSizeMb}MB limit`,
      });
    }

    const document = await documentsService.upload(
      req.familyId!,
      userId,
      userName,
      title,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      childId
    );

    return res.status(201).json(document);
  }

  /**
   * DELETE /api/documents/:familyId/:documentId
   * Delete document
   */
  async delete(req: FamilyRequest, res: Response) {
    const { documentId } = req.params;

    try {
      await documentsService.delete(documentId, req.familyId!);
      return res.json({ success: true });
    } catch (error) {
      if ((error as Error).message === 'document-not-found') {
        return res.status(404).json({
          error: 'not-found',
          message: 'Document not found',
        });
      }
      throw error;
    }
  }
}

export const documentsController = new DocumentsController();
export default documentsController;
