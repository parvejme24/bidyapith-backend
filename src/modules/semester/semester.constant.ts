import { SemesterStatus, type SemesterTerm } from '@prisma/client';

export const SEMESTER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'year',
  'term',
  'name',
  'status',
] as const;

export const SEMESTER_SELECT = {
  id: true,
  term: true,
  year: true,
  name: true,
  status: true,
  registrationStart: true,
  registrationEnd: true,
  dropDeadline: true,
  classStartDate: true,
  classEndDate: true,
  resultPublishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const SEMESTER_DATE_ORDER_MESSAGE =
  'Dates must satisfy registrationStart < registrationEnd ≤ dropDeadline ≤ classEndDate and registrationEnd ≤ classStartDate < classEndDate';

export type ISemesterDateFields = {
  registrationStart: Date;
  registrationEnd: Date;
  dropDeadline: Date;
  classStartDate: Date;
  classEndDate: Date;
};

export const semesterDatesInOrder = (dates: ISemesterDateFields): boolean =>
  dates.registrationStart < dates.registrationEnd &&
  dates.registrationEnd <= dates.dropDeadline &&
  dates.dropDeadline <= dates.classEndDate &&
  dates.registrationEnd <= dates.classStartDate &&
  dates.classStartDate < dates.classEndDate;

export const semesterDisplayName = (term: SemesterTerm, year: number): string =>
  `${term.charAt(0)}${term.slice(1).toLowerCase()} ${year}`;

export const EDITABLE_SEMESTER_STATUSES: readonly SemesterStatus[] = [
  SemesterStatus.UPCOMING,
  SemesterStatus.REGISTRATION,
];
