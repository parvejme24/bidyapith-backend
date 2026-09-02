import {
  AuditAction,
  type DayOfWeek,
  EnrollmentStatus,
  OfferingStatus,
  Prisma,
  SemesterStatus,
} from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { paginate, paginationMeta } from '../../shared/paginate';
import { prisma } from '../../shared/prisma';
import { buildWhere } from '../../shared/queryBuilder';
import { createAuditLog } from '../../utils/auditLog';
import { findConflicts, overlaps, type TimeSlot } from '../../utils/scheduleConflict';
import {
  isLegalOfferingTransition,
  OFFERING_DETAIL_SELECT,
  OFFERING_SELECT,
  OFFERING_SORT_FIELDS,
} from './offering.constant';
import type {
  IMyTeachingQuery,
  IOfferingCreate,
  IOfferingListQuery,
  IOfferingScheduleInput,
  IOfferingUpdate,
} from './offering.interface';

const credits = (value: Prisma.Decimal): string => value.toFixed(1);

const instructorDisplayName = (firstName: string, lastName: string): string =>
  `${firstName} ${lastName}`.trim();

const formatSlot = (slot: TimeSlot): string =>
  `${slot.dayOfWeek} ${slot.startTime}–${slot.endTime}`;

const serializeInstructor = (
  instructor: {
    id: string;
    employeeId: string;
    designation: string;
    user: { firstName: string; lastName: string };
  } | null,
) => {
  if (instructor === null) {
    return null;
  }
  return {
    id: instructor.id,
    employeeId: instructor.employeeId,
    designation: instructor.designation,
    firstName: instructor.user.firstName,
    lastName: instructor.user.lastName,
    name: instructorDisplayName(instructor.user.firstName, instructor.user.lastName),
  };
};

const serializeOffering = <
  T extends {
    createdAt: Date;
    updatedAt: Date;
    capacity: number;
    enrolledCount: number;
    course: { credits: Prisma.Decimal };
    instructor: {
      id: string;
      employeeId: string;
      designation: string;
      user: { firstName: string; lastName: string };
    } | null;
  },
>(
  row: T,
) => {
  const { instructor, course, ...rest } = row;
  return {
    ...rest,
    seatsRemaining: row.capacity - row.enrolledCount,
    course: { ...course, credits: credits(course.credits) },
    instructor: serializeInstructor(instructor),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
};

const uniqueConstraint = (error: unknown): string | null => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return null;
  }
  const target = error.meta?.['target'];
  const fields = Array.isArray(target)
    ? target.map(String)
    : typeof target === 'string'
      ? [target]
      : [];
  const joined = fields.join(',').toLowerCase();
  if (joined.includes('section') || joined.includes('course')) {
    return 'section';
  }
  if (joined.includes('day') || joined.includes('start')) {
    return 'schedule';
  }
  return 'field';
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

const SLOT_SELECT = {
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  room: true,
  offering: {
    select: {
      id: true,
      room: true,
      instructorId: true,
      course: { select: { code: true } },
    },
  },
} as const;

type LoadedSlot = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room: string | null;
  offering: {
    id: string;
    room: string | null;
    instructorId: string | null;
    course: { code: string };
  };
};

type AnnotatedSlot = TimeSlot & {
  courseCode: string;
  room: string | null;
  instructorId: string | null;
};

const toAnnotated = (slot: LoadedSlot): AnnotatedSlot => ({
  dayOfWeek: slot.dayOfWeek,
  startTime: slot.startTime,
  endTime: slot.endTime,
  courseCode: slot.offering.course.code,
  room: slot.room ?? slot.offering.room,
  instructorId: slot.offering.instructorId,
});

const loadSemesterSlots = async (
  db: Prisma.TransactionClient | typeof prisma,
  semesterId: string,
  excludeOfferingId?: string,
): Promise<AnnotatedSlot[]> => {
  const rows = await db.classSchedule.findMany({
    where: {
      offering: {
        semesterId,
        deletedAt: null,
        status: { not: OfferingStatus.CANCELLED },
        ...(excludeOfferingId !== undefined ? { id: { not: excludeOfferingId } } : {}),
      },
    },
    select: SLOT_SELECT,
  });
  return rows.map(toAnnotated);
};

