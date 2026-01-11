# CoParent Server - Hybrid Architecture (PostgreSQL + Firebase)

## מודולים שנוספו

### ✅ 1. Notifications Module
**Path:** `src/modules/notifications/`

**תכונות:**
- יצירה ושליחת התראות (push + in-app)
- ניהול העדפות התראות למשתמש
- סינון לפי משפחה וסטטוס קריאה
- Quiet Hours (שעות שקט)
- תמיכה היברידית PostgreSQL/Firebase

**API Endpoints:**
```
GET    /api/notifications                 - קבלת התראות
GET    /api/notifications/unread-count    - ספירת התראות שלא נקראו
GET    /api/notifications/preferences     - קבלת העדפות
PUT    /api/notifications/preferences     - עדכון העדפות
PUT    /api/notifications/read            - סימון כנקרא
PUT    /api/notifications/read-all        - סימון הכל כנקרא
POST   /api/notifications                 - יצירת התראה (פנימי)
DELETE /api/notifications/:id             - מחיקת התראה
DELETE /api/notifications                 - מחיקת כל ההתראות
```

**סוגי התראות נתמכים:**
- expense_created, expense_approved, expense_rejected, expense_paid
- swap_request_created, swap_request_approved, swap_request_rejected
- task_assigned, task_completed
- calendar_event_created, calendar_event_updated, calendar_event_reminder
- document_shared
- chat_message
- family_invite
- system_announcement

---

### ✅ 2. Settings Module
**Path:** `src/modules/settings/`

**תכונות:**
- **User Settings:** שפה, אזור זמן, פורמטים, ערכת נושא
- **Family Settings:** מטבע, חלוקת הוצאות, אישורים, תזכורות
- **Privacy Settings:** נראות פרופיל, חסימת משתמשים, הגדרות שיתוף
- **Finance Settings:** קטגוריות ברירת מחדל, תזכורות תשלום

**API Endpoints:**
```
# User Settings
GET    /api/settings/user
PUT    /api/settings/user
GET    /api/settings/all

# Family Settings
GET    /api/settings/family/:familyId
PUT    /api/settings/family/:familyId
GET    /api/settings/family/:familyId/all

# Privacy Settings
GET    /api/settings/privacy
PUT    /api/settings/privacy

# Finance Settings
GET    /api/settings/finance/:familyId
PUT    /api/settings/finance/:familyId
```

**User Settings שדות:**
- language: 'en' | 'he' | 'es' | 'fr' | 'de'
- timezone: string (e.g., 'Asia/Jerusalem')
- dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
- timeFormat: '12h' | '24h'
- weekStart: 'sunday' | 'monday'
- theme: 'light' | 'dark' | 'auto'

**Family Settings שדות:**
- defaultCurrency: 'USD' | 'EUR' | 'GBP' | 'ILS' | 'CAD'
- expenseSplitDefault: 'equal' | 'percentage' | 'custom'
- parent1Percentage / parent2Percentage: number (0-100)
- requireApprovalForExpenses: boolean
- expenseApprovalThreshold: number | null
- allowSwapRequests: boolean
- requireApprovalForSwaps: boolean

---

## שירותים שנוספו

### ✅ 3. Email Service
**Path:** `src/services/email.service.ts`

**תכונות:**
- תמיכה ב-SMTP (Nodemailer) וב-Firebase
- תבניות מיילים מעוצבות
- שליחת מיילים אוטומטיים

**פונקציות זמינות:**
```typescript
emailService.sendWelcomeEmail(to, userName)
emailService.sendFamilyInviteEmail(to, inviterName, familyName)
emailService.sendPasswordResetEmail(to, resetLink)
emailService.sendExpenseNotificationEmail(to, title, amount, actionUrl)
emailService.sendSwapRequestEmail(to, requesterName, details, actionUrl)
emailService.sendPaymentReminderEmail(to, amount, dueDate, actionUrl)
```

**הגדרות סביבה נדרשות:**
```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Email Display
EMAIL_FROM=noreply@coparent.app
EMAIL_FROM_NAME=CoParent
```

---

### ✅ 4. Storage Service (Hybrid)
**Path:** `src/services/storage.service.ts`

**תכונות:**
- תמיכה אוטומטית ב-S3 או Firebase Storage
- פונקציות ייעודיות להעלאת תמונות, מסמכים, קבלות
- ולידציה של גודל וסוג קובץ
- יצירת מפתחות ייחודיים

**פונקציות עיקריות:**
```typescript
// Upload
storageService.uploadFile(buffer, folder, fileName, contentType, metadata?)
storageService.uploadProfilePhoto(buffer, userId, contentType)
storageService.uploadDocument(buffer, familyId, fileName, contentType)
storageService.uploadReceipt(buffer, familyId, expenseId, fileName, contentType)
storageService.uploadChildPhoto(buffer, familyId, childId, contentType)
storageService.uploadFamilyPhoto(buffer, familyId, contentType)

// Delete
storageService.deleteFile(key)
storageService.deleteProfilePhoto(userId)

// Get URL
storageService.getDownloadUrl(key, expiresIn?)

// Validation
storageService.validateFileSize(buffer, maxSizeMB)
storageService.validateFileType(contentType, allowedTypes)
```

---

## מבנה Prisma Schema הנדרש

כדי שהמודולים יעבדו, צריך להוסיף ל-Prisma Schema:

