import { SemesterStatus } from '@prisma/client';

export const SEMESTER_TRANSITIONS: Record<SemesterStatus, readonly SemesterStatus[]> = {
  UPCOMING: [SemesterStatus.REGISTRATION, SemesterStatus.CANCELLED],
  REGISTRATION: [SemesterStatus.ONGOING, SemesterStatus.CANCELLED],
  ONGOING: [SemesterStatus.GRADING],
  GRADING: [],
  COMPLETED: [],
  CANCELLED: [],
};

export const isLegalSemesterTransition = (from: SemesterStatus, to: SemesterStatus): boolean =>
  SEMESTER_TRANSITIONS[from].includes(to);

export const CURRENT_SEMESTER_CACHE_KEY = 'semester:current';
export const CURRENT_SEMESTER_CACHE_TTL_SECONDS = 5 * 60;
