import { randomUUID } from 'node:crypto';
import {
  AuditAction,
  EnrollmentStatus,
  LetterGrade,
  NotificationType,
  OfferingStatus,
  Prisma,
  SemesterStatus,
} from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { CACHE_TTL, cacheKeys } from '../../constants/cache';
import { CURRENT_SEMESTER_CACHE_KEY } from '../../constants/semester';
import { ApiError } from '../../shared/ApiError';
import { cached, invalidateKeys } from '../../shared/cache';
import { prisma } from '../../shared/prisma';
import { getRedis } from '../../shared/redis';
import { createAuditLog } from '../../utils/auditLog';
import { cumulativeGpa, type GradedCourse, semesterGpa } from '../../utils/gpa';
import { countsTowardGpa, earnsCredits, gradeToPoint, marksToGrade } from '../../utils/gradeScale';
import { sendEmail } from '../../utils/sendEmail';
import {
  PUBLISH_MAX_WAIT_MS,
  PUBLISH_TIMEOUT_MS,
  TERM_ORDER,
  WRITE_CHUNK_SIZE,
} from './result.constant';
import type {
  IGradePatch,
  IGradeSubmit,
  IMyResultsQuery,
  IReadiness,
  IReadinessBlocker,
} from './result.interface';

const decimal = (value: Prisma.Decimal | number | string): string =>
  new Prisma.Decimal(value).toFixed(2);

const credits = (value: Prisma.Decimal): string => value.toFixed(1);

const chunk = <T>(items: T[], size: number): T[][] => {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
};

const unique = (ids: string[]): string[] => [...new Set(ids)];

const assertGrading = (status: SemesterStatus, action: string): void => {
  if (status === SemesterStatus.GRADING) {
    return;
  }
  if (status === SemesterStatus.COMPLETED) {
    throw new ApiError(StatusCodes.CONFLICT, `Cannot ${action}: results are already published`);
  }
  throw new ApiError(StatusCodes.CONFLICT, `Cannot ${action} while the semester is ${status}`);
};

const pointOrEmpty = (letter: LetterGrade): string => {
  const point = gradeToPoint(letter);
  return point === null ? '' : point.toFixed(2);
};

const asGradedCourse = (
  courseId: string,
  courseCredits: Prisma.Decimal,
  letter: LetterGrade,
  storedPoint: Prisma.Decimal | null,
): GradedCourse => ({
  courseId,
  credits: courseCredits,
  letter,
  point: storedPoint ?? gradeToPoint(letter) ?? new Prisma.Decimal(0),
});

type OfferingRow = {
  id: string;
  section: string;
  status: OfferingStatus;
  course: { code: string };
};

type EnrollmentGradeRow = {
  id: string;
  offeringId: string;
  letterGrade: LetterGrade | null;
};

const buildReadiness = (
  semesterStatus: SemesterStatus,
  semesterId: string,
  semesterName: string,
  offerings: OfferingRow[],
  enrollments: EnrollmentGradeRow[],
): IReadiness => {
  const ungradedByOffering = new Map<string, number>();
  let gradedEnrollments = 0;
  for (const row of enrollments) {
    if (row.letterGrade === null) {
      ungradedByOffering.set(row.offeringId, (ungradedByOffering.get(row.offeringId) ?? 0) + 1);
    } else {
      gradedEnrollments += 1;
    }
  }

  const offeringById = new Map(offerings.map((row) => [row.id, row]));
  const blockers: IReadinessBlocker[] = [];

  if (semesterStatus === SemesterStatus.COMPLETED) {
    blockers.push({
      offeringId: semesterId,
      course: semesterName,
      section: '',
      reason: 'ALREADY_PUBLISHED',
      count: 0,
    });
  } else if (semesterStatus !== SemesterStatus.GRADING) {
    blockers.push({
      offeringId: semesterId,
      course: semesterName,
      section: '',
      reason: 'NOT_GRADING',
      count: 0,
    });
  }

  for (const [offeringId, count] of ungradedByOffering) {
    const offering = offeringById.get(offeringId);
    blockers.push({
      offeringId,
      course: offering?.course.code ?? 'UNKNOWN',
      section: offering?.section ?? '',
      reason: 'UNGRADED',
      count,
    });
  }

  const gradedOfferings = offerings.filter(
    (offering) => !ungradedByOffering.has(offering.id),
  ).length;
  const statusReady = semesterStatus === SemesterStatus.GRADING && ungradedByOffering.size === 0;

  return {
    ready: statusReady,
    totalOfferings: offerings.length,
    gradedOfferings,
    totalEnrollments: enrollments.length,
    gradedEnrollments,
    blockers,
  };
};

