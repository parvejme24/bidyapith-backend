import {
  AuditAction,
  EnrollmentStatus,
  OfferingStatus,
  Prisma,
  SemesterStatus,
  StudentStatus,
} from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { paginate, paginationMeta } from '../../shared/paginate';
import { prisma } from '../../shared/prisma';
import { createAuditLog } from '../../utils/auditLog';
import { findConflicts, type TimeSlot } from '../../utils/scheduleConflict';
import { adjustSemesterInvoice, getBlockingDues } from '../invoice/invoice.service';
import {
  ACTIVE_ENROLLMENT_STATUSES,
  COURSE_REF_SELECT,
  ENROLLMENT_SORT_FIELDS,
  type ISkippableCheck,
  LOW_CGPA_CREDIT_CAP,
  LOW_CGPA_THRESHOLD,
  ROSTER_SORT_FIELDS,
  SCHEDULE_REF_SELECT,
  SKIPPABLE_CHECKS,
  TRANSACTION_TIMEOUT_MS,
} from './enrollment.constant';
import type {
  IAdminEnrollmentCreate,
  IAvailableCoursesQuery,
  IEligibilityBlock,
  IEnrollmentListQuery,
  IMyCoursesQuery,
  IRosterQuery,
} from './enrollment.interface';

const credits = (value: Prisma.Decimal): string => value.toFixed(1);
const money = (value: Prisma.Decimal): string => value.toFixed(2);

const formatSlot = (slot: TimeSlot): string =>
  `${slot.dayOfWeek} ${slot.startTime}–${slot.endTime}`;

const affectedRows = (rows: number | bigint): number => Number(rows);

const creditLimitFor = (cgpa: Prisma.Decimal, programMax: number): Prisma.Decimal => {
  if (cgpa.lt(LOW_CGPA_THRESHOLD)) {
    return new Prisma.Decimal(Math.min(LOW_CGPA_CREDIT_CAP, programMax));
  }
  return new Prisma.Decimal(programMax);
};

const OFFERING_REGISTRATION_SELECT = {
  id: true,
  courseId: true,
  semesterId: true,
  section: true,
  capacity: true,
  enrolledCount: true,
  status: true,
  course: {
    select: {
      ...COURSE_REF_SELECT,
      prerequisites: {
        select: {
          prerequisiteId: true,
          minGradePoint: true,
          prerequisite: { select: { id: true, code: true } },
        },
      },
    },
  },
  semester: {
    select: {
      id: true,
      name: true,
      status: true,
      registrationStart: true,
      registrationEnd: true,
      dropDeadline: true,
    },
  },
  schedules: { select: SCHEDULE_REF_SELECT },
} as const;

type RegistrationOffering = Prisma.CourseOfferingGetPayload<{
  select: typeof OFFERING_REGISTRATION_SELECT;
}>;

const lockStudent = async (tx: Prisma.TransactionClient, studentId: string): Promise<void> => {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM student_profiles WHERE id = ${studentId}::uuid AND deleted_at IS NULL FOR UPDATE
  `;
  const locked = rows[0];
  if (locked === undefined) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Student not found');
  }
};

const requireLiveStudent = async (studentId: string) => {
  const student = await prisma.studentProfile.findFirst({
    where: { id: studentId, deletedAt: null, user: { deletedAt: null } },
    select: {
      id: true,
      userId: true,
      cgpa: true,
      status: true,
      programId: true,
      program: {
        select: {
          id: true,
          maxCreditsPerSemester: true,
          feePerCredit: true,
        },
      },
    },
  });
  if (student === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Student not found');
  }
  return student;
};

const requireOfferingForRegistration = async (
  offeringId: string,
): Promise<RegistrationOffering> => {
  const offering = await prisma.courseOffering.findFirst({
    where: { id: offeringId, deletedAt: null },
    select: OFFERING_REGISTRATION_SELECT,
  });
  if (offering === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Offering not found');
  }
  return offering;
};

const assertStudentCanRegister = (status: StudentStatus): void => {
  if (status === StudentStatus.SUSPENDED || status === StudentStatus.WITHDRAWN) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `A ${status.toLowerCase()} student cannot register for courses`,
    );
  }
  if (status === StudentStatus.GRADUATED) {
    throw new ApiError(StatusCodes.CONFLICT, 'A graduated student cannot register for courses');
  }
};

const assertRegistrationWindow = (offering: RegistrationOffering, now: Date): void => {
  if (offering.semester.status !== SemesterStatus.REGISTRATION) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Registration is not open: ${offering.semester.name} is ${offering.semester.status}`,
    );
  }
  if (now < offering.semester.registrationStart) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Registration has not started yet (opens ${offering.semester.registrationStart.toISOString()})`,
    );
  }
  if (now > offering.semester.registrationEnd) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Registration closed on ${offering.semester.registrationEnd.toISOString()}`,
    );
  }
  if (offering.status !== OfferingStatus.OPEN) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `This section is not open for registration (status is ${offering.status})`,
    );
  }
};

