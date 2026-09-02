import { SemesterTerm } from '@prisma/client';

export const WRITE_CHUNK_SIZE = 500;
export const PUBLISH_TIMEOUT_MS = 60_000;
export const PUBLISH_MAX_WAIT_MS = 10_000;

export const TERM_ORDER: Record<SemesterTerm, number> = {
  [SemesterTerm.SPRING]: 1,
  [SemesterTerm.SUMMER]: 2,
  [SemesterTerm.FALL]: 3,
};
