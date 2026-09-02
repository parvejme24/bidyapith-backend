export const USER_SORT_FIELDS = ['createdAt', 'updatedAt', 'firstName', 'lastName', 'email'] as const;

export const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  status: true,
  provider: true,
  emailVerified: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const PROGRAM_SUMMARY_SELECT = {
  id: true,
  code: true,
  name: true,
  department: { select: { id: true, code: true, name: true } },
} as const;

export const STUDENT_PROFILE_SELECT = {
  id: true,
  studentId: true,
  programId: true,
  batch: true,
  admissionDate: true,
  status: true,
  cgpa: true,
  totalCreditsEarned: true,
  guardianName: true,
  guardianPhone: true,
  address: true,
  program: { select: PROGRAM_SUMMARY_SELECT },
} as const;

export const STUDENT_LIST_SELECT = {
  id: true,
  studentId: true,
  programId: true,
  batch: true,
  status: true,
  cgpa: true,
  totalCreditsEarned: true,
  createdAt: true,
  user: { select: USER_PUBLIC_SELECT },
  program: { select: PROGRAM_SUMMARY_SELECT },
} as const;

export const INSTRUCTOR_PROFILE_SELECT = {
  id: true,
  employeeId: true,
  departmentId: true,
  designation: true,
  specialization: true,
  joiningDate: true,
  department: { select: { id: true, code: true, name: true } },
} as const;

