/**
 * Migration Script: Firestore → PostgreSQL
 *
 * This script migrates all data from Firebase Firestore to PostgreSQL.
 *
 * Usage:
 *   1. Set up your .env file with DATABASE_URL and Firebase credentials
 *   2. Run: npm run db:push (to create tables)
 *   3. Run: npm run migrate:firestore
 *
 * IMPORTANT:
 *   - Back up your Firestore data before running this script
 *   - Run this script only once
 *   - The script uses upsert, so it's safe to re-run if needed
 */
import 'dotenv/config';
//# sourceMappingURL=migrate-from-firestore.d.ts.map