const loadStudentEnrollments = async (
  tx: Prisma.TransactionClient,
  studentId: string,
  semesterId: string,
) =>
  tx.enrollment.findMany({
    where: {
      studentId,
      OR: [
        { status: EnrollmentStatus.COMPLETED },
        { status: EnrollmentStatus.ENROLLED, offering: { semesterId } },
      ],
    },
    select: {
      id: true,
      offeringId: true,
      status: true,
      gradePoint: true,
      offering: {
        select: {
          semesterId: true,
          courseId: true,
          course: { select: { code: true, credits: true } },
          schedules: {
            select: { dayOfWeek: true, startTime: true, endTime: true },
          },
        },
      },
    },
  });

type LoadedEnrollment = Awaited<ReturnType<typeof loadStudentEnrollments>>[number];

const assertNotDuplicate = (
  offering: RegistrationOffering,
  enrollments: LoadedEnrollment[],
): void => {
  const clash = enrollments.find(
    (row) =>
      ACTIVE_ENROLLMENT_STATUSES.includes(row.status) &&
      row.offering.courseId === offering.courseId &&
      row.offering.semesterId === offering.semesterId,
  );
  if (clash !== undefined) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Already registered for ${offering.course.code} in this semester (section of offering ${clash.offeringId})`,
    );
  }
};

const assertPrerequisites = (
  offering: RegistrationOffering,
  enrollments: LoadedEnrollment[],
): void => {
  const completedByCourse = new Map<string, Prisma.Decimal>();
  for (const row of enrollments) {
    if (row.status !== EnrollmentStatus.COMPLETED || row.gradePoint === null) {
      continue;
    }
    const current = completedByCourse.get(row.offering.courseId);
    if (current === undefined || row.gradePoint.gt(current)) {
      completedByCourse.set(row.offering.courseId, row.gradePoint);
    }
  }

  const missing = offering.course.prerequisites.filter((edge) => {
    const earned = completedByCourse.get(edge.prerequisiteId);
    return earned === undefined || earned.lt(edge.minGradePoint);
  });

  if (missing.length > 0) {
    const names = missing.map((edge) => edge.prerequisite.code).join(', ');
    throw new ApiError(StatusCodes.CONFLICT, `Missing prerequisites: ${names}`);
  }
};

const enrolledCreditsThisSemester = (
  enrollments: LoadedEnrollment[],
  semesterId: string,
): Prisma.Decimal => {
  let total = new Prisma.Decimal(0);
  for (const row of enrollments) {
    if (row.status === EnrollmentStatus.ENROLLED && row.offering.semesterId === semesterId) {
      total = total.add(row.offering.course.credits);
    }
  }
  return total;
};

const creditSnapshot = (
  offering: RegistrationOffering,
  enrollments: LoadedEnrollment[],
  cgpa: Prisma.Decimal,
  programMax: number,
) => {
  const current = enrolledCreditsThisSemester(enrollments, offering.semesterId);
  const requested = offering.course.credits;
  const limit = creditLimitFor(cgpa, programMax);
  return { current, requested, limit, next: current.add(requested) };
};

const assertCreditLimit = (
  offering: RegistrationOffering,
  enrollments: LoadedEnrollment[],
  cgpa: Prisma.Decimal,
  programMax: number,
): void => {
  const { current, requested, limit, next } = creditSnapshot(
    offering,
    enrollments,
    cgpa,
    programMax,
  );
  if (next.gt(limit)) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Credit limit exceeded: current ${credits(current)}, requested ${credits(requested)}, limit ${credits(limit)}`,
    );
  }
};

