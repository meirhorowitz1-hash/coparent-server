# מדריך מעבר מ-Firebase ל-Node.js Server

## מבוא
מדריך זה מסביר כיצד לעבור בצורה הדרגתית מ-Firebase Firestore ל-PostgreSQL + Node.js, תוך שמירה על תמיכה היברידית בשני המצבים.

---

## שלב 1: הכנה

### 1.1 התקן תלויות נוספות
```bash
npm install nodemailer
npm install @types/nodemailer --save-dev
```

### 1.2 עדכן Prisma Schema
הוסף את המודלים החדשים ל-`prisma/schema.prisma`:

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
  quietHoursStart            String?
  quietHoursEnd              String?
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

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

// עדכן מודל User
model User {
  // ... שדות קיימים
  
  // הוסף:
  notifications            Notification[]
  notificationPreferences  NotificationPreferences?
  userSettings             UserSettings?
  privacySettings          PrivacySettings?
  blockedBy                PrivacySettings[] @relation("BlockedUsers")
}

// עדכן מודל Family
model Family {
  // ... שדות קיימים
  
  // הוסף:
  notifications    Notification[]
  familySettings   FamilySettings?
  financeSettings  FinanceSettings?
}
```

### 1.3 הרץ Migration
```bash
npx prisma migrate dev --name add_notifications_and_settings
npx prisma generate
```

---

## שלב 2: הגדרת משתני סביבה

הוסף ל-`.env`:
```env
# Database Mode
USE_FIREBASE=false           # true לשימוש ב-Firebase, false ל-PostgreSQL

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@coparent.app
EMAIL_FROM_NAME=CoParent

# Storage
USE_FIREBASE_STORAGE=false   # true לשימוש ב-Firebase Storage

# AWS S3 (אם לא משתמש ב-Firebase Storage)
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=coparent-files
CDN_URL=https://cdn.yourapp.com
```

---

## שלב 3: שדרוג הלקוח (Angular/Ionic)

### 3.1 צור Service Wrapper

```typescript
// src/app/services/backend.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BackendService {
  private useNodeServer = environment.useNodeServer;
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private firestore: AngularFirestore
  ) {}

  // Notifications
  getNotifications(familyId?: string, unreadOnly = false) {
    if (this.useNodeServer) {
      return this.http.get(`${this.apiUrl}/notifications`, {
        params: { familyId: familyId || '', unreadOnly: unreadOnly.toString() }
      });
    } else {
      // Firebase Firestore query
      return this.firestore
        .collection('notifications', ref => {
          let query = ref.where('userId', '==', this.getCurrentUserId());
          if (familyId) query = query.where('familyId', '==', familyId);
          if (unreadOnly) query = query.where('read', '==', false);
          return query.orderBy('createdAt', 'desc');
        })
        .valueChanges({ idField: 'id' });
    }
  }

  markNotificationsAsRead(notificationIds: string[]) {
    if (this.useNodeServer) {
      return this.http.put(`${this.apiUrl}/notifications/read`, {
        notificationIds
      });
    } else {
      // Firebase batch update
      const batch = this.firestore.firestore.batch();
      notificationIds.forEach(id => {
        const ref = this.firestore.doc(`notifications/${id}`).ref;
        batch.update(ref, { read: true });
      });
      return batch.commit();
    }
  }

  // Settings
  getUserSettings() {
    if (this.useNodeServer) {
      return this.http.get(`${this.apiUrl}/settings/user`);
    } else {
      return this.firestore
        .doc(`userSettings/${this.getCurrentUserId()}`)
        .valueChanges();
    }
  }

  updateUserSettings(settings: any) {
    if (this.useNodeServer) {
      return this.http.put(`${this.apiUrl}/settings/user`, settings);
    } else {
      return this.firestore
        .doc(`userSettings/${this.getCurrentUserId()}`)
        .set(settings, { merge: true });
    }
  }

  private getCurrentUserId(): string {
    // החזר את ה-userId הנוכחי מ-Auth
    return ''; // TODO: implement
  }
}
```

### 3.2 עדכן Environment

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  useNodeServer: false,  // false = Firebase, true = Node.js
  apiUrl: 'http://localhost:3000/api',
  firebase: {
    // ... Firebase config
  }
};
```

---

## שלב 4: מעבר הדרגתי

### אסטרטגיית המעבר

#### שלב 4.1: מצב היברידי (חודש 1)
- השרת פועל במקביל ל-Firebase
- משתמשים חדשים → Node.js
- משתמשים ישנים → Firebase
- בדיקות מקיפות

```typescript
// בלקוח
const USE_NODE_FOR_NEW_USERS = true;
const USE_NODE_FOR_OLD_USERS = false;

const backendService = isNewUser && USE_NODE_FOR_NEW_USERS
  ? nodeBackendService
  : firebaseBackendService;
```

