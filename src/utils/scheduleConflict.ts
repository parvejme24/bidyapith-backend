import type { DayOfWeek } from '@prisma/client';

export interface TimeSlot {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const toMinutes = (time: string): number => {
  const hour = Number.parseInt(time.slice(0, 2), 10);
  const minute = Number.parseInt(time.slice(3, 5), 10);
  return hour * 60 + minute;
};

export function isValidTimeRange(start: string, end: string): boolean {
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
    return false;
  }
  return toMinutes(start) < toMinutes(end);
}

export function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) {
    return false;
  }
  const aStart = toMinutes(a.startTime);
  const aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime);
  const bEnd = toMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

export function findConflicts<T extends TimeSlot>(candidate: TimeSlot[], existing: T[]): T[] {
  return existing.filter((slot) => candidate.some((item) => overlaps(item, slot)));
}
