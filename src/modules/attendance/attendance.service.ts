import { randomUUID } from 'node:crypto';
import {
  AttendanceStatus,
  AuditAction,
  DayOfWeek,
  EnrollmentStatus,
  type Prisma,
  SemesterStatus,
} from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { prisma } from '../../shared/prisma';
import { calculateRate } from '../../utils/attendanceRate';
import { createAuditLog } from '../../utils/auditLog';
import { JS_WEEKDAY_TO_DAY, MIN_ATTENDANCE_RATE } from './attendance.constant';
import type { IAttendanceMark } from './attendance.interface';

const toUtcDate = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
};

const startOfUtcDay = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const todayUtc = (): Date => startOfUtcDay(new Date());

const weekdayOf = (iso: string): DayOfWeek => {
  const index = toUtcDate(iso).getUTCDay();
  return JS_WEEKDAY_TO_DAY[index] ?? DayOfWeek.SUNDAY;
};

const requireOfferingForAttendance = async (offeringId: string) => {
  const offering = await prisma.courseOffering.findFirst({
    where: { id: offeringId, deletedAt: null },
    select: {
      id: true,
      instructorId: true,
      semester: {
        select: {
          id: true,
          status: true,
          classStartDate: true,
          classEndDate: true,
        },
      },
      schedules: { select: { dayOfWeek: true } },
    },
  });
  if (offering === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Offering not found');
  }
  return offering;
};

const assertSessionDate = (
  offering: Awaited<ReturnType<typeof requireOfferingForAttendance>>,
  isoDate: string,
): void => {
  const day = toUtcDate(isoDate);
  if (day > todayUtc()) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Attendance date cannot be in the future');
  }
  if (offering.semester.status !== SemesterStatus.ONGOING) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Attendance can only be marked while the semester is ONGOING (current status is ${offering.semester.status})`,
    );
  }
  const start = startOfUtcDay(offering.semester.classStartDate);
  const end = startOfUtcDay(offering.semester.classEndDate);
  if (day < start || day > end) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Date ${isoDate} is outside the class period ${start.toISOString().slice(0, 10)}–${end.toISOString().slice(0, 10)}`,
    );
  }
  const meetingDays = [...new Set(offering.schedules.map((slot) => slot.dayOfWeek))];
  const weekday = weekdayOf(isoDate);
  if (!meetingDays.includes(weekday)) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `No class on ${weekday}. This section meets on ${meetingDays.join(', ') || 'no scheduled days'}`,
    );
  }
};

const upsertAttendanceRows = async (
  tx: Prisma.TransactionClient,
  rows: {
    id: string;
    enrollmentId: string;
    date: string;
    status: AttendanceStatus;
    remarks: string;
    markedById: string;
  }[],
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }
  await tx.$executeRaw`
    INSERT INTO attendances (id, enrollment_id, date, status, remarks, marked_by_id, created_at, updated_at)
    SELECT
      u.id,
      u.enrollment_id,
      u.session_date::date,
      u.status::"AttendanceStatus",
      NULLIF(u.remarks, ''),
      u.marked_by_id,
      NOW(),
      NOW()
    FROM UNNEST(
      ${rows.map((row) => row.id)}::uuid[],
      ${rows.map((row) => row.enrollmentId)}::uuid[],
      ${rows.map((row) => row.date)}::text[],
      ${rows.map((row) => row.status)}::text[],
      ${rows.map((row) => row.remarks)}::text[],
      ${rows.map((row) => row.markedById)}::uuid[]
    ) AS u(id, enrollment_id, session_date, status, remarks, marked_by_id)
    ON CONFLICT (enrollment_id, date)
    DO UPDATE SET
      status = EXCLUDED.status,
      remarks = EXCLUDED.remarks,
      marked_by_id = EXCLUDED.marked_by_id,
      updated_at = NOW()
  `;
};

const updateExamEligible = async (
  tx: Prisma.TransactionClient,
  updates: { id: string; eligible: boolean }[],
): Promise<void> => {
  if (updates.length === 0) {
    return;
  }
  await tx.$executeRaw`
    UPDATE enrollments AS e
    SET exam_eligible = v.eligible, updated_at = NOW()
    FROM UNNEST(
      ${updates.map((row) => row.id)}::uuid[],
      ${updates.map((row) => row.eligible)}::boolean[]
    ) AS v(id, eligible)
    WHERE e.id = v.id
  `;
};

