export const DEPARTMENT_SORT_FIELDS = ['createdAt', 'updatedAt', 'code', 'name'] as const;

export const DEPARTMENT_SELECT = {
  id: true,
  code: true,
  name: true,
  contactEmail: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const PROGRAM_SUMMARY_SELECT = {
  id: true,
  code: true,
  name: true,
  degreeType: true,
  totalCredits: true,
} as const;
