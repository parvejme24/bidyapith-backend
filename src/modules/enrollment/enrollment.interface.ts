import type { EnrollmentStatus } from '@prisma/client';
import type { PaginationQuery } from '../../shared/paginate';
import type { IBlockReason, ISkippableCheck } from './enrollment.constant';

export type IEnrollmentCreate = {
  offeringId: string;
};

export type IAdminEnrollmentCreate = {
  studentId: string;
  offeringId: string;
  skipChecks?: ISkippableCheck[] | undefined;
};

export type IMyCoursesQuery = PaginationQuery & {
  semesterId?: string | undefined;
  status?: EnrollmentStatus | undefined;
};

export type IAvailableCoursesQuery = {
  eligibleOnly?: boolean | undefined;
};

export type IEnrollmentListQuery = PaginationQuery & {
  studentId?: string | undefined;
  offeringId?: string | undefined;
  semesterId?: string | undefined;
  status?: EnrollmentStatus | undefined;
};

export type IRosterQuery = PaginationQuery & {
  includeDropped?: boolean | undefined;
};

export type IEligibilityBlock = {
  reason: IBlockReason;
  detail: string;
};
