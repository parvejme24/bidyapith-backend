import type { ExamType } from '@prisma/client';
import type { PaginationQuery } from '../../shared/paginate';

export type IExamCreate = {
  type: ExamType;
  title: string;
  totalMarks: string;
  weight: string;
  examDate: string;
};

export type IExamUpdate = {
  title?: string | undefined;
  examDate?: string | undefined;
  totalMarks?: string | undefined;
  weight?: string | undefined;
};

export type IExamPublish = {
  isPublished: boolean;
};

export type IExamResultInput = {
  enrollmentId: string;
  marksObtained: string;
  remarks?: string | undefined;
};

export type IExamResultsWrite = {
  results: IExamResultInput[];
};

export type IExamListQuery = PaginationQuery;

export type IMyExamResultsQuery = {
  offeringId?: string | undefined;
};
