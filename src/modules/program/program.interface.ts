import type { CourseType, DegreeType } from '@prisma/client';
import type { PaginationQuery } from '../../shared/paginate';

export type IProgramListQuery = PaginationQuery & {
  departmentId?: string | undefined;
  degreeType?: DegreeType | undefined;
};

export type IProgramCreate = {
  code: string;
  name: string;
  departmentId: string;
  degreeType: DegreeType;
  totalCredits: number;
  durationYears?: number | undefined;
  minCreditsPerSemester?: number | undefined;
  maxCreditsPerSemester?: number | undefined;
  feePerCredit: string;
  registrationFee?: string | undefined;
};

export type IProgramUpdate = {
  code?: string | undefined;
  name?: string | undefined;
  departmentId?: string | undefined;
  degreeType?: DegreeType | undefined;
  totalCredits?: number | undefined;
  durationYears?: number | undefined;
  minCreditsPerSemester?: number | undefined;
  maxCreditsPerSemester?: number | undefined;
  feePerCredit?: string | undefined;
  registrationFee?: string | undefined;
};

export type ICurriculumEntry = {
  courseId: string;
  type?: CourseType | undefined;
  recommendedSemester?: number | undefined;
};

export type ICurriculumPatch = {
  type?: CourseType | undefined;
  recommendedSemester?: number | undefined;
};
