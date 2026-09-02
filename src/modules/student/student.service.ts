import type { Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { type PaginationQuery, paginate, paginationMeta } from '../../shared/paginate';
import { prisma } from '../../shared/prisma';
import { buildWhere } from '../../shared/queryBuilder';
import { findUserIdsByNameEmail } from '../../shared/search';
import {
  STUDENT_LIST_SELECT,
  STUDENT_PROFILE_SELECT,
  USER_PUBLIC_SELECT,
} from '../user/user.constant';
import { STUDENT_SORT_FIELDS } from './student.constant';
import type { StudentAdminPatch, StudentMePatch } from './student.interface';

const studentDetailSelect = {
  ...STUDENT_PROFILE_SELECT,
  createdAt: true,
  updatedAt: true,
  user: { select: USER_PUBLIC_SELECT },
} as const;

const liveStudentWhere = {
  deletedAt: null,
  user: { deletedAt: null },
} satisfies Prisma.StudentProfileWhereInput;

const requireOwnProfile = async (userId: string) => {
  const profile = await prisma.studentProfile.findFirst({
    where: { userId, ...liveStudentWhere },
    select: studentDetailSelect,
  });
  if (profile === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Student profile not found');
  }
  return profile;
};

const getMe = async (userId: string) => requireOwnProfile(userId);

const updateMe = async (userId: string, input: StudentMePatch) => {
  const profile = await requireOwnProfile(userId);
  return prisma.studentProfile.update({
    where: { id: profile.id },
    data: {
      ...(input.guardianName !== undefined ? { guardianName: input.guardianName } : {}),
      ...(input.guardianPhone !== undefined ? { guardianPhone: input.guardianPhone } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
    },
    select: studentDetailSelect,
  });
};

const listStudents = async (
  query: PaginationQuery & {
    programId?: string | undefined;
    batch?: string | undefined;
    status?: string | undefined;
    search?: string | undefined;
  },
) => {
  const pagination = paginate(query, STUDENT_SORT_FIELDS);
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
      ...(query.programId !== undefined ? { programId: query.programId } : {}),
      ...(query.batch !== undefined ? { batch: query.batch } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    },
    extra: [
      { user: { deletedAt: null } },
      ...(matchedUserIds !== undefined ? [{ userId: { in: matchedUserIds } }] : []),
    ],
  }) as Prisma.StudentProfileWhereInput;

  const [data, total] = await prisma.$transaction([
    prisma.studentProfile.findMany({
      where,
      select: STUDENT_LIST_SELECT,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.studentProfile.count({ where }),
  ]);

  return { data, meta: paginationMeta(pagination.page, pagination.limit, total) };
};

const getById = async (id: string) => {
  const profile = await prisma.studentProfile.findFirst({
    where: { id, ...liveStudentWhere },
    select: studentDetailSelect,
  });
  if (profile === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Student not found');
  }
  return profile;
};

const adminUpdate = async (id: string, input: StudentAdminPatch) => {
  await getById(id);
  if (input.programId !== undefined) {
    const program = await prisma.program.findFirst({
      where: { id: input.programId, deletedAt: null },
      select: { id: true },
    });
    if (program === null) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Program not found');
    }
  }
  return prisma.studentProfile.update({
    where: { id },
    data: {
      ...(input.programId !== undefined ? { programId: input.programId } : {}),
      ...(input.batch !== undefined ? { batch: input.batch } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    select: studentDetailSelect,
  });
};

export const StudentService = {
  getMe,
  updateMe,
  listStudents,
  getById,
  adminUpdate,
};
