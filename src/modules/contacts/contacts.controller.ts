import { Request, Response } from 'express';
import { contactsService } from './contacts.service.js';

interface AuthRequest extends Request {
  userId?: string;
  familyId?: string;
}

class ContactsController {
  /**
   * Get all contacts for a family
   */
  async getAll(req: AuthRequest, res: Response) {
    const { familyId } = req.params;

    const contacts = await contactsService.getByFamilyId(familyId);
    res.json(contacts);
  }

  /**
   * Get contact by ID
   */
  async getById(req: AuthRequest, res: Response) {
    const { familyId, contactId } = req.params;

    const contact = await contactsService.getById(contactId);
    if (!contact) {
      return res.status(404).json({ error: 'contact-not-found' });
    }

    if (contact.familyId !== familyId) {
      return res.status(403).json({ error: 'contact-access-denied' });
    }

    res.json(contact);
  }

  /**
   * Get contacts by child
   */
  async getByChild(req: AuthRequest, res: Response) {
    const { familyId, childId } = req.params;

    const contacts = await contactsService.getByChildId(familyId, childId);
    res.json(contacts);
  }

  /**
   * Get contacts by category
   */
  async getByCategory(req: AuthRequest, res: Response) {
    const { familyId, category } = req.params;

    const contacts = await contactsService.getByCategory(familyId, category);
    res.json(contacts);
  }

  /**
   * Create a new contact
   */
  async create(req: AuthRequest, res: Response) {
    const { familyId } = req.params;
    const { name, phone, email, category, childId, notes } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'missing-name' });
    }

    const contact = await contactsService.create(familyId, {
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      category: category || 'other',
      childId: childId || null,
      notes: notes?.trim() || null,
    });

    res.status(201).json(contact);
  }

  /**
   * Update a contact
   */
  async update(req: AuthRequest, res: Response) {
    const { familyId, contactId } = req.params;
    const { name, phone, email, category, childId, notes } = req.body;

    const existing = await contactsService.getById(contactId);
    if (!existing) {
      return res.status(404).json({ error: 'contact-not-found' });
    }

    if (existing.familyId !== familyId) {
      return res.status(403).json({ error: 'contact-access-denied' });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (category !== undefined) updateData.category = category;
    if (childId !== undefined) updateData.childId = childId || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    const updated = await contactsService.update(contactId, familyId, updateData);
    res.json(updated);
  }

  /**
   * Delete a contact
   */
  async delete(req: AuthRequest, res: Response) {
    const { familyId, contactId } = req.params;

    const existing = await contactsService.getById(contactId);
    if (!existing) {
      return res.status(404).json({ error: 'contact-not-found' });
    }

    if (existing.familyId !== familyId) {
      return res.status(403).json({ error: 'contact-access-denied' });
    }

    await contactsService.delete(contactId, familyId);
    res.status(204).send();
  }
}

export const contactsController = new ContactsController();
export default contactsController;