const readinessError = (readiness: IReadiness): ApiError =>
  new ApiError(
    StatusCodes.CONFLICT,
    'Cannot publish results because some enrollments are ungraded',
    readiness.blockers.map((blocker) => ({
      path: blocker.offeringId,
      message: `${blocker.reason}: ${blocker.course}${blocker.section.length > 0 ? ` section ${blocker.section}` : ''} (${blocker.count})`,
    })),
  );

const requireOffering = async (offeringId: string) => {
  const offering = await prisma.courseOffering.findFirst({
    where: { id: offeringId, deletedAt: null },
    select: {
      id: true,
      section: true,
      instructorId: true,
      semester: { select: { id: true, name: true, status: true } },
      course: { select: { code: true, title: true } },
    },
  });
  if (offering === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Offering not found');
  }
  return offering;
};

const loadSemesterReadiness = async (
  semesterId: string,
): Promise<{
  semester: { id: string; name: string; status: SemesterStatus };
  readiness: IReadiness;
}> => {
  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, deletedAt: null },
    select: { id: true, name: true, status: true },
  });
  if (semester === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Semester not found');
  }

  const [offerings, enrollments] = await prisma.$transaction([
    prisma.courseOffering.findMany({
      where: { semesterId, deletedAt: null },
      select: { id: true, section: true, status: true, course: { select: { code: true } } },
    }),
    prisma.enrollment.findMany({
      where: { status: EnrollmentStatus.ENROLLED, offering: { semesterId, deletedAt: null } },
      select: { id: true, offeringId: true, letterGrade: true },
    }),
  ]);

  return {
    semester,
    readiness: buildReadiness(semester.status, semester.id, semester.name, offerings, enrollments),
  };
};

const resolveLetter = (
  entry: { letterGrade?: LetterGrade | undefined },
  totalMarks: Prisma.Decimal | null,
): LetterGrade | null => {
  if (entry.letterGrade !== undefined) {
    return entry.letterGrade;
  }
  if (totalMarks === null) {
    return null;
  }
  return marksToGrade(totalMarks).letter;
};

