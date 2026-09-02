import { AuditAction, OfferingStatus, Prisma, SemesterStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import {
  CURRENT_SEMESTER_CACHE_KEY,
  CURRENT_SEMESTER_CACHE_TTL_SECONDS,
  isLegalSemesterTransition,
} from '../../constants/semester';
import { ApiError } from '../../shared/ApiError';
import { cached, invalidateKeys } from '../../shared/cache';
import { paginate, paginationMeta } from '../../shared/paginate';
import { prisma } from '../../shared/prisma';
import { buildWhere } from '../../shared/queryBuilder';
import { createAuditLog } from '../../utils/auditLog';
import {
  EDITABLE_SEMESTER_STATUSES,
  type ISemesterDateFields,
  SEMESTER_DATE_ORDER_MESSAGE,
  SEMESTER_SELECT,
  SEMESTER_SORT_FIELDS,
  semesterDatesInOrder,
  semesterDisplayName,
} from './semester.constant';
import type { ISemesterCreate, ISemesterListQuery, ISemesterUpdate } from './semester.interface';

const serializeSemester = <
  T extends {
    registrationStart: Date;
    registrationEnd: Date;
    dropDeadline: Date;
    classStartDate: Date;
    classEndDate: Date;
    resultPublishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  row: T,
) => ({
  ...row,
  registrationStart: row.registrationStart.toISOString(),
  registrationEnd: row.registrationEnd.toISOString(),
  dropDeadline: row.dropDeadline.toISOString(),
  classStartDate: row.classStartDate.toISOString(),
  classEndDate: row.classEndDate.toISOString(),
  resultPublishedAt: row.resultPublishedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const uniqueField = (error: unknown): string | null => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return null;
  }
  const target = error.meta?.['target'];
  if (Array.isArray(target) && target.some((field) => field === 'term' || field === 'year')) {
    return 'term_year';
  }
  if (typeof target === 'string' && (target.includes('term') || target.includes('year'))) {
    return 'term_year';
  }
  return 'field';
};

const invalidateCurrentSemesterCache = async (): Promise<void> => {
  await invalidateKeys(CURRENT_SEMESTER_CACHE_KEY);
};

const requireLiveSemester = async (id: string) => {
  const semester = await prisma.semester.findFirst({
    where: { id, deletedAt: null },
    select: SEMESTER_SELECT,
  });
  if (semester === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Semester not found');
  }
  return semester;
};

const currentFlags = (
  semester: {
    status: SemesterStatus;
    registrationStart: Date;
    registrationEnd: Date;
    dropDeadline: Date;
  },
  now: Date,
) => {
  const registrationOpen =
    semester.status === SemesterStatus.REGISTRATION &&
    now >= semester.registrationStart &&
    now <= semester.registrationEnd;
  const dropAllowed =
    (semester.status === SemesterStatus.REGISTRATION ||
      semester.status === SemesterStatus.ONGOING) &&
    now <= semester.dropDeadline;
  const daysUntilRegistrationEnd = Math.max(
    0,
    Math.ceil((semester.registrationEnd.getTime() - now.getTime()) / 86_400_000),
  );
  return { registrationOpen, dropAllowed, daysUntilRegistrationEnd };
};

const assertExamWeights = async (
  tx: Prisma.TransactionClient,
  semesterId: string,
): Promise<void> => {
  const offerings = await tx.courseOffering.findMany({
    where: {
      semesterId,
      deletedAt: null,
      status: { not: OfferingStatus.CANCELLED },
    },
    select: {
      id: true,
      section: true,
      course: { select: { code: true } },
    },
  });
  if (offerings.length === 0) {
    return;
  }

  const exams = await tx.exam.findMany({
    where: {
      offeringId: { in: offerings.map((offering) => offering.id) },
      deletedAt: null,
    },
    select: { offeringId: true, weight: true },
  });

  if (exams.length === 0) {
    return;
  }

  const weightsByOffering = new Map<string, Prisma.Decimal>();
  for (const exam of exams) {
    const current = weightsByOffering.get(exam.offeringId) ?? new Prisma.Decimal(0);
    weightsByOffering.set(exam.offeringId, current.add(exam.weight));
  }

  const failures = offerings
    .filter((offering) => {
      const total = weightsByOffering.get(offering.id);
      return total === undefined || !total.eq(100);
    })
    .map((offering) => {
      const total = weightsByOffering.get(offering.id);
      const label = total === undefined ? 'no exams' : `weights ${total.toFixed(2)}`;
      return `${offering.course.code} ${offering.section} (${label})`;
    });

  if (failures.length > 0) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot move to GRADING because these offerings do not have exam weights totaling 100: ${failures.join(', ')}`,
    );
  }
};

const create = async (actorId: string, input: ISemesterCreate) => {
  if (input.classEndDate <= new Date()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'classEndDate must be in the future');
  }

  const name = semesterDisplayName(input.term, input.year);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const semester = await tx.semester.create({
        data: {
          term: input.term,
          year: input.year,
          name,
          registrationStart: input.registrationStart,
          registrationEnd: input.registrationEnd,
          dropDeadline: input.dropDeadline,
          classStartDate: input.classStartDate,
          classEndDate: input.classEndDate,
        },
        select: SEMESTER_SELECT,
      });
      await createAuditLog(tx, {
        actorId,
        action: AuditAction.CREATE,
        entity: 'Semester',
        entityId: semester.id,
        after: { term: semester.term, year: semester.year, name: semester.name },
      });
      return semester;
    });
    await invalidateCurrentSemesterCache();
    return serializeSemester(created);
  } catch (error) {
    if (uniqueField(error) === 'term_year') {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `A semester for ${semesterDisplayName(input.term, input.year)} already exists`,
      );
    }
    throw error;
  }
};

const list = async (query: ISemesterListQuery) => {
  const pagination = paginate(query, SEMESTER_SORT_FIELDS);
  const where = buildWhere({
    searchFields: [],
    filters: {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.year !== undefined ? { year: query.year } : {}),
    },
  }) as Prisma.SemesterWhereInput;

  const [data, total] = await prisma.$transaction([
    prisma.semester.findMany({
      where,
      select: SEMESTER_SELECT,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.semester.count({ where }),
  ]);

  return {
    data: data.map(serializeSemester),
    meta: paginationMeta(pagination.page, pagination.limit, total),
  };
};

const getCurrent = async () =>
  cached(CURRENT_SEMESTER_CACHE_KEY, CURRENT_SEMESTER_CACHE_TTL_SECONDS, async () => {
    const active = await prisma.semester.findMany({
      where: {
        deletedAt: null,
        status: { in: [SemesterStatus.REGISTRATION, SemesterStatus.ONGOING] },
      },
      select: SEMESTER_SELECT,
      take: 2,
    });

    const current =
      active.find((semester) => semester.status === SemesterStatus.REGISTRATION) ??
      active.find((semester) => semester.status === SemesterStatus.ONGOING);

    if (current === undefined) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        'No semester is currently in registration or ongoing',
      );
    }

    return {
      ...serializeSemester(current),
      ...currentFlags(current, new Date()),
    };
  });

const getById = async (id: string) => {
  const semester = await requireLiveSemester(id);
  const offeringCount = await prisma.courseOffering.count({
    where: { semesterId: id, deletedAt: null },
  });
  return { ...serializeSemester(semester), offeringCount };
};

const update = async (actorId: string, id: string, input: ISemesterUpdate) => {
  const existing = await requireLiveSemester(id);

  if (!EDITABLE_SEMESTER_STATUSES.includes(existing.status)) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Dates can only be edited while the semester is UPCOMING or REGISTRATION (current status is ${existing.status})`,
    );
  }

  const merged: ISemesterDateFields = {
    registrationStart: input.registrationStart ?? existing.registrationStart,
    registrationEnd: input.registrationEnd ?? existing.registrationEnd,
    dropDeadline: input.dropDeadline ?? existing.dropDeadline,
    classStartDate: input.classStartDate ?? existing.classStartDate,
    classEndDate: input.classEndDate ?? existing.classEndDate,
  };

  if (!semesterDatesInOrder(merged)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, SEMESTER_DATE_ORDER_MESSAGE);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const semester = await tx.semester.update({
      where: { id },
      data: {
        ...(input.registrationStart !== undefined
          ? { registrationStart: input.registrationStart }
          : {}),
        ...(input.registrationEnd !== undefined ? { registrationEnd: input.registrationEnd } : {}),
        ...(input.dropDeadline !== undefined ? { dropDeadline: input.dropDeadline } : {}),
        ...(input.classStartDate !== undefined ? { classStartDate: input.classStartDate } : {}),
        ...(input.classEndDate !== undefined ? { classEndDate: input.classEndDate } : {}),
      },
      select: SEMESTER_SELECT,
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.UPDATE,
      entity: 'Semester',
      entityId: id,
      before: {
        registrationStart: existing.registrationStart.toISOString(),
        registrationEnd: existing.registrationEnd.toISOString(),
        dropDeadline: existing.dropDeadline.toISOString(),
        classStartDate: existing.classStartDate.toISOString(),
        classEndDate: existing.classEndDate.toISOString(),
      },
      after: {
        registrationStart: semester.registrationStart.toISOString(),
        registrationEnd: semester.registrationEnd.toISOString(),
        dropDeadline: semester.dropDeadline.toISOString(),
        classStartDate: semester.classStartDate.toISOString(),
        classEndDate: semester.classEndDate.toISOString(),
      },
    });
    return semester;
  });
  await invalidateCurrentSemesterCache();
  return serializeSemester(updated);
};

