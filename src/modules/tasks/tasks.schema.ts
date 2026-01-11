import { z } from 'zod';

export const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
export const taskStatusEnum = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);
export const taskCategoryEnum = z.enum(['medical', 'education', 'activity', 'shopping', 'household', 'paperwork', 'other']);
export const assignedToEnum = z.enum(['parent1', 'parent2', 'both']);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: taskPriorityEnum.default('medium'),
  assignedTo: assignedToEnum.default('both'),
  category: taskCategoryEnum.default('other'),
  childId: z.string().uuid().optional().nullable(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: taskPriorityEnum.optional(),
  assignedTo: assignedToEnum.optional(),
  category: taskCategoryEnum.optional(),
  childId: z.string().uuid().optional().nullable(),
});

export const updateTaskStatusSchema = z.object({
  status: taskStatusEnum,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
