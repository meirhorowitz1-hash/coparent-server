# CoParent Server

Backend API server for the CoParent application.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Real-time**: Socket.io
- **Authentication**: Firebase Auth (token verification)
- **Push Notifications**: Firebase Cloud Messaging
- **File Storage**: AWS S3 (or compatible)
- **Scheduling**: node-cron

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (or Docker)
- Firebase project with:
  - Authentication enabled
  - Service account credentials
- AWS S3 bucket (optional, for file uploads)

## Quick Start

### 1. Clone and Install

```bash
cd coparent-server
npm install
```

### 2. Start Database (Docker)

```bash
docker-compose up -d postgres
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. Initialize Database

```bash
npm run db:push      # Create tables
npm run db:generate  # Generate Prisma client
```

### 5. Run Development Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run migrate:firestore` | Migrate data from Firestore |

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Users
- `GET /api/users/me` - Get current user
- `POST /api/users/me` - Create/update user
- `PATCH /api/users/me` - Update profile
- `GET /api/users/me/families` - Get user's families
- `PUT /api/users/me/active-family` - Set active family
- `POST /api/users/me/push-token` - Add push token
- `DELETE /api/users/me/push-token` - Remove push token

### Families
- `POST /api/families` - Create family
- `GET /api/families/:familyId` - Get family
- `PATCH /api/families/:familyId` - Update family
- `DELETE /api/families/:familyId` - Delete family
- `POST /api/families/join` - Join by share code
- `POST /api/families/:familyId/invite` - Invite co-parent
- `POST /api/families/accept-invite` - Accept invite
- `POST /api/families/:familyId/leave` - Leave family
- `POST /api/families/:familyId/regenerate-code` - New share code
- `GET /api/families/:familyId/members` - Get members
- `POST /api/families/:familyId/children` - Add child
- `PATCH /api/families/:familyId/children/:childId` - Update child
- `DELETE /api/families/:familyId/children/:childId` - Remove child

### Calendar
- `GET /api/calendar/:familyId/events` - Get events
- `POST /api/calendar/:familyId/events` - Create event
- `PATCH /api/calendar/:familyId/events/:eventId` - Update event
- `DELETE /api/calendar/:familyId/events/:eventId` - Delete event
- `GET /api/calendar/:familyId/custody` - Get custody schedule
- `PUT /api/calendar/:familyId/custody` - Save custody schedule
- `POST /api/calendar/:familyId/custody/approve` - Approve/reject custody
- `POST /api/calendar/:familyId/custody/cancel` - Cancel approval request
- `DELETE /api/calendar/:familyId/custody` - Delete custody schedule

### Expenses
- `GET /api/expenses/:familyId` - Get expenses
- `GET /api/expenses/:familyId/summary` - Get summary
- `GET /api/expenses/:familyId/settings` - Get finance settings
- `PUT /api/expenses/:familyId/settings` - Update settings
- `POST /api/expenses/:familyId` - Create expense
- `PATCH /api/expenses/:familyId/:expenseId` - Update expense
- `PATCH /api/expenses/:familyId/:expenseId/status` - Update status
- `PATCH /api/expenses/:familyId/:expenseId/paid` - Toggle paid
- `DELETE /api/expenses/:familyId/:expenseId` - Delete expense

### Tasks
- `GET /api/tasks/:familyId` - Get tasks
- `GET /api/tasks/:familyId/stats` - Get statistics
- `POST /api/tasks/:familyId` - Create task
- `PATCH /api/tasks/:familyId/:taskId` - Update task
- `PATCH /api/tasks/:familyId/:taskId/status` - Update status
- `DELETE /api/tasks/:familyId/:taskId` - Delete task

### Documents
- `GET /api/documents/:familyId` - Get documents
- `POST /api/documents/:familyId` - Upload document
- `DELETE /api/documents/:familyId/:documentId` - Delete document

### Swap Requests
- `GET /api/swap-requests/:familyId` - Get requests
- `POST /api/swap-requests/:familyId` - Create request
- `PATCH /api/swap-requests/:familyId/:requestId/status` - Update status

### Chat
- `GET /api/chat/:familyId/messages` - Get messages
- `POST /api/chat/:familyId/messages` - Send message

## Socket.io Events

### Client → Server
- `join:family` - Join family room
- `leave:family` - Leave family room
- `chat:typing` - Typing indicator

### Server → Client
- `chat:message` - New message
- `expense:created` / `expense:updated` / `expense:deleted`
- `task:created` / `task:updated` / `task:deleted`
- `event:created` / `event:updated` / `event:deleted`
- `swap:created` / `swap:updated`
- `custody:updated` / `custody:deleted`
- `document:created` / `document:deleted`

## Migrating from Firestore

1. Ensure your PostgreSQL database is running
2. Set up Firebase credentials in `.env`
3. Run the migration:

```bash
npm run migrate:firestore
```

The script will:
- Migrate all users and their push tokens
- Migrate families with members, children, and invites
- Migrate all subcollections (expenses, tasks, events, etc.)
- Migrate settings (custody schedule, finance settings)
- Report any errors encountered

## Deployment

### Railway

1. Connect your repository to Railway
2. Add PostgreSQL database
3. Set environment variables
4. Set build command: `npm install && npm run build`
5. Set start command: `npm run railway:start`
6. Deploy

### Render

1. Create a new Web Service
2. Connect your repository
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add PostgreSQL database
6. Set environment variables

## License

MIT
# coparent-server
# coparent-server
# coparent-server
