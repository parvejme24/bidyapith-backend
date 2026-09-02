import { DayOfWeek } from '@prisma/client';

export const MIN_ATTENDANCE_RATE = 0.75;

export const JS_WEEKDAY_TO_DAY: readonly DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];
