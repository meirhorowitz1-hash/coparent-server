# 🚀 Quick Start - CoParent Server

## התקנה מהירה (5 דקות)

### 1. Clone & Install
```bash
cd coparent-server
npm install
```

### 2. הגדר משתני סביבה
```bash
cp .env.example .env
# ערוך .env עם הפרטים שלך
```

**חובה לערוך:**
- `DATABASE_URL` - חיבור PostgreSQL
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` - Firebase Admin
- `SMTP_USER`, `SMTP_PASS` - אימייל (או השאר ריק אם לא רוצה email)

### 3. הרץ Database Migrations
```bash
npm run db:migrate
```

### 4. הפעל את השרת
```bash
npm run dev
```

✅ השרת רץ על http://localhost:3000

---

## בדיקה מהירה

```bash
# Health check
curl http://localhost:3000/health

# Get notifications (צריך token)
curl -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  http://localhost:3000/api/notifications
```

---

## מה חדש? (הוסף היום)

### ✅ 2 מודולים חדשים:
1. **Notifications** - `/api/notifications`
2. **Settings** - `/api/settings`

### ✅ 2 שירותי תשתית:
1. **Email Service** - שליחת מיילים
2. **Storage Service** - העלאת קבצים (S3/Firebase)

---

## מצבי הרצה

### PostgreSQL Mode (ברירת מחדל)
```env
USE_FIREBASE=false
USE_FIREBASE_STORAGE=false
```

### Firebase Mode (fallback)
```env
USE_FIREBASE=true
USE_FIREBASE_STORAGE=true
```

---

## פקודות שימושיות

```bash
# פיתוח
npm run dev              # הרצה עם hot-reload

# בניה
npm run build            # TypeScript → JavaScript
npm start                # הרצה production

# Database
npm run db:studio        # פתיחת Prisma Studio
npm run db:migrate       # הרצת migrations
npm run db:generate      # יצירת Prisma Client

# בדיקות
npm test                 # הרצת בדיקות
npm run lint             # בדיקת קוד
```

---

## תיעוד מלא

- **מדריך מודולים:** `HYBRID_MODULES_README.md`
- **מפת מבנה:** `SERVER_STRUCTURE_MAP.md`
- **מדריך מעבר מ-Firebase:** `MIGRATION_GUIDE.md`
- **סיכום כולל:** `SUMMARY.md`

---

## צריך עזרה?

1. בדוק את התיעוד למעלה
2. בדוק logs: `npm run dev`
3. בדוק environment variables ב-`.env`
4. שאל אותי!

**בהצלחה! 🎉**
