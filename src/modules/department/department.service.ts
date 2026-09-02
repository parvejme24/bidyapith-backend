import { AuditAction, Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { CACHE_TTL, cacheKeys } from '../../constants/cache';
import { ApiError } from '../../shared/ApiError';
import { cached, invalidateKeys, queryHash } from '../../shared/cache';
import { paginate, paginationMeta } from '../../shared/paginate';
import { prisma } from '../../shared/prisma';
import { buildWhere } from '../../shared/queryBuilder';
import { getRedis } from '../../shared/redis';
import { createAuditLog } from '../../utils/auditLog';
import {
  DEPARTMENT_SELECT,
  DEPARTMENT_SORT_FIELDS,
  PROGRAM_SUMMARY_SELECT,
} from './department.constant';
import type {
  IDepartmentCreate,
  IDepartmentListQuery,
  IDepartmentUpdate,
} from './department.interface';

const serializeDepartment = <T extends { createdAt: Date; updatedAt: Date }>(row: T) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const uniqueField = (error: unknown): string | null => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return null;
  }
  const target = error.meta?.['target'];
  if (Array.isArray(target) && typeof target[0] === 'string') {
    return target[0];
  }
  if (typeof target === 'string') {
    return target;
  }
  return 'field';
};

const invalidateDepartmentCache = async (id: string): Promise<void> => {
  await invalidateKeys(`department:${id}`);
  const redis = getRedis();
  if (redis === null) {
    return;
  }
  try {
    const keys = await redis.keys(`${cacheKeys.departmentList}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Redis down — ignore invalidation failures.
  }
};

const create = async (actorId: string, input: IDepartmentCreate) => {
  try {
    const created = await prisma.$transaction(async (tx) => {
      const department = await tx.department.create({
        data: {
          code: input.code,
          name: input.name,
          ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
        },
        select: DEPARTMENT_SELECT,
      });
      await createAuditLog(tx, {
        actorId,
        action: AuditAction.CREATE,
        entity: 'Department',
        entityId: department.id,
        after: { code: department.code, name: department.name },
      });
      return department;
    });
    await invalidateDepartmentCache(created.id);
    return serializeDepartment(created);
  } catch (error) {
    const field = uniqueField(error);
    if (field !== null) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        field.includes('name')
          ? 'A department with this name already exists'
          : 'A department with this code already exists',
      );
    }
    throw error;
  }
};

const list = async (query: IDepartmentListQuery) => {
  const pagination = paginate(query, DEPARTMENT_SORT_FIELDS);
  const key = `${cacheKeys.departmentList}:${queryHash({
    search: query.search,
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
  })}`;

  return cached(key, CACHE_TTL.departmentList, async () => {
    const where = buildWhere({
      search: query.search,
      searchFields: ['code', 'name'],
      extra: [],
    }) as Prisma.DepartmentWhereInput;

    const [data, total] = await prisma.$transaction([
      prisma.department.findMany({
        where,
        select: DEPARTMENT_SELECT,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: pagination.orderBy,
      }),
      prisma.department.count({ where }),
    ]);

    return {
      data: data.map(serializeDepartment),
      meta: paginationMeta(pagination.page, pagination.limit, total),
    };
  });
};

const getById = async (id: string) =>
  cached(`department:${id}`, CACHE_TTL.departmentList, async () => {
    const department = await prisma.department.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...DEPARTMENT_SELECT,
        programs: {
          where: { deletedAt: null },
          select: PROGRAM_SUMMARY_SELECT,
          orderBy: { code: 'asc' },
        },
      },
    });
    if (department === null) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Department not found');
    }

    const [courseCount, instructorCount] = await Promise.all([
      prisma.course.count({ where: { departmentId: id, deletedAt: null } }),
      prisma.instructorProfile.count({ where: { departmentId: id, deletedAt: null } }),
    ]);

    return { ...serializeDepartment(department), courseCount, instructorCount };
  });

const update = async (actorId: string, id: string, input: IDepartmentUpdate) => {
  const existing = await prisma.department.findFirst({
    where: { id, deletedAt: null },
    select: DEPARTMENT_SELECT,
  });
  if (existing === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Department not found');
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const department = await tx.department.update({
        where: { id },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
        },
        select: DEPARTMENT_SELECT,
      });
      await createAuditLog(tx, {
        actorId,
        action: AuditAction.UPDATE,
        entity: 'Department',
        entityId: id,
        before: { code: existing.code, name: existing.name },
        after: { code: department.code, name: department.name },
      });
      return department;
    });
    await invalidateDepartmentCache(id);
    return serializeDepartment(updated);
  } catch (error) {
    const field = uniqueField(error);
    if (field !== null) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        field.includes('name')
          ? 'A department with this name already exists'
          : 'A department with this code already exists',
      );
    }
    throw error;
  }
};

const softDelete = async (actorId: string, id: string) => {
  const existing = await prisma.department.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, code: true },
  });
  if (existing === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Department not found');
  }

  const [programs, courses, instructors] = await Promise.all([
    prisma.program.count({ where: { departmentId: id, deletedAt: null } }),
    prisma.course.count({ where: { departmentId: id, deletedAt: null } }),
    prisma.instructorProfile.count({ where: { departmentId: id, deletedAt: null } }),
  ]);

  if (programs > 0 || courses > 0 || instructors > 0) {
    const blockers: string[] = [];
    if (programs > 0) {
      blockers.push(`${programs} program(s)`);
    }
    if (courses > 0) {
      blockers.push(`${courses} course(s)`);
    }
    if (instructors > 0) {
      blockers.push(`${instructors} instructor(s)`);
    }
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot delete this department because it still has ${blockers.join(', ')}.`,
    );
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const department = await tx.department.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: DEPARTMENT_SELECT,
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.DELETE,
      entity: 'Department',
      entityId: id,
      after: { code: existing.code },
    });
    return department;
  });
  await invalidateDepartmentCache(id);
  return serializeDepartment(deleted);
};

export const DepartmentService = {
  create,
  list,
  getById,
  update,
  softDelete,
};
