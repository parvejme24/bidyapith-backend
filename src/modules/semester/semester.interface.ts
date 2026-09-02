import type { SemesterStatus, SemesterTerm } from '@prisma/client';
import type { PaginationQuery } from '../../shared/paginate';
import type { ISemesterDateFields } from './semester.constant';

export type ISemesterListQuery = PaginationQuery & {
  status?: SemesterStatus | undefined;
  year?: number | undefined;
};

export type ISemesterCreate = ISemesterDateFields & {
  term: SemesterTerm;
  year: number;
};

export type ISemesterUpdate = Partial<ISemesterDateFields>;

export type ISemesterStatusChange = {
  status: SemesterStatus;
};
