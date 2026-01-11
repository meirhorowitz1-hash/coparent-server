# Goals Module - Server Implementation

## ✅ מה הוקם

### 1. **Database Schema (Prisma)**
נוספו 3 טבלאות חדשות:
- `GoalTable` - טבלת יעדים ראשית
- `Goal` - משימות יומיות
- `DailyProgress` - מעקב התקדמות יומית

### 2. **API Routes**
כל הנתיבים נמצאים תחת: `/api/families/:familyId/goals`

#### Goal Tables:
- `GET /api/families/:familyId/goals` - קבלת כל הטבלאות
  - Query params: `childId`, `active=true`
- `GET /api/families/:familyId/goals/:tableId` - קבלת טבלה ספציפית
- `POST /api/families/:familyId/goals` - יצירת טבלה חדשה
- `PUT /api/families/:familyId/goals/:tableId` - עדכון טבלה
- `DELETE /api/families/:familyId/goals/:tableId` - מחיקת טבלה

#### Progress:
- `GET /api/families/:familyId/goals/:tableId/progress` - קבלת כל ההתקדמות
  - Query params: `startDate`, `endDate`
- `POST /api/families/:familyId/goals/:tableId/progress` - עדכון התקדמות יומית

#### Statistics:
- `GET /api/families/:familyId/goals/:tableId/stats` - סטטיסטיקות

### 3. **Socket Events**
- `goal-table:created` - טבלה חדשה נוצרה
- `goal-table:updated` - טבלה עודכנה
- `goal-table:deleted` - טבלה נמחקה
- `goal-progress:updated` - התקדמות עודכנה

---

## 📋 צעדים הבאים

### 1. **הרצת Migration**
```bash
cd /Users/meirhorowitz/projects/personal_projects/coparent-server
npx prisma migrate dev --name add_goals_tables
npx prisma generate
```

### 2. **Restart השרת**
```bash
npm run dev
```

### 3. **בדיקה**
השתמש ב-Postman או curl לבדוק:
```bash
# יצירת טבלה חדשה
POST /api/families/{familyId}/goals
Authorization: Bearer {token}
Content-Type: application/json

{
  "childId": "child-id",
  "childName": "שם הילד",
  "title": "שגרת בוקר",
  "startDate": "2026-01-01T00:00:00Z",
  "endDate": "2026-01-31T23:59:59Z",
  "goals": [
    {
      "title": "צחצחתי שיניים",
      "icon": "🦷",
      "order": 1
    },
    {
      "title": "אכלתי ארוחת בוקר",
      "icon": "🥣",
      "order": 2
    }
  ]
}
```

---

## 🔄 אינטגרציה עם הקליינט

כדי להשתמש בשרת במקום Firebase:

### 1. יצירת GoalsService ב-mobile app
```typescript
// src/app/core/services/goals.service.ts
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GoalsService {
  constructor(private api: ApiService) {}

  getAll(familyId: string) {
    return this.api.get(`/families/${familyId}/goals`);
  }

  create(familyId: string, data: any) {
    return this.api.post(`/families/${familyId}/goals`, data);
  }

  update(familyId: string, tableId: string, data: any) {
    return this.api.put(`/families/${familyId}/goals/${tableId}`, data);
  }

  delete(familyId: string, tableId: string) {
    return this.api.delete(`/families/${familyId}/goals/${tableId}`);
  }

  getProgress(familyId: string, tableId: string) {
    return this.api.get(`/families/${familyId}/goals/${tableId}/progress`);
  }

  upsertProgress(familyId: string, tableId: string, data: any) {
    return this.api.post(`/families/${familyId}/goals/${tableId}/progress`, data);
  }

  getStats(familyId: string, tableId: string) {
    return this.api.get(`/families/${familyId}/goals/${tableId}/stats`);
  }
}
```

### 2. עדכון הקומפוננטות
החלף את השימוש ב-localStorage בקומפוננטות:
- `goals.page.ts`
- `goal-create.page.ts`
- `goal-calendar.page.ts`

---

## 🎯 Summary

**מה עובד:**
✅ Prisma Schema מוכן
✅ API Routes מוכנים
✅ Controllers + Services
✅ Socket Events
✅ Validation עם Zod

**מה נשאר:**
🔲 להריץ migration
🔲 ליצור GoalsService בקליינט
🔲 לעדכן קומפוננטות להשתמש ב-API במקום localStorage
