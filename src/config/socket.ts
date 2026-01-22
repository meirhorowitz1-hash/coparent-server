import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyIdToken } from './firebase.js';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
  familyIds?: Set<string>;
}

let io: Server | null = null;

// ==================== Event Types ====================

export const SocketEvents = {
  // Chat events
  CHAT_MESSAGE_NEW: 'chat:message:new',
  CHAT_MESSAGE_UPDATED: 'chat:message:updated',
  CHAT_MESSAGE_DELETED: 'chat:message:deleted',
  CHAT_TYPING: 'chat:typing',
  
  // Calendar events
  CALENDAR_EVENT_NEW: 'calendar:event:new',
  CALENDAR_EVENT_UPDATED: 'calendar:event:updated',
  CALENDAR_EVENT_DELETED: 'calendar:event:deleted',
  
  // Expense events
  EXPENSE_NEW: 'expense:new',
  EXPENSE_UPDATED: 'expense:updated',
  EXPENSE_DELETED: 'expense:deleted',
  
  // Task events
  TASK_NEW: 'task:new',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',
  
  // Swap request events
  SWAP_REQUEST_NEW: 'swap:request:new',
  SWAP_REQUEST_UPDATED: 'swap:request:updated',
  
  // Family events
  FAMILY_UPDATED: 'family:updated',
  FAMILY_MEMBER_JOINED: 'family:member:joined',
  FAMILY_MEMBER_LEFT: 'family:member:left',

  // Payment receipt events
  PAYMENT_RECEIPT_NEW: 'payment-receipt:new',
  PAYMENT_RECEIPT_UPDATED: 'payment-receipt:updated',
  PAYMENT_RECEIPT_DELETED: 'payment-receipt:deleted',

  // Document events
  DOCUMENT_NEW: 'document:new',
  DOCUMENT_DELETED: 'document:deleted',

  // Goal events
  GOAL_PROGRESS_UPDATED: 'goal-progress:updated',
  GOAL_TABLE_CREATED: 'goal-table:created',
  GOAL_TABLE_UPDATED: 'goal-table:updated',
  GOAL_TABLE_DELETED: 'goal-table:deleted',

  // Custody events
  CUSTODY_UPDATED: 'custody:updated',
  CUSTODY_DELETED: 'custody:deleted',
  CUSTODY_OVERRIDE_CREATED: 'custody-override:created',
  CUSTODY_OVERRIDE_UPDATED: 'custody-override:updated',
  CUSTODY_OVERRIDE_DELETED: 'custody-override:deleted',
  CUSTODY_OVERRIDE_DELETED_ALL: 'custody-override:deleted-all',

  // Contact events
  CONTACT_NEW: 'contact:new',
  CONTACT_UPDATED: 'contact:updated',
  CONTACT_DELETED: 'contact:deleted',

  // Monthly summary events
  MONTHLY_SUMMARY_UPDATED: 'monthly-summary:updated',
} as const;

/**
 * Initialize Socket.io server
 */
export function initializeSocket(httpServer: HttpServer): Server {
  const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8100', 'http://localhost:4200'];
  
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const authSocket = socket as AuthenticatedSocket;
    const token = authSocket.handshake.auth.token as string | undefined;

    if (!token) {
      return next(new Error('missing-token'));
    }

    try {
      const decoded = await verifyIdToken(token);
      authSocket.userId = decoded.uid;
      authSocket.email = decoded.email;
      authSocket.familyIds = new Set();
      next();
    } catch (error) {
      console.error('[Socket] Auth failed:', error);
      next(new Error('invalid-token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    authSocket.familyIds ??= new Set();
    console.log(`[Socket] User connected: ${authSocket.userId}`);

    // Join family room
    socket.on('join:family', (familyId: string) => {
      if (!familyId) return;
      
      socket.join(`family:${familyId}`);
      authSocket.familyIds?.add(familyId);
      console.log(`[Socket] User ${authSocket.userId} joined family ${familyId}`);
    });

    // Leave family room
    socket.on('leave:family', (familyId: string) => {
      if (!familyId) return;
      
      socket.leave(`family:${familyId}`);
      authSocket.familyIds?.delete(familyId);
      console.log(`[Socket] User ${authSocket.userId} left family ${familyId}`);
    });

    // Typing indicator for chat
    socket.on('chat:typing', (data: { familyId: string; isTyping: boolean }) => {
      socket.to(`family:${data.familyId}`).emit(SocketEvents.CHAT_TYPING, {
        userId: authSocket.userId,
        isTyping: data.isTyping,
      });
    });

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User ${authSocket.userId} disconnected: ${reason}`);
    });

    // Error handler
    socket.on('error', (error) => {
      console.error(`[Socket] Error for user ${authSocket.userId}:`, error);
    });
  });

  console.log('[Socket] Server initialized');
  return io;
}

/**
 * Get the Socket.io server instance
 */
export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

/**
 * Emit event to a specific family room
 */
export function emitToFamily(familyId: string, event: string, data: unknown): void {
  if (!io) {
    console.warn('[Socket] Cannot emit - not initialized');
    return;
  }
  const room = `family:${familyId}`;
  const socketsInRoom = io.sockets.adapter.rooms.get(room);
  console.log(`[Socket] Emitting ${event} to ${room} (${socketsInRoom?.size || 0} clients)`);
  io.to(room).emit(event, data);
}

/**
 * Emit event to a specific family room, excluding a user
 */
export function emitToFamilyExceptUser(
  familyId: string,
  excludeUserId: string,
  event: string,
  data: unknown
): void {
  if (!io) {
    console.warn('[Socket] Cannot emit - not initialized');
    return;
  }

  const room = `family:${familyId}`;
  let emittedCount = 0;

  io.sockets.sockets.forEach((socket) => {
    const authSocket = socket as AuthenticatedSocket;
    if (authSocket.userId === excludeUserId) {
      return;
    }
    if (socket.rooms.has(room)) {
      socket.emit(event, data);
      emittedCount += 1;
    }
  });

  console.log(`[Socket] Emitting ${event} to ${room} excluding ${excludeUserId} (${emittedCount} clients)`);
}

/**
 * Emit event to a specific user (all their connections)
 */
export function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io) {
    console.warn('[Socket] Cannot emit - not initialized');
    return;
  }
  
  // Find all sockets for this user and emit
  const sockets = io.sockets.sockets;
  sockets.forEach((socket) => {
    const authSocket = socket as AuthenticatedSocket;
    if (authSocket.userId === userId) {
      socket.emit(event, data);
    }
  });
}

export default { initializeSocket, getIO, emitToFamily, emitToFamilyExceptUser, emitToUser, SocketEvents };