#### שלב 4.2: העברת נתונים (חודש 2)
```bash
# סקריפט להעברת נתונים מ-Firestore ל-PostgreSQL
node scripts/migrate-firebase-to-postgres.js
```

```typescript
// scripts/migrate-firebase-to-postgres.ts
import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';

const firestore = admin.firestore();
const prisma = new PrismaClient();

async function migrateNotifications() {
  const snapshot = await firestore.collection('notifications').get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    await prisma.notification.create({
      data: {
        id: doc.id,
        userId: data.userId,
        familyId: data.familyId,
        type: data.type,
        title: data.title,
        body: data.body,
        priority: data.priority || 'normal',
        data: data.data,
        actionUrl: data.actionUrl,
        read: data.read || false,
        createdAt: data.createdAt?.toDate() || new Date(),
      }
    });
  }
  
  console.log(`Migrated ${snapshot.size} notifications`);
}

async function migrateSettings() {
  const snapshot = await firestore.collection('userSettings').get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    await prisma.userSettings.create({
      data: {
        userId: doc.id,
        language: data.language || 'en',
        timezone: data.timezone || 'UTC',
        dateFormat: data.dateFormat || 'MM/DD/YYYY',
        timeFormat: data.timeFormat || '12h',
        weekStart: data.weekStart || 'sunday',
        theme: data.theme || 'auto',
      }
    });
  }
  
  console.log(`Migrated ${snapshot.size} user settings`);
}

async function main() {
  console.log('Starting migration...');
  await migrateNotifications();
  await migrateSettings();
  console.log('Migration complete!');
  await prisma.$disconnect();
}

main();
```

#### שלב 4.3: מעבר מלא (חודש 3)
- כל המשתמשים → Node.js
- Firebase רק ל-Authentication
- כיבוי Firestore לפונקציונליות עסקית

```typescript
// environment.prod.ts
export const environment = {
  production: true,
  useNodeServer: true,  // כולם Node.js!
  apiUrl: 'https://api.coparent.app',
  firebase: {
    // רק Authentication
  }
};
```

---

## שלב 5: בדיקות

### 5.1 בדיקות יחידה (Unit Tests)
```typescript
// notifications.service.spec.ts
describe('NotificationsService', () => {
  it('should create notification in PostgreSQL', async () => {
    const service = new NotificationsService(false);
    const notification = await service.createNotification({
      userId: 'user-id',
      type: 'expense_created',
      title: 'Test',
      body: 'Test notification',
    });
    expect(notification).toBeDefined();
  });

  it('should create notification in Firebase', async () => {
    const service = new NotificationsService(true);
    // ... test Firebase mode
  });
});
```

### 5.2 בדיקות אינטגרציה
```bash
# הרץ בדיקות
npm test

# בדיקות E2E
npm run test:e2e
```

---

## שלב 6: Monitoring & Rollback

### 6.1 הוסף Logging
```typescript
// בכל service
console.log(`[${this.constructor.name}] Using ${this.useFirebase ? 'Firebase' : 'PostgreSQL'}`);
```

### 6.2 Rollback Plan
אם משהו לא עובד:
```env
# חזור מיד ל-Firebase
USE_FIREBASE=true
USE_FIREBASE_STORAGE=true
```

---

## Checklist מעבר

### לפני המעבר:
- [ ] גיבוי מלא של Firestore
- [ ] תיעוד כל ה-Collections וה-Documents
- [ ] רשימת כל השדות והטיפוסים
- [ ] בדיקת כל ה-Security Rules
- [ ] תכנון downtime (אם נדרש)

### במהלך המעבר:
- [ ] הרצת Migration scripts
- [ ] ולידציה של נתונים
- [ ] בדיקות smoke tests
- [ ] ניטור performance
- [ ] בדיקת logs לשגיאות

### אחרי המעבר:
- [ ] ולידציה שכל הפיצ'רים עובדים
- [ ] בדיקת real-time features
- [ ] בדיקת push notifications
- [ ] בדיקת file uploads
- [ ] ניטור במשך 48 שעות
- [ ] מחיקת נתונים ישנים מ-Firebase (אחרי 30 יום)

---

## עלויות

### Firebase (עכשיו):
- Firestore: ~$200/חודש
- Storage: ~$50/חודש
- Functions: ~$100/חודש
- **סה"כ: ~$350/חודש**

### Node.js + PostgreSQL (לאחר מעבר):
- Server (AWS/Digital Ocean): $50-100/חודש
- PostgreSQL (managed): $30/חודש
- S3 Storage: $20/חודש
- **סה"כ: ~$100/חודש**

**חיסכון: ~$250/חודש = $3,000/שנה** 💰

---

## תמיכה

אם יש בעיות במהלך המעבר:
1. בדוק logs של השרת
2. ודא ש-environment variables נכונים
3. בדוק connectivity ל-DB
4. אם צריך - rollback ל-Firebase

שאלות? תשאל!
