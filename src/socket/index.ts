import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyIdToken } from '../config/firebase.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  familyRooms?: Set<string>;
}

let io: Server | null = null;

/**
 * Initialize Socket.io server
 */
export function initializeSocket(httpServer: HttpServer, corsOrigins: string[]): Server {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const authSocket = socket as AuthenticatedSocket;
      const token = authSocket.handshake.auth.token || authSocket.handshake.headers.authorization?.split('Bearer ')[1];
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decodedToken = await verifyIdToken(token);
      authSocket.userId = decodedToken.uid;
      authSocket.userEmail = decodedToken.email;
      authSocket.familyRooms = new Set();
      
      next();
    } catch (error) {
      console.error('[Socket] Auth error:', error);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    authSocket.familyRooms ??= new Set();
    console.log(`[Socket] User connected: ${authSocket.userId}`);

    // Join family room
    socket.on('join:family', (familyId: string) => {
      if (!familyId) return;
      
      const room = `family:${familyId}`;
      socket.join(room);
      authSocket.familyRooms?.add(room);
      console.log(`[Socket] User ${authSocket.userId} joined ${room}`);
    });

    // Leave family room
    socket.on('leave:family', (familyId: string) => {
      if (!familyId) return;
      
      const room = `family:${familyId}`;
      socket.leave(room);
      authSocket.familyRooms?.delete(room);
      console.log(`[Socket] User ${authSocket.userId} left ${room}`);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User ${authSocket.userId} disconnected: ${reason}`);
    });

    // Typing indicators
    socket.on('chat:typing', (data: { familyId: string; isTyping: boolean }) => {
      const room = `family:${data.familyId}`;
      socket.to(room).emit('chat:typing', {
        userId: authSocket.userId,
        isTyping: data.isTyping,
      });
    });
  });

  console.log('[Socket] Socket.io initialized');
  return io;
}

/**
 * Get Socket.io instance
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Emit event to a family room
 */
export function emitToFamily(familyId: string, event: string, data: any): void {
  if (!io) {
    console.warn('[Socket] Socket.io not initialized');
    return;
  }
  
  const room = `family:${familyId}`;
  io.to(room).emit(event, data);
}

/**
 * Emit event to a specific user
 */
export function emitToUser(userId: string, event: string, data: any): void {
  if (!io) {
    console.warn('[Socket] Socket.io not initialized');
    return;
  }
  
  const room = `user:${userId}`;
  io.to(room).emit(event, data);
}

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
} as const;

export default { initializeSocket, getIO, emitToFamily, emitToUser, SocketEvents };
