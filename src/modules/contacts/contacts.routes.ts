import { Router } from 'express';
import { contactsController } from './contacts.controller.js';

const router = Router({ mergeParams: true }); // mergeParams to access :familyId from parent router

// All contacts routes (familyMemberMiddleware already applied in parent router)
router.get('/', (req, res) => contactsController.getAll(req as any, res));
router.get('/:contactId', (req, res) => contactsController.getById(req as any, res));
router.get('/child/:childId', (req, res) => contactsController.getByChild(req as any, res));
router.get('/category/:category', (req, res) => contactsController.getByCategory(req as any, res));
router.post('/', (req, res) => contactsController.create(req as any, res));
router.patch('/:contactId', (req, res) => contactsController.update(req as any, res));
router.delete('/:contactId', (req, res) => contactsController.delete(req as any, res));

export default router;