const assertNoSelfOverlap = (slots: TimeSlot[]): void => {
  for (let i = 0; i < slots.length; i += 1) {
    const left = slots[i];
    if (left === undefined) {
      continue;
    }
    for (let j = i + 1; j < slots.length; j += 1) {
      const right = slots[j];
      if (right !== undefined && overlaps(left, right)) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          `Schedule slots overlap on ${formatSlot(left)} and ${formatSlot(right)}`,
        );
      }
    }
  }
};

const assertInstructorConflict = (
  name: string,
  instructorId: string,
  candidate: TimeSlot[],
  existing: AnnotatedSlot[],
): void => {
  const conflicts = findConflicts(
    candidate,
    existing.filter((slot) => slot.instructorId === instructorId),
  );
  const hit = conflicts[0];
  if (hit === undefined) {
    return;
  }
  throw new ApiError(
    StatusCodes.CONFLICT,
    `${name} already teaches ${hit.courseCode} on ${formatSlot(hit)}`,
  );
};

const assertRoomConflict = (candidate: AnnotatedSlot[], existing: AnnotatedSlot[]): void => {
  for (const slot of candidate) {
    if (slot.room === null) {
      continue;
    }
    const conflicts = findConflicts(
      [slot],
      existing.filter((item) => item.room === slot.room),
    );
    const hit = conflicts[0];
    if (hit !== undefined) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `Room ${slot.room} is already used by ${hit.courseCode} on ${formatSlot(hit)}`,
      );
    }
  }
};

const candidateRooms = (
  slots: IOfferingScheduleInput[],
  offeringRoom: string | null,
  courseCode: string,
  instructorId: string | null,
): AnnotatedSlot[] =>
  slots.map((slot) => ({
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    courseCode,
    room: slot.room ?? offeringRoom,
    instructorId,
  }));

const writableSemester = (status: SemesterStatus): boolean =>
  status !== SemesterStatus.COMPLETED && status !== SemesterStatus.CANCELLED;

const cancellableSemester = (status: SemesterStatus): boolean =>
  status === SemesterStatus.UPCOMING || status === SemesterStatus.REGISTRATION;

const requireLiveInstructor = async (
  db: Prisma.TransactionClient | typeof prisma,
  instructorId: string,
) => {
  const instructor = await db.instructorProfile.findFirst({
    where: { id: instructorId, deletedAt: null, user: { deletedAt: null } },
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });
  if (instructor === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Instructor not found');
  }
  return instructor;
};

const requireLiveOffering = async (id: string) => {
  const offering = await prisma.courseOffering.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...OFFERING_SELECT,
      semester: { select: { id: true, status: true, name: true } },
      schedules: {
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          room: true,
        },
      },
    },
  });
  if (offering === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Offering not found');
  }
  return offering;
};

const runSerializable = async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
  try {
    return await prisma.$transaction(fn, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'The offering was changed concurrently; please retry',
      );
    }
    throw error;
  }
};

const cancelInTransaction = async (
  tx: Prisma.TransactionClient,
  actorId: string,
  offering: { id: string; status: OfferingStatus; semester: { status: SemesterStatus } },
  softDelete: boolean,
) => {
  if (!cancellableSemester(offering.semester.status)) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'An offering can only be cancelled while the semester is UPCOMING or REGISTRATION',
    );
  }
  if (offering.status === OfferingStatus.CANCELLED) {
    throw new ApiError(StatusCodes.CONFLICT, 'Offering is already cancelled');
  }

  // Invoice adjustment for dropped students is the invoice module's job.
  // Do not create credit notes or rewrite invoices here.
  await tx.enrollment.updateMany({
    where: { offeringId: offering.id, status: EnrollmentStatus.ENROLLED },
    data: { status: EnrollmentStatus.DROPPED, droppedAt: new Date() },
  });

  const updated = await tx.courseOffering.update({
    where: { id: offering.id },
    data: {
      status: OfferingStatus.CANCELLED,
      ...(softDelete ? { deletedAt: new Date() } : {}),
    },
    select: OFFERING_SELECT,
  });

  await createAuditLog(tx, {
    actorId,
    action: softDelete ? AuditAction.DELETE : AuditAction.STATUS_CHANGE,
    entity: 'CourseOffering',
    entityId: offering.id,
    before: { status: offering.status },
    after: { status: OfferingStatus.CANCELLED },
  });

  return updated;
};

