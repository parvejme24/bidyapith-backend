import type { CourseType } from '@prisma/client';
import type { PaginationQuery } from '../../shared/paginate';

export type ICourseListQuery = PaginationQuery & {
  search?: string | undefined;
  departmentId?: string | undefined;
  type?: CourseType | undefined;
  level?: number | undefined;
  minCredits?: number | undefined;
  maxCredits?: number | undefined;
};

export type ICourseCreate = {
  code: string;
  title: string;
  description?: string | undefined;
  credits: string;
  type?: CourseType | undefined;
  level?: number | undefined;
  departmentId: string;
};

export type ICourseUpdate = {
  code?: string | undefined;
  title?: string | undefined;
  description?: string | null | undefined;
  credits?: string | undefined;
  type?: CourseType | undefined;
  level?: number | undefined;
  departmentId?: string | undefined;
};

export type ICourseFilters = ICourseListQuery;
