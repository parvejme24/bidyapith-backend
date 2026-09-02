import type { DayOfWeek, OfferingStatus } from '@prisma/client';
import type { PaginationQuery } from '../../shared/paginate';

export type IOfferingScheduleInput = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room?: string | undefined;
};

export type IOfferingCreate = {
  courseId: string;
  semesterId: string;
  section: string;
  capacity?: number | undefined;
  room?: string | undefined;
  instructorId?: string | undefined;
  schedules?: IOfferingScheduleInput[] | undefined;
};

export type IOfferingUpdate = {
  capacity?: number | undefined;
  room?: string | null | undefined;
  section?: string | undefined;
};

export type IOfferingInstructorChange = {
  instructorId: string | null;
};

export type IOfferingStatusChange = {
  status: OfferingStatus;
};

export type IOfferingListQuery = PaginationQuery & {
  semesterId?: string | undefined;
  courseId?: string | undefined;
  instructorId?: string | undefined;
  departmentId?: string | undefined;
  status?: OfferingStatus | undefined;
  hasSeats?: boolean | undefined;
  search?: string | undefined;
};

export type IMyTeachingQuery = PaginationQuery & {
  semesterId?: string | undefined;
};
