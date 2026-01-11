import { Response } from 'express';
import { FamilyRequest } from '../../middleware/family.middleware.js';
import { chatService } from './chat.service.js';
import { 
  sendAnyMessageSchema, 
  editMessageSchema,
  listMessagesQuerySchema 
} from './chat.schema.js';

export class ChatController {
  /**
   * GET /api/families/:familyId/chat/messages
   * Get messages with pagination
   */
  async getMessages(req: FamilyRequest, res: Response) {
    const query = listMessagesQuerySchema.parse(req.query);

    const messages = await chatService.getMessages(req.familyId!, {
      limit: query.limit,
      before: query.before ? new Date(query.before) : undefined,
    });

    res.json(messages);
  }

  /**
   * POST /api/families/:familyId/chat/messages
   * Send message (text, image, or both)
   */
  async sendMessage(req: FamilyRequest, res: Response) {
    const userId = req.user!.uid;
    const userName = req.body.senderName || req.user!.name || 'הורה';
    
    const data = sendAnyMessageSchema.parse(req.body);

    const message = await chatService.sendMessage(
      req.familyId!,
      userId,
      userName,
      data
    );

    res.status(201).json(message);
  }

  /**
   * PUT /api/families/:familyId/chat/messages/:messageId
   * Edit a message
   */
  async editMessage(req: FamilyRequest, res: Response) {
    const { messageId } = req.params;
    const userId = req.user!.uid;
    
    const data = editMessageSchema.parse(req.body);

    const message = await chatService.editMessage(
      messageId,
      userId,
      req.familyId!,
      data
    );

    res.json(message);
  }

  /**
   * DELETE /api/families/:familyId/chat/messages/:messageId
   * Delete a message (soft delete)
   */
  async deleteMessage(req: FamilyRequest, res: Response) {
    const { messageId } = req.params;
    const userId = req.user!.uid;

    const message = await chatService.deleteMessage(
      messageId,
      userId,
      req.familyId!
    );

    res.json(message);
  }

  /**
   * GET /api/families/:familyId/chat/messages/:messageId
   * Get a single message
   */
  async getMessage(req: FamilyRequest, res: Response) {
    const { messageId } = req.params;

    const message = await chatService.getMessageById(messageId);

    if (!message) {
      res.status(404).json({ error: 'message-not-found' });
      return;
    }

    if (message.familyId !== req.familyId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    res.json(message);
  }
}

export const chatController = new ChatController();
export default chatController;
