import type { LetterGrade } from '@prisma/client';

export type IGradeEntry = {
  enrollmentId: string;
  letterGrade?: LetterGrade | undefined;
  remarks?: string | undefined;
};

export type IGradeSubmit = {
  grades: IGradeEntry[];
};

export type IGradePatch = {
  letterGrade: LetterGrade;
};

export type IMyResultsQuery = {
  semesterId?: string | undefined;
};

export type IReadinessBlocker = {
  offeringId: string;
  course: string;
  section: string;
  reason: 'UNGRADED' | 'NOT_GRADING' | 'ALREADY_PUBLISHED';
  count: number;
};

export type IReadiness = {
  ready: boolean;
  totalOfferings: number;
  gradedOfferings: number;
  totalEnrollments: number;
  gradedEnrollments: number;
  blockers: IReadinessBlocker[];
};
