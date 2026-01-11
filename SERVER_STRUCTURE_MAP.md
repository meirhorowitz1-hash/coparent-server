# CoParent Server - מפת מבנה מלאה

```
coparent-server/
│
├── src/
│   ├── app.ts                          # Main Express app
│   │
│   ├── config/
│   │   ├── database.ts                 # Prisma client
│   │   ├── firebase.ts                 # Firebase Admin SDK
│   │   ├── s3.ts                       # AWS S3 client
│   │   └── socket.ts                   # Socket.io configuration
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts          # Firebase Auth verification
│   │   ├── error.middleware.ts         # Error handling
│   │   └── family.middleware.ts        # Family membership check
│   │
│   ├── modules/
│   │   │
│   │   ├── users/                      # ✅ קיים
│   │   │   ├── users.schema.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.controller.ts
│   │   │   └── users.routes.ts
│   │   │
│   │   ├── families/                   # ✅ קיים (כולל children)
│   │   │   ├── families.schema.ts      # כולל addChild, updateChild
│   │   │   ├── families.service.ts     # ניהול משפחות + ילדים
│   │   │   ├── families.controller.ts
│   │   │   └── families.routes.ts
│   │   │
│   │   ├── calendar/                   # ✅ קיים
│   │   │   ├── calendar.schema.ts
│   │   │   ├── calendar.service.ts
│   │   │   ├── calendar.controller.ts
│   │   │   └── calendar.routes.ts
│   │   │
│   │   ├── expenses/                   # ✅ קיים
│   │   │   ├── expenses.schema.ts
│   │   │   ├── expenses.service.ts
│   │   │   ├── expenses.controller.ts
│   │   │   └── expenses.routes.ts
│   │   │
│   │   ├── tasks/                      # ✅ קיים
│   │   │   ├── tasks.schema.ts
│   │   │   ├── tasks.service.ts
│   │   │   ├── tasks.controller.ts
│   │   │   └── tasks.routes.ts
│   │   │
│   │   ├── documents/                  # ✅ קיים
│   │   │   ├── documents.schema.ts
│   │   │   ├── documents.service.ts
│   │   │   ├── documents.controller.ts
│   │   │   └── documents.routes.ts
│   │   │
│   │   ├── chat/                       # ✅ קיים
│   │   │   ├── chat.schema.ts
│   │   │   ├── chat.service.ts
│   │   │   ├── chat.controller.ts
│   │   │   └── chat.routes.ts
│   │   │
│   │   ├── swap-requests/              # ✅ קיים
│   │   │   ├── swap-requests.schema.ts
│   │   │   ├── swap-requests.service.ts
│   │   │   ├── swap-requests.controller.ts
│   │   │   └── swap-requests.routes.ts
│   │   │
│   │   ├── payment-receipts/           # ✅ קיים
│   │   │   ├── payment-receipts.schema.ts
│   │   │   ├── payment-receipts.service.ts
│   │   │   ├── payment-receipts.controller.ts
│   │   │   └── payment-receipts.routes.ts
│   │   │
│   │   ├── notifications/              # ✅ חדש! (היברידי)
│   │   │   ├── notifications.schema.ts
│   │   │   ├── notifications.service.ts
│   │   │   ├── notifications.controller.ts
│   │   │   └── notifications.routes.ts
│   │   │
│   │   └── settings/                   # ✅ חדש! (היברידי)
│   │       ├── settings.schema.ts
│   │       ├── settings.service.ts
│   │       ├── settings.controller.ts
│   │       └── settings.routes.ts
│   │
│   ├── services/                       # ✅ חדש!
│   │   ├── email.service.ts            # שליחת מיילים (SMTP/Firebase)
│   │   └── storage.service.ts          # העלאת קבצים (S3/Firebase Storage)
│   │
│   ├── jobs/
│   │   └── reminder.job.ts             # תזכורות מתוזמנות
│   │
│   ├── socket/
│   │   └── index.ts                    # Real-time events (chat, updates)
│   │
│   └── utils/
│       ├── helpers.ts                  # Helper functions
│       └── push.ts                     # Push notifications (FCM)
│
├── prisma/
│   └── schema.prisma                   # Database schema
│
├── .env                                # Environment variables
├── package.json
└── tsconfig.json
```

---

## סיכום סטטוס מודולים

### ✅ מודולים קיימים (9)
1. **Users** - ניהול משתמשים
2. **Families** - ניהול משפחות + ילדים
3. **Calendar** - אירועי לוח שנה
4. **Expenses** - הוצאות ותשלומים
5. **Tasks** - משימות
6. **Documents** - מסמכים
7. **Chat** - צ'אט real-time
8. **Swap Requests** - בקשות החלפת משמורת
9. **Payment Receipts** - קבלות תשלום

