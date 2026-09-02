import { AuditAction, Prisma, SemesterStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { CACHE_TTL, cacheKeys } from '../../constants/cache';
import { ApiError } from '../../shared/ApiError';
import { cached, queryHash } from '../../shared/cache';
import { paginate, paginationMeta } from '../../shared/paginate';
import { prisma } from '../../shared/prisma';
import { buildWhere } from '../../shared/queryBuilder';
import { getRedis } from '../../shared/redis';
import { createAuditLog } from '../../utils/auditLog';
import { PrerequisiteService } from '../prerequisite/prerequisite.service';
import { COURSE_SELECT, COURSE_SORT_FIELDS } from './course.constant';
import type { ICourseCreate, ICourseListQuery, ICourseUpdate } from './course.interface';

const credits = (value: Prisma.Decimal): string => value.toFixed(1);

const serializeCourse = <T extends { credits: Prisma.Decimal }>(row: T) => ({
  ...row,
  credits: credits(row.credits),
});

const uniqueField = (error: unknown): string | null => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return null;
  }
  return 'code';
};

const escapeIlike = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

const findCourseIdsBySearch = async (term: string): Promise<string[]> => {
  const trimmed = term.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const pattern = `%${escapeIlike(trimmed)}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM courses
    WHERE deleted_at IS NULL
      AND (code || ' ' || title) ILIKE ${pattern} ESCAPE '\\'
  `;
  return rows.map((row) => row.id);
};

const invalidateCourseCache = async (): Promise<void> => {
  const redis = getRedis();
  if (redis === null) {
    return;
  }
  try {
    const listKeys = await redis.keys('course:list:*');
    if (listKeys.length > 0) {
      await redis.del(...listKeys);
    }
  } catch {
    // ignore
  }
};

const requireLiveDepartment = async (departmentId: string) => {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, deletedAt: null },
    select: { id: true },
  });
  if (department === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Department not found');
  }
};

const requireLiveCourse = async (id: string) => {
  const course = await prisma.course.findFirst({
    where: { id, deletedAt: null },
    select: COURSE_SELECT,
  });
  if (course === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Course not found');
  }
  return course;
};

const create = async (actorId: string, input: ICourseCreate) => {
  await requireLiveDepartment(input.departmentId);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          code: input.code,
          title: input.title,
          credits: new Prisma.Decimal(input.credits),
          departmentId: input.departmentId,
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.level !== undefined ? { level: input.level } : {}),
        },
        select: COURSE_SELECT,
      });
      await createAuditLog(tx, {
        actorId,
        action: AuditAction.CREATE,
        entity: 'Course',
        entityId: course.id,
        after: { code: course.code },
      });
      return course;
    });
    await invalidateCourseCache();
    return serializeCourse(created);
  } catch (error) {
    if (uniqueField(error) !== null) {
      throw new ApiError(StatusCodes.CONFLICT, 'A course with this code already exists');
    }
    throw error;
  }
};

const list = async (query: ICourseListQuery) => {
  const pagination = paginate(query, COURSE_SORT_FIELDS);
  const key = cacheKeys.courseList(
    queryHash({
      search: query.search,
      departmentId: query.departmentId,
      type: query.type,
      level: query.level,
      minCredits: query.minCredits,
      maxCredits: query.maxCredits,
      page: pagination.page,
      limit: pagination.limit,
      sortBy: pagination.sortBy,
      sortOrder: pagination.sortOrder,
    }),
  );

  return cached(key, CACHE_TTL.courseList, async () => {
    const searchTerm = query.search?.trim();
    let matchedIds: string[] | undefined;
    if (searchTerm !== undefined && searchTerm.length > 0) {
      matchedIds = await findCourseIdsBySearch(searchTerm);
      if (matchedIds.length === 0) {
        return { data: [], meta: paginationMeta(pagination.page, pagination.limit, 0) };
      }
    }

    const extra: object[] = [];
    if (matchedIds !== undefined) {
      extra.push({ id: { in: matchedIds } });
    }
    if (query.minCredits !== undefined || query.maxCredits !== undefined) {
      extra.push({
        credits: {
          ...(query.minCredits !== undefined ? { gte: query.minCredits } : {}),
          ...(query.maxCredits !== undefined ? { lte: query.maxCredits } : {}),
        },
      });
    }

    const where = buildWhere({
      searchFields: [],
      filters: {
        ...(query.departmentId !== undefined ? { departmentId: query.departmentId } : {}),
        ...(query.type !== undefined ? { type: query.type } : {}),
        ...(query.level !== undefined ? { level: query.level } : {}),
      },
      extra,
    }) as Prisma.CourseWhereInput;

    const [rows, total] = await prisma.$transaction([
      prisma.course.findMany({
        where,
        select: COURSE_SELECT,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: pagination.orderBy,
      }),
      prisma.course.count({ where }),
    ]);

    return {
      data: rows.map(serializeCourse),
      meta: paginationMeta(pagination.page, pagination.limit, total),
    };
  });
};

const getById = async (id: string) => {
  const course = serializeCourse(await requireLiveCourse(id));
  const tree = await PrerequisiteService.getTree(id);
  return { ...course, prerequisites: tree.prerequisites };
};

const update = async (actorId: string, id: string, input: ICourseUpdate) => {
  const existing = await requireLiveCourse(id);
  if (input.departmentId !== undefined) {
    await requireLiveDepartment(input.departmentId);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const course = await tx.course.update({
        where: { id },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.credits !== undefined ? { credits: new Prisma.Decimal(input.credits) } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.level !== undefined ? { level: input.level } : {}),
          ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
        },
        select: COURSE_SELECT,
      });
      await createAuditLog(tx, {
        actorId,
        action: AuditAction.UPDATE,
        entity: 'Course',
        entityId: id,
        before: { code: existing.code },
        after: { code: course.code },
      });
      return course;
    });
    await invalidateCourseCache();
    return serializeCourse(updated);
  } catch (error) {
    if (uniqueField(error) !== null) {
      throw new ApiError(StatusCodes.CONFLICT, 'A course with this code already exists');
    }
    throw error;
  }
};

const softDelete = async (actorId: string, id: string) => {
  const existing = await requireLiveCourse(id);

  const [liveOfferings, requiredBy] = await Promise.all([
    prisma.courseOffering.count({
      where: {
        courseId: id,
        deletedAt: null,
        semester: { status: { not: SemesterStatus.COMPLETED }, deletedAt: null },
      },
    }),
    prisma.coursePrerequisite.count({
      where: { prerequisiteId: id, course: { deletedAt: null } },
    }),
  ]);

  if (liveOfferings > 0 || requiredBy > 0) {
    const blockers: string[] = [];
    if (liveOfferings > 0) {
      blockers.push(`${liveOfferings} offering(s) in a semester that is not COMPLETED`);
    }
    if (requiredBy > 0) {
      blockers.push(`${requiredBy} live course(s) that list it as a prerequisite`);
    }
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot delete this course because it still has ${blockers.join(' and ')}.`,
    );
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const course = await tx.course.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: COURSE_SELECT,
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.DELETE,
      entity: 'Course',
      entityId: id,
      after: { code: existing.code },
    });
    return course;
  });
  await invalidateCourseCache();
  return serializeCourse(deleted);
};

export const CourseService = {
  create,
  list,
  getById,
  update,
  softDelete,
};
