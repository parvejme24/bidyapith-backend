import type { PaginationQuery } from '../../shared/paginate';

export type IDepartmentListQuery = PaginationQuery & {
  search?: string | undefined;
};

export type IDepartmentCreate = {
  code: string;
  name: string;
  contactEmail?: string | undefined;
};

export type IDepartmentUpdate = {
  code?: string | undefined;
  name?: string | undefined;
  contactEmail?: string | null | undefined;
};