const markSession = async (actorId: string, offeringId: string, input: IAttendanceMark) => {
  const offering = await requireOfferingForAttendance(offeringId);
  assertSessionDate(offering, input.date);

  const roster = await prisma.enrollment.findMany({
    where: { offeringId, status: EnrollmentStatus.ENROLLED },
    select: {
      id: true,
      examEligible: true,
      student: {
        select: {
          studentId: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  const rosterById = new Map(roster.map((row) => [row.id, row]));
  const invalid = input.records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => !rosterById.has(record.enrollmentId));
  if (invalid.length > 0) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'One or more enrollmentIds do not belong to this offering or are not ENROLLED',
      invalid.map(({ record, index }) => ({
        path: `records.${index}.enrollmentId`,
        message: `${record.enrollmentId} is not an ENROLLED student in this offering`,
      })),
    );
  }

  const affectedIds = input.records.map((record) => record.enrollmentId);

  const summary = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT id FROM course_offerings WHERE id = ${offeringId}::uuid FOR UPDATE
    `;

    const existing = await tx.attendance.findMany({
      where: { enrollmentId: { in: affectedIds } },
      select: { enrollmentId: true, date: true, status: true },
    });

    const byEnrollment = new Map<string, { date: string; status: AttendanceStatus }[]>();
    for (const row of existing) {
      const dateKey = startOfUtcDay(row.date).toISOString().slice(0, 10);
      const list = byEnrollment.get(row.enrollmentId) ?? [];
      list.push({ date: dateKey, status: row.status });
      byEnrollment.set(row.enrollmentId, list);
    }

    const previousEligibility = new Map<string, boolean>();
    for (const id of affectedIds) {
      const statuses = (byEnrollment.get(id) ?? []).map((row) => row.status);
      previousEligibility.set(id, calculateRate(statuses, MIN_ATTENDANCE_RATE).eligible);
    }

    await upsertAttendanceRows(
      tx,
      input.records.map((record) => ({
        id: randomUUID(),
        enrollmentId: record.enrollmentId,
        date: input.date,
        status: record.status,
        remarks: record.remarks ?? '',
        markedById: actorId,
      })),
    );

    const eligibilityUpdates: { id: string; eligible: boolean }[] = [];
    const droppedBelow: {
      enrollmentId: string;
      studentId: string;
      name: string;
      rate: number;
    }[] = [];

    for (const record of input.records) {
      const prior = (byEnrollment.get(record.enrollmentId) ?? []).filter(
        (row) => row.date !== input.date,
      );
      prior.push({ date: input.date, status: record.status });
      const next = calculateRate(
        prior.map((row) => row.status),
        MIN_ATTENDANCE_RATE,
      );
      eligibilityUpdates.push({ id: record.enrollmentId, eligible: next.eligible });
      const wasEligible = previousEligibility.get(record.enrollmentId) ?? true;
      if (wasEligible && !next.eligible) {
        const student = rosterById.get(record.enrollmentId);
        droppedBelow.push({
          enrollmentId: record.enrollmentId,
          studentId: student?.student.studentId ?? '',
          name: student
            ? `${student.student.user.firstName} ${student.student.user.lastName}`.trim()
            : '',
          rate: next.rate,
        });
      }
    }

    await updateExamEligible(tx, eligibilityUpdates);
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.UPDATE,
      entity: 'Attendance',
      entityId: offeringId,
      after: { date: input.date, marked: input.records.length },
    });

    const counts = {
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
      EXCUSED: 0,
    };
    for (const record of input.records) {
      counts[record.status] += 1;
    }

    return { counts, droppedBelow };
  });

  return {
    date: input.date,
    marked: input.records.length,
    present: summary.counts.PRESENT,
    late: summary.counts.LATE,
    absent: summary.counts.ABSENT,
    excused: summary.counts.EXCUSED,
    droppedBelowThreshold: summary.droppedBelow,
  };
};

const getSession = async (offeringId: string, isoDate: string) => {
  await requireOfferingForAttendance(offeringId);
  const day = toUtcDate(isoDate);
  const nextDay = new Date(day.getTime() + 86_400_000);

  const records = await prisma.attendance.findMany({
    where: {
      date: { gte: day, lt: nextDay },
      enrollment: { offeringId, status: EnrollmentStatus.ENROLLED },
    },
    select: {
      id: true,
      enrollmentId: true,
      date: true,
      status: true,
      remarks: true,
      enrollment: {
        select: {
          student: {
            select: {
              studentId: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    date: isoDate,
    records: records.map((row) => ({
      id: row.id,
      enrollmentId: row.enrollmentId,
      status: row.status,
      remarks: row.remarks,
      studentId: row.enrollment.student.studentId,
      firstName: row.enrollment.student.user.firstName,
      lastName: row.enrollment.student.user.lastName,
    })),
  };
};

const getSummary = async (offeringId: string) => {
  await requireOfferingForAttendance(offeringId);
  const enrollments = await prisma.enrollment.findMany({
    where: { offeringId, status: EnrollmentStatus.ENROLLED },
    select: {
      id: true,
      examEligible: true,
      student: {
        select: {
          studentId: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  const attendanceRows = await prisma.attendance.findMany({
    where: { enrollmentId: { in: enrollments.map((row) => row.id) } },
    select: { enrollmentId: true, date: true, status: true },
  });
  const byEnrollment = new Map<string, { date: Date; status: AttendanceStatus }[]>();
  for (const row of attendanceRows) {
    const list = byEnrollment.get(row.enrollmentId) ?? [];
    list.push({ date: row.date, status: row.status });
    byEnrollment.set(row.enrollmentId, list);
  }

  return enrollments.map((enrollment) => {
    const sessions = byEnrollment.get(enrollment.id) ?? [];
    const rate = calculateRate(
      sessions.map((row) => row.status),
      MIN_ATTENDANCE_RATE,
    );
    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.student.studentId,
      firstName: enrollment.student.user.firstName,
      lastName: enrollment.student.user.lastName,
      sessionsHeld: sessions.length,
      attended: rate.attended,
      counted: rate.counted,
      rate: rate.rate,
      examEligible: rate.eligible,
      missedDates: sessions
        .filter((row) => row.status === AttendanceStatus.ABSENT)
        .map((row) => startOfUtcDay(row.date).toISOString().slice(0, 10)),
    };
  });
};

const getMine = async (studentId: string) => {
  const active = await prisma.semester.findMany({
    where: {
      deletedAt: null,
      status: { in: [SemesterStatus.REGISTRATION, SemesterStatus.ONGOING] },
    },
    select: { id: true, name: true, status: true },
    take: 2,
  });
  const semester =
    active.find((row) => row.status === SemesterStatus.REGISTRATION) ??
    active.find((row) => row.status === SemesterStatus.ONGOING);
  if (semester === undefined) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'No semester is currently in registration or ongoing',
    );
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
      offering: { semesterId: semester.id },
      status: { in: [EnrollmentStatus.ENROLLED, EnrollmentStatus.COMPLETED] },
    },
    select: {
      id: true,
      examEligible: true,
      offering: {
        select: {
          id: true,
          section: true,
          course: { select: { code: true, title: true } },
        },
      },
      attendances: { select: { status: true } },
    },
  });

  const courses = enrollments.map((enrollment) => {
    const rate = calculateRate(
      enrollment.attendances.map((row) => row.status),
      MIN_ATTENDANCE_RATE,
    );
    return {
      offeringId: enrollment.offering.id,
      section: enrollment.offering.section,
      course: enrollment.offering.course,
      ...rate,
      examEligible: rate.eligible,
    };
  });

  const overall = calculateRate(
    enrollments.flatMap((enrollment) => enrollment.attendances.map((row) => row.status)),
    MIN_ATTENDANCE_RATE,
  );

  return {
    semester: { id: semester.id, name: semester.name, status: semester.status },
    overall,
    ineligibleCourses: courses
      .filter((course) => !course.examEligible)
      .map((course) => course.course.code),
    courses,
  };
};

const deleteSession = async (actorId: string, offeringId: string, isoDate: string) => {
  await requireOfferingForAttendance(offeringId);
  const day = toUtcDate(isoDate);
  const nextDay = new Date(day.getTime() + 86_400_000);

  const existing = await prisma.attendance.findMany({
    where: {
      date: { gte: day, lt: nextDay },
      enrollment: { offeringId },
    },
    select: { id: true, enrollmentId: true },
  });
  if (existing.length === 0) {
    throw new ApiError(StatusCodes.NOT_FOUND, `No attendance session on ${isoDate}`);
  }

  const affectedIds = [...new Set(existing.map((row) => row.enrollmentId))];

  await prisma.$transaction(async (tx) => {
    await tx.attendance.deleteMany({
      where: { id: { in: existing.map((row) => row.id) } },
    });

    const remaining = await tx.attendance.findMany({
      where: { enrollmentId: { in: affectedIds } },
      select: { enrollmentId: true, status: true },
    });
    const byEnrollment = new Map<string, AttendanceStatus[]>();
    for (const id of affectedIds) {
      byEnrollment.set(id, []);
    }
    for (const row of remaining) {
      const list = byEnrollment.get(row.enrollmentId) ?? [];
      list.push(row.status);
      byEnrollment.set(row.enrollmentId, list);
    }
    await updateExamEligible(
      tx,
      [...byEnrollment.entries()].map(([id, statuses]) => ({
        id,
        eligible: calculateRate(statuses, MIN_ATTENDANCE_RATE).eligible,
      })),
    );
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.DELETE,
      entity: 'Attendance',
      entityId: offeringId,
      after: { date: isoDate, removed: existing.length },
    });
  });

  return { date: isoDate, removed: existing.length };
};

export const AttendanceService = {
  markSession,
  getSession,
  getSummary,
  getMine,
  deleteSession,
};
