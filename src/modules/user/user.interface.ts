import type { Designation, Role, StudentStatus, UserStatus } from '@prisma/client';

export type PaginationInput = {
  page?: string | number | undefined;
  limit?: string | number | undefined;
  sortBy?: string | undefined;
  sortOrder?: string | undefined;
};

export type AdminUserListQuery = PaginationInput & {
  role?: Role;
  status?: UserStatus;
  search?: string;
};

export type UpdateMeInput = {
  firstName?: string;
  lastName?: string;
  phone?: string;
};

export type CreateStaffInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  departmentId?: string;
  designation?: Designation;
  joiningDate?: string;
  specialization?: string;
};

export type StudentMePatch = {
  guardianName?: string;
  guardianPhone?: string;
  address?: string;
};

export type StudentAdminPatch = {
  programId?: string;
  batch?: string;
  status?: StudentStatus;
};

export type InstructorMePatch = {
  specialization: string | null;
};

export type InstructorAdminPatch = {
  departmentId?: string;
  designation?: Designation;
  specialization?: string;
};
