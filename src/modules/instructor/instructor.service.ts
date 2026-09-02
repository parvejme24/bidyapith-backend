import { Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { paginate, paginationMeta, type PaginationQuery } from '../../shared/paginate';
import { prisma } from '../../shared/prisma';
import { buildWhere } from '../../shared/queryBuilder';
import { findUserIdsByNameEmail } from '../../shared/search';
import { INSTRUCTOR_PROFILE_SELECT, USER_PUBLIC_SELECT } from '../user/user.constant';
import { INSTRUCTOR_SORT_FIELDS } from './instructor.constant';
import type { InstructorAdminPatch, InstructorMePatch } from './instructor.interface';

const instructorDetailSelect = {
  ...INSTRUCTOR_PROFILE_SELECT,
  createdAt: true,
  updatedAt: true,
  user: { select: USER_PUBLIC_SELECT },
} as const;

const liveInstructorWhere = {
  deletedAt: null,
  user: { deletedAt: null },
} satisfies Prisma.InstructorProfileWhereInput;

const requireOwnProfile = async (userId: string) => {
  const profile = await prisma.instructorProfile.findFirst({
    where: { userId, ...liveInstructorWhere },
    select: instructorDetailSelect,
  });
  if (profile === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Instructor profile not found');
  }
  return profile;
};

const getMe = async (userId: string) => requireOwnProfile(userId);

const updateMe = async (userId: string, input: InstructorMePatch) => {
  const profile = await requireOwnProfile(userId);
  return prisma.instructorProfile.update({
    where: { id: profile.id },
    data: {
      specialization: input.specialization,
    },
    select: instructorDetailSelect,
  });
};

const listInstructors = async (
  query: PaginationQuery & {
    departmentId?: string | undefined;
    designation?: string | undefined;
    search?: string | undefined;
  },
) => {
  const pagination = paginate(query, INSTRUCTOR_SORT_FIELDS);
  const searchTerm = query.search?.trim();
  let matchedUserIds: string[] | undefined;
  if (searchTerm !== undefined && searchTerm.length > 0) {
    matchedUserIds = await findUserIdsByNameEmail(searchTerm);
    if (matchedUserIds.length === 0) {
      return { data: [], meta: paginationMeta(pagination.page, pagination.limit, 0) };
    }
  }

  const where = buildWhere({
    searchFields: [],
    filters: {
      ...(query.departmentId !== undefined ? { departmentId: query.departmentId } : {}),
      ...(query.designation !== undefined ? { designation: query.designation } : {}),
    },
    extra: [
      { user: { deletedAt: null } },
      ...(matchedUserIds !== undefined ? [{ userId: { in: matchedUserIds } }] : []),
    ],
  }) as Prisma.InstructorProfileWhereInput;

  const [data, total] = await prisma.$transaction([
    prisma.instructorProfile.findMany({
      where,
      select: instructorDetailSelect,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.instructorProfile.count({ where }),
  ]);

  return { data, meta: paginationMeta(pagination.page, pagination.limit, total) };
};

const getById = async (id: string) => {
  const profile = await prisma.instructorProfile.findFirst({
    where: { id, ...liveInstructorWhere },
    select: instructorDetailSelect,
  });
  if (profile === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Instructor not found');
  }
  return profile;
};

const adminUpdate = async (id: string, input: InstructorAdminPatch) => {
  await getById(id);
  if (input.departmentId !== undefined) {
    const department = await prisma.department.findFirst({
      where: { id: input.departmentId, deletedAt: null },
      select: { id: true },
    });
    if (department === null) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Department not found');
    }
  }
  return prisma.instructorProfile.update({
    where: { id },
    data: {
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
      ...(input.designation !== undefined ? { designation: input.designation } : {}),
      ...(input.specialization !== undefined ? { specialization: input.specialization } : {}),
    },
    select: instructorDetailSelect,
  });
};

export const InstructorService = {
  getMe,
  updateMe,
  listInstructors,
  getById,
  adminUpdate,
};