const validateResolvedGrade = (
  studentLabel: string,
  examEligible: boolean,
  totalMarks: Prisma.Decimal | null,
  letter: LetterGrade | null,
): LetterGrade => {
  if (letter === null) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `${studentLabel} has no totalMarks and no letterGrade; only I or W may be assigned without marks`,
    );
  }
  if (!examEligible && letter !== LetterGrade.F && letter !== LetterGrade.I) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot pass exam-ineligible student ${studentLabel}; only F or I is allowed`,
    );
  }
  if (totalMarks === null && letter !== LetterGrade.I && letter !== LetterGrade.W) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `${studentLabel} has no totalMarks and may only receive I or W`,
    );
  }
  return letter;
};

const writeEnrollmentGrades = async (
  tx: Prisma.TransactionClient,
  actorId: string,
  rows: { id: string; letter: LetterGrade }[],
): Promise<void> => {
  for (const group of chunk(rows, WRITE_CHUNK_SIZE)) {
    const ids = group.map((row) => row.id);
    const letters = group.map((row) => row.letter);
    const points = group.map((row) => pointOrEmpty(row.letter));
    const actors = group.map(() => actorId);
    await tx.$executeRaw`
      UPDATE enrollments AS e
      SET
        letter_grade = v.letter::"LetterGrade",
        grade_point = NULLIF(v.point, '')::numeric,
        graded_at = NOW(),
        graded_by_id = v.graded_by::uuid,
        updated_at = NOW()
      FROM UNNEST(
        ${ids}::uuid[],
        ${letters}::text[],
        ${points}::text[],
        ${actors}::uuid[]
      ) AS v(id, letter, point, graded_by)
      WHERE e.id = v.id
    `;
  }
};

const upsertSemesterResults = async (
  tx: Prisma.TransactionClient,
  semesterId: string,
  publishedAt: Date,
  rows: {
    studentId: string;
    gpa: Prisma.Decimal;
    creditsAttempted: Prisma.Decimal;
    creditsEarned: Prisma.Decimal;
    cgpa: Prisma.Decimal;
  }[],
): Promise<void> => {
  for (const group of chunk(rows, WRITE_CHUNK_SIZE)) {
    await tx.$executeRaw`
      INSERT INTO semester_results (
        id, student_id, semester_id, gpa, credits_attempted, credits_earned,
        cgpa_snapshot, is_published, published_at, created_at, updated_at
      )
      SELECT
        u.id,
        u.student_id,
        ${semesterId}::uuid,
        u.gpa::numeric,
        u.attempted::numeric,
        u.earned::numeric,
        u.cgpa::numeric,
        TRUE,
        ${publishedAt},
        NOW(),
        NOW()
      FROM UNNEST(
        ${group.map(() => randomUUID())}::uuid[],
        ${group.map((row) => row.studentId)}::uuid[],
        ${group.map((row) => row.gpa.toFixed(2))}::text[],
        ${group.map((row) => row.creditsAttempted.toFixed(1))}::text[],
        ${group.map((row) => row.creditsEarned.toFixed(1))}::text[],
        ${group.map((row) => row.cgpa.toFixed(2))}::text[]
      ) AS u(id, student_id, gpa, attempted, earned, cgpa)
      ON CONFLICT (student_id, semester_id)
      DO UPDATE SET
        gpa = EXCLUDED.gpa,
        credits_attempted = EXCLUDED.credits_attempted,
        credits_earned = EXCLUDED.credits_earned,
        cgpa_snapshot = EXCLUDED.cgpa_snapshot,
        is_published = TRUE,
        published_at = EXCLUDED.published_at,
        updated_at = NOW()
    `;
  }
};

const updateStudentProfiles = async (
  tx: Prisma.TransactionClient,
  rows: { studentId: string; cgpa: Prisma.Decimal; creditsEarned: Prisma.Decimal }[],
): Promise<void> => {
  for (const group of chunk(rows, WRITE_CHUNK_SIZE)) {
    await tx.$executeRaw`
      UPDATE student_profiles AS s
      SET
        cgpa = v.cgpa::numeric,
        total_credits_earned = v.credits::numeric,
        updated_at = NOW()
      FROM UNNEST(
        ${group.map((row) => row.studentId)}::uuid[],
        ${group.map((row) => row.cgpa.toFixed(2))}::text[],
        ${group.map((row) => row.creditsEarned.toFixed(1))}::text[]
      ) AS v(id, cgpa, credits)
      WHERE s.id = v.id
    `;
  }
};

const updateEnrollmentStatuses = async (
  tx: Prisma.TransactionClient,
  rows: { id: string; status: EnrollmentStatus }[],
): Promise<void> => {
  for (const group of chunk(rows, WRITE_CHUNK_SIZE)) {
    await tx.$executeRaw`
      UPDATE enrollments AS e
      SET status = v.status::"EnrollmentStatus", updated_at = NOW()
      FROM UNNEST(
        ${group.map((row) => row.id)}::uuid[],
        ${group.map((row) => row.status)}::text[]
      ) AS v(id, status)
      WHERE e.id = v.id
    `;
  }
};

const invalidateResultCaches = async (): Promise<void> => {
  await invalidateKeys(CURRENT_SEMESTER_CACHE_KEY);
  const redis = getRedis();
  if (redis === null) {
    return;
  }
  try {
    const keys = [
      ...(await redis.keys('transcript:*')),
      ...(await redis.keys('semester-result:*')),
    ];
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Redis down — never fail publish because cache could not be cleared.
  }
};

const previewGrades = async (offeringId: string) => {
  const offering = await requireOffering(offeringId);
  const enrollments = await prisma.enrollment.findMany({
    where: { offeringId, status: EnrollmentStatus.ENROLLED },
    select: {
      id: true,
      totalMarks: true,
      letterGrade: true,
      gradePoint: true,
      examEligible: true,
      student: {
        select: {
          studentId: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { student: { studentId: 'asc' } },
  });

  return {
    offering: {
      id: offering.id,
      section: offering.section,
      course: offering.course,
      semester: offering.semester,
    },
    students: enrollments.map((row) => {
      const computed = row.totalMarks === null ? null : marksToGrade(row.totalMarks);
      return {
        enrollmentId: row.id,
        studentId: row.student.studentId,
        firstName: row.student.user.firstName,
        lastName: row.student.user.lastName,
        totalMarks: row.totalMarks === null ? null : decimal(row.totalMarks),
        examEligible: row.examEligible,
        missingMarks: row.totalMarks === null,
        currentLetterGrade: row.letterGrade,
        currentGradePoint: row.gradePoint === null ? null : decimal(row.gradePoint),
        computedLetterGrade: computed?.letter ?? null,
        computedGradePoint: computed === null ? null : decimal(computed.point),
      };
    }),
  };
};

const submitGrades = async (actorId: string, offeringId: string, input: IGradeSubmit) => {
  const offering = await requireOffering(offeringId);
  assertGrading(offering.semester.status, 'submit grades');

  const roster = await prisma.enrollment.findMany({
    where: { offeringId, status: EnrollmentStatus.ENROLLED },
    select: {
      id: true,
      examEligible: true,
      totalMarks: true,
      student: { select: { studentId: true } },
    },
  });
  const rosterById = new Map(roster.map((row) => [row.id, row]));

  const unknown = input.grades
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !rosterById.has(row.enrollmentId));
  if (unknown.length > 0) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'One or more enrollmentIds do not belong to this offering or are not ENROLLED',
      unknown.map(({ row, index }) => ({
        path: `grades.${index}.enrollmentId`,
        message: `${row.enrollmentId} is not an ENROLLED student in this offering`,
      })),
    );
  }

  const submitted = new Set(input.grades.map((row) => row.enrollmentId));
  const missing = roster.filter((row) => !submitted.has(row.id));
  if (missing.length > 0) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Every enrolled student must be included in the grade submission',
      missing.map((row) => ({
        path: 'grades',
        message: `Missing ${row.student.studentId} (${row.id})`,
      })),
    );
  }

  const resolved = input.grades.map((entry) => {
    const enrollment = rosterById.get(entry.enrollmentId);
    if (enrollment === undefined) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Enrollment not found on this offering');
    }
    const letter = validateResolvedGrade(
      enrollment.student.studentId,
      enrollment.examEligible,
      enrollment.totalMarks,
      resolveLetter(entry, enrollment.totalMarks),
    );
    return { id: enrollment.id, letter };
  });

  await prisma.$transaction(async (tx) => {
    await writeEnrollmentGrades(tx, actorId, resolved);
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.GRADE_SUBMIT,
      entity: 'CourseOffering',
      entityId: offeringId,
      after: { count: resolved.length, course: offering.course.code, section: offering.section },
    });
  });

  return { graded: resolved.length };
};

const patchGrade = async (actorId: string, enrollmentId: string, input: IGradePatch) => {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      status: true,
      examEligible: true,
      totalMarks: true,
      letterGrade: true,
      student: { select: { studentId: true } },
      offering: {
        select: {
          id: true,
          semester: { select: { status: true } },
        },
      },
    },
  });
  if (enrollment === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Enrollment not found');
  }
  assertGrading(enrollment.offering.semester.status, 'correct a grade');
  if (enrollment.status !== EnrollmentStatus.ENROLLED) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      `${enrollment.student.studentId} is not ENROLLED on this offering`,
    );
  }

  const letter = validateResolvedGrade(
    enrollment.student.studentId,
    enrollment.examEligible,
    enrollment.totalMarks,
    input.letterGrade,
  );

  const updated = await prisma.$transaction(async (tx) => {
    await writeEnrollmentGrades(tx, actorId, [{ id: enrollment.id, letter }]);
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.GRADE_SUBMIT,
      entity: 'Enrollment',
      entityId: enrollment.id,
      before: { letterGrade: enrollment.letterGrade },
      after: { letterGrade: letter },
    });
    return tx.enrollment.findUnique({
      where: { id: enrollment.id },
      select: {
        id: true,
        letterGrade: true,
        gradePoint: true,
        gradedAt: true,
      },
    });
  });

  if (updated === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Enrollment not found');
  }

  return {
    id: updated.id,
    letterGrade: updated.letterGrade,
    gradePoint: updated.gradePoint === null ? null : decimal(updated.gradePoint),
    gradedAt: updated.gradedAt?.toISOString() ?? null,
  };
};

const getReadiness = async (semesterId: string): Promise<IReadiness> => {
  const { readiness } = await loadSemesterReadiness(semesterId);
  return readiness;
};

type PublishNotify = {
  userId: string;
  email: string;
  firstName: string;
  gpa: string;
  cgpa: string;
};

const publishResults = async (actorId: string, semesterId: string) => {
  const started = Date.now();
  const preview = await loadSemesterReadiness(semesterId);
  assertGrading(preview.semester.status, 'publish results');
  if (!preview.readiness.ready) {
    throw readinessError(preview.readiness);
  }

  const published = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT id FROM semesters WHERE id = ${semesterId}::uuid FOR UPDATE`;

      const semester = await tx.semester.findFirst({
        where: { id: semesterId, deletedAt: null },
        select: { id: true, name: true, status: true },
      });
      if (semester === null) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Semester not found');
      }
      assertGrading(semester.status, 'publish results');

      const thisSemester = await tx.enrollment.findMany({
        where: { status: EnrollmentStatus.ENROLLED, offering: { semesterId, deletedAt: null } },
        select: {
          id: true,
          studentId: true,
          letterGrade: true,
          gradePoint: true,
          offering: {
            select: {
              id: true,
              section: true,
              courseId: true,
              course: { select: { code: true, credits: true } },
            },
          },
        },
      });

      const ungraded = thisSemester.filter((row) => row.letterGrade === null);
      if (ungraded.length > 0) {
        const offeringRows: OfferingRow[] = [];
        const seenOfferings = new Set<string>();
        for (const row of thisSemester) {
          if (seenOfferings.has(row.offering.id)) {
            continue;
          }
          seenOfferings.add(row.offering.id);
          offeringRows.push({
            id: row.offering.id,
            section: row.offering.section,
            status: OfferingStatus.CLOSED,
            course: { code: row.offering.course.code },
          });
        }
        throw readinessError(
          buildReadiness(
            semester.status,
            semester.id,
            semester.name,
            offeringRows,
            thisSemester.map((row) => ({
              id: row.id,
              offeringId: row.offering.id,
              letterGrade: row.letterGrade,
            })),
          ),
        );
      }

      const studentIds = unique(thisSemester.map((row) => row.studentId));
      if (studentIds.length === 0) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'Cannot publish results because this semester has no ENROLLED students',
        );
      }

      const [history, profiles] = await Promise.all([
        tx.enrollment.findMany({
          where: {
            studentId: { in: studentIds },
            letterGrade: { not: null },
            offering: { semesterId: { not: semesterId }, deletedAt: null },
          },
          select: {
            studentId: true,
            letterGrade: true,
            gradePoint: true,
            offering: {
              select: {
                courseId: true,
                course: { select: { credits: true } },
              },
            },
          },
        }),
        tx.studentProfile.findMany({
          where: { id: { in: studentIds } },
          select: {
            id: true,
            userId: true,
            user: { select: { email: true, firstName: true } },
          },
        }),
      ]);

      const historyByStudent = new Map<string, GradedCourse[]>();
      for (const row of history) {
        if (row.letterGrade === null) {
          continue;
        }
        const list = historyByStudent.get(row.studentId) ?? [];
        list.push(
          asGradedCourse(
            row.offering.courseId,
            row.offering.course.credits,
            row.letterGrade,
            row.gradePoint,
          ),
        );
        historyByStudent.set(row.studentId, list);
      }

      const currentByStudent = new Map<string, typeof thisSemester>();
      for (const row of thisSemester) {
        const list = currentByStudent.get(row.studentId) ?? [];
        list.push(row);
        currentByStudent.set(row.studentId, list);
      }

      const publishedAt = new Date();
      const resultRows: {
        studentId: string;
        gpa: Prisma.Decimal;
        creditsAttempted: Prisma.Decimal;
        creditsEarned: Prisma.Decimal;
        cgpa: Prisma.Decimal;
      }[] = [];
      const profileRows: {
        studentId: string;
        cgpa: Prisma.Decimal;
        creditsEarned: Prisma.Decimal;
      }[] = [];
      const statusRows: { id: string; status: EnrollmentStatus }[] = [];
      const notify: PublishNotify[] = [];
      const profileById = new Map(profiles.map((row) => [row.id, row]));

      for (const studentId of studentIds) {
        const current = currentByStudent.get(studentId) ?? [];
        const currentCourses: GradedCourse[] = [];
        for (const row of current) {
          if (row.letterGrade === null) {
            continue;
          }
          currentCourses.push(
            asGradedCourse(
              row.offering.courseId,
              row.offering.course.credits,
              row.letterGrade,
              row.gradePoint,
            ),
          );
          if (row.letterGrade === LetterGrade.F) {
            statusRows.push({ id: row.id, status: EnrollmentStatus.FAILED });
          } else if (earnsCredits(row.letterGrade)) {
            statusRows.push({ id: row.id, status: EnrollmentStatus.COMPLETED });
          }
        }

        const term = semesterGpa(currentCourses);
        const allCourses = [...(historyByStudent.get(studentId) ?? []), ...currentCourses];
        const cumulative = cumulativeGpa(allCourses);
        resultRows.push({
          studentId,
          gpa: term.gpa,
          creditsAttempted: term.creditsAttempted,
          creditsEarned: term.creditsEarned,
          cgpa: cumulative.cgpa,
        });
        profileRows.push({
          studentId,
          cgpa: cumulative.cgpa,
          creditsEarned: cumulative.creditsEarned,
        });

        const profile = profileById.get(studentId);
        if (profile !== undefined) {
          notify.push({
            userId: profile.userId,
            email: profile.user.email,
            firstName: profile.user.firstName,
            gpa: decimal(term.gpa),
            cgpa: decimal(cumulative.cgpa),
          });
        }
      }

      await upsertSemesterResults(tx, semesterId, publishedAt, resultRows);
      await updateStudentProfiles(tx, profileRows);
      await updateEnrollmentStatuses(tx, statusRows);
      await tx.courseOffering.updateMany({
        where: {
          semesterId,
          deletedAt: null,
          status: { not: OfferingStatus.CANCELLED },
        },
        data: { status: OfferingStatus.COMPLETED },
      });
      await tx.semester.update({
        where: { id: semesterId },
        data: { status: SemesterStatus.COMPLETED, resultPublishedAt: publishedAt },
        select: { id: true },
      });
      await createAuditLog(tx, {
        actorId,
        action: AuditAction.RESULT_PUBLISH,
        entity: 'Semester',
        entityId: semesterId,
        after: {
          students: resultRows.length,
          enrollments: thisSemester.length,
          statusChanges: statusRows.length,
        },
      });

      return {
        name: semester.name,
        students: resultRows.length,
        enrollments: thisSemester.length,
        notify,
        publishedAt,
      };
    },
    { timeout: PUBLISH_TIMEOUT_MS, maxWait: PUBLISH_MAX_WAIT_MS },
  );

  await invalidateResultCaches();
  queueResultNotifications(published.name, published.notify);

  const elapsedMs = Date.now() - started;
  console.log(
    `> RESULT_PUBLISH ${published.name}: ${published.students} students, ${published.enrollments} enrollments, ${elapsedMs}ms`,
  );

  return {
    semesterId,
    name: published.name,
    students: published.students,
    enrollments: published.enrollments,
    publishedAt: published.publishedAt.toISOString(),
    elapsedMs,
  };
};

