export const CACHE_TTL = {
  courseList: 10 * 60,
  departmentList: 60 * 60,
  program: 60 * 60,
  transcript: 60 * 60,
  dashboardStats: 5 * 60,
} as const;

export const cacheKeys = {
  courseList: (queryHash: string) => `course:list:${queryHash}`,
  departmentList: 'department:list',
  program: (id: string) => `program:${id}`,
  transcript: (studentId: string) => `transcript:${studentId}`,
  dashboardStats: 'dashboard:stats',
} as const;

/**
 * Never cache these. A stale value reintroduces races the enrollment
 * transaction and payment webhooks were written to prevent.
 * - enrolledCount / seat availability
 * - invoice status / payment state
 * - anything read inside the enrollment transaction
 */
