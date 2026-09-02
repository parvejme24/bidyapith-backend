import { AuditAction, CourseType, Prisma, StudentStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { CACHE_TTL, cacheKeys } from '../../constants/cache';
import { ApiError } from '../../shared/ApiError';
import { cached, invalidateKeys, queryHash } from '../../shared/cache';
import { paginate, paginationMeta } from '../../shared/paginate';
import { prisma } from '../../shared/prisma';
import { buildWhere } from '../../shared/queryBuilder';
import { getRedis } from '../../shared/redis';
import { createAuditLog } from '../../utils/auditLog';
import { COURSE_CURRICULUM_SELECT, PROGRAM_SELECT, PROGRAM_SORT_FIELDS } from './program.constant';
import type {
  ICurriculumEntry,
  ICurriculumPatch,
  IProgramCreate,
  IProgramListQuery,
  IProgramUpdate,
} from './program.interface';

const money = (value: Prisma.Decimal): string => value.toFixed(2);
const credits = (value: Prisma.Decimal): string => value.toFixed(1);

const serializeProgram = <
  T extends { feePerCredit: Prisma.Decimal; registrationFee: Prisma.Decimal },
>(
  row: T,
) => ({
  ...row,
  feePerCredit: money(row.feePerCredit),
  registrationFee: money(row.registrationFee),
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

const invalidateProgramCache = async (id: string): Promise<void> => {
  await invalidateKeys(cacheKeys.program(id));
  const redis = getRedis();
  if (redis === null) {
    return;
  }
  try {
    const keys = await redis.keys('program:list:*');
    if (keys.length > 0) {
      await redis.del(...keys);
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

const requireLiveProgram = async (id: string) => {
  const program = await prisma.program.findFirst({
    where: { id, deletedAt: null },
    select: PROGRAM_SELECT,
  });
  if (program === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Program not found');
  }
  return program;
};

const assertRecommendedSemester = (recommendedSemester: number, durationYears: number): void => {
  const max = durationYears * 3;
  if (recommendedSemester < 1 || recommendedSemester > max) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `recommendedSemester must be between 1 and ${max} for this program`,
    );
  }
};

const create = async (actorId: string, input: IProgramCreate) => {
  await requireLiveDepartment(input.departmentId);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const program = await tx.program.create({
        data: {
          code: input.code,
          name: input.name,
          departmentId: input.departmentId,
          degreeType: input.degreeType,
          totalCredits: input.totalCredits,
          feePerCredit: new Prisma.Decimal(input.feePerCredit),
          ...(input.durationYears !== undefined ? { durationYears: input.durationYears } : {}),
          ...(input.minCreditsPerSemester !== undefined
            ? { minCreditsPerSemester: input.minCreditsPerSemester }
            : {}),
          ...(input.maxCreditsPerSemester !== undefined
            ? { maxCreditsPerSemester: input.maxCreditsPerSemester }
            : {}),
          ...(input.registrationFee !== undefined
            ? { registrationFee: new Prisma.Decimal(input.registrationFee) }
            : {}),
        },
        select: PROGRAM_SELECT,
      });
      await createAuditLog(tx, {
        actorId,
        action: AuditAction.CREATE,
        entity: 'Program',
        entityId: program.id,
        after: { code: program.code, departmentId: program.departmentId },
      });
      return program;
    });
    await invalidateProgramCache(created.id);
    return serializeProgram(created);
  } catch (error) {
    if (uniqueField(error) !== null) {
      throw new ApiError(StatusCodes.CONFLICT, 'A program with this code already exists');
    }
    throw error;
  }
};

const list = async (query: IProgramListQuery) => {
  const pagination = paginate(query, PROGRAM_SORT_FIELDS);
  const key = `program:list:${queryHash({
    departmentId: query.departmentId,
    degreeType: query.degreeType,
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
  })}`;

  return cached(key, CACHE_TTL.program, async () => {
    const where = buildWhere({
      searchFields: [],
      filters: {
        ...(query.departmentId !== undefined ? { departmentId: query.departmentId } : {}),
        ...(query.degreeType !== undefined ? { degreeType: query.degreeType } : {}),
      },
    }) as Prisma.ProgramWhereInput;

    const [rows, total] = await prisma.$transaction([
      prisma.program.findMany({
        where,
        select: PROGRAM_SELECT,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: pagination.orderBy,
      }),
      prisma.program.count({ where }),
    ]);

    return {
      data: rows.map(serializeProgram),
      meta: paginationMeta(pagination.page, pagination.limit, total),
    };
  });
};

const getById = async (id: string) =>
  cached(cacheKeys.program(id), CACHE_TTL.program, async () =>
    serializeProgram(await requireLiveProgram(id)),
  );

const update = async (actorId: string, id: string, input: IProgramUpdate) => {
  const existing = await requireLiveProgram(id);
  if (input.departmentId !== undefined) {
    await requireLiveDepartment(input.departmentId);
  }

  const nextMin = input.minCreditsPerSemester ?? existing.minCreditsPerSemester;
  const nextMax = input.maxCreditsPerSemester ?? existing.maxCreditsPerSemester;
  if (nextMax < nextMin) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'maxCreditsPerSemester must be greater than or equal to minCreditsPerSemester',
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const program = await tx.program.update({
        where: { id },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
          ...(input.degreeType !== undefined ? { degreeType: input.degreeType } : {}),
          ...(input.totalCredits !== undefined ? { totalCredits: input.totalCredits } : {}),
          ...(input.durationYears !== undefined ? { durationYears: input.durationYears } : {}),
          ...(input.minCreditsPerSemester !== undefined
            ? { minCreditsPerSemester: input.minCreditsPerSemester }
            : {}),
          ...(input.maxCreditsPerSemester !== undefined
            ? { maxCreditsPerSemester: input.maxCreditsPerSemester }
            : {}),
          ...(input.feePerCredit !== undefined
            ? { feePerCredit: new Prisma.Decimal(input.feePerCredit) }
            : {}),
          ...(input.registrationFee !== undefined
            ? { registrationFee: new Prisma.Decimal(input.registrationFee) }
            : {}),
        },
        select: PROGRAM_SELECT,
      });
      await createAuditLog(tx, {
        actorId,
        action: AuditAction.UPDATE,
        entity: 'Program',
        entityId: id,
        before: { code: existing.code },
        after: { code: program.code },
      });
      return program;
    });
    await invalidateProgramCache(id);
    return serializeProgram(updated);
  } catch (error) {
    if (uniqueField(error) !== null) {
      throw new ApiError(StatusCodes.CONFLICT, 'A program with this code already exists');
    }
    throw error;
  }
};

