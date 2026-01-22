import prisma from '../../config/database.js';
import { emitToFamily, SocketEvents } from '../../config/socket.js';

export interface CreateContactInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  category?: string;
  childId?: string | null;
  notes?: string | null;
}

export interface UpdateContactInput {
  name?: string;
  phone?: string | null;
  email?: string | null;
  category?: string;
  childId?: string | null;
  notes?: string | null;
}

export class ContactsService {
  /**
   * Get all contacts for a family
   */
  async getByFamilyId(familyId: string) {
    return prisma.contact.findMany({
      where: { familyId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get contact by ID
   */
  async getById(id: string) {
    return prisma.contact.findUnique({
      where: { id },
    });
  }

  /**
   * Get contacts by child ID
   */
  async getByChildId(familyId: string, childId: string) {
    return prisma.contact.findMany({
      where: { familyId, childId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get contacts by category
   */
  async getByCategory(familyId: string, category: string) {
    return prisma.contact.findMany({
      where: { familyId, category },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Create a new contact
   */
  async create(familyId: string, data: CreateContactInput) {
    const contact = await prisma.contact.create({
      data: {
        familyId,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        category: data.category || 'other',
        childId: data.childId || null,
        notes: data.notes || null,
      },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.CONTACT_NEW, contact);

    return contact;
  }

  /**
   * Update a contact
   */
  async update(id: string, familyId: string, data: UpdateContactInput) {
    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.childId !== undefined && { childId: data.childId }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.CONTACT_UPDATED, contact);

    return contact;
  }

  /**
   * Delete a contact
   */
  async delete(id: string, familyId: string) {
    await prisma.contact.delete({
      where: { id },
    });

    // Emit socket event
    emitToFamily(familyId, SocketEvents.CONTACT_DELETED, { id });

    return { id, deleted: true };
  }

  /**
   * Delete all contacts for a family
   */
  async deleteByFamilyId(familyId: string) {
    const result = await prisma.contact.deleteMany({
      where: { familyId },
    });

    return result.count;
  }
}

export const contactsService = new ContactsService();
export default contactsService;