const create = async (actorId: string, input: IOfferingCreate) => {
  try {
    const created = await runSerializable(async (tx) => {
      const [course, semester] = await Promise.all([
        tx.course.findFirst({
          where: { id: input.courseId, deletedAt: null },
          select: { id: true, code: true },
        }),
        tx.semester.findFirst({
          where: { id: input.semesterId, deletedAt: null },
          select: { id: true, status: true },
        }),
      ]);
      if (course === null) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Course not found');
      }
      if (semester === null) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Semester not found');
      }
      if (!writableSemester(semester.status)) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          `Cannot create an offering in a ${semester.status} semester`,
        );
      }

      let instructorName: string | null = null;
      if (input.instructorId !== undefined) {
        const instructor = await requireLiveInstructor(tx, input.instructorId);
        instructorName = instructorDisplayName(instructor.user.firstName, instructor.user.lastName);
      }

      const schedules = input.schedules ?? [];
      if (schedules.length > 0) {
        const existing = await loadSemesterSlots(tx, input.semesterId);
        const candidate = candidateRooms(
          schedules,
          input.room ?? null,
          course.code,
          input.instructorId ?? null,
        );
        assertNoSelfOverlap(candidate);
        if (input.instructorId !== undefined && instructorName !== null) {
          assertInstructorConflict(instructorName, input.instructorId, candidate, existing);
        }
        assertRoomConflict(candidate, existing);
      }

      const offering = await tx.courseOffering.create({
        data: {
          courseId: input.courseId,
          semesterId: input.semesterId,
          section: input.section,
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          ...(input.room !== undefined ? { room: input.room } : {}),
          ...(input.instructorId !== undefined ? { instructorId: input.instructorId } : {}),
          ...(schedules.length > 0
            ? {
                schedules: {
                  create: schedules.map((slot) => ({
                    dayOfWeek: slot.dayOfWeek,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    ...(slot.room !== undefined ? { room: slot.room } : {}),
                  })),
                },
              }
            : {}),
        },
        select: OFFERING_SELECT,
      });

      await createAuditLog(tx, {
        actorId,
        action: AuditAction.CREATE,
        entity: 'CourseOffering',
        entityId: offering.id,
        after: {
          courseId: offering.courseId,
          semesterId: offering.semesterId,
          section: offering.section,
        },
      });

      return offering;
    });
    return serializeOffering(created);
  } catch (error) {
    if (uniqueConstraint(error) === 'section') {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `Section ${input.section} of this course is already offered in this semester`,
      );
    }
    throw error;
  }
};