const softDelete = async (actorId: string, id: string) => {
  const existing = await requireLiveProgram(id);
  const activeStudents = await prisma.studentProfile.count({
    where: {
      programId: id,
      deletedAt: null,
      status: { notIn: [StudentStatus.GRADUATED, StudentStatus.WITHDRAWN] },
    },
  });
  if (activeStudents > 0) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot delete this program because ${activeStudents} student profile(s) still reference it with a status other than GRADUATED or WITHDRAWN.`,
    );
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const program = await tx.program.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: PROGRAM_SELECT,
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.DELETE,
      entity: 'Program',
      entityId: id,
      after: { code: existing.code },
    });
    return program;
  });
  await invalidateProgramCache(id);
  return serializeProgram(deleted);
};

const getCurriculum = async (id: string) => {
  const program = await requireLiveProgram(id);
  const entries = await prisma.programCourse.findMany({
    where: { programId: id, course: { deletedAt: null } },
    select: {
      type: true,
      recommendedSemester: true,
      course: { select: COURSE_CURRICULUM_SELECT },
    },
    orderBy: [{ recommendedSemester: 'asc' }, { course: { code: 'asc' } }],
  });

  const bySemester = new Map<
    number,
    { recommendedSemester: number; totalCredits: Prisma.Decimal; courses: unknown[] }
  >();
  let overall = new Prisma.Decimal(0);
  let core = new Prisma.Decimal(0);

  for (const entry of entries) {
    const courseCredits = entry.course.credits;
    overall = overall.add(courseCredits);
    if (entry.type === CourseType.CORE) {
      core = core.add(courseCredits);
    }

    const bucket = bySemester.get(entry.recommendedSemester) ?? {
      recommendedSemester: entry.recommendedSemester,
      totalCredits: new Prisma.Decimal(0),
      courses: [],
    };
    bucket.totalCredits = bucket.totalCredits.add(courseCredits);
    bucket.courses.push({
      ...entry.course,
      credits: credits(entry.course.credits),
      curriculumType: entry.type,
    });
    bySemester.set(entry.recommendedSemester, bucket);
  }

  const semesters = [...bySemester.values()].map((bucket) => ({
    recommendedSemester: bucket.recommendedSemester,
    totalCredits: credits(bucket.totalCredits),
    courses: bucket.courses,
  }));

  return {
    programId: program.id,
    programCode: program.code,
    totalCreditsRequired: program.totalCredits,
    overallCredits: credits(overall),
    coreCredits: credits(core),
    coreMeetsProgramTotal: core.gte(program.totalCredits),
    semesters,
  };
};

const addCourse = async (actorId: string, programId: string, input: ICurriculumEntry) => {
  const program = await requireLiveProgram(programId);
  const recommendedSemester = input.recommendedSemester ?? 1;
  assertRecommendedSemester(recommendedSemester, program.durationYears);

  const course = await prisma.course.findFirst({
    where: { id: input.courseId, deletedAt: null },
    select: { id: true, code: true },
  });
  if (course === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Course not found');
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.programCourse.create({
        data: {
          programId,
          courseId: input.courseId,
          recommendedSemester,
          ...(input.type !== undefined ? { type: input.type } : {}),
        },
        select: {
          type: true,
          recommendedSemester: true,
          course: { select: COURSE_CURRICULUM_SELECT },
        },
      });
      await createAuditLog(tx, {
        actorId,
        action: AuditAction.CREATE,
        entity: 'ProgramCourse',
        entityId: programId,
        after: { courseId: input.courseId, recommendedSemester },
      });
      return entry;
    });
    await invalidateProgramCache(programId);
    return {
      ...created,
      course: { ...created.course, credits: credits(created.course.credits) },
    };
  } catch (error) {
    if (uniqueField(error) !== null) {
      throw new ApiError(StatusCodes.CONFLICT, 'This course is already on the program curriculum');
    }
    throw error;
  }
};

const patchCourse = async (
  actorId: string,
  programId: string,
  courseId: string,
  input: ICurriculumPatch,
) => {
  const program = await requireLiveProgram(programId);
  if (input.recommendedSemester !== undefined) {
    assertRecommendedSemester(input.recommendedSemester, program.durationYears);
  }

  const existing = await prisma.programCourse.findUnique({
    where: { programId_courseId: { programId, courseId } },
    select: { id: true },
  });
  if (existing === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Curriculum entry not found');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const entry = await tx.programCourse.update({
      where: { programId_courseId: { programId, courseId } },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.recommendedSemester !== undefined
          ? { recommendedSemester: input.recommendedSemester }
          : {}),
      },
      select: {
        type: true,
        recommendedSemester: true,
        course: { select: COURSE_CURRICULUM_SELECT },
      },
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.UPDATE,
      entity: 'ProgramCourse',
      entityId: programId,
      after: {
        courseId,
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.recommendedSemester !== undefined
          ? { recommendedSemester: input.recommendedSemester }
          : {}),
      },
    });
    return entry;
  });
  await invalidateProgramCache(programId);
  return {
    ...updated,
    course: { ...updated.course, credits: credits(updated.course.credits) },
  };
};

const removeCourse = async (actorId: string, programId: string, courseId: string) => {
  await requireLiveProgram(programId);
  const existing = await prisma.programCourse.findUnique({
    where: { programId_courseId: { programId, courseId } },
    select: { id: true },
  });
  if (existing === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Curriculum entry not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.programCourse.delete({
      where: { programId_courseId: { programId, courseId } },
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.DELETE,
      entity: 'ProgramCourse',
      entityId: programId,
      after: { courseId },
    });
  });
  await invalidateProgramCache(programId);
  return null;
};

export const ProgramService = {
  create,
  list,
  getById,
  update,
  softDelete,
  getCurriculum,
  addCourse,
  patchCourse,
  removeCourse,
};