const changeStatus = async (actorId: string, id: string, next: SemesterStatus) => {
  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.semester.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, name: true, status: true },
        });
        if (existing === null) {
          throw new ApiError(StatusCodes.NOT_FOUND, 'Semester not found');
        }

        const current = existing.status;

        if (next === SemesterStatus.COMPLETED) {
          if (current === SemesterStatus.GRADING) {
            throw new ApiError(
              StatusCodes.CONFLICT,
              'GRADING → COMPLETED happens only through POST /semesters/:id/publish-results in the result module',
            );
          }
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            `Cannot transition semester from ${current} to ${next}`,
          );
        }

        if (!isLegalSemesterTransition(current, next)) {
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            `Cannot transition semester from ${current} to ${next}`,
          );
        }

        if (next === SemesterStatus.REGISTRATION) {
          const openOfferings = await tx.courseOffering.count({
            where: { semesterId: id, status: OfferingStatus.OPEN, deletedAt: null },
          });
          if (openOfferings === 0) {
            throw new ApiError(
              StatusCodes.CONFLICT,
              'Cannot open registration because this semester has no OPEN offerings',
            );
          }

          const otherRegistration = await tx.semester.findFirst({
            where: {
              status: SemesterStatus.REGISTRATION,
              deletedAt: null,
              id: { not: id },
            },
            select: { name: true },
          });
          if (otherRegistration !== null) {
            throw new ApiError(
              StatusCodes.CONFLICT,
              `${otherRegistration.name} is already in REGISTRATION`,
            );
          }
        }

        if (next === SemesterStatus.ONGOING) {
          const otherOngoing = await tx.semester.findFirst({
            where: {
              status: SemesterStatus.ONGOING,
              deletedAt: null,
              id: { not: id },
            },
            select: { name: true },
          });
          if (otherOngoing !== null) {
            throw new ApiError(StatusCodes.CONFLICT, `${otherOngoing.name} is already ONGOING`);
          }

          await tx.courseOffering.updateMany({
            where: { semesterId: id, status: OfferingStatus.OPEN, deletedAt: null },
            data: { status: OfferingStatus.CLOSED },
          });
        }

        if (next === SemesterStatus.GRADING) {
          await assertExamWeights(tx, id);
        }

        const semester = await tx.semester.update({
          where: { id },
          data: { status: next },
          select: SEMESTER_SELECT,
        });

        await createAuditLog(tx, {
          actorId,
          action: AuditAction.STATUS_CHANGE,
          entity: 'Semester',
          entityId: id,
          before: { status: current },
          after: { status: next },
        });

        return semester;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await invalidateCurrentSemesterCache();
    return serializeSemester(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'Semester status was changed concurrently; please retry',
      );
    }
    throw error;
  }
};

const softDelete = async (actorId: string, id: string) => {
  const existing = await requireLiveSemester(id);

  if (
    existing.status === SemesterStatus.ONGOING ||
    existing.status === SemesterStatus.GRADING ||
    existing.status === SemesterStatus.COMPLETED
  ) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot delete a semester in ${existing.status} status`,
    );
  }

  const liveOfferings = await prisma.courseOffering.count({
    where: {
      semesterId: id,
      deletedAt: null,
      status: { not: OfferingStatus.CANCELLED },
    },
  });
  if (liveOfferings > 0) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot delete this semester because it still has ${liveOfferings} offering(s)`,
    );
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const semester = await tx.semester.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: SEMESTER_SELECT,
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.DELETE,
      entity: 'Semester',
      entityId: id,
      after: { name: existing.name, status: existing.status },
    });
    return semester;
  });
  await invalidateCurrentSemesterCache();
  return serializeSemester(deleted);
};

export const SemesterService = {
  create,
  list,
  getCurrent,
  getById,
  update,
  changeStatus,
  remove: softDelete,
  softDelete,
};