```prisma
// Notifications
model Notification {
  id        String   @id @default(uuid())
  userId    String
  familyId  String?
  type      String
  title     String
  body      String
  priority  String   @default("normal")
  data      Json?
  actionUrl String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  family Family? @relation(fields: [familyId], references: [id], onDelete: Cascade)
  
  @@index([userId, read])
  @@index([familyId])
}

model NotificationPreferences {
  id                         String  @id @default(uuid())
  userId                     String  @unique
  expenseNotifications       Boolean @default(true)
  swapRequestNotifications   Boolean @default(true)
  taskNotifications          Boolean @default(true)
  calendarNotifications      Boolean @default(true)
  chatNotifications          Boolean @default(true)
  emailNotifications         Boolean @default(true)
  pushNotifications          Boolean @default(true)
  quietHoursEnabled          Boolean @default(false)
  quietHoursStart            String? // HH:mm
  quietHoursEnd              String?
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Settings
model UserSettings {
  id         String  @id @default(uuid())
  userId     String  @unique
  language   String  @default("en")
  timezone   String  @default("UTC")
  dateFormat String  @default("MM/DD/YYYY")
  timeFormat String  @default("12h")
  weekStart  String  @default("sunday")
  theme      String  @default("auto")
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model FamilySettings {
  id                        String   @id @default(uuid())
  familyId                  String   @unique
  defaultCurrency           String   @default("USD")
  expenseSplitDefault       String   @default("equal")
  parent1Percentage         Int      @default(50)
  parent2Percentage         Int      @default(50)
  requireApprovalForExpenses Boolean @default(true)
  expenseApprovalThreshold  Float?
  allowSwapRequests         Boolean  @default(true)
  requireApprovalForSwaps   Boolean  @default(true)
  reminderDefaultTime       String   @default("09:00")
  enableCalendarReminders   Boolean  @default(true)
  calendarReminderMinutes   Int      @default(30)
  
  family Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
}

model PrivacySettings {
  id                        String   @id @default(uuid())
  userId                    String   @unique
  profileVisibility         String   @default("family")
  shareCalendarWithCoParent Boolean  @default(true)
  shareExpensesWithCoParent Boolean  @default(true)
  shareDocumentsWithCoParent Boolean @default(true)
  allowCoParentMessaging    Boolean  @default(true)
  blockedUserIds            String[] @default([])
  
  user         User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  blockedUsers User[] @relation("BlockedUsers", fields: [blockedUserIds], references: [id])
}

model FinanceSettings {
  id                      String  @id @default(uuid())
  familyId                String  @unique
  defaultExpenseCategory  String?
  enableReceiptScanning   Boolean @default(true)
  autoCalculateSplit      Boolean @default(true)
  trackPaymentStatus      Boolean @default(true)
  sendPaymentReminders    Boolean @default(true)
  paymentReminderDays     Int     @default(7)
  
  family Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
}
```

---

## הוראות התקנה

### 1. התקן תלויות

```bash
npm install nodemailer
npm install @types/nodemailer --save-dev
```

### 2. הגדר משתני סביבה

הוסף ל-`.env`:
```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@coparent.app
EMAIL_FROM_NAME=CoParent

# Storage (S3 or Firebase)
USE_FIREBASE_STORAGE=false  # true לשימוש ב-Firebase

# AWS S3 (if not using Firebase)
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=coparent-files
CDN_URL=https://cdn.yourapp.com  # Optional
```

### 3. הרץ Prisma Migrations

```bash
npx prisma migrate dev --name add_notifications_and_settings
```

### 4. אפשר במודולים אחרים

**דוגמה: שליחת התראה בעת יצירת הוצאה**

```typescript
// In expenses.service.ts
import notificationsService from '../notifications/notifications.service.js';

// After creating expense
await notificationsService.createNotification({
  userId: coParentId,
  familyId: expense.familyId,
  type: 'expense_created',
  title: 'New Expense Added',
  body: `${creatorName} added expense: ${expense.title}`,
  priority: 'normal',
  data: { expenseId: expense.id },
  actionUrl: `/expenses/${expense.id}`,
  sendPush: true,
});
```

---

## מעבר בין PostgreSQL ל-Firebase

**להחלפה ל-Firebase:**

```typescript
// במקום
import { notificationsService } from './notifications.service.js';

// השתמש ב
import { notificationsServiceFirebase as notificationsService } from './notifications.service.js';
```

או קבע משתנה סביבה:
```env
USE_FIREBASE=true
```

והשתמש ב-factory pattern:
```typescript
const notificationsService = process.env.USE_FIREBASE === 'true' 
  ? notificationsServiceFirebase 
  : notificationsService;
```

---

## מה עדיין חסר?

### Priority 2 (לעתיד):
1. **Custody Schedule Module** - לוחות משמורת מותאמים אישית
2. **Analytics Service** - מעקב אחר שימוש ומטריקות
3. **Caching Layer** - Redis/In-memory cache
4. **Background Jobs** - עוד jobs למשימות מתוזמנות

### שיפורים נוספים:
- השלמת Firebase implementations (כרגע רק placeholder)
- Rate limiting middleware
- Input sanitization middleware
- API documentation (Swagger/OpenAPI)

---

## שאלות?

אם יש לך שאלות או שאתה צריך עזרה בהטמעה, תגיד לי!