const assertFinancialHold = async (
  tx: Prisma.TransactionClient,
  studentId: string,
  semesterId: string,
): Promise<void> => {
  const dues = await getBlockingDues(tx, studentId, semesterId);
  if (dues.length === 0) {
    return;
  }
  const numbers = dues.map((invoice) => invoice.invoiceNumber);
  const owed = dues.reduce(
    (sum, invoice) => sum.add(invoice.totalAmount.sub(invoice.paidAmount)),
    new Prisma.Decimal(0),
  );
  throw new ApiError(
    StatusCodes.PAYMENT_REQUIRED,
    `Outstanding dues block registration: ${numbers.join(', ')}. Total owed ${money(owed)}`,
  );
};

const assertScheduleConflict = (
  offering: RegistrationOffering,
  enrollments: LoadedEnrollment[],
): void => {
  const candidate: TimeSlot[] = offering.schedules.map((slot) => ({
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
  }));
  const existing = enrollments
    .filter(
      (row) =>
        row.status === EnrollmentStatus.ENROLLED && row.offering.semesterId === offering.semesterId,
    )
    .flatMap((row) =>
      row.offering.schedules.map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        courseCode: row.offering.course.code,
      })),
    );

  const conflicts = findConflicts(candidate, existing);
  const hit = conflicts[0];
  if (hit === undefined) {
    return;
  }
  throw new ApiError(
    StatusCodes.CONFLICT,
    `Schedule conflict with ${hit.courseCode} on ${formatSlot(hit)}`,
  );
};

const takeSeat = async (tx: Prisma.TransactionClient, offeringId: string): Promise<void> => {
  const rows = await tx.$executeRaw`
    UPDATE course_offerings
    SET enrolled_count = enrolled_count + 1
    WHERE id = ${offeringId}::uuid AND enrolled_count < capacity AND deleted_at IS NULL
  `;
  if (affectedRows(rows) === 0) {
    throw new ApiError(StatusCodes.CONFLICT, 'This section is full');
  }
};

const releaseSeat = async (tx: Prisma.TransactionClient, offeringId: string): Promise<void> => {
  const rows = await tx.$executeRaw`
    UPDATE course_offerings
    SET enrolled_count = enrolled_count - 1
    WHERE id = ${offeringId}::uuid AND enrolled_count > 0
  `;
  if (affectedRows(rows) === 0) {
    throw new ApiError(StatusCodes.CONFLICT, 'Cannot drop: enrolled count is already zero');
  }
};

const upsertEnrollment = async (
  tx: Prisma.TransactionClient,
  studentId: string,
  offeringId: string,
) => {
  const existing = await tx.enrollment.findUnique({
    where: { studentId_offeringId: { studentId, offeringId } },
    select: { id: true, status: true },
  });

  if (existing === null) {
    return tx.enrollment.create({
      data: { studentId, offeringId, status: EnrollmentStatus.ENROLLED },
      select: {
        id: true,
        status: true,
        enrolledAt: true,
      },
    });
  }

  if (ACTIVE_ENROLLMENT_STATUSES.includes(existing.status)) {
    throw new ApiError(StatusCodes.CONFLICT, 'Already registered for this section');
  }

  return tx.enrollment.update({
    where: { id: existing.id },
    data: {
      status: EnrollmentStatus.ENROLLED,
      droppedAt: null,
      enrolledAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      enrolledAt: true,
    },
  });
};

