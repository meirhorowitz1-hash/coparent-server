import admin from 'firebase-admin';

let firebaseInitialized = false;

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  if (!privateKey || !projectId || !clientEmail) {
    console.warn('[Firebase Admin] Missing credentials - Firebase features will be disabled');
    console.warn('[Firebase Admin] Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env');
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      firebaseInitialized = true;
      console.log('[Firebase Admin] Initialized successfully');
    } catch (error) {
      console.error('[Firebase Admin] Failed to initialize:', error);
    }
  }
}

export const firebaseAdmin = admin;
export const isFirebaseInitialized = () => firebaseInitialized;

// Safe getters that check initialization
export const getFirebaseAuth = (): admin.auth.Auth => {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized');
  }
  return admin.auth();
};

export const getFirebaseMessaging = (): admin.messaging.Messaging => {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized');
  }
  return admin.messaging();
};

/**
 * Verify Firebase ID token
 */
export async function verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized - cannot verify tokens');
  }
  return admin.auth().verifyIdToken(token);
}

/**
 * Send push notification to specific tokens
 */
export async function sendPushNotification(
  tokens: string[],
  notification: { title: string; body: string },
  data?: Record<string, string>
): Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }> {
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  if (!firebaseInitialized) {
    console.warn('[Firebase Messaging] Not initialized - skipping push notification');
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification,
      data,
      android: {
        priority: 'high',
        notification: { sound: 'default' },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            alert: {
              title: notification.title,
              body: notification.body,
            },
          },
        },
      },
    });

    const invalidTokens = response.responses
      .map((res, idx) => (!res.success ? tokens[idx] : null))
      .filter((token): token is string => Boolean(token));

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  } catch (error) {
    console.error('[Firebase Messaging] Failed to send:', error);
    throw error;
  }
}

export default firebaseAdmin;
