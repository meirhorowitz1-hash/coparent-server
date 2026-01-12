import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth.middleware.js';
import * as adminService from './admin.service.js';
import { TableName, TABLES } from './admin.service.js';

const router = Router();

// Admin middleware - check if user is admin
async function adminMiddleware(req: AuthRequest, res: Response, next: Function) {
  if (!req.user?.email || !adminService.isAdminUser(req.user.email)) {
    return res.status(403).json({ error: 'forbidden', message: 'Admin access required' });
  }
  next();
}

// Apply auth and admin middleware to all routes
router.use(authMiddleware, adminMiddleware);

// Get list of all tables
router.get('/tables', async (req: AuthRequest, res: Response) => {
  res.json({ tables: TABLES });
});

// Get database stats
router.get('/stats', async (req: AuthRequest, res: Response) => {
  const stats = await adminService.getDbStats();
  res.json(stats);
});

// Get table schema
router.get('/tables/:tableName/schema', async (req: AuthRequest, res: Response) => {
  const { tableName } = req.params;
  
  if (!TABLES.includes(tableName as TableName)) {
    return res.status(404).json({ error: 'not_found', message: 'Table not found' });
  }

  const schema = await adminService.getTableSchema(tableName as TableName);
  res.json(schema);
});

// Get table data with pagination
router.get('/tables/:tableName', async (req: AuthRequest, res: Response) => {
  const { tableName } = req.params;
  const { page, limit, orderBy, orderDir, search, searchField } = req.query;

  if (!TABLES.includes(tableName as TableName)) {
    return res.status(404).json({ error: 'not_found', message: 'Table not found' });
  }

  const data = await adminService.getTableData(tableName as TableName, {
    page: page ? parseInt(page as string) : 1,
    limit: limit ? parseInt(limit as string) : 50,
    orderBy: orderBy as string,
    orderDir: orderDir as 'asc' | 'desc',
    search: search as string,
    searchField: searchField as string,
  });

  res.json(data);
});

// Get single record
router.get('/tables/:tableName/:id', async (req: AuthRequest, res: Response) => {
  const { tableName, id } = req.params;

  if (!TABLES.includes(tableName as TableName)) {
    return res.status(404).json({ error: 'not_found', message: 'Table not found' });
  }

  const record = await adminService.getRecordById(tableName as TableName, id);
  
  if (!record) {
    return res.status(404).json({ error: 'not_found', message: 'Record not found' });
  }

  res.json(record);
});

// Create new record
router.post('/tables/:tableName', async (req: AuthRequest, res: Response) => {
  const { tableName } = req.params;

  if (!TABLES.includes(tableName as TableName)) {
    return res.status(404).json({ error: 'not_found', message: 'Table not found' });
  }

  try {
    const record = await adminService.createRecord(tableName as TableName, req.body);
    res.status(201).json(record);
  } catch (error: any) {
    console.error('Error creating record:', error);
    res.status(400).json({ error: 'bad_request', message: error.message });
  }
});

// Update record
router.put('/tables/:tableName/:id', async (req: AuthRequest, res: Response) => {
  const { tableName, id } = req.params;

  if (!TABLES.includes(tableName as TableName)) {
    return res.status(404).json({ error: 'not_found', message: 'Table not found' });
  }

  try {
    const record = await adminService.updateRecord(tableName as TableName, id, req.body);
    res.json(record);
  } catch (error: any) {
    console.error('Error updating record:', error);
    res.status(400).json({ error: 'bad_request', message: error.message });
  }
});

// Delete record
router.delete('/tables/:tableName/:id', async (req: AuthRequest, res: Response) => {
  const { tableName, id } = req.params;

  if (!TABLES.includes(tableName as TableName)) {
    return res.status(404).json({ error: 'not_found', message: 'Table not found' });
  }

  try {
    await adminService.deleteRecord(tableName as TableName, id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting record:', error);
    res.status(400).json({ error: 'bad_request', message: error.message });
  }
});

// Delete multiple records
router.post('/tables/:tableName/delete-many', async (req: AuthRequest, res: Response) => {
  const { tableName } = req.params;
  const { ids } = req.body;

  if (!TABLES.includes(tableName as TableName)) {
    return res.status(404).json({ error: 'not_found', message: 'Table not found' });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'bad_request', message: 'ids array required' });
  }

  try {
    const result = await adminService.deleteMultipleRecords(tableName as TableName, ids);
    res.json({ success: true, deleted: result.count });
  } catch (error: any) {
    console.error('Error deleting records:', error);
    res.status(400).json({ error: 'bad_request', message: error.message });
  }
});

// Execute raw SQL query (SELECT only)
router.post('/query', async (req: AuthRequest, res: Response) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'bad_request', message: 'query required' });
  }

  try {
    const result = await adminService.executeRawQuery(query);
    res.json({ data: result });
  } catch (error: any) {
    console.error('Error executing query:', error);
    res.status(400).json({ error: 'bad_request', message: error.message });
  }
});

export default router;