const list = async (query: IOfferingListQuery) => {
  const pagination = paginate(query, OFFERING_SORT_FIELDS);

  let courseIds: string[] | undefined;
  const search = query.search?.trim();
  if (search !== undefined && search.length > 0) {
    courseIds = await findCourseIdsBySearch(search);
    if (courseIds.length === 0) {
      return { data: [], meta: paginationMeta(pagination.page, pagination.limit, 0) };
    }
  }

  const extra: Prisma.CourseOfferingWhereInput[] = [];
  if (query.departmentId !== undefined) {
    extra.push({ course: { departmentId: query.departmentId, deletedAt: null } });
  }
  if (courseIds !== undefined) {
    extra.push({ courseId: { in: courseIds } });
  }
  if (query.courseId !== undefined) {
    extra.push({ courseId: query.courseId });
  }
  if (query.hasSeats === true) {
    extra.push({ enrolledCount: { lt: prisma.courseOffering.fields.capacity } });
  }

  const where = buildWhere({
    searchFields: [],
    filters: {
      ...(query.semesterId !== undefined ? { semesterId: query.semesterId } : {}),
      ...(query.instructorId !== undefined ? { instructorId: query.instructorId } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    },
    extra,
  }) as Prisma.CourseOfferingWhereInput;

  const [data, total] = await prisma.$transaction([
    prisma.courseOffering.findMany({
      where,
      select: OFFERING_SELECT,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.courseOffering.count({ where }),
  ]);

  return {
    data: data.map(serializeOffering),
    meta: paginationMeta(pagination.page, pagination.limit, total),
  };
};

const listMyTeaching = async (userId: string, query: IMyTeachingQuery) => {
  const profile = await prisma.instructorProfile.findFirst({
    where: { userId, deletedAt: null, user: { deletedAt: null } },
    select: { id: true },
  });
  if (profile === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Instructor profile not found');
  }

  return list({
    ...query,
    instructorId: profile.id,
  });
};

const getById = async (id: string) => {
  const offering = await prisma.courseOffering.findFirst({
    where: { id, deletedAt: null },
    select: OFFERING_DETAIL_SELECT,
  });
  if (offering === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Offering not found');
  }
  return serializeOffering(offering);
};

const update = async (actorId: string, id: string, input: IOfferingUpdate) => {
  const existing = await requireLiveOffering(id);

  if (input.capacity !== undefined && input.capacity < existing.enrolledCount) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot reduce capacity to ${input.capacity} because ${existing.enrolledCount} students are already enrolled`,
    );
  }

  if (input.section !== undefined && existing.enrolledCount > 0) {
    throw new ApiError(StatusCodes.CONFLICT, 'Section can only change while enrolledCount is 0');
  }

  const roomChanging = input.room !== undefined && input.room !== existing.room;

  try {
    const updated = await runSerializable(async (tx) => {
      if (roomChanging) {
        const nextRoom = input.room ?? null;
        if (nextRoom !== null && existing.schedules.length > 0) {
          const existingSlots = await loadSemesterSlots(tx, existing.semesterId, existing.id);
          const candidate = existing.schedules.map((slot) => ({
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            courseCode: existing.course.code,
            room: slot.room ?? nextRoom,
            instructorId: existing.instructorId,
          }));
          assertRoomConflict(candidate, existingSlots);
        }
      }

      const offering = await tx.courseOffering.update({
        where: { id },
        data: {
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          ...(input.room !== undefined ? { room: input.room } : {}),
          ...(input.section !== undefined ? { section: input.section } : {}),
        },
        select: OFFERING_SELECT,
      });

      await createAuditLog(tx, {
        actorId,
        action: AuditAction.UPDATE,
        entity: 'CourseOffering',
        entityId: id,
        before: {
          capacity: existing.capacity,
          room: existing.room,
          section: existing.section,
        },
        after: {
          capacity: offering.capacity,
          room: offering.room,
          section: offering.section,
        },
      });

      return offering;
    });
    return serializeOffering(updated);
  } catch (error) {
    if (uniqueConstraint(error) === 'section') {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `Section ${input.section ?? existing.section} of this course is already offered in this semester`,
      );
    }
    throw error;
  }
};

const assignInstructor = async (actorId: string, id: string, instructorId: string | null) => {
  const existing = await requireLiveOffering(id);

  const updated = await runSerializable(async (tx) => {
    if (instructorId !== null) {
      const instructor = await requireLiveInstructor(tx, instructorId);
      if (existing.schedules.length > 0) {
        const existingSlots = await loadSemesterSlots(tx, existing.semesterId, existing.id);
        assertInstructorConflict(
          instructorDisplayName(instructor.user.firstName, instructor.user.lastName),
          instructorId,
          existing.schedules,
          existingSlots,
        );
      }
    }

    const offering = await tx.courseOffering.update({
      where: { id },
      data: { instructorId },
      select: OFFERING_SELECT,
    });

    await createAuditLog(tx, {
      actorId,
      action: AuditAction.UPDATE,
      entity: 'CourseOffering',
      entityId: id,
      before: { instructorId: existing.instructorId },
      after: { instructorId },
    });

    return offering;
  });

  return serializeOffering(updated);
};

const changeStatus = async (actorId: string, id: string, next: OfferingStatus) => {
  const existing = await requireLiveOffering(id);

  if (next === OfferingStatus.CANCELLED) {
    const cancelled = await runSerializable((tx) =>
      cancelInTransaction(tx, actorId, existing, false),
    );
    return serializeOffering(cancelled);
  }

  if (!isLegalOfferingTransition(existing.status, next)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot transition offering from ${existing.status} to ${next}`,
    );
  }

  if (next === OfferingStatus.OPEN) {
    if (existing.instructorId === null) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'An offering cannot move to OPEN without an assigned instructor',
      );
    }
    if (existing.schedules.length === 0) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'An offering cannot move to OPEN without at least one schedule slot',
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const offering = await tx.courseOffering.update({
      where: { id },
      data: { status: next },
      select: OFFERING_SELECT,
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.STATUS_CHANGE,
      entity: 'CourseOffering',
      entityId: id,
      before: { status: existing.status },
      after: { status: next },
    });
    return offering;
  });

  return serializeOffering(updated);
};

