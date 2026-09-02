import { AttendanceStatus } from '@prisma/client';

export interface AttendanceRate {
  attended: number;
  counted: number;
  rate: number;
  eligible: boolean;
}

const ATTENDED = new Set<AttendanceStatus>([AttendanceStatus.PRESENT, AttendanceStatus.LATE]);

export function calculateRate(statuses: AttendanceStatus[], minRate: number): AttendanceRate {
  let attended = 0;
  let counted = 0;

  for (const status of statuses) {
    if (status === AttendanceStatus.EXCUSED) {
      continue;
    }
    counted += 1;
    if (ATTENDED.has(status)) {
      attended += 1;
    }
  }

  if (counted === 0) {
    return { attended: 0, counted: 0, rate: 1, eligible: true };
  }

  const rate = attended / counted;
  return {
    attended,
    counted,
    rate,
    eligible: rate >= minRate,
  };
}