const queueResultNotifications = (semesterName: string, rows: PublishNotify[]): void => {
  void (async () => {
    try {
      for (const group of chunk(rows, WRITE_CHUNK_SIZE)) {
        await prisma.notification.createMany({
          data: group.map((row) => ({
            userId: row.userId,
            type: NotificationType.RESULT,
            title: `${semesterName} results published`,
            body: `Your GPA is ${row.gpa}. Your CGPA is now ${row.cgpa}.`,
            link: '/students/me/transcript',
          })),
        });
      }
    } catch (error) {
      console.error('[result] failed to insert result notifications', error);
    }

    for (const row of rows) {
      void sendEmail({
        to: row.email,
        subject: `Your ${semesterName} results are published`,
        template: 'resultPublished',
        data: {
          firstName: row.firstName,
          semesterName,
          gpa: row.gpa,
          cgpa: row.cgpa,
        },
      });
    }
  })();
};

type TranscriptCourse = {
  enrollmentId: string;
  courseId: string;
  code: string;
  title: string;
  credits: string;
  letterGrade: LetterGrade;
  gradePoint: string | null;
  superseded: boolean;
  supersededBy: string | null;
};

type TranscriptSemester = {
  semesterId: string;
  name: string;
  term: string;
  year: number;
  gpa: string;
  creditsAttempted: string;
  creditsEarned: string;
  cgpaSnapshot: string;
  publishedAt: string | null;
  courses: TranscriptCourse[];
};

