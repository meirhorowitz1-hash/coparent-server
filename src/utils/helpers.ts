/**
 * Format date for Hebrew display
 */
export function formatDateHebrew(date: Date): string {
  return date.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

/**
 * Format date and time for Hebrew display
 */
export function formatDateTimeHebrew(date: Date, isAllDay?: boolean): string {
  if (isAllDay) {
    return formatDateHebrew(date);
  }

  const dateStr = formatDateHebrew(date);
  const timeStr = date.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${dateStr} • ${timeStr}`;
}

/**
 * Format currency in ILS
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
  }).format(amount);
}

/**
 * Generate a random 6-digit share code
 */
export function generateShareCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Get start of day (midnight)
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day (23:59:59.999)
 */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get the parent role (parent1 or parent2) for a user in a family
 */
export function getParentRole(
  memberIds: string[],
  userId: string
): 'parent1' | 'parent2' | null {
  const sorted = [...new Set(memberIds)].sort();
  const index = sorted.indexOf(userId);
  
  if (index === 0) return 'parent1';
  if (index === 1) return 'parent2';
  return null;
}

/**
 * Sleep for specified milliseconds (useful for rate limiting)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Paginate results
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function paginate<T>(
  items: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const totalPages = Math.ceil(total / limit);

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export default {
  formatDateHebrew,
  formatDateTimeHebrew,
  formatCurrency,
  generateShareCode,
  normalizeEmail,
  startOfDay,
  endOfDay,
  getParentRole,
  sleep,
  paginate,
};
