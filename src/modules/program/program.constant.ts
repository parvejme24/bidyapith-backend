export const PROGRAM_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'code',
  'name',
  'totalCredits',
] as const;

export const DEPARTMENT_REF_SELECT = {
  id: true,
  code: true,
  name: true,
} as const;

export const PROGRAM_SELECT = {
  id: true,
  code: true,
  name: true,
  departmentId: true,
  degreeType: true,
  totalCredits: true,
  durationYears: true,
  minCreditsPerSemester: true,
  maxCreditsPerSemester: true,
  feePerCredit: true,
  registrationFee: true,
  createdAt: true,
  updatedAt: true,
  department: { select: DEPARTMENT_REF_SELECT },
} as const;

export const COURSE_CURRICULUM_SELECT = {
  id: true,
  code: true,
  title: true,
  credits: true,
  type: true,
  level: true,
} as const;
