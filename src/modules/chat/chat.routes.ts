import { Router } from 'express';
import { chatController } from './chat.controller.js';

const router = Router({ mergeParams: true }); // mergeParams to access :familyId from parent router

// Chat routes (familyMemberMiddleware already applied in parent router)
router.get('/messages', (req, res) => chatController.getMessages(req as any, res));
router.post('/messages', (req, res) => chatController.sendMessage(req as any, res));
router.get('/messages/:messageId', (req, res) => chatController.getMessage(req as any, res));
router.put('/messages/:messageId', (req, res) => chatController.editMessage(req as any, res));
router.delete('/messages/:messageId', (req, res) => chatController.deleteMessage(req as any, res));

export default router;
