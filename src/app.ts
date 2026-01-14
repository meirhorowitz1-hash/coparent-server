import 'dotenv/config';
import 'express-async-errors';

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { initializeSocket } from './config/socket.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js';

// Import routes
import usersRoutes from './modules/users/users.routes.js';
import familiesRoutes from './modules/families/families.routes.js';
import calendarRoutes from './modules/calendar/calendar.routes.js';
import expensesRoutes from './modules/expenses/expenses.routes.js';
import tasksRoutes from './modules/tasks/tasks.routes.js';
import documentsRoutes from './modules/documents/documents.routes.js';
import swapRequestsRoutes from './modules/swap-requests/swap-requests.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';

// Import jobs
import './jobs/reminder.job.js';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = initializeSocket(httpServer);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isDevOrigin = isLocalhost || origin.startsWith('capacitor://') || origin.startsWith('ionic://');

    // In development, allow all localhost/capacitor/ionic origins
    if (process.env.NODE_ENV === 'development' && isDevOrigin) {
      return callback(null, true);
    }

    // Allow localhost in other environments when explicitly enabled
    if (process.env.CORS_ALLOW_LOCALHOST === 'true' && isLocalhost) {
      return callback(null, true);
    }

    // In production, check against allowed origins
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));

// Additional CORS headers (fallback)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Health check
app.get('/health', (_, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API routes (all require authentication)
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/families', authMiddleware, familiesRoutes);
app.use('/api/calendar', authMiddleware, calendarRoutes);
app.use('/api/expenses', authMiddleware, expensesRoutes);
app.use('/api/tasks', authMiddleware, tasksRoutes);
app.use('/api/documents', authMiddleware, documentsRoutes);
app.use('/api/swap-requests', authMiddleware, swapRequestsRoutes);
app.use('/api/notifications', notificationsRoutes); // Auth handled inside routes
app.use('/api/settings', settingsRoutes); // Auth handled inside routes
// Chat routes are now nested under /api/families/:familyId/chat

// Admin routes (authentication handled in routes)
app.use('/api/admin', adminRoutes);

// Error handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);

httpServer.listen(PORT, () => {
  console.log(`
🚀 CoParent Server is running!
   
   Environment: ${process.env.NODE_ENV || 'development'}
   Port: ${PORT}
   Health: http://localhost:${PORT}/health
   
   API Endpoints:
   - Users:              /api/users
   - Families:           /api/families
   - Calendar:           /api/calendar
   - Expenses:           /api/expenses
   - Tasks:              /api/tasks
   - Documents:          /api/documents
   - Swap Requests:      /api/swap-requests
   - Notifications:      /api/notifications
   - Settings:           /api/settings
   - Goals:              /api/families/:familyId/goals
   - Chat:               /api/families/:familyId/chat
   - Payment Receipts:   /api/families/:familyId/payment-receipts
   - Monthly Summaries:  /api/families/:familyId/monthly-summaries
   - Custody Overrides:  /api/calendar/:familyId/custody-overrides
   - Admin:              /api/admin
  `);
});

export { app, httpServer, io };