const loadTranscript = async (studentId: string) => {
  const profile = await prisma.studentProfile.findFirst({
    where: { id: studentId, deletedAt: null },
    select: {
      id: true,
      studentId: true,
      cgpa: true,
      totalCreditsEarned: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });
  if (profile === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Student profile not found');
  }

  const results = await prisma.semesterResult.findMany({
    where: { studentId, isPublished: true },
    select: {
      gpa: true,
      creditsAttempted: true,
      creditsEarned: true,
      cgpaSnapshot: true,
      publishedAt: true,
      semester: {
        select: { id: true, name: true, term: true, year: true },
      },
    },
  });

  const publishedSemesterIds = results.map((row) => row.semester.id);
  const enrollments =
    publishedSemesterIds.length === 0
      ? []
      : await prisma.enrollment.findMany({
          where: {
            studentId,
            letterGrade: { not: null },
            offering: { semesterId: { in: publishedSemesterIds }, deletedAt: null },
          },
          select: {
            id: true,
            letterGrade: true,
            gradePoint: true,
            offering: {
              select: {
                courseId: true,
                semesterId: true,
                semester: { select: { name: true } },
                course: { select: { code: true, title: true, credits: true } },
              },
            },
          },
          orderBy: { enrolledAt: 'asc' },
        });

  const bestByCourse = new Map<
    string,
    { enrollmentId: string; point: Prisma.Decimal; semesterName: string }
  >();
  for (const row of enrollments) {
    if (row.letterGrade === null || !countsTowardGpa(row.letterGrade)) {
      continue;
    }
    const point = row.gradePoint ?? gradeToPoint(row.letterGrade) ?? new Prisma.Decimal(0);
    const current = bestByCourse.get(row.offering.courseId);
    if (current === undefined || point.gt(current.point)) {
      bestByCourse.set(row.offering.courseId, {
        enrollmentId: row.id,
        point,
        semesterName: row.offering.semester.name,
      });
    }
  }

  const coursesBySemester = new Map<string, TranscriptCourse[]>();
  for (const row of enrollments) {
    if (row.letterGrade === null) {
      continue;
    }
    const winner = bestByCourse.get(row.offering.courseId);
    const point = row.gradePoint ?? gradeToPoint(row.letterGrade);
    const superseded =
      countsTowardGpa(row.letterGrade) && winner !== undefined && winner.enrollmentId !== row.id;

    const list = coursesBySemester.get(row.offering.semesterId) ?? [];
    list.push({
      enrollmentId: row.id,
      courseId: row.offering.courseId,
      code: row.offering.course.code,
      title: row.offering.course.title,
      credits: credits(row.offering.course.credits),
      letterGrade: row.letterGrade,
      gradePoint: point === null ? null : decimal(point),
      superseded,
      supersededBy: superseded ? (winner?.semesterName ?? null) : null,
    });
    coursesBySemester.set(row.offering.semesterId, list);
  }

  const semesters: TranscriptSemester[] = results
    .slice()
    .sort((a, b) => {
      if (a.semester.year !== b.semester.year) {
        return a.semester.year - b.semester.year;
      }
      return TERM_ORDER[a.semester.term] - TERM_ORDER[b.semester.term];
    })
    .map((row) => ({
      semesterId: row.semester.id,
      name: row.semester.name,
      term: row.semester.term,
      year: row.semester.year,
      gpa: decimal(row.gpa),
      creditsAttempted: credits(row.creditsAttempted),
      creditsEarned: credits(row.creditsEarned),
      cgpaSnapshot: decimal(row.cgpaSnapshot),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      courses: (coursesBySemester.get(row.semester.id) ?? []).sort((a, b) =>
        a.code.localeCompare(b.code),
      ),
    }));

  return {
    student: {
      id: profile.id,
      studentId: profile.studentId,
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
    },
    semesters,
    cumulative: {
      cgpa: decimal(profile.cgpa),
      creditsEarned: credits(profile.totalCreditsEarned),
    },
  };
};

const getMyResults = async (studentId: string, query: IMyResultsQuery) => {
  const transcript = await loadTranscript(studentId);
  if (query.semesterId === undefined) {
    return transcript.semesters;
  }
  const semester = transcript.semesters.find((row) => row.semesterId === query.semesterId);
  if (semester === undefined) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Results for this semester are not published yet');
  }
  return semester;
};

const getMyTranscript = async (studentId: string) =>
  cached(cacheKeys.transcript(studentId), CACHE_TTL.transcript, () => loadTranscript(studentId));

const getTranscriptByStudentId = async (studentId: string) => loadTranscript(studentId);

export const ResultService = {
  previewGrades,
  submitGrades,
  patchGrade,
  getReadiness,
  publishResults,
  getMyResults,
  getMyTranscript,
  getTranscriptByStudentId,
};