const parseSkipChecks = (raw: string[] | undefined): Set<ISkippableCheck> => {
  if (raw === undefined || raw.length === 0) {
    return new Set();
  }
  const allowed = new Set<string>(SKIPPABLE_CHECKS);
  const forbidden = raw.filter((check) => !allowed.has(check));
  if (forbidden.length > 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot skip ${forbidden.join(', ')}. Only ${SKIPPABLE_CHECKS.join(', ')} may be skipped`,
    );
  }
  return new Set(raw as ISkippableCheck[]);
};

const register = async (args: {
  actorId: string;
  studentId: string;
  offeringId: string;
  skipChecks?: string[] | undefined;
}) => {
  const skipped = parseSkipChecks(args.skipChecks);
  const [student, offering] = await Promise.all([
    requireLiveStudent(args.studentId),
    requireOfferingForRegistration(args.offeringId),
  ]);

  assertStudentCanRegister(student.status);

  const created = await prisma.$transaction(
    async (tx) => {
      await lockStudent(tx, student.id);
      assertRegistrationWindow(offering, new Date());

      const enrollments = await loadStudentEnrollments(tx, student.id, offering.semesterId);

      assertNotDuplicate(offering, enrollments);
      if (!skipped.has('PREREQUISITE')) {
        assertPrerequisites(offering, enrollments);
      }
      if (!skipped.has('CREDIT_LIMIT')) {
        assertCreditLimit(
          offering,
          enrollments,
          student.cgpa,
          student.program.maxCreditsPerSemester,
        );
      }
      if (!skipped.has('FINANCIAL_HOLD')) {
        await assertFinancialHold(tx, student.id, offering.semesterId);
      }
      if (!skipped.has('SCHEDULE_CONFLICT')) {
        assertScheduleConflict(offering, enrollments);
      }

      await takeSeat(tx, offering.id);
      let enrollment: Awaited<ReturnType<typeof upsertEnrollment>>;
      try {
        enrollment = await upsertEnrollment(tx, student.id, offering.id);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ApiError(StatusCodes.CONFLICT, 'Already registered for this section');
        }
        throw error;
      }
      await adjustSemesterInvoice(
        tx,
        student.id,
        offering.semesterId,
        offering.course.credits,
        student.program.feePerCredit,
      );
      await createAuditLog(tx, {
        actorId: args.actorId,
        action: AuditAction.CREATE,
        entity: 'Enrollment',
        entityId: enrollment.id,
        after: {
          studentId: student.id,
          offeringId: offering.id,
          courseCode: offering.course.code,
          ...(skipped.size > 0 ? { skippedChecks: [...skipped] } : {}),
        },
      });

      const current = enrolledCreditsThisSemester(enrollments, offering.semesterId).add(
        offering.course.credits,
      );
      const limit = creditLimitFor(student.cgpa, student.program.maxCreditsPerSemester);

      return { enrollment, current, limit };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );

  return {
    id: created.enrollment.id,
    status: created.enrollment.status,
    course: {
      code: offering.course.code,
      title: offering.course.title,
      credits: credits(offering.course.credits),
    },
    section: offering.section,
    schedule: offering.schedules.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })),
    semesterCredits: {
      current: Number(credits(created.current)),
      limit: Number(credits(created.limit)),
    },
  };
};

const registerSelf = async (actorId: string, studentProfileId: string, offeringId: string) =>
  register({ actorId, studentId: studentProfileId, offeringId });

const registerAdmin = async (actorId: string, input: IAdminEnrollmentCreate) =>
  register({
    actorId,
    studentId: input.studentId,
    offeringId: input.offeringId,
    skipChecks: input.skipChecks,
  });

const drop = async (actorId: string, enrollmentId: string) => {
  const existing = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      studentId: true,
      offeringId: true,
      status: true,
      offering: {
        select: {
          semesterId: true,
          course: { select: { credits: true, code: true } },
          semester: { select: { dropDeadline: true } },
        },
      },
    },
  });
  if (existing === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Enrollment not found');
  }

  const student = await requireLiveStudent(existing.studentId);

  const dropped = await prisma.$transaction(
    async (tx) => {
      await lockStudent(tx, existing.studentId);

      if (existing.status !== EnrollmentStatus.ENROLLED) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          `Cannot drop a course with status ${existing.status}`,
        );
      }

      const now = new Date();
      if (now > existing.offering.semester.dropDeadline) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          `Drop deadline passed on ${existing.offering.semester.dropDeadline.toISOString()}`,
        );
      }

      const enrollment = await tx.enrollment.update({
        where: { id: existing.id },
        data: { status: EnrollmentStatus.DROPPED, droppedAt: now },
        select: { id: true, status: true, droppedAt: true },
      });

      await releaseSeat(tx, existing.offeringId);
      // Invoice overpayment after a drop is left in place (status PAID).
      // Refunds are the payment module's job.
      await adjustSemesterInvoice(
        tx,
        existing.studentId,
        existing.offering.semesterId,
        existing.offering.course.credits.mul(-1),
        student.program.feePerCredit,
      );
      await createAuditLog(tx, {
        actorId,
        action: AuditAction.STATUS_CHANGE,
        entity: 'Enrollment',
        entityId: existing.id,
        before: { status: EnrollmentStatus.ENROLLED },
        after: { status: EnrollmentStatus.DROPPED },
      });

      return enrollment;
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );

  return dropped;
};

const currentSemester = async () => {
  const active = await prisma.semester.findMany({
    where: {
      deletedAt: null,
      status: { in: [SemesterStatus.REGISTRATION, SemesterStatus.ONGOING] },
    },
    select: { id: true, name: true, status: true },
    take: 2,
  });
  return (
    active.find((semester) => semester.status === SemesterStatus.REGISTRATION) ??
    active.find((semester) => semester.status === SemesterStatus.ONGOING)
  );
};

const listAvailable = async (studentId: string, query: IAvailableCoursesQuery) => {
  const semester = await currentSemester();
  if (semester === undefined) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'No semester is currently in registration or ongoing',
    );
  }

  const [offerings, studentState, currentEnrollments] = await Promise.all([
    prisma.courseOffering.findMany({
      where: {
        semesterId: semester.id,
        status: OfferingStatus.OPEN,
        deletedAt: null,
      },
      select: {
        id: true,
        section: true,
        capacity: true,
        enrolledCount: true,
        courseId: true,
        course: {
          select: {
            ...COURSE_REF_SELECT,
            prerequisites: {
              select: {
                prerequisiteId: true,
                minGradePoint: true,
                prerequisite: { select: { code: true } },
              },
            },
          },
        },
        schedules: { select: SCHEDULE_REF_SELECT },
      },
    }),
    prisma.studentProfile.findFirst({
      where: { id: studentId, deletedAt: null },
      select: {
        cgpa: true,
        program: { select: { maxCreditsPerSemester: true } },
        enrollments: {
          where: { status: EnrollmentStatus.COMPLETED },
          select: {
            gradePoint: true,
            offering: { select: { courseId: true } },
          },
        },
      },
    }),
    prisma.enrollment.findMany({
      where: {
        studentId,
        status: EnrollmentStatus.ENROLLED,
        offering: { semesterId: semester.id },
      },
      select: {
        offering: {
          select: {
            courseId: true,
            course: { select: { code: true, credits: true } },
            schedules: { select: { dayOfWeek: true, startTime: true, endTime: true } },
          },
        },
      },
    }),
  ]);

  if (studentState === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Student not found');
  }

  // Four queries: current semester, OPEN offerings, completed enrollments
  // (via the student row), current-semester enrollments. Evaluated in memory.
  const completedByCourse = new Map<string, Prisma.Decimal>();
  for (const row of studentState.enrollments) {
    if (row.gradePoint === null) {
      continue;
    }
    const current = completedByCourse.get(row.offering.courseId);
    if (current === undefined || row.gradePoint.gt(current)) {
      completedByCourse.set(row.offering.courseId, row.gradePoint);
    }
  }

  const enrolledCourseIds = new Set(currentEnrollments.map((row) => row.offering.courseId));
  const enrolledCredits = currentEnrollments.reduce(
    (sum, row) => sum.add(row.offering.course.credits),
    new Prisma.Decimal(0),
  );
  const limit = creditLimitFor(studentState.cgpa, studentState.program.maxCreditsPerSemester);
  const existingSlots = currentEnrollments.flatMap((row) =>
    row.offering.schedules.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      courseCode: row.offering.course.code,
    })),
  );

  const rows = offerings.map((offering) => {
    const blockedBy: IEligibilityBlock[] = [];

    if (enrolledCourseIds.has(offering.courseId)) {
      blockedBy.push({
        reason: 'ALREADY_ENROLLED',
        detail: `Already enrolled in ${offering.course.code} this semester`,
      });
    }

    if (offering.enrolledCount >= offering.capacity) {
      blockedBy.push({
        reason: 'SECTION_FULL',
        detail: `Section ${offering.section} is full (${offering.enrolledCount}/${offering.capacity})`,
      });
    }

    const nextCredits = enrolledCredits.add(offering.course.credits);
    if (nextCredits.gt(limit)) {
      blockedBy.push({
        reason: 'CREDIT_LIMIT',
        detail: `Credit limit exceeded: current ${credits(enrolledCredits)}, requested ${credits(offering.course.credits)}, limit ${credits(limit)}`,
      });
    }

    for (const edge of offering.course.prerequisites) {
      const earned = completedByCourse.get(edge.prerequisiteId);
      if (earned === undefined || earned.lt(edge.minGradePoint)) {
        blockedBy.push({
          reason: 'PREREQUISITE',
          detail: `${edge.prerequisite.code} not completed`,
        });
      }
    }

    const candidate: TimeSlot[] = offering.schedules.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
    const conflicts = findConflicts(candidate, existingSlots);
    const hit = conflicts[0];
    if (hit !== undefined) {
      blockedBy.push({
        reason: 'SCHEDULE_CONFLICT',
        detail: `Conflicts with ${hit.courseCode} on ${formatSlot(hit)}`,
      });
    }

    return {
      offeringId: offering.id,
      section: offering.section,
      seatsRemaining: offering.capacity - offering.enrolledCount,
      course: {
        id: offering.course.id,
        code: offering.course.code,
        title: offering.course.title,
        credits: credits(offering.course.credits),
      },
      schedule: offering.schedules.map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
      eligible: blockedBy.length === 0,
      blockedBy,
    };
  });

  const data = query.eligibleOnly === true ? rows.filter((row) => row.eligible) : rows;
  return { semester: { id: semester.id, name: semester.name, status: semester.status }, data };
};

const ENROLLMENT_LIST_SELECT = {
  id: true,
  studentId: true,
  offeringId: true,
  status: true,
  enrolledAt: true,
  droppedAt: true,
  offering: {
    select: {
      section: true,
      semesterId: true,
      course: { select: COURSE_REF_SELECT },
      semester: { select: { id: true, name: true, status: true } },
    },
  },
} as const;

const serializeListRow = (
  row: Prisma.EnrollmentGetPayload<{ select: typeof ENROLLMENT_LIST_SELECT }>,
) => ({
  id: row.id,
  studentId: row.studentId,
  offeringId: row.offeringId,
  status: row.status,
  enrolledAt: row.enrolledAt.toISOString(),
  droppedAt: row.droppedAt?.toISOString() ?? null,
  offering: {
    ...row.offering,
    course: { ...row.offering.course, credits: credits(row.offering.course.credits) },
  },
});

const listMyCourses = async (studentId: string, query: IMyCoursesQuery) => {
  const pagination = paginate(query, ENROLLMENT_SORT_FIELDS);
  const where: Prisma.EnrollmentWhereInput = {
    studentId,
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.semesterId !== undefined ? { offering: { semesterId: query.semesterId } } : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.enrollment.findMany({
      where,
      select: ENROLLMENT_LIST_SELECT,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.enrollment.count({ where }),
  ]);

  return {
    data: data.map(serializeListRow),
    meta: paginationMeta(pagination.page, pagination.limit, total),
  };
};

const listAll = async (query: IEnrollmentListQuery) => {
  const pagination = paginate(query, ENROLLMENT_SORT_FIELDS);
  const where: Prisma.EnrollmentWhereInput = {
    ...(query.studentId !== undefined ? { studentId: query.studentId } : {}),
    ...(query.offeringId !== undefined ? { offeringId: query.offeringId } : {}),
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.semesterId !== undefined ? { offering: { semesterId: query.semesterId } } : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.enrollment.findMany({
      where,
      select: {
        ...ENROLLMENT_LIST_SELECT,
        student: {
          select: {
            id: true,
            studentId: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.enrollment.count({ where }),
  ]);

  return {
    data: data.map((row) => ({
      ...serializeListRow(row),
      student: {
        id: row.student.id,
        studentId: row.student.studentId,
        firstName: row.student.user.firstName,
        lastName: row.student.user.lastName,
        email: row.student.user.email,
      },
    })),
    meta: paginationMeta(pagination.page, pagination.limit, total),
  };
};

const listRoster = async (offeringId: string, query: IRosterQuery) => {
  const offering = await prisma.courseOffering.findFirst({
    where: { id: offeringId, deletedAt: null },
    select: { id: true, section: true, course: { select: COURSE_REF_SELECT } },
  });
  if (offering === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Offering not found');
  }

  const pagination = paginate(query, ROSTER_SORT_FIELDS);
  const where: Prisma.EnrollmentWhereInput = {
    offeringId,
    ...(query.includeDropped === true ? {} : { status: { not: EnrollmentStatus.DROPPED } }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.enrollment.findMany({
      where,
      select: {
        id: true,
        status: true,
        enrolledAt: true,
        student: {
          select: {
            studentId: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.enrollment.count({ where }),
  ]);

  return {
    offering: {
      id: offering.id,
      section: offering.section,
      course: { ...offering.course, credits: credits(offering.course.credits) },
    },
    data: data.map((row) => ({
      enrollmentId: row.id,
      status: row.status,
      enrolledAt: row.enrolledAt.toISOString(),
      studentId: row.student.studentId,
      firstName: row.student.user.firstName,
      lastName: row.student.user.lastName,
    })),
    meta: paginationMeta(pagination.page, pagination.limit, total),
  };
};

export const EnrollmentService = {
  registerSelf,
  registerAdmin,
  drop,
  listAvailable,
  listMyCourses,
  listAll,
  listRoster,
};
