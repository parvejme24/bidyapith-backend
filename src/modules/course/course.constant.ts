export const COURSE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'code',
  'title',
  'credits',
  'level',
] as const;

export const DEPARTMENT_REF_SELECT = {
  id: true,
  code: true,
  name: true,
} as const;

export const COURSE_SELECT = {
  id: true,
  code: true,
  title: true,
  description: true,
  credits: true,
  type: true,
  level: true,
  departmentId: true,
  createdAt: true,
  updatedAt: true,
  department: { select: DEPARTMENT_REF_SELECT },
} as const;