### ✅ מודולים חדשים (2)
10. **Notifications** - מערכת התראות מלאה (היברידי)
11. **Settings** - הגדרות משתמש/משפחה (היברידי)

### ✅ שירותים חדשים (2)
1. **Email Service** - שליחת מיילים אוטומטיים
2. **Storage Service** - ניהול קבצים היברידי (S3/Firebase)

---

## API Endpoints - רשימה מלאה

### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
```

### Users
```
GET    /api/users/me
PUT    /api/users/me
POST   /api/users/push-token
DELETE /api/users/push-token
```

### Families
```
POST   /api/families
GET    /api/families/:id
PUT    /api/families/:id
DELETE /api/families/:id
POST   /api/families/:id/regenerate-code
POST   /api/families/:id/invite
POST   /api/families/join-by-code
POST   /api/families/:id/leave
GET    /api/families/:id/members

# Children
POST   /api/families/:id/children
PUT    /api/families/:id/children/:childId
DELETE /api/families/:id/children/:childId
```

### Calendar
```
GET    /api/calendar/:familyId
POST   /api/calendar/:familyId
PUT    /api/calendar/:familyId/:eventId
DELETE /api/calendar/:familyId/:eventId
```

### Expenses
```
GET    /api/expenses/:familyId
POST   /api/expenses/:familyId
PUT    /api/expenses/:familyId/:expenseId
DELETE /api/expenses/:familyId/:expenseId
POST   /api/expenses/:familyId/:expenseId/approve
POST   /api/expenses/:familyId/:expenseId/reject
POST   /api/expenses/:familyId/:expenseId/pay
```

### Tasks
```
GET    /api/tasks/:familyId
POST   /api/tasks/:familyId
PUT    /api/tasks/:familyId/:taskId
DELETE /api/tasks/:familyId/:taskId
POST   /api/tasks/:familyId/:taskId/complete
```

### Documents
```
GET    /api/documents/:familyId
POST   /api/documents/:familyId
DELETE /api/documents/:familyId/:documentId
GET    /api/documents/:familyId/:documentId/download
```

### Swap Requests
```
GET    /api/swap-requests/:familyId
POST   /api/swap-requests/:familyId
PUT    /api/swap-requests/:familyId/:requestId/approve
PUT    /api/swap-requests/:familyId/:requestId/reject
```

### Chat
```
GET    /api/families/:familyId/chat
POST   /api/families/:familyId/chat
PUT    /api/families/:familyId/chat/:messageId/read
```

### Payment Receipts
```
GET    /api/families/:familyId/payment-receipts
POST   /api/families/:familyId/payment-receipts
DELETE /api/families/:familyId/payment-receipts/:receiptId
```

### Notifications ✅ חדש!
```
GET    /api/notifications
GET    /api/notifications/unread-count
GET    /api/notifications/preferences
PUT    /api/notifications/preferences
PUT    /api/notifications/read
PUT    /api/notifications/read-all
POST   /api/notifications
DELETE /api/notifications/:id
DELETE /api/notifications
```

### Settings ✅ חדש!
```
# User
GET    /api/settings/user
PUT    /api/settings/user
GET    /api/settings/all

# Family
GET    /api/settings/family/:familyId
PUT    /api/settings/family/:familyId
GET    /api/settings/family/:familyId/all

# Privacy
GET    /api/settings/privacy
PUT    /api/settings/privacy

# Finance
GET    /api/settings/finance/:familyId
PUT    /api/settings/finance/:familyId
```

---

## סה"כ
- **11 מודולים** (9 קיימים + 2 חדשים)
- **2 שירותי תשתית** (email + storage)
- **~80 API endpoints**
- **מוכן לעבודה היברידית** (PostgreSQL + Firebase)

---

## מה נשאר לעשות?

### חובה (Priority 1):
- ✅ Notifications ✓
- ✅ Settings ✓
- ✅ Email Service ✓
- ✅ Storage Service ✓

### רצוי (Priority 2):
- ❌ Custody Schedule Module (לוחות משמורת מתוכננים)
- ❌ Caching Layer (Redis)
- ❌ Analytics Service
- ❌ Rate Limiting Middleware
- ❌ Input Sanitization
- ❌ API Documentation (Swagger)

### אופציונלי (Priority 3):
- ❌ Background Jobs (cleanup, backups, reports)
- ❌ Versioning למסמכים
- ❌ Recurring events בקלנדר
- ❌ Sub-tasks במשימות
- ❌ Categories management להוצאות
