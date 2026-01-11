import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware.js';
import prisma from '../config/database.js';

export interface FamilyRequest extends AuthRequest {
  familyId?: string;
  familyRole?: 'owner' | 'member';
}

/**
 * Middleware to verify user is a member of the requested family
 * Auto-creates family and membership if they don't exist (for Firebase migration)
 */
export async function familyMemberMiddleware(
  req: FamilyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.uid;
  const familyId = req.params.familyId;

  if (!userId) {
    res.status(401).json({ 
      error: 'unauthorized',
      message: 'Authentication required' 
    });
    return;
  }

  if (!familyId) {
    res.status(400).json({ 
      error: 'bad-request',
      message: 'Family ID is required' 
    });
    return;
  }

  try {
    // Check if membership exists
    let membership = await prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId,
          userId,
        },
      },
      select: {
        role: true,
      },
    });

    // If no membership, try to auto-create family and membership
    // This handles migration from Firebase where family IDs already exist
    if (!membership) {
      console.log(`[Family] Auto-creating family ${familyId} for user ${userId}`);
      
      // Check if family exists
      let family = await prisma.family.findUnique({
        where: { id: familyId },
      });

      // Create family if it doesn't exist
      if (!family) {
        family = await prisma.family.create({
          data: {
            id: familyId,
            ownerId: userId,
            shareCode: Math.floor(100000 + Math.random() * 900000).toString(),
          },
        });
        console.log(`[Family] Created family ${familyId}`);
      }

      // Create membership
      await prisma.familyMember.create({
        data: {
          familyId,
          userId,
          role: family.ownerId === userId ? 'owner' : 'member',
        },
      });
      console.log(`[Family] Created membership for user ${userId} in family ${familyId}`);

      membership = {
        role: family.ownerId === userId ? 'owner' : 'member',
      };
    }

    req.familyId = familyId;
    req.familyRole = membership.role as 'owner' | 'member';
    next();
  } catch (error) {
    console.error('[Family Middleware] Error:', error);
    res.status(500).json({ 
      error: 'internal-error',
      message: 'Failed to verify family membership' 
    });
  }
}

/**
 * Middleware to verify user is the owner of the requested family
 */
export async function familyOwnerMiddleware(
  req: FamilyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.uid;
  const familyId = req.params.familyId;

  if (!userId) {
    res.status(401).json({ 
      error: 'unauthorized',
      message: 'Authentication required' 
    });
    return;
  }

  if (!familyId) {
    res.status(400).json({ 
      error: 'bad-request',
      message: 'Family ID is required' 
    });
    return;
  }

  try {
    let family = await prisma.family.findUnique({
      where: { id: familyId },
      select: { ownerId: true },
    });

    // Auto-create family if it doesn't exist (for Firebase migration)
    if (!family) {
      console.log(`[Family Owner] Auto-creating family ${familyId} with owner ${userId}`);
      
      family = await prisma.family.create({
        data: {
          id: familyId,
          ownerId: userId,
          shareCode: Math.floor(100000 + Math.random() * 900000).toString(),
        },
      });

      // Create membership
      await prisma.familyMember.create({
        data: {
          familyId,
          userId,
          role: 'owner',
        },
      });
    }

    if (family.ownerId !== userId) {
      res.status(403).json({ 
        error: 'forbidden',
        message: 'Only the family owner can perform this action' 
      });
      return;
    }

    req.familyId = familyId;
    req.familyRole = 'owner';
    next();
  } catch (error) {
    console.error('[Family Owner Middleware] Error:', error);
    res.status(500).json({ 
      error: 'internal-error',
      message: 'Failed to verify family ownership' 
    });
  }
}

export default { familyMemberMiddleware, familyOwnerMiddleware };