const addSchedule = async (actorId: string, id: string, input: IOfferingScheduleInput) => {
  const existing = await requireLiveOffering(id);
  if (
    existing.status === OfferingStatus.CANCELLED ||
    existing.status === OfferingStatus.COMPLETED
  ) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot add a schedule to a ${existing.status} offering`,
    );
  }

  try {
    const created = await runSerializable(async (tx) => {
      const existingSlots = await loadSemesterSlots(tx, existing.semesterId, existing.id);
      const selfSlots = existing.schedules.map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }));
      const candidateSlot: TimeSlot = {
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
      };
      assertNoSelfOverlap([...selfSlots, candidateSlot]);

      if (existing.instructorId !== null && existing.instructor !== null) {
        assertInstructorConflict(
          instructorDisplayName(
            existing.instructor.user.firstName,
            existing.instructor.user.lastName,
          ),
          existing.instructorId,
          [candidateSlot],
          existingSlots,
        );
      }

      const room = input.room ?? existing.room;
      if (room !== null) {
        assertRoomConflict(
          [
            {
              ...candidateSlot,
              courseCode: existing.course.code,
              room,
              instructorId: existing.instructorId,
            },
          ],
          existingSlots,
        );
      }

      const schedule = await tx.classSchedule.create({
        data: {
          offeringId: id,
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
          ...(input.room !== undefined ? { room: input.room } : {}),
        },
        select: {
          id: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          room: true,
        },
      });

      await createAuditLog(tx, {
        actorId,
        action: AuditAction.UPDATE,
        entity: 'CourseOffering',
        entityId: id,
        after: {
          scheduleId: schedule.id,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
      });

      return schedule;
    });
    return created;
  } catch (error) {
    if (uniqueConstraint(error) === 'schedule') {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `A schedule slot already exists on ${input.dayOfWeek} at ${input.startTime}`,
      );
    }
    throw error;
  }
};

const removeSchedule = async (actorId: string, offeringId: string, scheduleId: string) => {
  await requireLiveOffering(offeringId);
  const schedule = await prisma.classSchedule.findFirst({
    where: { id: scheduleId, offeringId },
    select: { id: true, dayOfWeek: true, startTime: true },
  });
  if (schedule === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Schedule slot not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.classSchedule.delete({ where: { id: scheduleId } });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.DELETE,
      entity: 'ClassSchedule',
      entityId: scheduleId,
      after: {
        offeringId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
      },
    });
  });

  return { id: scheduleId };
};

const softDelete = async (actorId: string, id: string) => {
  const existing = await requireLiveOffering(id);
  const cancelled = await runSerializable((tx) => cancelInTransaction(tx, actorId, existing, true));
  return serializeOffering(cancelled);
};

export const OfferingService = {
  create,
  list,
  listMyTeaching,
  getById,
  update,
  assignInstructor,
  changeStatus,
  addSchedule,
  removeSchedule,
  softDelete,
};
