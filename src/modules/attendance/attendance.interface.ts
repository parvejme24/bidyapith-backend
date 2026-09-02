import type { AttendanceStatus } from '@prisma/client';

export type IAttendanceRecordInput = {
  enrollmentId: string;
  status: AttendanceStatus;
  remarks?: string | undefined;
};

export type IAttendanceMark = {
  date: string;
  records: IAttendanceRecordInput[];
};

export type IAttendanceDateQuery = {
  date?: string | undefined;
};

export type IAttendanceSessionQuery = {
  date: string;
};
