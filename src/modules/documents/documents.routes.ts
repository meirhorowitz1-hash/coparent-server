import { Router } from 'express';
import multer from 'multer';
import { documentsController } from './documents.controller.js';
import { familyMemberMiddleware } from '../../middleware/family.middleware.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_, file, cb) => {
    // Allow common document and image types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// All routes require family membership
router.use('/:familyId', familyMemberMiddleware);

// Documents routes
router.get('/:familyId', (req, res) => documentsController.getAll(req, res));
router.get('/:familyId/:documentId', (req, res) => documentsController.getById(req, res));
router.post('/:familyId', upload.single('file'), (req, res) => documentsController.upload(req, res));
router.delete('/:familyId/:documentId', (req, res) => documentsController.delete(req, res));

export default router;
