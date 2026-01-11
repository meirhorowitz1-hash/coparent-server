import prisma from '../../config/database.js';
import { emitToFamily, SocketEvents } from '../../config/socket.js';
import { sendPushToFamilyMembers } from '../../utils/push.js';
import { SendAnyMessageInput, EditMessageInput } from './chat.schema.js';

export class ChatService {
  /**
   * Get messages for a family (with soft-delete filter)
   */
  async getMessages(familyId: string, options?: {
    limit?: number;
    before?: Date;
  }) {
    const messages = await prisma.chatMessage.findMany({
      where: {
        familyId,
        ...(options?.before && { sentAt: { lt: options.before } }),
      },
      orderBy: { sentAt: 'asc' },
      take: options?.limit || 50,
    });

    // Return messages with deleted content cleared
    return messages.map(msg => this.sanitizeMessage(msg));
  }

  /**
   * Send a message (text, image, or both)
   */
  async sendMessage(
    familyId: string,
    userId: string,
    userName: string,
    data: SendAnyMessageInput
  ) {
    const message = await prisma.chatMessage.create({
      data: {
        familyId,
        senderId: userId,
        senderName: userName,
        text: data.text?.trim() || null,
        imageData: data.imageData || null,
        imageWidth: data.imageWidth || null,
        imageHeight: data.imageHeight || null,
      },
    });

    const sanitized = this.sanitizeMessage(message);

    // Emit socket event for real-time
    emitToFamily(familyId, SocketEvents.CHAT_MESSAGE_NEW, sanitized);

    // Send push notification
    const pushBody = data.imageData 
      ? (data.text ? `📷 ${data.text.slice(0, 100)}` : '📷 שלח/ה תמונה')
      : (data.text?.slice(0, 120) || 'הודעה חדשה');

    await sendPushToFamilyMembers(
      familyId,
      userId,
      {
        title: userName || 'הודעה חדשה',
        body: pushBody,
      },
      {
        type: 'chat',
        familyId,
        messageId: message.id,
        senderId: userId,
        senderName: userName || '',
      }
    );

    return sanitized;
  }

  /**
   * Edit a message (only text, only by sender, only non-deleted)
   */
  async editMessage(
    messageId: string,
    userId: string,
    familyId: string,
    data: EditMessageInput
  ) {
    // First verify ownership and state
    const existing = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!existing) {
      throw new Error('message-not-found');
    }

    if (existing.senderId !== userId) {
      throw new Error('not-message-owner');
    }

    if (existing.familyId !== familyId) {
      throw new Error('message-not-in-family');
    }

    if (existing.deleted) {
      throw new Error('message-deleted');
    }

    if (existing.imageData && !existing.text) {
      throw new Error('cannot-edit-image-only-message');
    }

    const message = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        text: data.text.trim(),
        edited: true,
        editedAt: new Date(),
      },
    });

    const sanitized = this.sanitizeMessage(message);

    // Emit socket event
    emitToFamily(familyId, SocketEvents.CHAT_MESSAGE_UPDATED, sanitized);

    return sanitized;
  }

  /**
   * Delete a message (soft delete, only by sender)
   */
  async deleteMessage(
    messageId: string,
    userId: string,
    familyId: string
  ) {
    // First verify ownership
    const existing = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!existing) {
      throw new Error('message-not-found');
    }

    if (existing.senderId !== userId) {
      throw new Error('not-message-owner');
    }

    if (existing.familyId !== familyId) {
      throw new Error('message-not-in-family');
    }

    if (existing.deleted) {
      // Already deleted
      return this.sanitizeMessage(existing);
    }

    const message = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        deleted: true,
        deletedAt: new Date(),
        // Clear content for privacy
        text: null,
        imageData: null,
        imageWidth: null,
        imageHeight: null,
      },
    });

    const sanitized = this.sanitizeMessage(message);

    // Emit socket event
    emitToFamily(familyId, SocketEvents.CHAT_MESSAGE_DELETED, {
      id: messageId,
      deleted: true,
      deletedAt: message.deletedAt,
    });

    return sanitized;
  }

  /**
   * Get a single message by ID
   */
  async getMessageById(messageId: string) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    return message ? this.sanitizeMessage(message) : null;
  }

  /**
   * Get unread messages count (since last visit)
   */
  async getUnreadCount(familyId: string, userId: string, lastSeen: Date) {
    return prisma.chatMessage.count({
      where: {
        familyId,
        senderId: { not: userId },
        deleted: false,
        sentAt: { gt: lastSeen },
      },
    });
  }

  /**
   * Sanitize message for client (hide content if deleted)
   */
  private sanitizeMessage(message: any) {
    if (message.deleted) {
      return {
        id: message.id,
        familyId: message.familyId,
        senderId: message.senderId,
        senderName: message.senderName,
        text: null,
        imageData: null,
        imageWidth: null,
        imageHeight: null,
        edited: message.edited,
        editedAt: message.editedAt,
        deleted: true,
        deletedAt: message.deletedAt,
        sentAt: message.sentAt,
      };
    }

    return {
      id: message.id,
      familyId: message.familyId,
      senderId: message.senderId,
      senderName: message.senderName,
      text: message.text,
      imageData: message.imageData,
      imageWidth: message.imageWidth,
      imageHeight: message.imageHeight,
      edited: message.edited,
      editedAt: message.editedAt,
      deleted: false,
      deletedAt: null,
      sentAt: message.sentAt,
    };
  }
}

export const chatService = new ChatService();
export default chatService;
