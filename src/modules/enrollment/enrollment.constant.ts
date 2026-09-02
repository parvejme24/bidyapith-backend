import { EnrollmentStatus } from '@prisma/client';

export const ENROLLMENT_SORT_FIELDS = ['createdAt', 'updatedAt', 'enrolledAt', 'status'] as const;

export const ROSTER_SORT_FIELDS = ['enrolledAt', 'createdAt', 'status'] as const;

export const TRANSACTION_TIMEOUT_MS = 10_000;

export const LOW_CGPA_THRESHOLD = '2.00';
export const LOW_CGPA_CREDIT_CAP = 9;

export const SKIPPABLE_CHECKS = [
  'PREREQUISITE',
  'CREDIT_LIMIT',
  'SCHEDULE_CONFLICT',
  'FINANCIAL_HOLD',
] as const;

export type ISkippableCheck = (typeof SKIPPABLE_CHECKS)[number];

export const BLOCK_REASONS = [
  'PREREQUISITE',
  'SCHEDULE_CONFLICT',
  'CREDIT_LIMIT',
  'ALREADY_ENROLLED',
  'SECTION_FULL',
] as const;

export type IBlockReason = (typeof BLOCK_REASONS)[number];

export const ACTIVE_ENROLLMENT_STATUSES: readonly EnrollmentStatus[] = [
  EnrollmentStatus.ENROLLED,
  EnrollmentStatus.COMPLETED,
];

export const COURSE_REF_SELECT = {
  id: true,
  code: true,
  title: true,
  credits: true,
} as const;

export const SCHEDULE_REF_SELECT = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  room: true,
} as const;
