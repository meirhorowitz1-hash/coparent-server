import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../config/firebase.js';
import prisma from '../config/database.js';

export interface AuthUser {
  uid: string;
  email?: string;
  name?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/**
 * Middleware to authenticate requests using Firebase ID token
 * Also ensures user exists in PostgreSQL (auto-creates if not)
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  console.log('[Auth] Request to:', req.method, req.path);
  console.log('[Auth] Authorization header:', authHeader ? authHeader.substring(0, 30) + '...' : 'MISSING');

  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[Auth] ❌ Missing or invalid authorization header');
    res.status(401).json({ 
      error: 'unauthorized',
      message: 'Missing or invalid authorization header' 
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  if (!token) {
    res.status(401).json({ 
      error: 'unauthorized',
      message: 'Missing token' 
    });
    return;
  }

  try {
    const decodedToken = await verifyIdToken(token);
    console.log('[Auth] ✅ Token verified for user:', decodedToken.uid);
    
    // Ensure user exists in PostgreSQL
    await ensureUserExists(decodedToken.uid, decodedToken.email, decodedToken.name);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
    next();
  } catch (error) {
    console.error('[Auth Middleware] ❌ Token verification failed:', error);
    res.status(401).json({ 
      error: 'unauthorized',
      message: 'Invalid or expired token' 
    });
  }
}

/**
 * Ensure user exists in PostgreSQL, create if not
 */
async function ensureUserExists(
  uid: string, 
  email?: string, 
  name?: string
): Promise<void> {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: uid },
    });

    if (!existingUser) {
      console.log(`[Auth] Creating new user in PostgreSQL: ${uid} (${email})`);
      await prisma.user.create({
        data: {
          id: uid,
          email: email || '',
          fullName: name || email?.split('@')[0] || 'User',
        },
      });
    }
  } catch (error) {
    // Log but don't fail - user might already exist from race condition
    console.warn('[Auth] Error ensuring user exists:', error);
  }
}

/**
 * Optional auth - doesn't fail if no token, but attaches user if valid
 */
export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const decodedToken = await verifyIdToken(token);
    
    // Ensure user exists in PostgreSQL
    await ensureUserExists(decodedToken.uid, decodedToken.email, decodedToken.name);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
  } catch (error) {
    // Token invalid, but that's okay for optional auth
    console.warn('[Auth Middleware] Optional auth failed:', error);
  }

  next();
}

export default authMiddleware;
